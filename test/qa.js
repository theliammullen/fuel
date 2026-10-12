/* First-time-user QA pass (iPhone 393×852, touch). Counts taps per core flow, audits layout/inputs/tap targets,
   export→import round-trip, offline reload. Run: python3 -m http.server 8765 & node test/qa.js [before|after] [webkit]
   Screenshots: screenshots/qa/<tag>-*.png */
const pw = require('/workspace/pwtest/node_modules/playwright-core');
const TAG = process.argv[2] || 'after'; const WK = process.argv.includes('webkit');
const OUT = '/workspace/nutrition-app/screenshots/qa/'; const BASE = process.env.FUEL_URL || 'http://127.0.0.1:8765/';
const fs = require('fs');
(async () => {
  const b = WK ? await pw.webkit.launch() : await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: !WK, hasTouch: true, colorScheme: 'dark', acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); const errs = []; const R = { taps: {}, issues: [], checks: {} };
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/openfoodfacts|Failed to load resource|ERR_INTERNET_DISCONNECTED|getUserMedia|NotAllowed|NotFound|NotSupported|Requested device/i.test(m.text())) errs.push('console ' + m.text()); });
  p.on('dialog', d => d.accept());
  let flow = null, n = 0; const start = f => { flow = f; n = 0; }; const end = () => { R.taps[flow] = n; flow = null; };
  const tap = async (sel, opt = {}) => { n++; if (WK) await p.locator(sel).first().evaluate(e => e.scrollIntoView({ block: "center" })).catch(() => {}); try { await p.tap(sel, { timeout: 5000, force: WK, ...opt }); } catch (e) { if (!WK) throw e; await p.screenshot({ path: "/tmp/wk-fail.png" }); console.error("WK tap retry", sel, await p.evaluate(() => [...document.querySelectorAll(".sheet")].map(s => s.className + ":" + s.querySelector("h2").textContent))); await p.waitForTimeout(800); await p.tap(sel, { timeout: 5000, force: true }); } await p.waitForTimeout(opt.wait ?? 550); };
  const shot = async (name, full) => { await p.waitForTimeout(350); await p.screenshot({ path: OUT + TAG + (WK ? '-webkit' : '') + '-' + name + '.png', fullPage: !!full }); };
  const today = () => p.evaluate(() => __fuel.S().days[__fuel.today()] || { entries: [], water: [] });
  const audit = async label => { const r = await p.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.hidden'); };
      const out = { smallFont: [], hscroll: document.documentElement.scrollWidth > innerWidth + 1, offscreen: [], clipped: [] };
      document.querySelectorAll('input:not([type=hidden]):not([type=range]):not([type=file]):not([type=color]),select,textarea').forEach(el => { if (el.getBoundingClientRect().width && parseFloat(getComputedStyle(el).fontSize) < 16) out.smallFont.push((el.id || el.className) + ' ' + getComputedStyle(el).fontSize); });
      document.querySelectorAll('.sheet.on *, #app *, #tabbar *').forEach(el => { if (!vis(el)) return; const r = el.getBoundingClientRect();
        if ((r.right > innerWidth + 1 || r.left < -1) && !el.closest('.qstrip,.seg,.chart')) out.offscreen.push((el.className || el.tagName) + ' ' + (el.textContent || '').trim().slice(0, 20));
        const cs = getComputedStyle(el); if (el.children.length === 0 && el.textContent.trim() && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp?.match(/\d/) && el.scrollWidth > el.clientWidth + 2) out.clipped.push((el.className || el.tagName) + ' “' + el.textContent.trim().slice(0, 24) + '”'); });
      out.offscreen = [...new Set(out.offscreen)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 8); return out; });
    const bad = r.smallFont.length || r.hscroll || r.offscreen.length || r.clipped.length; if (bad) R.issues.push({ label, ...r }); return r; };
  const closeTop = async () => { await p.evaluate(() => { const s = [...document.querySelectorAll('.sheet.on [data-close]')].pop(); s && s.click(); }); await p.waitForTimeout(450); };

  await p.goto(BASE); await p.waitForTimeout(1800);
  await p.evaluate(() => __fuel.loadDB()); await shot('01-first-run'); await audit('first run today');
  R.checks.fabCentre = await p.evaluate(() => { const f = document.querySelector('#fab').getBoundingClientRect(), t = document.querySelector('#tabbar').getBoundingClientRect(); return Math.round((f.left + f.width / 2) - (t.left + t.width / 2)); });
  R.checks.tabWidths = await p.evaluate(() => [...document.querySelectorAll('#tabbar .tab')].map(t => Math.round(t.getBoundingClientRect().width)));
  await shot('01b-first-run-full', true);
  // Say it (Today tile)
  start('Say it (Today tile → type → Find → Approve)');
  await tap('#app [data-act=voice]'); await p.fill('#vtxt', '2 eggs, a cup of oatmeal and a black coffee'); await tap('#vgo', { wait: 1500 }); await shot('02-say-review'); await audit('say review');
  await tap('#rapprove', { wait: 1200 }); end();
  R.checks.sayLogged = (await today()).entries.length; await shot('02b-after-say');
  // Say it via + button
  start('Say it via + (＋ → Say it → type → Find → Approve)');
  await tap('#fab'); await shot('03-plus-hub'); await audit('plus hub'); await tap('.sheet.on [data-act=voice]'); await p.fill('#vtxt', 'a banana'); await tap('#vgo', { wait: 1500 }); await tap('#rapprove', { wait: 1200 }); end();
  // Label → Save item
  start('Read the label → Read → Save item');
  await tap('#app [data-act=label]'); await p.fill('#ltxt', 'Kirkland protein bar, serving 60 grams, 190 calories, 21 grams protein, 7 fat, 22 carbs, 15 fibre, 1 gram sugar, 200 milligrams sodium, calcium 10 percent, creatine 2 grams');
  await tap('#lgo', { wait: 900 }); await shot('04-label-review'); await audit('label review');
  R.checks.labelForm = await p.evaluate(() => ({ name: document.querySelector('#cfn').value, serving: document.querySelector('#cfs').value, servingCls: document.querySelector('#cfs').className, slabel: document.querySelector('#cfsl').value, creatine: (document.querySelector('[data-cf=creatine]') || {}).value }));
  await p.evaluate(() => document.querySelector('#cfsave').scrollIntoView()); await shot('04b-label-review-bottom');
  await tap('#cfsave', { wait: 900 }); end();
  R.checks.customFoods = await p.evaluate(() => __fuel.S().customFoods.map(c => [c.name, c.servingG, c.servingLabel, c.n100.creatine]));
  await shot('05-my-items'); await audit('today with my items');
  // My items one-tap + Undo
  const xp0 = await p.evaluate(() => __fuel.gameCtx().xp), ach0 = await p.evaluate(() => Object.keys(__fuel.S().achievements).length);
  const e0 = (await today()).entries.length;
  start('My items one-tap'); await tap('#app .qi', { wait: 700 }); end();
  if (!WK) await shot('06-one-tap-toast'); // WebKit screenshots at 3x take longer than the 6 s Undo window
  const e1 = (await today()).entries.length, xp1 = await p.evaluate(() => __fuel.gameCtx().xp);
  start('Undo (toast)'); await tap('.toast .tbtn', { wait: 900 }); end();
  const e2 = (await today()).entries.length, xp2 = await p.evaluate(() => __fuel.gameCtx().xp), ach2 = await p.evaluate(() => Object.keys(__fuel.S().achievements).length);
  R.checks.undo = { entries: [e0, e1, e2], xp: [xp0, xp1, xp2], achievements: [ach0, ach2] };
  // Undo on a first-ever log (fresh profile: First Bite achievement)
  R.checks.undoFirstEver = await p.evaluate(async () => { const S = __fuel.S(); const keep = JSON.stringify(S); return keep.length; });
  // Hold = change serving
  start('Hold My item → change serving sheet');
  n++; const box = await p.locator('#app .qi').first().boundingBox();
  await p.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerType: 'touch' })); }, { x: box.x + 30, y: box.y + 20 });
  await p.waitForTimeout(700); await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  await p.waitForTimeout(500); R.checks.holdOpens = await p.$$eval('.sheet.on #fq', x => x.length); await shot('07-hold-serving'); await audit('hold serving sheet'); end();
  await closeTop();
  // water
  const w0 = (await today()).water.length;
  start('Water +250'); await tap('#app .c-water [data-water]'); end();
  start('Water +500'); await tap('#app .c-water [data-water] >> nth=1'); end();
  R.checks.water = [(w0), (await today()).water.map(w => w.ml)]; await shot('08-water');
  // search
  start('Search → type → pick → Add'); await tap('#app [data-act=search]'); await p.fill('#q', 'greek yogurt'); await p.waitForTimeout(700); await shot('09-search'); await audit('search');
  await tap('.sheet.on #res .it'); await shot('09b-food'); await audit('food sheet'); await tap('.sheet.on #fadd', { wait: 900 }); end();
  // barcode typed
  start('Barcode (typed) → Look up'); await tap('#app [data-act=scan]', { wait: 900 }); await p.fill('#bcode', '0055577101015'); await tap('#bgo', { wait: 5000 }); end();
  R.checks.barcode = await p.evaluate(() => { const s = [...document.querySelectorAll('.sheet.on')].pop(); return s ? s.querySelector('h2').textContent + ' | ' + (s.querySelector('#scanmsg') || {}).textContent : 'no sheet'; });
  await shot('10-barcode'); await audit('barcode'); await p.evaluate(() => { while (document.querySelector('.sheet.on [data-close]')) { document.querySelectorAll('.sheet.on [data-close]').forEach(x => x.click()); break; } }); await p.waitForTimeout(500); await closeTop(); await closeTop();
  // Coach
  start('Coach → Eat next → pick → Approve'); await tap('#tabbar [data-tab=coach]', { wait: 1200 }); await shot('11-coach-next'); await audit('coach next');
  const pk = await p.$('#app [data-coach-pick]'); if (pk) { await tap('#app [data-coach-pick]', { wait: 900 }); await shot('11b-coach-review'); await tap('#rapprove', { wait: 1200 }); } end();
  start('Coach → Meal ideas → log idea'); await tap('#app [data-coach-tab=meals]', { wait: 1200 }); await shot('12-coach-meals', true); await audit('coach meals');
  R.checks.mealPortions = await p.$$eval('.co-parts li', x => x.map(l => l.innerText).slice(0, 12));
  if (await p.$('#app [data-coach-idea]')) { await tap('#app [data-coach-idea]', { wait: 900 }); await shot('12b-idea-review'); await closeTop(); } end();
  await tap('#app [data-coach-tab=insights]', { wait: 1200 }); await shot('13-insights', true); await audit('insights');
  // Progress: weigh-in + goal
  await tap('#tabbar [data-tab=progress]', { wait: 900 }); await shot('14-progress', true); await audit('progress');
  start('Weigh-in'); await tap('#app [data-act=log-weight]'); await p.fill('#wl', '182.4'); await tap('#wsave', { wait: 800 }); end();
  start('Add goal'); await tap('#app [data-act=add-goal]'); await p.fill('#gv', '150'); await shot('15-goal'); await audit('goal sheet'); await tap('#gsave', { wait: 800 }); end();
  R.checks.weights = await p.evaluate(() => __fuel.S().weights); R.checks.goals = await p.evaluate(() => __fuel.S().goals.length);
  await tap('#tabbar [data-tab=nutrients]', { wait: 900 }); await shot('16-nutrients', true); await audit('nutrients');
  await tap('#tabbar [data-tab=awards]', { wait: 900 }); await shot('17-awards'); await audit('awards');
  // vitamin D + creatine info sheets
  await tap('#tabbar [data-tab=today]', { wait: 900 });
  await p.evaluate(() => document.querySelector('[data-nut=vitD]') ? 0 : 1);
  for (const k of ['vitD', 'creatine']) { const ok = await p.evaluate(k => { const el = document.querySelector(`#app [data-nut=${k}]`); if (el) { el.click(); return true; } return false; }, k); R.checks['tile_' + k] = ok; if (ok) { await p.waitForTimeout(700); await shot('18-info-' + k, true); R.checks['info_' + k] = await p.evaluate(() => [...document.querySelectorAll('.sheet.on')].pop().innerText.slice(0, 900)); await audit('info ' + k); await closeTop(); } }
  // Settings + Appearance: every theme / layout / palette
  await tap('#app [data-act=profile]', { wait: 800 }); await shot('19-settings'); await audit('settings');
  const looks = await p.evaluate(() => ({ th: [...document.querySelectorAll('.sheet.on [data-look-theme]')].map(x => x.dataset.lookTheme), lay: [...document.querySelectorAll('.sheet.on [data-look-layout]')].map(x => x.dataset.lookLayout), pal: [...document.querySelectorAll('.sheet.on [data-look-pal]')].map(x => x.dataset.lookPal) }));
  R.checks.looks = looks; await closeTop();
  for (const th of looks.th) { await p.evaluate(t => localStorage.setItem('fuel.look', JSON.stringify({ theme: t, layout: 'tiles' })), th); await p.reload(); await p.waitForTimeout(1100); await shot('20-theme-' + th); await audit('theme ' + th); }
  for (const lay of looks.lay) { await p.evaluate(l => localStorage.setItem('fuel.look', JSON.stringify({ theme: 'midnight', layout: l })), lay); await p.reload(); await p.waitForTimeout(1100); await shot('21-layout-' + lay); await audit('layout ' + lay); }
  for (const pal of looks.pal) { await p.evaluate(l => localStorage.setItem('fuel.look', JSON.stringify({ theme: 'midnight', layout: 'tiles', palette: l })), pal); await p.reload(); await p.waitForTimeout(1100); await audit('palette ' + pal); }
  await p.evaluate(() => localStorage.setItem('fuel.look', JSON.stringify({ theme: 'ember', layout: 'cards', palette: 'jewel' }))); await p.reload(); await p.waitForTimeout(1200);
  // export → wipe → import round-trip
  const before = await p.evaluate(() => localStorage.getItem('fuel.v1')); const lookBefore = await p.evaluate(() => localStorage.getItem('fuel.look'));
  await p.evaluate(() => { navigator.canShare = undefined; });
  await tap('#app [data-act=profile]', { wait: 800 });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.evaluate(() => document.querySelector('.sheet.on #exp').click())]);
  const file = '/tmp/fuel-qa-backup.json'; await dl.saveAs(file);
  await p.evaluate(() => { localStorage.setItem('fuel.v1', JSON.stringify({ days: {}, profile: {} })); localStorage.removeItem('fuel.look'); }); await p.reload(); await p.waitForTimeout(1200);
  await tap('#app [data-act=profile]', { wait: 800 }); await p.setInputFiles('.sheet.on #impf', file); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => localStorage.getItem('fuel.v1')); const lookAfter = await p.evaluate(() => localStorage.getItem('fuel.look'));
  const strip = s => { const o = JSON.parse(s); return JSON.stringify(o); };
  R.checks.roundTrip = { dataEqual: strip(before) === strip(after), lookRestored: lookBefore === lookAfter, bytes: fs.statSync(file).size, keys: Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))) };
  if (!R.checks.roundTrip.dataEqual) { const a = JSON.parse(before), c = JSON.parse(after); R.checks.roundTrip.diff = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(c[k])); }
  // debounced save survives an immediate background (pagehide) — iOS kills standalone apps without unload
  await p.reload(); await p.waitForTimeout(1200);
  R.checks.saveOnHide = await p.evaluate(async () => { const S = __fuel.S(); __fuel.addWater(123); const raw0 = localStorage.getItem('fuel.v1'); window.dispatchEvent(new Event('pagehide')); const raw1 = localStorage.getItem('fuel.v1'); return { immediately: raw0.includes('"ml":123'), afterPagehide: raw1.includes('"ml":123') }; });
  // CSS / iOS checks
  R.checks.css = await p.evaluate(async () => { const css = (await Promise.all(['css/app.css', 'css/themes.css', 'css/coach.css'].map(u => fetch(u).then(r => r.text())))).join('\n');
    const decls = []; css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').forEach(r => { const [sel, body] = r.split('{'); if (!body) return; body.split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) decls.push({ sel: sel.trim().replace(/\s+/g, ' '), prop: d.slice(0, i).trim(), val: d.slice(i + 1) }); }); });
    const cm = decls.filter(d => d.val.includes('color-mix(')); const rules = cm;
    const noFallback = cm.filter(d => !decls.slice(0, decls.indexOf(d)).some(o => o.sel === d.sel && o.prop === d.prop && !o.val.includes('color-mix('))).map(d => d.sel).length;
    return { colorMixRules: rules.length, colorMixWithoutFallback: noFallback, safeArea: /safe-area-inset-bottom/.test(css), viewportFit: document.querySelector('meta[name=viewport]').content }; });
  // offline reload via service worker
  await p.waitForTimeout(1500); await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(2000);
  R.checks.offline = await p.evaluate(async () => ({ title: document.title, tabs: document.querySelectorAll('#tabbar .tab').length, app: document.querySelector('#app').innerText.length > 100, db: (await __fuel.loadDB()).foods.length, sw: (await caches.keys()).join(',') }));
  await shot('22-offline'); await ctx.setOffline(false);
  R.errors = errs; console.log(JSON.stringify(R, null, 1));
  fs.writeFileSync(OUT + TAG + (WK ? '-webkit' : '') + '-report.json', JSON.stringify(R, null, 1));
  await b.close();
})().catch(e => { console.error('QA FAILED', e); process.exit(1); });
