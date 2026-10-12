const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(2500);
  // offline (free) voice parser — no network AI
  await p.reload(); await p.waitForTimeout(1500);
  await p.click('[data-act=voice]'); await p.waitForTimeout(500);
  await p.fill('#vtxt', 'a 12 oz latte and a bagel'); await p.click('#vgo'); await p.waitForTimeout(2000);
  console.log('voice review', await p.$$eval('.sheet .card', x => x.map(c => c.innerText.replace(/\s+/g, ' ').slice(0, 110))));
  await p.click('#rapprove'); await p.waitForTimeout(800);
  console.log('water incl latte', await p.evaluate(() => { const d = new Date(); const pad = n => String(n).padStart(2, '0'); const k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); return Math.round(__fuel.totals(k).t.water); }));
  // offline reload via SW
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(2000);
  console.log('offline title', await p.title(), 'db', await p.evaluate(async () => { const d = await __fuel.loadDB(); return d.foods.length; }));
  console.log('offline search', await p.evaluate(() => __fuel.searchLocal('lentils')[0].name));
  console.log('ERRS', errs);
  await b.close();
})();
