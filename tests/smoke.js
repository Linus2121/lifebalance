const { serve, launch, newPage } = require('./helpers');
const fs = require('fs'), path = require('path');
(async () => {
  const { server, url } = await serve(), browser = await launch();
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  for (const mobile of [true, false]) {
    const tag = mobile ? 'm' : 'd', { page, errors } = await newPage(browser, url, mobile);
    for (const t of ['today', 'habits', 'journal', 'events', 'wellness', 'progress']) {
      await page.click(`#tabs [data-arg=${t}]`); await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(__dirname, 'shots', `${tag}-${t}.png`), fullPage: true });
    }
    await page.click('[data-a=openSettings]'); await page.screenshot({ path: path.join(__dirname, 'shots', `${tag}-settings.png`), fullPage: true });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    console.log(tag, 'overflow:', ov, 'errors:', errors);
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
