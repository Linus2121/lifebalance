# LifeBalance Android — last updated 2026-10-29

## Step 1 implemented
Capacitor 8 Android project, packaged offline web assets, existing logo in launcher icons and launch screen, dark native theme, native-only touch/keyboard CSS. The website remains unchanged. Application ID: `com.lambtechnologies.lifebalance` (confirm ownership/name before first store upload). Android target/compile API 36. No billing, prices, subscriptions or paid feature gates have been added; pricing remains undecided.

## Windows setup
Install Node.js 22+ and Android Studio 2025.2.1+ with Android SDK Platform 36 and the bundled Java runtime. From the repository root:

```powershell
npm ci
npm run android:sync
npm run android:open
```

In Android Studio let Gradle sync finish, connect an Android phone with USB debugging enabled, select it and press Run. Repeat `npm run android:sync` after web changes. The mobile build copies only approved client assets into ignored `www/`; never point Capacitor at a remote server URL. The native app does not register the web service worker. Signing keys and local SDK settings are ignored by git.

## Data and release limitations
Browser storage and native WebView storage are separate. Existing browser data is not erased or automatically transferred. Export a browser backup before testing; native file export/import and migration still require implementation/device verification. Native local notifications, Android Back behavior, external link handling, account sync and secure credential storage are later work. In-app reminders retain existing behavior; do not advertise closed-app reminders yet. No additional notification permissions are requested in this phase.

Android cloud backup is disabled for this initial shell because it may contain sensitive local records. This is not a replacement for encrypted storage or an export/import backup flow.

## Validation and remaining work
Web unit tests passed (41). Capacitor add/sync succeeded. No Android SDK/device is available in this workspace: Gradle compilation, keyboard behavior, safe-area/edge-to-edge rendering, launch screen, accessibility and real-device offline testing remain unverified. No APK/AAB, signing credentials, store submission or approval is claimed. Android 12+ controls the system launch-screen presentation.

After testing, generate a signed Android App Bundle in Android Studio. Before production: finish migration and native reminders, confirm package ID, choose pricing, prepare privacy/Data safety declarations, store listing and required closed testing. Keep signing keys backed up privately; never commit them.
