const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(2500);
  // Gemini voice path mocked
  await p.evaluate(() => { const S = __fuel.S(); S.settings.ai = { provider: 'gemini', key: 'AIza-test', model: '' }; localStorage.setItem('fuel.v1', JSON.stringify(S)); });
  await p.route('https://generativelanguage.googleapis.com/**', async route => {
    const body = JSON.parse(route.request().postData()); console.log('gemini url ok', route.request().url().includes('gemini-2.5-flash:generateContent?key='), 'thinking', JSON.stringify(body.generationConfig));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ name: 'Latte', search: 'Coffee, latte', ml: 350, is_drink: true, confidence: 0.9, portion: '12 oz' }, { name: 'Bagel', search: 'Bagel, plain', grams: 100, confidence: 0.8 }], notes: 'ok' }) }] } }] }) });
  });
  await p.reload(); await p.waitForTimeout(1500);
  await p.click('[data-act=voice]'); await p.waitForTimeout(500);
  await p.fill('#vtxt', 'a 12 oz latte and a bagel'); await p.click('#vgo'); await p.waitForTimeout(2000);
  console.log('gemini review', await p.$$eval('.sheet .card', x => x.map(c => c.innerText.replace(/\s+/g, ' ').slice(0, 110))));
  await p.click('#rapprove'); await p.waitForTimeout(800);
  console.log('water incl latte', await p.evaluate(() => { const d = new Date(); const pad = n => String(n).padStart(2, '0'); const k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); return Math.round(__fuel.totals(k).t.water); }));
  // offline reload via SW
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(2000);
  console.log('offline title', await p.title(), 'db', await p.evaluate(async () => { const d = await __fuel.loadDB(); return d.foods.length; }));
  console.log('offline search', await p.evaluate(() => __fuel.searchLocal('lentils')[0].name));
  console.log('ERRS', errs);
  await b.close();
})();
