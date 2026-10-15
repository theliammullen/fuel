// Barcode lookup: USDA FDC Branded (gtinUpc) → Open Food Facts → "Scan the label instead"; saved codes rescan offline.
// node test/barcode.js [--webkit] [--real]   (--real also hits the live USDA + OFF APIs)
const pw = require('/workspace/pwtest/node_modules/playwright-core');
const WK = process.argv.includes('--webkit'), REAL = process.argv.includes('--real');
const URL0 = process.env.URL || 'http://127.0.0.1:8765/';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const FDC = { foods: [{ fdcId: 1, gtinUpc: '00016000275287', description: 'CHEERIOS TOASTED WHOLE GRAIN OAT CEREAL', brandOwner: 'GENERAL MILLS SALES INC.', servingSize: 39, servingSizeUnit: 'g', householdServingFullText: '1.5 cup', publishedDate: '2024-03-01',
  foodNutrients: [['208', 359], ['203', 12.8], ['204', 6.4], ['205', 74.4], ['291', 10.3], ['269', 3.6], ['307', 487], ['606', 1.3], ['301', 333], ['303', 21.8]].map(([n, v]) => ({ nutrientNumber: n, value: v })) },
  { fdcId: 2, gtinUpc: '00099999999999', description: 'WRONG ITEM', foodNutrients: [] }] };
const OFF = { status: 1, code: '0064200116435', product: { product_name: 'Spaghetti', brands: 'Catelli', serving_quantity: 85, serving_size: '85 g', nutriments: { 'energy-kcal_100g': 353, proteins_100g: 12.9, carbohydrates_100g: 72.9, fat_100g: 1.8, fiber_100g: 3.5, sugars_100g: 3.5, sodium_100g: 0.006 } } };
(async () => {
  const b = await (WK ? pw.webkit.launch() : pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }));
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, serviceWorkers: REAL ? 'allow' : 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => m.type() === 'error' && !/camera|NotAllowed|NotFound|Permission|getUserMedia|net::ERR_FAILED|status of 404/i.test(m.text()) && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
  let mode = 'fdc', hits = [];
  if (!REAL) await p.route(/api\.nal\.usda\.gov|openfoodfacts\.org/, r => { const u = r.request().url(); hits.push(u);
    const json = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/usda/.test(u)) return mode === 'fdc' ? json(FDC) : json({ foods: [] });
    if (mode === 'off' && /064200116435/.test(u)) return json(OFF);
    return r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{"status":0}' }); });
  await p.goto(URL0); await p.waitForTimeout(900);
  console.log('GTIN helpers');
  const g = await p.evaluate(() => [__fuel.gtinKey('016000275287'), __fuel.gtinKey('0016000275287'), __fuel.gtinKey('00016000275287'), __fuel.gtinVariants('016000275287').join(',')]);
  ok(g[0] === g[1] && g[1] === g[2], 'UPC-A, EAN-13 and GTIN-14 forms share one key (' + g[0] + ')');
  ok(/00016000275287/.test(g[3]) && /0016000275287/.test(g[3]), 'variants include zero-padded 13/14 digit forms');
  const scan = async code => { await p.evaluate(() => __fuel.closeAll && __fuel.closeAll()); await p.click('[data-act=scan]'); await p.waitForSelector('#scanmsg', { state: 'attached' }); await p.evaluate(c => __fuel.lookupBarcode(c), code); await p.waitForTimeout(REAL ? 4000 : 500); };
  const SH = (process.env.SHOTS || '') + (WK ? 'wk-' : '');
  console.log(REAL ? 'Live: USDA (Cheerios 016000275287)' : 'Mock: USDA match');
  await scan('016000275287');
  ok(await p.isVisible('#cflog'), 'review sheet opens with "Looks right — log it"');
  ok(/USDA/.test(await p.textContent('.srcb.usda').catch(() => '')), 'USDA source badge shown');
  ok(/cheerios/i.test(await p.inputValue('#cfn')), 'name filled: ' + await p.inputValue('#cfn'));
  if (!REAL) { ok(await p.inputValue('#cfs') === '39', 'serving 39 g from manufacturer label'); ok(!hits.some(u => /openfoodfacts/.test(u)), 'Open Food Facts not called when USDA matches'); }
  if (process.env.SHOTS) await p.screenshot({ path: SH + 'barcode-review.png' });
  await p.click('#cflog'); await p.waitForTimeout(500);
  let st = await p.evaluate(() => { const S = __fuel.S(); const c = S.customFoods.find(x => x.code); return { c, fav: S.favs.some(f => c && f.key === 'cus:' + c.id), n: S.customFoods.length }; });
  ok(st.c && __gk(st.c.code) === g[0], 'saved as custom food keyed by barcode'); ok(st.fav, 'added to favourites');
  console.log('Rescan offline is instant');
  await ctx.setOffline(true); hits = []; const t0 = Date.now(); await scan('0016000275287');
  ok(/Saved/.test(await p.textContent('.srcb').catch(() => '')) && hits.length === 0, 'rescan from saved item, no network (' + (Date.now() - t0 - (REAL ? 4000 : 500)) + ' ms)');
  await p.click('#cfsave'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => __fuel.S().customFoods.length) === st.n, 'Save only on rescan updates the same item (no duplicate)');
  await ctx.setOffline(false);
  console.log(REAL ? 'Live: Canadian product via Open Food Facts (Catelli 064200116435)' : 'Mock: USDA empty → Open Food Facts');
  mode = 'off'; await scan('064200116435');
  ok(/Open Food Facts/.test(await p.textContent('.srcb.off').catch(() => '')), 'community badge shown');
  ok(/spaghetti/i.test(await p.inputValue('#cfn').catch(() => '')), 'name filled');
  await p.click('#cfsave'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => __fuel.S().customFoods.some(c => c.code && /64200116435$/.test(c.code))), 'Save only stores it with its barcode');
  if (!REAL) { console.log('Not found → Scan the label instead');
  mode = 'none'; await scan('0012345678905'); if (process.env.DBG) console.log(await p.evaluate(() => [...document.querySelectorAll('.sheet')].map(s => s.innerText.slice(0, 300)).join(' ### ')));
  ok(/Scan the label instead/.test(await p.textContent('#scanmsg')), 'offers "Scan the label instead"');
  const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), p.click('#mklabel')]);
  ok(!!fc, 'opens the camera / photo picker');
  if (fc) { await fc.setFiles('test/ocr/img/tuna-ca.png'); await p.waitForSelector('#cflog', { timeout: 60000 }); await p.fill('#cfn', 'Tuna test'); await p.click('#cflog'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => __fuel.S().customFoods.some(c => c.name === 'Tuna test' && c.code === '0012345678905')), 'label result saved with the barcode'); } }
  ok(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
function __gk(c) { return String(c).replace(/\D/g, '').replace(/^0+/, ''); }
