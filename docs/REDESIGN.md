# Premium redesign: version 1.2.2 · last updated 2026-11-02

LifeBalance now has the midnight-navy look from the approved reference image. The workflow was: reference image → Figma design → approved screens → this code.

- **Figma file:** [LifeBalance – Premium Redesign](https://www.figma.com/design/cFObRej5a3KoGmUdU0Ac4w)
  - "1 Foundations": colours, gradients, text styles and effects
  - "2 Components"
  - "3 Screens – Mobile + Desktop": 11 phone screens and 2 desktop screens

The app keeps its existing architecture: a shared web codebase, packaged for Android with Capacitor. It was **restyled, not rewritten**, so every feature, stored record, reminder, setting and the Android signing key carry over. There is no data migration, and the data schema stays at 3.

## What changed

| Area | Change |
|---|---|
| Look | New `styles.css`, rewritten from scratch to replace the earlier layered overrides. Navy backgrounds, a violet-to-blue gradient for primary actions, glass cards, soft glows and line icons. Uses the system font (no web fonts), so the app stays fully offline and private. |
| Icons | New `js/icons.js`: a line-icon set, category icons and the logo mark. It is shared by every screen. |
| Navigation | On phones and tablets: a floating bottom bar with Home, Events, a glowing **+** button (quick add) and Work, plus **More**, which holds Health, Habits, Journal, Progress, Settings, Alerts, Export backup and Demo mode. Screens opened from More have a "‹ More" back button. On screens 900 px and wider, every section appears in the top bar with an **Add** button. |
| Home | Greeting and date chip. Four tiles: events today, tasks left, weekly fitness %, and water against goal. Then Next appointment, a Work & Leave card (this week's shifts and leave balance), and Health rings (workouts and active minutes against your weekly goals, and water against its goal). Daily balance, priorities, tasks, today's plan, task history and suggestions are all still there. |
| Events | A segmented Upcoming/Past/Calendar switch and scrollable category chips with coloured icons (plus **All**). The gradient **+ Add appointment** button sits beneath the chips; with a category chosen it reads, for example, "Add Hospital appointment" and opens the form with that category set. Appointment cards have a coloured category tile and a bell when reminders are set. |
| Events fix (1.2.1) | Choosing a category further along the chip row scrolls the row so the selected chip stays visible. Before, every redraw reset the row to the start. Only the row scrolls, not the page. |
| Logo (1.2.2) | The LifeBalance logo (the ring with three linked dots from `logo.png`) is back in the top bar and on the Welcome screen. It replaces the reference image's figure mark and spins clockwise as before (it stays still if the device is set to reduce motion). It is drawn as a vector copy so it stays sharp at any size. The footer reads "Powered by **Lamb Technologies**". |
| Welcome | New first-launch screen. It appears only on a fresh install with no records. Existing users go straight to Home. "Sign In" appears only when the account service is reachable. |
| Other screens | Work, Health, Habits, Journal, Progress, Settings, forms and dialogs keep their content and controls, restyled through the shared components. |
| Version | 1.2.0 (Android versionCode 8). Updated in the footer, About, the Android badge, `package.json` and Gradle. Asset version tags are `20261102-work-17` and the offline cache is `lifebalance-work-17`, so installed web apps load the new files. |

**Real data only.** The reference image shows steps and calories, but LifeBalance doesn't record either, so the Health rings use workouts, active minutes and water. Water is counted in the unit you set (glasses by default).

**Intentional differences from the reference image:**
- No profile photo or personal name in the greeting. The app doesn't store either, and adding them would be a new feature.
- The app keeps its own LifeBalance logo rather than the figure mark shown in the reference image. The launcher icon and favicon (`logo.png`, `icons/`) are unchanged.

## Tests

- `npm test`: **77 passed**, including new tests for the Welcome logic, the More screen, Home's real-data rings, and the category Add button.
- Manual browser checks:
  - Welcome, Home, Events (with a category selected), Work, More, Habits, Settings and the quick-add menu, at 390 px (iPhone).
  - Every main screen at 360 px (common Android), with no sideways scrolling and no rendering errors.
  - Tablet at 768 px and desktop at 1280 px.
- `tests/e2e.js`, `tests/smoke.js` and `tests/helpers.js` were updated for the new navigation and the Welcome screen. They need Playwright with Chrome, which isn't installed here, so they **were not run**.

## Pending

- **Samsung tablet:** install the 1.2.0 APK over 1.1.1 (same signing key) and confirm data, reminders and the new navigation.
- **iPhone/iPad:** check the web version in Safari, including Add to Home Screen and safe areas. There is still no native iOS build.
- **Figma tidy-up:** rename the captured frames, delete the duplicate Welcome frame (node 4:2), and finish the remaining components. Figma's Starter plan allows only 20 edit calls a month.
- **Screen readers:** keyboard focus order and contrast are checked in the design tokens. A full TalkBack/VoiceOver pass is still to do.
