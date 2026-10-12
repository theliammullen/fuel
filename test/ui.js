const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const SS = '/workspace/nutrition-app/screenshots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1200);
  await p.screenshot({ path: '/tmp/fresh.png' });
  // seed: weights + 9 days of realistic logs
  await p.evaluate(async () => {
    await __fuel.loadDB(); const S = __fuel.S();
    const pad = n => String(n).padStart(2, '0'); const ds = o => { const d = new Date(); d.setDate(d.getDate() - o); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    const menu = [['breakfast', 'egg whole cooked', 100], ['breakfast', 'egg white cooked', 120], ['breakfast', 'oatmeal', 250], ['breakfast', 'blueberries raw', 100], ['breakfast', 'coffee brewed', 350],
      ['lunch', 'chicken breast cooked', 190], ['lunch', 'rice white cooked', 200], ['lunch', 'broccoli cooked', 160], ['lunch', 'black beans cooked', 90],
      ['snacks', 'yogurt greek plain nonfat', 250], ['snacks', 'pumpkin seeds', 20], ['snacks', 'banana raw', 120],
      ['dinner', 'salmon atlantic farmed cooked', 140], ['dinner', 'sweet potato baked', 220], ['dinner', 'spinach raw', 80], ['dinner', 'milk skim', 250]];
    const mk = (q, g, meal, hyd) => { const it = __fuel.searchLocal(q)[0]; const n = {}; for (const k in it.n100) n[k] = +(it.n100[k] * g / 100).toPrecision(4); return { id: Math.random().toString(36).slice(2), key: it.key, name: it.name, sub: it.sub, src: it.src, meal, g: Math.round(g), qty: Math.round(g), unit: 'g', qtyLabel: Math.round(g) + ' g', n, hyd: it.hyd || undefined, por: it.portions, dens: it.dens, t: Date.now() }; };
    for (let o = 9; o >= 0; o--) {
      const day = S.days[ds(o)] = { entries: [], water: [], training: { on: o % 2 === 0, hours: 1 } };
      menu.forEach(([meal, q, g], i) => { if (o === 0 && i > 11) return; if ((o + i) % 7 === 3) return; day.entries.push(mk(q, g * (0.9 + ((o * 7 + i) % 5) / 20), meal)); });
      [500, 750, 750, 750, 750, 500].forEach((ml, i) => { if (!(o === 0 && i > 2)) day.water.push({ id: 'w' + o + i, ml, t: Date.now() }); });
    }
    S.weights = []; [196.4, 195.8, 196.0, 195.1, 194.6, 194.9, 194.0, 193.4, 193.6, 192.8, 192.5].forEach((lb, i) => S.weights.push({ d: ds(20 - i * 2), lb }));
    S.profile.weightLb = 192.5; S.profile.name = 'Liam';
    const snap = (q, last) => { const it = __fuel.searchLocal(q)[0]; return { key: it.key, name: it.name, sub: it.sub, src: it.src, n100: it.n100, portions: it.portions, dens: it.dens, hyd: it.hyd, last }; };
    S.favs = [snap('yogurt greek plain nonfat'), snap('banana raw')];
    S.recent = [snap('egg whole cooked', { qty: 2, unit: 'p0', meal: 'breakfast' }), snap('chicken breast cooked', { qty: 170, unit: 'g', meal: 'lunch' }), snap('coffee brewed', { qty: 1, unit: 'p0', meal: 'breakfast' })];
    localStorage.setItem('fuel.v1', JSON.stringify(S));
  });
  await p.reload(); await p.waitForTimeout(1800);
  await p.screenshot({ path: SS + '1-dashboard.png' });
  await p.screenshot({ path: SS + '1b-dashboard-full.png', fullPage: true });
  // quick log sheet → voice → review
  await p.click('#fab'); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/quick.png' });
  await p.click('.sheet [data-act=voice]'); await p.waitForTimeout(600);
  await p.fill('#vtxt', 'two eggs, a cup of oatmeal with blueberries and a black coffee');
  await p.click('#vgo'); await p.waitForTimeout(1500);
  await p.screenshot({ path: SS + '2-voice-review.png' });
  const nRows = await p.$$eval('[data-rg]', x => x.length); console.log('review rows', nRows);
  await p.click('#rapprove'); await p.waitForTimeout(1200);
  console.log('entries today', await p.evaluate(() => { const S = __fuel.S(); const k = Object.keys(S.days).sort().pop(); return S.days[k].entries.length; }));
  // search flow
  await p.click('[data-act=search]'); await p.waitForTimeout(500);
  await p.fill('#q', 'greek yogurt'); await p.waitForTimeout(700);
  await p.screenshot({ path: SS + '3-search.png' });
  await p.click('#res .it >> nth=0'); await p.waitForTimeout(700);
  await p.screenshot({ path: SS + '4-food-detail.png' });
  await p.click('#fadd'); await p.waitForTimeout(1000);
  // nutrient detail
  await p.waitForTimeout(3500); await p.click('#app [data-nut=vitD]'); await p.waitForTimeout(900);
  await p.screenshot({ path: SS + '5-nutrient-info.png' });
  await p.click('.sheet [data-close]'); await p.waitForTimeout(500);
  // nutrients tab
  await p.click('[data-tab=nutrients]'); await p.waitForTimeout(1200);
  await p.screenshot({ path: SS + '6-nutrients.png' });
  await p.click('[data-tab=progress]'); await p.waitForTimeout(1200);
  await p.screenshot({ path: SS + '7-progress.png', fullPage: true });
  await p.click('[data-tab=awards]'); await p.waitForTimeout(1200);
  await p.screenshot({ path: SS + '8-awards.png' });
  await p.screenshot({ path: '/tmp/awards-full.png', fullPage: true });
  // profile
  await p.click('[data-tab=today]'); await p.waitForTimeout(500);
  await p.click('[data-act=profile]'); await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/profile.png' });
  await p.click('.sheet [data-close]'); await p.waitForTimeout(500);
  // water + training + edit entry + delete
  await p.click('[data-water="500"]'); await p.waitForTimeout(400);
  await p.click('[data-act=training]'); await p.waitForTimeout(400);
  await p.click('[data-entry] >> nth=0'); await p.waitForTimeout(600);
  await p.fill('#fq', '3'); await p.click('#fadd'); await p.waitForTimeout(600);
  await p.click('[data-act=prevday]'); await p.waitForTimeout(500);
  await p.click('[data-act=nextday]'); await p.waitForTimeout(500);
  // goals add
  await p.click('[data-tab=progress]'); await p.waitForTimeout(500);
  await p.click('[data-act=add-goal]'); await p.waitForTimeout(500);
  await p.fill('#gv', '30'); await p.click('#gsave'); await p.waitForTimeout(500);
  // custom food + recipe
  await p.click('#fab'); await p.waitForTimeout(400); await p.click('.sheet [data-act=search]'); await p.waitForTimeout(400);
  await p.click('[data-ltab=mine]'); await p.waitForTimeout(400);
  await p.click('[data-act=new-custom]'); await p.waitForTimeout(500);
  await p.fill('#cfn', 'Test bar'); await p.fill('[data-cf=kcal]', '200'); await p.fill('[data-cf=protein]', '20'); await p.click('#cfsave'); await p.waitForTimeout(500);
  await p.click('[data-act=new-recipe]'); await p.waitForTimeout(500);
  await p.fill('#rn', 'Bowl'); await p.click('#radd'); await p.waitForTimeout(500);
  await p.fill('.sheet:last-of-type #q', 'rice white cooked'); await p.waitForTimeout(600);
  await p.click('.sheet:last-of-type #res .it >> nth=0'); await p.waitForTimeout(600);
  await p.click('.sheet:last-of-type #fadd'); await p.waitForTimeout(600);
  console.log('recipe items text', await p.evaluate(() => document.querySelector('#rb') && document.querySelector('#rb').innerText.slice(0, 200)));
  await p.click('#rsave'); await p.waitForTimeout(600);
  console.log('recipes', await p.evaluate(() => __fuel.S().recipes.length), 'custom', await p.evaluate(() => __fuel.S().customFoods.length));
  console.log('sheets open', await p.$$eval('.sheet', x => x.length));
  console.log('ach', await p.evaluate(() => Object.keys(__fuel.S().achievements).join(',')), 'xp', await p.evaluate(() => __fuel.gameCtx().xp));
  console.log('SW', await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }));
  // ---- READ THE LABEL (voice nutrition facts) ----
  await p.reload(); await p.waitForTimeout(1500);
  const nEnt = () => p.evaluate(() => { const S = __fuel.S(); const k = Object.keys(S.days).sort().pop(); return S.days[k].entries.length; });
  await p.click('[data-act=label]'); await p.waitForTimeout(600);
  await p.fill('#ltxt', 'Kirkland protein bar, serving 60 grams, 190 calories, 21 grams protein, 7 fat, 22 carbs, 15 fibre, 1 gram sugar, 200 milligrams sodium, calcium 10 percent, wombat 5');
  await p.screenshot({ path: SS + '9a-read-label.png' });
  await p.click('#lgo'); await p.waitForTimeout(900);
  await p.screenshot({ path: SS + '9-label-review.png' });
  await p.evaluate(() => { const d = document.querySelector('.sheet:last-of-type details'); d.scrollIntoView({ block: 'start' }); });
  await p.waitForTimeout(300); await p.screenshot({ path: SS + '9b-label-review-more.png' });
  console.log('label review fields', await p.$$eval('.sheet [data-cf]', x => x.filter(i => i.value !== '').map(i => i.dataset.cf + '=' + i.value + (i.className.match(/hl-(\w+)/) ? '[' + i.className.match(/hl-(\w+)/)[1] + ']' : '')).join(', ')));
  console.log('unparsed box', await p.$eval('.unparsed', x => x.innerText.replace(/\s+/g, ' ')));
  const e0 = await nEnt();
  await p.click('#cflog'); await p.waitForTimeout(900);
  console.log('save&log: entries', e0, '->', await nEnt(), '| custom', await p.evaluate(() => __fuel.S().customFoods.map(c => c.name + ' ' + c.servingG + 'g kcal/100g=' + c.n100.kcal).join(';')), '| fav', await p.evaluate(() => __fuel.S().favs.some(f => /Kirkland/.test(f.name))));
  await p.waitForTimeout(6500);
  // ---- MY ITEMS one-tap ----
  await p.evaluate(() => document.querySelector('.qgrid, .qrow').closest('.card, .tl').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
  await p.screenshot({ path: SS + '10-my-items.png' });
  console.log('my items', await p.$$eval('.qi .qn', x => x.map(i => i.innerText).join(' | ')));
  const e1 = await nEnt();
  await p.click('.qi >> nth=0'); await p.waitForTimeout(500);
  await p.screenshot({ path: SS + '10b-one-tap-undo.png' });
  const e2 = await nEnt();
  console.log('toast', await p.$eval('.toast.act', x => x.innerText.replace(/\s+/g, ' ')));
  await p.click('.toast.act .tbtn'); await p.waitForTimeout(600);
  console.log('one-tap: entries', e1, '->', e2, '-> after undo', await nEnt());
  // long-press → change serving
  const qb = await (await p.$('.qi >> nth=1')).boundingBox();
  await p.mouse.move(qb.x + 30, qb.y + 20); await p.mouse.down(); await p.waitForTimeout(750); await p.mouse.up(); await p.waitForTimeout(600);
  console.log('long-press opened food sheet', !!(await p.$('.sheet.on #fadd')), '| entries unchanged', await nEnt());
  await p.screenshot({ path: SS + '10c-long-press-serving.png' });
  await p.click('.sheet.on [data-close]'); await p.waitForTimeout(500);
  await p.click('.qi >> nth=1 >> [data-qiedit]'); await p.waitForTimeout(600);
  console.log('⋯ opened food sheet', !!(await p.$('.sheet.on #fadd')));
  await p.click('.sheet.on [data-close]'); await p.waitForTimeout(500);
  // quick-log sheet (FAB)
  await p.click('#fab'); await p.waitForTimeout(500); await p.screenshot({ path: SS + '11-quick-log-sheet.png' });
  await p.click('.sheet [data-act=manual-food]'); await p.waitForTimeout(600);
  console.log('manual form open', !!(await p.$('#cfn')), 'buttons', await p.$$eval('.sheet.on #cfsave, .sheet.on #cflog', x => x.map(b => b.innerText).join(' / ')));
  await p.click('.sheet.on [data-close]'); await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.screenshot({ path: SS + '1-dashboard.png' });
  console.log('AI leftovers in DOM', await p.evaluate(() => /photo|api key|openai|gemini/i.test(document.body.innerHTML)));
  console.log('ERRS', errs);
  await b.close();
})();
