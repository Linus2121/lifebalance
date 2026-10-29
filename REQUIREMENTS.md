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

## Non-goals (not implemented)

Automatic step counting, wearable sync, food-photo analysis, a nutrition database, user accounts / cross-device sync, native mobile app. See README "Limitations".
