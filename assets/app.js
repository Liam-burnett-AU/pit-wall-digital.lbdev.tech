// Shared config + helpers used by every Pit Wall page.
// Firebase SDK calls stay in each page (so pages only import the pieces
// they actually use) — this module holds the config value plus the
// app-specific glue: nav, toasts, markdown, and the third-party API calls.

export const firebaseConfig = {
  apiKey: "AIzaSyDxEHi2ug0DvkzPR06EKdXYtJ69KSGUmus",
  authDomain: "lb-dev-2444f.firebaseapp.com",
  projectId: "lb-dev-2444f",
  storageBucket: "lb-dev-2444f.firebasestorage.app",
  messagingSenderId: "262360112421",
  appId: "1:262360112421:web:828d6f1ff00024a3be0ecc"
};

// Groq (chat completions) via a Cloudflare Worker proxy — the Groq API key
// lives as a Worker secret, never here or sent to the browser.
export const GROQ_PROXY_URL = "https://groq-proxy.lbdevelopment.workers.dev";
export const GROQ_MODEL = "openai/gpt-oss-120b";
// Vision model for photo feedback — check console.groq.com/docs/models if
// this ever stops working.
export const VISION_MODEL = "qwen/qwen3.6-27b";

// FIRST's official FTC Events API, via a separate Worker proxy — the
// FTC_EVENTS_USERNAME / FTC_EVENTS_API_KEY live as Worker secrets.
export const FTC_EVENTS_PROXY_URL = "https://ftc-events-proxy.lbdevelopment.workers.dev";
// Season year the competition started in — e.g. the 2026-2027 season is "2026".
export const FTC_EVENTS_SEASON = "2026";

// Cloudinary — free file storage, unsigned upload straight from the browser.
export const CLOUDINARY_CLOUD_NAME = "dmht3gpl";
export const CLOUDINARY_UPLOAD_PRESET = "LB Dev";

// Escapes for both text-node and attribute-value contexts (quotes included)
// since output from this is used in both places all over the app.
export function escapeHtml(str) {
  return (str == null ? '' : String(str))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Renders trusted-ish Markdown (AI output) to sanitised HTML. Falls back to
// plain escaped text if the marked/DOMPurify CDN scripts didn't load.
export function renderMarkdown(text) {
  if (!text) return '';
  if (!window.marked || !window.DOMPurify) return escapeHtml(text);
  return window.DOMPurify.sanitize(window.marked.parse(text, { breaks: true }));
}

function humanizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function formatKeyValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map(v => (v && typeof v === 'object' ? JSON.stringify(v) : v)).join(', ');
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return null;
    return entries.map(([k, v]) => `${humanizeKey(k)}: ${v && typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// Renders an arbitrary API response object as a grid of label/value pairs —
// used for the "everything the API returned" sections of the match/team
// modals, so new fields FIRST or FTCScout add just show up automatically
// instead of needing a hardcoded field list per endpoint.
export function renderKeyValueList(obj, opts = {}) {
  const skip = new Set(opts.skip || []);
  if (!obj || typeof obj !== 'object') {
    return '<p class="faint" style="font-size:13px;">No data available.</p>';
  }

  const rows = Object.entries(obj)
    .filter(([k]) => !skip.has(k) && !k.startsWith('_'))
    .map(([k, v]) => [humanizeKey(k), formatKeyValue(v)])
    .filter(([, v]) => v !== null);

  if (rows.length === 0) {
    return '<p class="faint" style="font-size:13px;">No data available.</p>';
  }

  return `<div class="kv-grid">${rows.map(([k, v]) => `
    <div class="kv-item"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>
  `).join('')}</div>`;
}

export function toast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

// ===== Third-party API calls =====

// FTCScout — community-run stats (OPR/DPR/CCWM, team profiles). Public,
// CORS-enabled, called straight from the browser like FIRST's own search.
export const FTCSCOUT_API_BASE = "https://api.ftcscout.org/rest/v1";

export async function ftcTeamSearch(query) {
  const res = await fetch(`${FTCSCOUT_API_BASE}/teams/search?searchText=${encodeURIComponent(query)}&limit=5`);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
  return res.json();
}

// Generic FTCScout GET. Returns null on a 404 (e.g. a team with no data
// for that season) rather than throwing, since that's an expected,
// non-error outcome callers should handle quietly.
export async function ftcScoutFetch(path) {
  const res = await fetch(`${FTCSCOUT_API_BASE}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`FTCScout API returned ${res.status}`);
  return res.json();
}

export async function ftcEventsFetch(path) {
  const res = await fetch(`${FTC_EVENTS_PROXY_URL}/?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`FTC Events proxy returned ${res.status}${errBody ? ': ' + errBody : ''}`);
  }
  return res.json();
}

// The FTC Events API scopes everything to a single season, so a team's
// event history lives across several past `/{season}/events` calls, not
// one. This fetches the current season plus this many prior ones and
// merges them — each returned event carries a `_season` field so callers
// know which season's endpoints (matches, rankings, ...) to use for it.
export const FTC_EVENTS_SEASONS_LOOKBACK = 5;

export async function fetchTeamEventsAcrossSeasons(teamNumber, seasonsBack = FTC_EVENTS_SEASONS_LOOKBACK) {
  const currentSeason = parseInt(FTC_EVENTS_SEASON, 10);
  const seasons = Array.from({ length: seasonsBack }, (_, i) => currentSeason - i);

  const results = await Promise.allSettled(
    seasons.map(season =>
      ftcEventsFetch(`/${season}/events?teamNumber=${teamNumber}`).then(data => ({ season, events: data.events || [] }))
    )
  );

  const merged = [];
  let anyFulfilled = false;
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      anyFulfilled = true;
      r.value.events.forEach(e => merged.push({ ...e, _season: r.value.season }));
    }
  });

  if (!anyFulfilled) {
    // every season request failed — surface the first error rather than silently returning nothing
    throw results[0].reason;
  }

  return merged;
}

export async function callGroq(messages, model) {
  const res = await fetch(GROQ_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model: model || GROQ_MODEL })
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    let errMsg = `Worker returned status ${res.status}`;
    try { errMsg = JSON.parse(errBody).error || errMsg; } catch (e) { /* not JSON */ }
    throw new Error(errMsg);
  }
  return res.json();
}

export async function uploadToCloudinary(file, resourceType) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed (${res.status}): ${errBody}`);
  }
  const data = await res.json();
  return data.secure_url;
}

// ===== FTC team number/name lookup (signup, scouting, settings) =====

export function wireTeamLookup({ numberInputId, nameInputId, statusId, dropdownId }) {
  let debounceTimer = null;
  const numberInput = document.getElementById(numberInputId);
  const nameInput = document.getElementById(nameInputId);
  const status = document.getElementById(statusId);
  const dropdown = document.getElementById(dropdownId);
  if (!numberInput || !nameInput || !status || !dropdown) return;

  function renderResults(teams) {
    dropdown.innerHTML = '';
    if (!teams || teams.length === 0) {
      dropdown.innerHTML = '<div class="result-empty">No matching FTC teams found.</div>';
      dropdown.classList.add('open');
      return;
    }
    teams.slice(0, 5).forEach((team) => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `<span class="result-number">#${team.number}</span><span class="result-name">${escapeHtml(team.name || 'Unnamed team')}</span>`;
      item.addEventListener('click', () => {
        numberInput.value = team.number;
        nameInput.value = team.name || '';
        dropdown.classList.remove('open');
        status.textContent = `Selected: #${team.number} — ${team.name || 'Unnamed team'}`;
        status.className = 'lookup-status success';
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.add('open');
  }

  numberInput.addEventListener('input', () => {
    nameInput.value = '';
    status.textContent = '';
    status.className = 'lookup-status';
    clearTimeout(debounceTimer);

    const q = numberInput.value.trim();
    if (!q) {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      status.textContent = 'Searching...';
      try {
        const teams = await ftcTeamSearch(q);
        renderResults(teams);
        status.textContent = teams.length ? `${teams.length} match${teams.length === 1 ? '' : 'es'} found` : '';
      } catch (err) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('open');
        status.textContent = "Couldn't reach the FTC team database. You can type the name manually.";
        status.className = 'lookup-status error';
        nameInput.readOnly = false;
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!numberInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

// ===== App shell navigation =====

const NAV_ITEMS = [
  { key: 'dashboard', href: 'dashboard.html', icon: '🏁', label: 'Dashboard' },
  { key: 'robot', href: 'robot-profile.html', icon: '🤖', label: 'Robot' },
  { key: 'scouting', href: 'scouting.html', icon: '🔍', label: 'Scouting' },
  { key: 'schedule', href: 'schedule.html', icon: '📅', label: 'Schedule' },
  { key: 'events', href: 'events.html', icon: '🏆', label: 'Events' },
  { key: 'chat', href: 'chat.html', icon: '💬', label: 'AI Chat' },
  { key: 'notebook', href: 'engineering-notebook.html', icon: '📓', label: 'Notebook' },
  { key: 'checklist', href: 'pit-checklist.html', icon: '✅', label: 'Checklist' },
  { key: 'settings', href: 'settings.html', icon: '⚙️', label: 'Settings' }
];

export function renderNav(activeKey) {
  const items = NAV_ITEMS.map(i => `
    <a href="${i.href}" class="${i.key === activeKey ? 'active' : ''}"${i.key === activeKey ? ' aria-current="page"' : ''}>
      <span class="icon" aria-hidden="true">${i.icon}</span>${i.label}
    </a>`).join('');

  return `
    <a href="#mainContent" class="skip-link">Skip to main content</a>
    <div class="mobile-topbar">
      <div class="brand-mini"><span class="mark" aria-hidden="true">PW</span> Pit Wall</div>
      <button class="hamburger-btn" id="navHamburger" aria-label="Open menu" aria-expanded="false" aria-controls="appSidebar">☰</button>
    </div>
    <div class="sidebar-scrim" id="sidebarScrim"></div>
    <aside class="sidebar" id="appSidebar">
      <div class="sidebar-brand">
        <span class="mark" aria-hidden="true">PW</span>
        <span class="name">Pit Wall<small>FTC Team Hub</small></span>
      </div>
      <nav class="sidebar-nav" aria-label="Main">${items}</nav>
      <div class="sidebar-foot">
        <span class="sidebar-team-chip" id="teamChip">Loading…</span>
        <button class="sidebar-signout" id="sidebarSignout">Sign out</button>
      </div>
    </aside>
  `;
}

// Wires the hamburger/scrim toggle and the sign-out button. `signOutFn`
// is passed in so this module doesn't need its own Firebase Auth import.
export function wireNav(auth, signOutFn) {
  const sidebar = document.getElementById('appSidebar');
  const scrim = document.getElementById('sidebarScrim');
  const hamburger = document.getElementById('navHamburger');
  const signoutBtn = document.getElementById('sidebarSignout');

  function setOpen(open) {
    sidebar?.classList.toggle('open', open);
    scrim?.classList.toggle('open', open);
    hamburger?.setAttribute('aria-expanded', String(open));
  }

  hamburger?.addEventListener('click', () => setOpen(!sidebar?.classList.contains('open')));
  scrim?.addEventListener('click', () => setOpen(false));
  sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));

  signoutBtn?.addEventListener('click', async () => {
    try {
      await signOutFn(auth);
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      toast("Couldn't sign out — try again.", 'error');
    }
  });
}

export function setTeamChip(team) {
  const el = document.getElementById('teamChip');
  if (el) el.textContent = `#${team.teamNumber || '—'} ${team.competition || 'FTC'}`;
}

// ===== Accessible modal open/close =====
// Shared by every page with a #modalOverlay/.modal-panel popup. Handles
// what each page used to duplicate (Escape to close, click outside to
// close) plus what they didn't have: marking the dialog up for screen
// readers, trapping Tab inside it while open, and returning keyboard
// focus to whatever opened it once it closes.

const modalStates = {};

export function openModal(overlayId, triggerEl) {
  const overlay = document.getElementById(overlayId);
  const panel = overlay?.querySelector('.modal-panel');
  if (!overlay || !panel) return;

  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  panel.setAttribute('tabindex', '-1');
  overlay.classList.remove('hidden');

  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusable = () => Array.from(panel.querySelectorAll(focusableSelector)).filter(el => el.offsetParent !== null);

  (focusable()[0] || panel).focus({ preventScroll: true });

  const keydownHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(overlayId);
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', keydownHandler);

  const clickOutsideHandler = (e) => {
    if (e.target === overlay) closeModal(overlayId);
  };
  overlay.addEventListener('click', clickOutsideHandler);

  modalStates[overlayId] = {
    triggerEl: triggerEl || document.activeElement,
    keydownHandler,
    clickOutsideHandler
  };
}

export function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  const state = modalStates[overlayId];
  if (!overlay) return;

  overlay.classList.add('hidden');

  if (state) {
    document.removeEventListener('keydown', state.keydownHandler);
    overlay.removeEventListener('click', state.clickOutsideHandler);
    if (state.triggerEl && typeof state.triggerEl.focus === 'function') {
      state.triggerEl.focus({ preventScroll: true });
    }
    delete modalStates[overlayId];
  }
}
