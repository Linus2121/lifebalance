const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || p.startsWith('/tests') || p.startsWith('/server') || !fs.existsSync(f)) { r.writeHead(404); return r.end('nf'); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res({ server: s, url: 'http://127.0.0.1:' + s.address().port + '/' }));
  });
}
async function launch() {
  // CHROME_PATH overrides; otherwise use the installed Chrome on Windows, macOS or Linux.
  return chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, headless: true } : { channel: 'chrome', headless: true });
}
async function newPage(browser, url, mobile, init) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 800 } });
  await ctx.grantPermissions(['notifications'], { origin: url });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // Skip the first-launch welcome screen; tests start on Home like a returning user.
  await page.addInitScript(() => { try { const d = JSON.parse(localStorage.getItem('lifebalance.device') || '{}'); if (!d.welcomed) { d.welcomed = true; localStorage.setItem('lifebalance.device', JSON.stringify(d)); } } catch (e) { /* storage blocked */ } });
  if (init) await page.addInitScript(init);
  await page.goto(url); await page.waitForSelector('#app h2, #app section, #app .card');
  return { page, ctx, errors };
}
// Phones show some sections under More; wide screens show them all in the top bar.
async function goTab(page, t) { const b = page.locator(`#tabs [data-arg=${t}]`); if (await b.isVisible()) return b.click(); await page.click('#tabs [data-arg=more]'); await page.click(`main [data-a=go][data-arg=${t}]`); }
module.exports = { serve, launch, newPage, goTab, ROOT };
