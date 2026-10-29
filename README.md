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

## Known limitations

- Closed-app push is covered by server tests and a mocked client; it has **not** been verified end to end with a real push service or device.
- No automatic step counting, wearable sync or food-photo analysis: logging is manual.
- No nutrition database. Calories and nutrients appear only if you enter them and are labelled as your own estimates. Diet and allergen tags on built-in meals are best-effort: always check ingredients.
- Not medical advice; wellbeing guidance is general only.
- Metric units only.
- Reminders are sent to the server for the next 45 days only (re-synced while the app is used).
- Edited single occurrences of a recurring event use the series' reminder offsets.
- Migrated v1 history cannot recover past goal changes.
- Snooze works only while the app is open.
- iOS needs the app added to the Home Screen for Web Push.
- Auto-generated shopping items have no computed quantities; deleted auto items may return when the plan changes.
- Per-device token auth only (no user accounts).

Powered by Lamb Technologies
