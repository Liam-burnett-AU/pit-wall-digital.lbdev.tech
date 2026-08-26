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
export const GROQ_PROXY_URL = "https://groq-proxy.liamburnett40.workers.dev";
export const GROQ_MODEL = "openai/gpt-oss-120b";
// Vision model for photo feedback — check console.groq.com/docs/models if
// this ever stops working.
export const VISION_MODEL = "qwen/qwen3.6-27b";

// FIRST's official FTC Events API, via a separate Worker proxy — the
// FTC_EVENTS_USERNAME / FTC_EVENTS_API_KEY live as Worker secrets.
export const FTC_EVENTS_PROXY_URL = "https://ftc-events-proxy.liamburnett40.workers.dev";
// Season year the competition started in — e.g. the 2026-2027 season is "2026".
export const FTC_EVENTS_SEASON = "2026";

// Cloudinary — free file storage, unsigned upload straight from the browser.
export const CLOUDINARY_CLOUD_NAME = "dmht3gpl";
export const CLOUDINARY_UPLOAD_PRESET = "LB Dev";

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// Renders trusted-ish Markdown (AI output) to sanitised HTML. Falls back to
// plain escaped text if the marked/DOMPurify CDN scripts didn't load.
export function renderMarkdown(text) {
  if (!text) return '';
  if (!window.marked || !window.DOMPurify) return escapeHtml(text);
  return window.DOMPurify.sanitize(window.marked.parse(text, { breaks: true }));
}

export function toast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}

// ===== Third-party API calls =====

export async function ftcTeamSearch(query) {
  const res = await fetch(`https://api.ftcscout.org/rest/v1/teams/search?searchText=${encodeURIComponent(query)}&limit=5`);
  if (!res.ok) throw new Error('Search failed (' + res.status + ')');
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
    <a href="${i.href}" class="${i.key === activeKey ? 'active' : ''}">
      <span class="icon">${i.icon}</span>${i.label}
    </a>`).join('');

  return `
    <div class="mobile-topbar">
      <div class="brand-mini"><span class="mark">PW</span> Pit Wall</div>
      <button class="hamburger-btn" id="navHamburger" aria-label="Open menu">☰</button>
    </div>
    <div class="sidebar-scrim" id="sidebarScrim"></div>
    <aside class="sidebar" id="appSidebar">
      <div class="sidebar-brand">
        <span class="mark">PW</span>
        <span class="name">Pit Wall<small>FTC Team Hub</small></span>
      </div>
      <nav class="sidebar-nav">${items}</nav>
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

  function closeNav() {
    sidebar?.classList.remove('open');
    scrim?.classList.remove('open');
  }

  hamburger?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    scrim?.classList.toggle('open');
  });
  scrim?.addEventListener('click', closeNav);
  sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));

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
