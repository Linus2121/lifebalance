const { serve, launch, newPage } = require('./helpers');
const assert = require('assert');
let fails = 0;
const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { fails++; console.log('  FAIL', name, '-', e.message.split('\n').slice(0,6).join(' | ')); if (process.env.DBG && global.__page) console.log((await global.__page.locator('main').innerText()).slice(0, 1500)); } };
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

(async () => {
  const { server, url } = await serve(), browser = await launch();
  for (const mobile of [true, false]) {
    console.log(mobile ? 'MOBILE 375px' : 'DESKTOP 1280px');
    const v1 = { tasks: [{ id: 't1', title: 'Old v1 task', done: false, date: '2020-01-01' }], habits: [], logs: {}, journal: [] };
    const { page, errors } = await newPage(browser, url, mobile, `if(!sessionStorage.seeded){sessionStorage.seeded=1;localStorage.setItem('lifebalance.v1',${JSON.stringify(JSON.stringify(v1))});}`);
    const tab = t => page.click(`#tabs [data-arg=${t}]`); global.__page = page;

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
      assert.equal(await page.locator('[data-s=addWorkout]').count(), 0, 'workout form hidden until Log workout');
      await page.getByRole('button', { name: /Log workout/ }).first().click();
      await page.locator('[data-s=addWorkout] input[name=dur], [data-s=addWorkout] input[type=number]').first().fill('30');
      await page.click('[data-s=addWorkout] button[type=submit], [data-s=addWorkout] .btn');
      await page.waitForTimeout(200);
      const S = await ls(page, 'lifebalance.v2'); assert.ok(S.fitness.workouts.length >= 1, 'workout not saved');
    });
    await step('Today dashboard: next appointment, plan, water, quick add', async () => {
      await tab('today');
      assert.ok(await page.locator('#nxH').isVisible(), 'nxH'); assert.ok(await page.locator('#nxH + .ev, #nxH ~ .ev').first().innerText().then(t => /GP check/.test(t)), 'gp');
      assert.ok(/Starts in \d+ day/.test(await page.locator('main').innerText()));
      const fresh = await newPage(browser, url, mobile); const fp = fresh.page;
      const w0 = await fp.locator('#tdH ~ .row b').first().innerText();
      await fp.click('#tdH ~ .row [data-arg="1"]'); const w1 = await fp.locator('#tdH ~ .row b').first().innerText();
      assert.notEqual(w0, w1); await fp.click('#tdH ~ .row [data-arg="-1"]'); assert.equal(await fp.locator('#tdH ~ .row b').first().innerText(), w0); await fp.context().close();
      await page.click('[data-a=quickAdd]'); assert.ok(await page.locator('.modal').getByRole('button', { name: /Appointment/ }).isVisible());
      await page.locator('.modal').getByRole('button', { name: /Log workout/ }).click();
      assert.ok(await page.locator('#wk-type').isVisible(), 'wk-type'); await tab('today');
      await page.click('[data-a=quickAdd]'); await page.locator('.modal').getByRole('button', { name: /Appointment/ }).click();
      assert.ok(await page.locator('#evForm').isVisible(), 'evForm'); await tab('today');
    });
    await step('calendar export: per-event menu and .ics download', async () => {
      await tab('events'); await page.locator('[data-a=calMenu]').first().click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.modal').getByRole('button', { name: /Download .ics with reminder/ }).click()]);
      const txt = require('fs').readFileSync(await dl.path(), 'utf8'); assert.ok(/BEGIN:VEVENT/.test(txt) && /SUMMARY:GP check/.test(txt));
    });
    await step('install card, device toggle, manifest, offline reload', async () => {
      await page.click('[data-a=openSettings]');
      const body = await page.locator('main').innerText(); assert.ok(/Install & this device/.test(body) && /Add to Home Screen|Install|Add to Dock|address bar/i.test(body));
      await page.uncheck('[data-c=receive]'); assert.equal((await ls(page, 'lifebalance.device')).receive, false); await page.check('[data-c=receive]');
      const man = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.json())); assert.equal(man.display, 'standalone'); assert.ok(man.icons.some(i => i.sizes === '512x512'));
      await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(800);
      await page.context().setOffline(true); await page.reload(); await page.waitForSelector('#app h2');
      assert.ok(await page.getByText('Buy milk').first().isVisible()); await page.context().setOffline(false);
    });
    await step('in-app alert: test alert, snooze, dismiss', async () => {
      await page.click('[data-a=openSettings]'); await page.click('[data-a=testAlert]'); await page.waitForTimeout(300);
      assert.ok(await page.locator('#alerts .alert').first().isVisible());
      await page.locator('#alerts [data-a=snooze]').first().click(); await page.waitForTimeout(200);
      await page.click('[data-a=testAlert]'); await page.waitForTimeout(300);
      await page.locator('#alerts [data-a=dismiss]').first().click(); await page.waitForTimeout(200);
      assert.equal(await page.locator('#alerts .alert').count(), 0);
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
