# LifeBalance

A simple, colourful, mobile-friendly lifestyle planner: **Today, Habits, Journal, Events, Wellness (Fitness & Food) and Progress**.

Last updated: **2026-10-29**. Requirements and the v1 review are in [REQUIREMENTS.md](REQUIREMENTS.md).

## Run it

The app is static. Serve the folder over http(s) (the service worker does not work from `file://`):

    npx serve .        # or: python -m http.server 8080

Open http://localhost:3000 (or :8080).

## Where your data is stored

- All personal data (tasks, habits, journal, events, fitness, food) stays in **this browser's localStorage** (`lifebalance.v2`). Nothing is uploaded unless you enable closed-app reminders.
- Demo data is kept separately (`lifebalance.demo`) and never changes your own data.
- There are no accounts and no cross-device sync. Use **Settings → Export backup** to move data between devices.
- If you enable closed-app reminders, only the reminder **time and notification text** go to your push server. By default the text is generic ("You have a reminder."); appointment, health and food details are never sent unless you turn on "Show details in notifications".

## Reminders

- **In-app alerts** (all reminder offsets, custom offsets, snooze, dismiss, test alert) work while the app is open. Past reminder times are skipped and duplicates are prevented.
- **Browser notifications** need permission, requested when you enable alerts.
- **Closed-app delivery** needs the push server in `server/` plus a service worker, Web Push and an always-on host. The app only shows "scheduled" after the server confirms the schedule.

### Push server

    cd server
    npm install
    npm start          # http://localhost:8787
    npm test

Environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | Listen port (default 8787) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys. If unset, keys are generated into `server/data/vapid.json` (mode 0600). Keep the private key on the server only. |
| `VAPID_SUBJECT` | `mailto:you@example.com` contact |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API (e.g. your GitHub Pages URL) |

Security: each device registers and receives a random token; the server stores only its SHA-256 hash and gives each device access to its own schedule only. Requests are rate limited. Data is a JSON file in `server/data/` (not encrypted at rest; use disk encryption on your host). Delete a device's data any time from Settings.

Costs: `web-push` is free and browsers' push services are free. You pay only for hosting. GitHub Pages is static only and **cannot** run the server; use any always-on Node host (free tiers may sleep, which delays reminders).

## Tests

    node tests/core.test.js          # or: node --test tests   (core logic)
    cd server; npm test              # push server
    cd tests; npm i; node e2e.js     # browser tests (needs Chrome; mobile + desktop)

## v4 update (last updated 2026-10-29)

**Added:** simple "Enable reminders" flow with five separate statuses (device support, permission, server connection, scheduling, delivery); server address moved under "Advanced"; the "This device receives reminders" switch also governs snoozes; snooze from a notification works while the app is closed (server-side); cancellations and edits sync to the server; accounts with per-user AES-256-GCM encrypted storage, hourly backups (newest 30), three-way-merge sync with a conflicts list (never silently overwrites) and consented migration of browser data; food audit (ingredient quantities per serving, labels derived from ingredients, uncertain items marked unverified, halal never asserted, no "allergy-safe" claims); portions in the meal plan and a shopping list that combines matching items and scales by portions; .ics export with reminder alarms (VALARM); Today dashboard and Wellness simplified (forms open from "Log workout", "Add meal", "Add to plan", "Edit goals").

### Configuration
- `config.js`: set `serverUrl` to your deployed server (blank = same origin). Users never see this.
- Server env: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (+ subject), `LB_DATA_KEY` (encryption master key; auto-generated into `server/data/datakey` if unset, so back it up), `ALLOWED_ORIGINS`, `PORT`. Credentials stay on the server.
- Needs an always-on HTTPS Node host. Cost: hosting (free tiers may sleep and delay reminders) and optionally a domain. Web Push itself is free.

### Test results (Chrome on Windows only)
core/calendar/merge/food unit tests 34+ pass; server tests 20 pass; smoke and browser e2e (375px and 1280px) pass.

### Verified vs not verified
| Item | Status |
|---|---|
| Dashboard, Wellness forms, demo mode, drafts, import/export, undo, .ics (alarms, recurring, cancellations, time zones), offline reload, in-app alert/snooze | Automated tests |
| Accounts, encrypted storage, revisions/409 conflicts, backups, snooze route, scheduler | Server tests (fake sender) |
| Three-way merge | Unit tests |
| Client sync against a live server in a browser, offline-edit then reconnect | **Not tested end to end** |
| Real closed-app push and "delivery verified" on any OS | **Not verified** (no push service or devices here) |
| Android, iOS/iPadOS, macOS, Linux, Safari, Firefox, Edge | **Not tested** |
| Email verification / password reset | **Not built** (forgotten password = data unrecoverable) |
| Apple Calendar | .ics download only; exports are copies and do not sync |
## Known limitations

- Closed-app push is covered by server tests and a mocked client; it has **not** been verified end to end with a real push service or device.
- No automatic step counting, wearable sync or food-photo analysis: logging is manual.
- No nutrition database. Calories and nutrients appear only if you enter them and are labelled as your own estimates. Diet and allergen tags on built-in meals are best-effort: always check ingredients.
- Not medical advice; wellbeing guidance is general only.
- Metric units only.
- Reminders are sent to the server for the next 45 days only (re-synced while the app is used).
- Edited single occurrences of a recurring event use the series' reminder offsets.
- Migrated v1 history cannot recover past goal changes.
- Closed-app snooze needs the server and a verified push subscription; unverified here.
- iOS needs the app added to the Home Screen for Web Push.
- Shopping quantities are scaled estimates from per-serving amounts; deleted auto items may return when the plan changes.
- Accounts exist but are untested on a real host; no email verification or password reset.

Powered by Lamb Technologies

## Global-use improvements — 2026-10-29

- Settings → Region & units: device/default or chosen date region; 12/24-hour appointment display; metric or imperial fitness entry and display. Interface remains English.
- Fitness records continue to use kg/km internally. Switching units does not rewrite history. Recipe quantities retain their labelled units. Settings are per-device.
- Today places suggestions below the daily plan and history. Existing quick-add remains available.
- Account forms check backend availability before they are shown. This does not deploy a backend or complete the pending verification/recovery frontend integration.
- Settings records the last requested backup export and encourages regular exports; downloading is controlled by the browser.
- Validation: 37 existing tests plus 4 regional/measurement tests pass. Real-device push, signed-in cross-device sync, native packaging and full translations are not verified or completed by this update.
