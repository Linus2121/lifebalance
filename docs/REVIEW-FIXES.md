# Review fixes — version 1.1.1 · last updated 2026-10-31

This release responds to the *LifeBalance Code Review and Development Plan* (reviewed 30 Oct 2026 against commit `e3ff7d5`). Each finding was checked against the code before it was changed. No features, branding or stored-data formats were removed. The data schema stays at 3, so existing records and backups load unchanged.

Status labels used below:
- **Done (tested)**: code changed and covered by automated tests in `tests/review.test.js`.
- **Ready, needs configuration**: code in place, but it only takes effect once a secret, key or server is set up.
- **Needs device testing**: the logic is tested with mocks, but it has not been run on a real phone or tablet.

## Findings

| ID | Finding | Verified? | What changed | Status |
|---|---|---|---|---|
| F01 | First sign-in could replace Work-only data without asking | Yes | The "is this device empty?" check now counts leave bookings, allowances, custom working days, the fitness plan, favourites and shopping list. "Use the cloud copy" and "Combine" both stop and sign out if the safety backup can't be saved. | Done (tested) |
| F02 | One old shift made later bookings deduct 0 days | Yes | Roster rule decided: a Monday–Sunday week with a scheduled shift counts that week's shift dates, and every other week uses the chosen working weekdays. The leave review now warns when 0 working days are found. | Done (tested) |
| F03 | Manual corrections dropped working-date priority | Yes | A correction fills working dates first, then other dates in date order. This keeps cross-year and half-day bookings on the right year. | Done (tested) |
| F04 | Registration tried to sync with `Bearer undefined` | Yes | Registration and unverified sign-in now show an "Enter code" step with Resend and Back. "Forgot password?" sends a reset code and lets you set a new password. The app connects only after the server returns a real session. The password needed for Resend is held in memory and never saved. | Done (tested with mocked server). Needs a hosted server to use. |
| F05 | Saved plugin records could hide lost Android alarms | Yes | All owned alarms are registered again at every app start and whenever notification permission or precise-alarm access changes. Re-using the same IDs replaces alarms rather than duplicating them. Normal refreshes still skip unchanged alarms. | Done (tested with mocks). Needs device testing. |
| F06 | Delivered-notification cleanup read the wrong field | Yes (plugin source checked) | Android returns system extras as `data`, without the app's metadata. The adapter now keeps its own map of notification IDs it scheduled (pruned after 7 days) and uses it to clear stale, cancelled or over-detailed notifications. It never touches IDs it didn't schedule. | Done (tested with mocks). Needs device testing. |
| F07 | No stable Android signing | Yes | Gradle signs debug builds with a stable test key, and release builds with an upload key, when the `LB_TEST_*` / `LB_RELEASE_*` environment variables are set. CI restores the test key from secrets. Without the secret, CI prints a warning that the APK can't update earlier builds. No keys are stored in the repo. | Ready, needs configuration |
| F08 | Session token stored in general local storage | Yes | No code change. A Keystore/Keychain adapter would add a new native dependency and needs device testing, so it is planned work (see below). | Open (planned) |
| F09 | CI skipped server tests; browser tests needed Windows Chrome | Yes | CI now runs separate app-test, server-test and Android jobs, also on pull requests and on server or test changes. Browser tests use `CHROME_PATH`, or the installed Chrome on Windows, macOS or Linux. | Done. CI run pending. |

Also fixed: every version label (footer, About, the Android badge, `package.json`, Gradle `versionName` 1.1.1 / `versionCode` 7) now comes from one value, and a test checks they all match. The offline cache name was bumped so installed web apps pick up the fixes.

## Tests run (2026-10-31, Windows 11, Node 26.1)

- App suite `npm test`: **74 passed, 0 failed** (64 existing + 10 new). Five repeated runs, all passing.
- Before the fixes were applied, 8 of the 10 new tests failed on the original code. The other two guard behaviour that already worked (precise-alarm regrant and version labels).
- Server suite: **not run locally**. Its dependency (`web-push`) couldn't be installed in this environment. No server code was changed, and the updated CI workflow runs this suite.
- Browser end-to-end scripts (`tests/e2e.js`, `tests/smoke.js`) and the Android Gradle build: **not run here** (Playwright and the Android SDK aren't installed).

## Before installing an update on the Samsung tablet

APKs from the old workflow were signed with a different, temporary key on each run. Android may refuse to install a new build over an old one.
1. In the installed app, open Settings → Your data → **Export backup**, and keep the file somewhere safe.
2. Try installing the new APK over the old one. Uninstall **only** if Android refuses, and only after confirming the export opens.
3. After that, create one test keystore, add it as the GitHub secrets `LB_TEST_KEYSTORE_B64`, `LB_TEST_KEYSTORE_PASSWORD`, `LB_TEST_KEY_ALIAS` and `LB_TEST_KEY_PASSWORD`, and keep a private backup of it. Every later build will then update in place and keep its data.

Custom-tone files are not part of the JSON backup. Pick the tone again after a reinstall.

## Still awaiting configuration or real-device testing

- **Samsung tablet**: alarms in the foreground, from the Home screen, on the lock screen, after reboot and after force-stop; revoking and re-granting precise alarms; editing, cancelling and snoozing; removal of delivered notifications; an in-place upgrade that keeps data.
- **Accounts**: a hosted HTTPS server with email delivery, allowed origins, persistent storage, a protected data key and monitoring. `config.js` `serverUrl` is still empty, so accounts stay unavailable on the published site.
- **F08**: native session secrets in Android Keystore (and iOS Keychain), a reviewed web-session approach, and documented export-retention and account-deletion behaviour.
- **Release**: a separate upload key, Play App Signing and a signed AAB.
- **CI maintenance**: actions are pinned to major tags. Pin them to commit SHAs during routine maintenance.

## Platform limitations (unchanged)

| Platform | Status |
|---|---|
| Android | Capacitor app with native reminders and tones. Debug APK only, and not yet verified on a device. |
| iOS / iPadOS | Shared browser/PWA code only. A native app needs an iOS notification adapter (the Android channel, tone and exact-alarm calls don't apply), a Mac build and Apple signing. |
| Windows, macOS, Linux | Shared browser/PWA code. Closed-app reminders need the hosted Web Push server. No native desktop packages. |

All platforms use the same shared code for data, leave rules, merging and accounts. Only reminder delivery differs by platform.
