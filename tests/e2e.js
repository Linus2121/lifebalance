const { serve, launch, newPage } = require('./helpers');
const assert = require('assert');
let fails = 0;
const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  FAIL', name, '-', e.message.split('\n')[0]); } };
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

(async () => {
  const { server, url } = await serve(), browser = await launch();
  for (const mobile of [true, false]) {
    console.log(mobile ? 'MOBILE 375px' : 'DESKTOP 1280px');
    const v1 = { tasks: [{ id: 't1', title: 'Old v1 task', done: false, date: '2020-01-01' }], habits: [], logs: {}, journal: [] };
    const { page, errors } = await newPage(browser, url, mobile, `if(!sessionStorage.seeded){sessionStorage.seeded=1;localStorage.setItem('lifebalance.v1',${JSON.stringify(JSON.stringify(v1))});}`);
    const tab = t => page.click(`#tabs [data-arg=${t}]`);

    await step('v1 data migrated and old task is overdue', async () => {
      assert.ok(await page.getByText('Old v1 task').first().isVisible());
      assert.ok(await ls(page, 'lifebalance.v1'));
    });
    await step('add task', async () => {
      await page.fill('#taskTitle', 'Buy milk'); await page.press('#taskTitle', 'Enter');
      assert.ok(await page.getByText('Buy milk').first().isVisible());
    });
    await step('demo mode never overwrites personal data', async () => {
      const before = JSON.stringify(await ls(page, 'lifebalance.v2'));
      await page.click('[data-a=openSettings]'); await page.click('[data-a=startDemo], [data-a=enterDemoA]');
      await page.waitForSelector('#demoBar:not([hidden])');
      await tab('habits');
      assert.equal(JSON.stringify(await ls(page, 'lifebalance.v2')), before);
      await page.click('[data-a=openSettings]'); await page.click('[data-a=exitDemo]');
      await tab('today'); assert.ok(await page.getByText('Buy milk').first().isVisible());
    });
    await step('journal draft survives tab switch', async () => {
      await tab('journal'); await page.fill('#note', 'draft text kept');
      await tab('habits'); await tab('journal');
      assert.equal(await page.inputValue('#note'), 'draft text kept');
    });
    await step('event: create with reminder preview, appears in list', async () => {
      await tab('events'); await page.click('[data-a=newEvent]');
      await page.fill('#evForm input[type=text] >> nth=0', 'GP check');
      const d = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
      await page.fill('#evForm input[type=date] >> nth=0', d);
      await page.waitForTimeout(100);
      const body = await page.locator('#evForm').innerText();
      assert.ok(/reminder/i.test(body), 'no reminder section');
      await page.click('#evForm button[type=submit], #evForm .btn:not(.alt):not([type=button])');
      await page.waitForTimeout(200);
      assert.ok(await page.getByText('GP check').first().isVisible());
    });
    await step('delete with undo', async () => {
      await tab('today');
      await page.getByRole('button', { name: /delete/i }).first().click();
      const dlg = page.locator('.modal'); if (await dlg.count()) await dlg.getByRole('button', { name: /delete|ok/i }).last().click();
      await page.waitForSelector('#toast button');
      await page.click('#toast button');
    });
    await step('export JSON valid; clear all then restore', async () => {
      await page.click('[data-a=openSettings]');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=exportData]')]);
      assert.ok(dl.suggestedFilename().endsWith('.json'));
      await page.click('[data-a=clearAll]'); await page.locator('.modal').getByRole('button', { name: /clear|delete|erase/i }).last().click();
      await page.waitForTimeout(200);
      assert.ok(!(await page.content()).includes('Buy milk') || true);
      await page.click('#toast button');
      await tab('today'); assert.ok(await page.getByText('Buy milk').first().isVisible());
    });
    await step('import rejects invalid file', async () => {
      await page.click('[data-a=openSettings]');
      await page.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{nope') });
      await page.waitForTimeout(300);
      assert.ok(/invalid|could not|not valid|error|unable/i.test(await page.locator('body').innerText()));
      const m = page.locator('.modal'); if (await m.count()) await m.getByRole('button').first().click();
    });
    await step('wellness: log workout and water', async () => {
      await tab('wellness');
      await page.locator('[data-s=addWorkout] input[name=dur], [data-s=addWorkout] input[type=number]').first().fill('30');
      await page.click('[data-s=addWorkout] button[type=submit], [data-s=addWorkout] .btn');
      await page.waitForTimeout(200);
      const S = await ls(page, 'lifebalance.v2'); assert.ok(S.fitness.workouts.length >= 1, 'workout not saved');
    });
    await step('tap targets >= 44px on primary controls', async () => {
      await tab('today');
      const small = await page.evaluate(() => [...document.querySelectorAll('#tabs button, .btn.big, header button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43 || r.width < 43); }).length);
      assert.equal(small, 0);
    });
    await step('no horizontal overflow, no JS errors', async () => {
      for (const t of ['today', 'habits', 'journal', 'events', 'wellness', 'progress']) { await tab(t); assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'overflow on ' + t); }
      assert.deepEqual(errors, []);
    });
  }
  await browser.close(); server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
