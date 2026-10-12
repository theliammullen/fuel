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
  await p.waitForTimeout(3500); await p.click('.tile[data-nut=vitD]'); await p.waitForTimeout(900);
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
  // mocked AI photo flow
  await p.evaluate(() => { const S = __fuel.S(); S.settings.ai = { provider: 'openai', key: 'sk-test', model: '' }; localStorage.setItem('fuel.v1', JSON.stringify(S)); });
  await p.route('https://api.openai.com/**', async route => {
    const body = JSON.parse(route.request().postData()); console.log('AI req model', body.model, 'has image', JSON.stringify(body).includes('data:image/jpeg'));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [
      { name: 'Fried egg', search: 'Egg, whole, cooked, fried', grams: 50, ml: null, portion: '1 large egg', is_drink: false, confidence: 0.9 },
      { name: 'Grilled chicken breast', search: 'Chicken, breast, meat only, cooked, roasted', grams: 160, portion: '1 breast', is_drink: false, confidence: 0.8 },
      { name: 'Steamed broccoli', search: 'Broccoli, cooked, boiled', grams: 120, portion: '1 cup', is_drink: false, confidence: 0.85 },
      { name: 'Protein bar', search: 'protein bar', grams: 60, is_drink: false, confidence: 0.7, brand: 'Quest', label: { serving_g: 60, kcal: 190, protein_g: 21, carbs_g: 22, fibre_g: 14, sugars_g: 1, fat_g: 8, sat_fat_g: 3, sodium_mg: 230 } },
      { name: 'Orange juice', search: 'Orange juice', ml: 250, portion: '1 glass', is_drink: true, confidence: 0.6 } ], notes: 'Plate with egg, chicken and broccoli; a protein bar label and a glass of juice.' }) } }] }) });
  });
  await p.reload(); await p.waitForTimeout(1200);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act=photo]')]);
  await fc.setFiles('/tmp/plate.jpg'); await p.waitForTimeout(800);
  await p.click('#pgo'); await p.waitForTimeout(2000);
  await p.screenshot({ path: SS + '3-photo-review.png' });
  console.log('photo rows', await p.$$eval('[data-rg]', x => x.map(i => i.value).join(',')));
  await p.click('#rapprove'); await p.waitForTimeout(800);
  console.log('ERRS', errs);
  await b.close();
})();
