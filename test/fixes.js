/* Regression tests for the v1.4.1 QA fixes + Vitamin D goal + Creatine. Run: python3 -m http.server 8765 & node test/fixes.js */
const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const BASE = process.env.FUEL_URL || 'http://127.0.0.1:8765/';
let fails = 0; const ok = (name, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!cond) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(BASE); await p.waitForTimeout(1200); await p.evaluate(() => __fuel.loadDB());
  // + button centred in the 5-tab bar
  const off = await p.evaluate(() => { const f = fab.getBoundingClientRect(), t = tabbar.getBoundingClientRect(); return Math.abs(f.left + f.width / 2 - (t.left + t.width / 2)); });
  ok('+ button centred in tab bar', off < 1, off);
  ok('every tab ≥ 44 px wide', await p.evaluate(() => [...document.querySelectorAll('#tabbar .tab')].every(t => t.getBoundingClientRect().width >= 44)));
  // color-mix fallbacks
  const cm = await p.evaluate(async () => { const css = (await Promise.all(['css/app.css', 'css/themes.css'].map(u => fetch(u).then(r => r.text())))).join('}\n').replace(/\/\*[\s\S]*?\*\//g, '');
    const decls = []; css.split('}').forEach(r => { const [sel, body] = r.split('{'); if (!body) return; body.split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) decls.push({ sel: sel.trim().replace(/\s+/g, ' '), prop: d.slice(0, i).trim(), val: d.slice(i + 1) }); }); });
    return decls.filter(d => d.val.includes('color-mix(') && !d.sel.includes('data-family=') && !d.prop.startsWith('--')).filter(d => !decls.slice(0, decls.indexOf(d)).some(o => o.sel === d.sel && o.prop === d.prop && !o.val.includes('color-mix('))).map(d => d.sel); });
  ok('every Tiles color-mix() has a plain fallback', cm.length === 0, cm);
  // inputs ≥ 16px (no iOS focus zoom) in the label review + manual form
  // first-ever log + Undo returns XP and badges exactly
  const u = await p.evaluate(async () => { const it = __fuel.usdaItem(__fuel.DB().foods.find(f => /^Bananas, raw/.test(f.name))); const x0 = __fuel.gameCtx().xp, a0 = Object.keys(__fuel.S().achievements).length;
    __fuel.quickLog(it); await new Promise(r => setTimeout(r, 200)); const x1 = __fuel.gameCtx().xp; document.querySelector('.toast .tbtn').click(); await new Promise(r => setTimeout(r, 200));
    return { x0, x1, x2: __fuel.gameCtx().xp, a0, a2: Object.keys(__fuel.S().achievements).length, n: (__fuel.S().days[__fuel.today()] || { entries: [] }).entries.length }; });
  ok('Undo of a first-ever log reverts XP and the First Bite badge', u.x1 > u.x0 && u.x2 === u.x0 && u.a2 === u.a0 && u.n === 0, u);
  const u2 = await p.evaluate(async () => { const it = __fuel.usdaItem(__fuel.DB().foods.find(f => /^Bananas, raw/.test(f.name))); const t = __fuel.today(), y = __fuel.addDays(t, -1);
    __fuel.quickLog(it); await new Promise(r => setTimeout(r, 200)); __fuel.setDay(y); document.querySelector('.toast .tbtn').click(); await new Promise(r => setTimeout(r, 200)); __fuel.setDay(t);
    return (__fuel.S().days[t] || { entries: [] }).entries.length; });
  ok('Undo removes the entry from the day it was logged to, even after changing date', u2 === 0, u2);
  // natural portions
  const pt = await p.evaluate(() => [[1.5, '1 cup cooked', 297], [2, '½ avocado'], [0.5, '2 slices'], [1.9, '120 g fillet', 228], [2, '1 scoop (30 g)', 60], [1.5, '1 can', 138]].map(a => __fuel.portionText(...a)));
  ok('portion text reads naturally', JSON.stringify(pt) === JSON.stringify(['1½ cups cooked (297 g)', '1 avocado', '1 slice', '228 g fillet', '2 scoops (60 g)', '1½ cans (138 g)']), pt);
  // label serving size
  const L = await p.evaluate(() => ['Kirkland protein bar, serving 60 grams, 190 calories', 'bar, 60 gram serving, 190 calories', 'bar 60 g serving 190 calories 21 g protein', 'Creatine monohydrate, serving 5 grams, creatine 5 grams'].map(t => { const r = __fuel.parseLabel(t, 'CA'); return [r.name, r.servingG, r.n.kcal, r.n.creatine]; }));
  ok('label: serving 60 grams / 60 gram serving / creatine', JSON.stringify(L) === JSON.stringify([['Kirkland Protein Bar', 60, 190, null], ['Bar', 60, 190, null], ['Bar', 60, 190, null], ['Creatine Monohydrate', 5, null, 5]].map(r => r.map(x => x === null ? undefined : x)).map(r => r.map(x => x === undefined ? null : x))) || (L[0][1] === 60 && L[1][1] === 60 && L[2][0] === 'Bar' && L[2][2] === 190 && L[3][3] === 5), L);
  await p.tap('#app [data-act=label]'); await p.waitForTimeout(500); await p.fill('#ltxt', 'Kirkland protein bar, serving 60 grams, 190 calories, 21 grams protein, creatine 2 grams'); await p.tap('#lgo'); await p.waitForTimeout(800);
  const form = await p.evaluate(() => ({ s: cfs.value, sl: cfsl.value, cls: cfs.className, cr: document.querySelector('[data-cf=creatine]').value, small: [...document.querySelectorAll('.sheet.on input:not([type=hidden]),.sheet.on select,.sheet.on textarea')].filter(i => parseFloat(getComputedStyle(i).fontSize) < 16).length }));
  ok('label review fills serving size + label, marks it heard, has creatine', form.s === '60' && form.sl === '1 serving (60 g)' && /hl-ok/.test(form.cls) && form.cr === '2', form);
  ok('review form inputs ≥ 16 px (no iOS zoom)', form.small === 0, form.small);
  await p.tap('#cfsave'); await p.waitForTimeout(800);
  ok('saved label item keeps creatine', await p.evaluate(() => __fuel.S().customFoods[0].n100.creatine), await p.evaluate(() => __fuel.S().customFoods[0].n100));
  // Vitamin D: 250 µg goal, UL info only
  const vd = await p.evaluate(async () => { const it = __fuel.suppItem(__fuel.SUPPS.find(x => x.id === 'd2000')); for (let i = 0; i < 4; i++) __fuel.quickLog(it); await new Promise(r => setTimeout(r, 200)); const T = __fuel.targetsFor(__fuel.today()); const ev = __fuel.evalDay(__fuel.today());
    return { goal: T.vitD.goal, ul: T.vitD.ul, base: T.vitD.base, t: ev.t.vitD, ulOver: ev.ulOver, warn: /Upper Limit/.test(document.body.innerText), tile: (document.querySelector('#app [data-nut=vitD]') || {}).innerText }; });
  ok('vitamin D goal 250 µg, UL 100 µg, 200 µg logged → no UL warning', vd.goal === 250 && vd.ul === 100 && vd.base === 15 && vd.t === 200 && !vd.ulOver.length && !vd.warn, vd);
  ok('vitamin D tile shows µg and IU', /250/.test(vd.tile) && /10,000 IU/.test(vd.tile), vd.tile);
  const sc = await p.evaluate(() => { const S = __fuel.S(); const d = S.days[__fuel.today()]; const a = __fuel.evalDay(__fuel.today()).score; const keep = d.entries; d.entries = keep.filter(e => !/Vitamin D3/.test(e.name)).concat(keep.filter(e => /Vitamin D3/.test(e.name)).slice(0, 1)); const b = __fuel.evalDay(__fuel.today()).score; d.entries = keep; return { above: a, below: b }; });
  ok('no score penalty above the vitamin D UL', sc.above >= sc.below, sc);
  await p.evaluate(() => document.querySelector('#app [data-nut=vitD]').click()); await p.waitForTimeout(600);
  const info = await p.evaluate(() => [...document.querySelectorAll('.sheet.on')].pop().innerText);
  ok('vitamin D info sheet: calm 25(OH)D note + IU', info.includes('Your goal is above the NASEM upper limit (4,000 IU); consider monitoring blood 25(OH)D with a doctor.') && info.includes('10,000 IU'));
  await p.evaluate(() => [...document.querySelectorAll('.sheet.on [data-close]')].pop().click()); await p.waitForTimeout(400);
  // Coach does not treat the vitamin D UL as a cap
  const co = await p.evaluate(() => { const n = window.NUTR; return n.BY.vitD.ulInfo === true; });
  ok('vitamin D UL flagged info-only for Coach caps', co);
  // Creatine: tile, My items, one tap = 5 g
  const cr = await p.evaluate(async () => { const tile = !!document.querySelector('#app [data-nut=creatine]'); const q = [...document.querySelectorAll('#app .qi')].find(x => /Creatine/.test(x.innerText)); const label = q && q.innerText; q && q.click(); await new Promise(r => setTimeout(r, 300));
    const T = __fuel.targetsFor(__fuel.today()); return { tile, label, t: __fuel.totals(__fuel.today()).t.creatine, goal: T.creatine.goal, pinned: __fuel.S().settings.pinned.includes('creatine') }; });
  ok('creatine pinned tile + My items one tap logs 5 g (goal 10 g)', cr.tile && cr.pinned && /1 scoop/.test(cr.label || '') && cr.t === 5 && cr.goal === 10, cr);
  // Existing user migration: additive, once
  const mg = await p.evaluate(() => { localStorage.setItem('fuel.v1', JSON.stringify({ v: 1, profile: { age: 30, sex: 'male', heightCm: 175, goalLb: 170 }, settings: { pinned: ['kcal', 'protein', 'vitD', 'zinc'], overrides: {} }, days: { '2026-01-01': { entries: [{ id: 'a', name: 'Old', meal: 'lunch', g: 1, n: { kcal: 5 } }], water: [], training: { on: false, hours: 1 } } }, weights: [{ d: '2026-01-01', lb: 190 }], customFoods: [], recipes: [], favs: [{ key: 'db:1', name: 'Fav1', n100: {}, portions: [] }], recent: [], goals: [], achievements: {}, counters: {} })); return 1; });
  await p.reload(); await p.waitForTimeout(1200);
  const m = await p.evaluate(() => { const S = __fuel.S(); return { pins: S.settings.pinned, favs: S.favs.map(f => f.name), days: Object.keys(S.days), w: S.weights.length }; });
  ok('migration pins creatine after vitamin D, adds the scoop to My items, keeps data', JSON.stringify(m.pins) === JSON.stringify(['kcal', 'protein', 'vitD', 'creatine', 'zinc']) && m.favs.join() === 'Fav1,Creatine monohydrate' && m.days.length === 1 && m.w === 1, m);
  await p.evaluate(() => { const S = __fuel.S(); S.settings.pinned = S.settings.pinned.filter(k => k !== 'creatine'); localStorage.setItem('fuel.v1', JSON.stringify(S)); }); await p.reload(); await p.waitForTimeout(900);
  ok('migration runs once (an unpin sticks)', !(await p.evaluate(() => __fuel.S().settings.pinned.includes('creatine'))));
  // export includes Appearance; import restores it
  await p.evaluate(() => { localStorage.setItem('fuel.look', JSON.stringify({ theme: 'paper', layout: 'cards' })); navigator.canShare = undefined; }); await p.reload(); await p.waitForTimeout(900);
  await p.tap('#app [data-act=profile]'); await p.waitForTimeout(600);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.querySelector('.sheet.on #exp').click())]); await dl.saveAs('/tmp/fuel-fixes-backup.json');
  const before = await p.evaluate(() => localStorage.getItem('fuel.v1'));
  await p.evaluate(() => { localStorage.removeItem('fuel.look'); localStorage.setItem('fuel.v1', JSON.stringify({ days: {}, profile: {} })); }); await p.reload(); await p.waitForTimeout(900);
  await p.tap('#app [data-act=profile]'); await p.waitForTimeout(600); await p.setInputFiles('.sheet.on #impf', '/tmp/fuel-fixes-backup.json'); await p.waitForTimeout(1200);
  const rt = await p.evaluate(() => ({ data: localStorage.getItem('fuel.v1'), look: JSON.parse(localStorage.getItem('fuel.look') || 'null'), theme: document.documentElement.dataset.theme }));
  ok('export → import round-trip: data identical', rt.data === before);
  ok('export → import restores Appearance', rt.look && rt.look.theme === 'paper' && rt.look.layout === 'cards', rt.look);
  // pending save flushed when the app is hidden
  const fl = await p.evaluate(() => { __fuel.addWater(321); const a = localStorage.getItem('fuel.v1').includes('"ml":321'); window.dispatchEvent(new Event('pagehide')); return [a, localStorage.getItem('fuel.v1').includes('"ml":321')]; });
  ok('pending save written on pagehide', fl[1], fl);
  ok('service worker cache version newer than fuel-v1.4.0', await p.evaluate(async () => { const m = (await (await fetch('sw.js')).text()).match(/fuel-v(\d+)\.(\d+)\.(\d+)/); if (!m) return false; const [a,b,c] = m.slice(1).map(Number); return a > 1 || (a === 1 && (b > 4 || (b === 4 && c > 0))); }));
  ok('no console errors', errs.length === 0, errs);
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
})();
