# LifeBalance – requirements

Last updated: 2026-10-29

## Review of v1 (existing code)

| Finding | Resolution |
|---|---|
| "Load sample data" replaced personal data | Separate demo mode with its own storage key; personal data is never read or written while in demo |
| Journal text lost when switching tabs/mood | Draft (mood + note) autosaved into state on every keystroke |
| Historical progress used *today's* goals and habit list | Habits carry `createdAt`, `archivedAt` and a `goalHistory`; each past day uses the goals/habits that applied then |
| Unfinished tasks from earlier days were unreachable | Overdue card on Today + task history |
| Achievements were recalculated, so deleting data lost them | Earned achievements stored permanently with the date earned |
| No backup | JSON export/import with validation + confirmation; automatic pre-import / pre-clear backups |
| Deletes were final; "Clear all" confirmation only | Undo toast for individual deletions; confirmation + undo for clear-all |
| Chart "Habit goals met (%)" actually showed average progress | Renamed "Average habit progress (%)" |
| Data key `lifebalance.v1` | Migrated to `lifebalance.v2`; v1 key is left untouched as a permanent backup |

## Functional requirements

1. **Existing (kept):** daily planner with 3 priorities; habits (water, walking, exercise, reading, sleep, custom, adjustable goals); mood journal with private notes; weekly dashboard (charts, streaks, achievements); suggestions; local persistence; sample data; clear data; footer "Powered by Lamb Technologies".
2. **Navigation:** Today, Habits, Journal, Events, Wellness, Progress; Settings via the header button.
3. **Events & appointments:** General, School, GP, Hospital, Meetings, Weddings, Travel, Other. Create/edit/cancel/delete; title, category, date, start/end, location, notes, contact; all-day; recurring (daily/weekly/monthly/yearly, interval, end date); travel (departure/return, time zones, booking reference); edit/cancel one occurrence or the series; calendar + upcoming list; search; category filter; Today dashboard shows upcoming events and overdue tasks.
4. **Reminders:** 14d, 7d, 3d, 1d, 2h, 30m before and at event time; custom offsets; per event; exact times previewed before saving; past reminders skipped; recalculated when events change; de-duplicated; notification settings, test alert, snooze, dismiss; correct across time zones and DST.
5. **Delivery:** in-app alerts, browser notifications, and (with the optional server) Web Push via a service worker for closed-app delivery. Never claims "scheduled" unless the server confirmed.
6. **Privacy:** data stays on the device; notification previews are generic by default; the server stores only reminder times + opaque text.
7. **Fitness:** goals, weekly plan, logging (walking, running, cycling, gym, custom; duration, distance, sets/reps/weight), history, weekly progress, optional weight tracking, adjustable workout reminders, no double counting with the Walking/Exercise habits.
8. **Food:** diary (breakfast, lunch, dinner, snacks, water), weekly meal plan, editable auto-generated shopping list, African + international meals, dietary preferences / allergies / exclusions, favourites, custom recipes, portions, optional calorie/nutrient tracking labelled as estimates, optional meal + hydration reminders.
9. **Connected dashboard:** Today shows workouts, meals, water, tasks, appointments. Weekly fitness/food summaries in Wellness and Progress.
10. **Health safeguards:** general wellbeing guidance only; no diagnosis or medical diets; weight and calorie targets optional; health details hidden from notification previews by default.

## v4 requirements (documented before implementation)

R1. **Enable reminders flow.** One button runs: device support check → notification permission → server connection → push subscription → scheduling. Server address is not shown on ordinary screens (deployer sets `config.js`; same origin is the default; an "Advanced" disclosure is allowed for self-hosters only). Settings shows five separate statuses: Device support, Permission, Server connection, Scheduling, Delivery. "Delivery verified" is shown only after a test push was actually received by this device's service worker.
R2. **Reminder controls.** "This device receives reminders" gates in-app alerts, browser notifications, snoozed alerts and the server schedule. Changes/cancellations are synced to the server (schedule replaced; server-side snoozes for cancelled events dropped). No duplicate alerts (shared tag/key). Snooze works with the app closed (notification action → server). Failures are reported, never hidden.
R3. **Accounts & sync.** Email + password accounts (scrypt), per-user data, encrypted at rest (AES-256-GCM, key from server env), automatic server-side version backups with restore, sync across devices. Offline edits are kept locally and synced later. Conflicts are resolved by three-way merge; edits to the same item on two devices are never silently overwritten (the other copy is kept in a visible "Sync conflicts" list). Existing browser data is uploaded only after explicit consent.
R4. **Platform support.** Accurate per-OS guidance in Settings. README lists which platforms were verified (only what was actually tested) and which are unverified.
R5. **Food accuracy.** Built-in meal diet tags and allergens are derived from the listed ingredients (not hand-tagged). Ingredients that are uncertain (stock, spice blends, soy sauce, canned beans, granola, injera, cheese) cause the affirmative tag to be withheld and the meal to be marked "unverified". "Halal" is never asserted for built-in meals. Nothing is called allergy-safe.
R6. **Calendar export.** .ics includes VALARM for the event's selected reminders (when offsets ≥ 0). UI states exports are copies and do not sync. Tests cover recurring events, cancellations and time zones.
R7. **Today dashboard.** Compact empty cards, appointment and water info not repeated, suggestions placed below the priorities, everything reachable via "➕ Add".
R8. **Wellness.** Summaries first; detailed forms open from "Log workout" and "Add meal" buttons. Ingredients have per-serving quantities, scaled by planned portions; shopping list combines matching items (same name and unit) and stays editable.

Honest scope: no push service, device or OS other than headless Chrome on Windows can be verified in this environment.

## Non-goals (not implemented)

Automatic step counting, wearable sync, food-photo analysis, a nutrition database, native mobile app. See README "Limitations".
