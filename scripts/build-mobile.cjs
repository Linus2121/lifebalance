const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');
// Explicit allowlist: never ship server files, tests, credentials or dependencies.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of ['index.html', 'styles.css', 'config.js', 'logo.png', 'manifest.webmanifest', 'icons', 'js']) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
html = html.replace('</head>', '<link rel="stylesheet" href="mobile.css">\n</head>');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(root, 'mobile.css'), path.join(out, 'mobile.css'));
// Native assets are managed by app updates, not the website service worker.
const reminders = path.join(out, 'js/reminders.js');
fs.writeFileSync(reminders, fs.readFileSync(reminders, 'utf8').replace("if ('serviceWorker' in navigator &&", "if (!window.Capacitor?.isNativePlatform() && 'serviceWorker' in navigator &&"));
console.log('Bundled LifeBalance offline web assets in www/');
