const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    await __fuel.loadDB();
    const q = ['chicken breast', 'egg', 'eggs', 'banana', 'greek yogurt', 'coffee', 'black coffee', 'oatmeal', 'blueberries', 'salmon', 'rice white cooked', 'milk 2%', 'beer', 'whey', 'orange juice', 'toast', 'water tap', 'coffee brewed', 'egg whole cooked'];
    const out = {}; q.forEach(x => out[x] = __fuel.searchLocal(x).slice(0, 3).map(i => i.src + ' | ' + i.name));
    out.parse = __fuel.localParse('two eggs, a cup of oatmeal with blueberries and a black coffee');
    out.parse2 = __fuel.localParse('200g chicken breast, 1 1/2 cups rice, half a cup of milk, 3 slices of bacon, a large banana');
    const rows = await __fuel.matchItems(out.parse.concat(out.parse2));
    out.rows = rows.map(r => `${r.ai.name} -> ${r.item && r.item.src} | ${r.item && r.item.name} | ${r.g} g | ${r.item ? Math.round(r.item.n100.kcal * r.g / 100) : 0} kcal hyd=${r.hyd}`);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('ERRS', errs);
  await b.close();
})();
