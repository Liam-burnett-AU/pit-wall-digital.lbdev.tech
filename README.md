# Pit Wall

Pit Wall is a team hub for FIRST Tech Challenge (FTC) robotics teams — one place to manage your team account, track your robot, scout opponents, browse events with AI-generated performance analysis, keep an engineering notebook with instant AI feedback, and ask a context-aware AI assistant questions about your own team's data.

Live at **[pit-wall-digital.lbdev.tech](https://pit-wall-digital.lbdev.tech)**.

## Features

- **Team accounts** — sign up/log in with Firebase Auth; team number and name are looked up live from [FTCScout](https://ftcscout.org) as you type.
- **Dashboard** — quick links and a snapshot of your robot profile.
- **Robot profile** — log your drivetrain, game piece mechanism, and autonomous routine; this feeds the AI chat and event analysis.
- **Scouting** — log opponent teams you see at events (drivetrain, scoring capability, driver skill, notes), with a driver-skill chart and CSV export.
- **Schedule** — pulls your team's match schedule for the current season straight from FIRST's official FTC Events API.
- **Events** — every event your team is registered for, past and upcoming, across multiple seasons. Pick a past event to see your record, browse **Our Matches**, **All Matches**, or the full **Teams** list, click into any match or team for a popup with everything both the FTC Events API and FTCScout API know about it, and generate AI feedback — a whole-event breakdown by Driver/Programmer/Builder, plus a quick AI comment on any individual match.
- **AI Chat** — ask questions about strategy, your robot, or the competition; the assistant is given your team, robot, scouting, and notebook data as context. Supports Markdown and LaTeX.
- **Engineering Notebook** — log session entries and get instant AI feedback on each one (shown right in the list, no need to open anything), upload photos of physical notebook pages for AI feedback, upload a finished PDF/Word notebook for a holistic AI review, or have the AI pull your robot profile and every logged session together into a complete, judge-ready notebook write-up you can download.
- **Pit Checklist** — a customisable pre-competition checklist.
- **Settings** — manage your account, team info, and chat history; see roughly how much data your account has stored (in MB) with a button to wipe it all while keeping your login, or delete the account entirely; shows the current app version.

## Tech stack

Pit Wall is a static site — plain HTML/CSS/JS, no build step, no framework. It's designed to run entirely on free tiers:

| Purpose | Service |
|---|---|
| Auth + database | [Firebase](https://firebase.google.com/) (Auth + Firestore) |
| File storage (notebook photos/docs) | [Cloudinary](https://cloudinary.com/) (unsigned uploads) |
| AI chat completions | [Groq](https://groq.com/), called through a Cloudflare Worker proxy so the API key never reaches the browser |
| Official FTC event/team/match data | [FIRST's FTC Events API](https://ftc-events.firstinspires.org/api-docs), called through a second Cloudflare Worker proxy |
| Community FTC stats (OPR/DPR/CCWM, team profiles) | [FTCScout API](https://api.ftcscout.org/) — public and CORS-enabled, called directly from the browser |
| Hosting | GitHub Pages, with a custom domain via `CNAME` |

## Project structure

```
index.html                  Login / signup
dashboard.html               Team dashboard
robot-profile.html          Robot profile form
scouting.html                Opponent scouting log
schedule.html                Match schedule (current season)
events.html                   Past/upcoming events, results, AI analysis
chat.html                    AI chat
engineering-notebook.html   Notebook entries, photos, final doc review
pit-checklist.html          Pit checklist
settings.html                 Account/team settings
assets/style.css              Shared design system (tokens, layout, components)
assets/app.js                 Shared config + helpers (Firebase config, nav, toasts,
                              markdown rendering, API calls) imported by every page
firestore.rules               Firestore security rules — see below
```

Every page pulls its Firebase config, third-party API helpers, toast notifications, and sidebar navigation from `assets/app.js`, and its visual design from `assets/style.css`, so there's one place to update either.

## Configuration

To run your own copy, set these in **`assets/app.js`**:

- `firebaseConfig` — your Firebase project config (this is safe to be public; real access control is enforced by `firestore.rules`, not by hiding this).
- `GROQ_PROXY_URL` / `FTC_EVENTS_PROXY_URL` — URLs of your own deployed Cloudflare Worker proxies. These proxies exist so the Groq API key and FTC Events API credentials stay server-side as Worker secrets, never in this repo.
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` — your Cloudinary cloud name and an **unsigned** upload preset.
- `FTC_EVENTS_SEASON` — the season FTC Events API calls default to (e.g. `"2026"` for the 2026-2027 season).

### Firestore rules

`firestore.rules` locks every collection Pit Wall uses to "only the signed-in user whose `uid` matches the document path can read or write it." It isn't deployed automatically — paste it into **Firebase Console → Firestore Database → Rules**, or run:

```
firebase deploy --only firestore:rules
```

## Deployment

This is a static site with no build step — GitHub Pages serves the `main` branch directly. Push to `main` and it's live.

## Versioning

`APP_VERSION` in `assets/app.js` is shown at the bottom of the Settings page. Bump it with every change that ships — patch (`1.0.x`) for fixes/tweaks, minor (`1.x.0`) for new features, major (`x.0.0`) for a significant redesign or breaking change.

---

Built as a Digital Technologies assessment project (Sheldon College, Term 2 2026).
