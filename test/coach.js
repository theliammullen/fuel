/* Coach feature test: seeds ~90 days of realistic sample logs into a throwaway browser profile (never into the repo),
   exercises What-to-eat-next, Meal ideas, Insights (7/30/90 + empty state), one-tap logging through the review flow,
   checks console errors, and saves screenshots to screenshots/coach/.   Usage: node test/coach.js [port]   */
const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const PORT = process.argv[2] || 8771; const URL = `http://127.0.0.1:${PORT}/`;
const OUT = __dirname + '/../screenshots/coach/';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const shot = async (name, full) => { await p.waitForTimeout(500); await p.screenshot({ path: OUT + name + '.png', fullPage: !!full }); };
  const ok = (c, msg) => { if (!c) { console.log('FAIL', msg); process.exitCode = 1; } else console.log('ok  ', msg); };

  // ---- 1. empty state ----
  await p.goto(URL); await p.waitForTimeout(1200);
  await p.evaluate(() => __fuel.loadDB()); await p.waitForTimeout(300);
  await p.evaluate(() => { __fuel.render(); });
  ok(await p.$('[data-coach="open"]'), 'Today shows Coach card with empty log');
  await p.click('[data-coach="open"]'); await p.waitForTimeout(400);
  await shot('01-eat-next-empty-day');
  await p.click('[data-coach-tab="insights"]'); await p.waitForTimeout(300);
  ok((await p.textContent('#app')).includes('No food logged'), 'Insights empty state');
  await shot('02-insights-empty');

  // ---- 2. seed 90 days ----
  const n = await p.evaluate(() => {
    const F = __fuel, C = FuelCoach; const st = C.staples(); const by = id => st.find(s => s.id === id);
    const S = F.S(); const today = F.today();
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ent = (s, mult, meal, ds, hour) => { const g = Math.round(s.g * mult); const n = {}; for (const k in s.it.n100) n[k] = +(s.it.n100[k] * g / 100).toPrecision(4);
      const t = F.parseD(ds); t.setHours(hour, Math.floor(rnd() * 59)); return { id: 'seed' + Math.random().toString(36).slice(2), key: s.it.key, name: s.it.name, sub: s.it.sub, src: s.it.src, meal, g, qty: g, unit: 'g', qtyLabel: g + ' g', n, hyd: s.it.hyd || undefined, por: s.it.portions, dens: s.it.dens, t: +t }; };
    // a few non-staple foods from the DB (beer, cheddar, white bread, chips) for realistic excesses
    const db = F.DB(); const mk = (id) => { const f = db.byId.get(id); return { it: F.usdaItem(f), g: 100 }; };
    const beer = mk(168746), cheddar = mk(328637), chips = mk(169677), pizza = mk(2708622);
    let days = 0;
    for (let i = 89; i >= 0; i--) {
      const ds = F.addDays(today, -i); const wd = F.parseD(ds).getDay(); const we = wd === 0 || wd === 6;
      if (i > 0 && rnd() < (we ? 0.3 : 0.12)) continue;          // skipped days (more on weekends)
      const E = [], W = [];
      if (i === 0) { E.push(ent(by('cnf130'), 1, 'breakfast', ds, 8), ent(by(173904), 1, 'breakfast', ds, 8), ent(by('cnf63'), 1, 'breakfast', ds, 8)); W.push({ id: 'w' + i, ml: 500, t: +F.parseD(ds) + 9 * 36e5 }); }
      else {
        const partial = rnd() < 0.08;
        // breakfast: small protein
        E.push(ent(by(rnd() < 0.5 ? 173904 : 'cnf4067'), 1, 'breakfast', ds, 8), ent(by('cnf63'), 0.7, 'breakfast', ds, 8));
        if (rnd() < 0.4) E.push(ent(by('cnf130'), 0.5, 'breakfast', ds, 8));
        if (!partial) {
          // lunch
          E.push(ent(by(rnd() < 0.6 ? 173709 : 'cnf502087'), 1, 'lunch', ds, 12), ent(by('cnf4067'), 1, 'lunch', ds, 12));
          if (rnd() < 0.5) E.push(ent({ it: cheddar.it, g: 30 }, 1, 'lunch', ds, 12));
          // dinner: big protein
          E.push(ent(by(rnd() < 0.5 ? 171477 : 174752), 1.9, 'dinner', ds, 18), ent(by(rnd() < 0.5 ? 'cnf4497' : 170093), 1.2, 'dinner', ds, 18));
          if (rnd() < 0.35) E.push(ent(by('cnf2375'), 0.8, 'dinner', ds, 18));
          // snacks
          if (rnd() < 0.5) E.push(ent(by(173944), 1, 'snacks', ds, 15));
          if (rnd() < 0.4) E.push(ent(by(330137), 1, 'snacks', ds, 21));
          if (we) { E.push(ent(chips, 0.6, 'snacks', ds, 20), ent(pizza, 2.2, 'dinner', ds, 19)); if (beer.it) E.push(Object.assign(ent({ it: beer.it, g: 355 }, 2 + Math.floor(rnd() * 2), 'snacks', ds, 21), { hyd: true })); }
        }
        // water: mostly evenings
        const nW = 2 + Math.floor(rnd() * 3); for (let w = 0; w < nW; w++) W.push({ id: 'w' + i + '_' + w, ml: 500, t: +F.parseD(ds) + (w === 0 ? 10 : 17 + w) * 36e5 });
      }
      S.days[ds] = { entries: E, water: W, training: { on: !we && rnd() < 0.6, hours: 1 } };
      days++;
    }
    S.weights = [{ d: F.addDays(today, -60), lb: 196 }, { d: F.addDays(today, -30), lb: 192.5 }, { d: F.addDays(today, -2), lb: 189.8 }];
    S.favs.unshift({ key: by(330137).it.key, name: by(330137).it.name, sub: by(330137).it.sub, src: by(330137).it.src, n100: by(330137).it.n100, portions: by(330137).it.portions, dens: by(330137).it.dens, hyd: false });
    S.recent = [{ key: by(330137).it.key, name: by(330137).it.name, sub: '', src: by(330137).it.src, n100: by(330137).it.n100, portions: by(330137).it.portions, last: { qty: 175, unit: 'g', meal: 'snacks' } }];
    localStorage.setItem('fuel.v1', JSON.stringify(S));
    return days;
  });
  ok(n > 50, 'seeded ' + n + ' days');
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(() => __fuel.loadDB()); await p.waitForTimeout(400);

  // ---- 3. Today card + What to eat next ----
  const card = await p.$('[data-coach="open"]'); ok(card, 'Coach card on Today after seeding');
  // the default Tiles layout hides the Today Coach card (themes.css; Coach has its own tab) → show it in the Cards layout for the screenshot
  const cardsLayout = () => p.evaluate(() => { document.documentElement.dataset.layout = 'cards'; });
  await cardsLayout(); await p.waitForTimeout(200);
  await p.evaluate(() => { const c = document.querySelector('[data-coach="open"]').closest('.card, .tl'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await shot('03-today-coach-card');
  const sug = await p.evaluate(() => { const r = FuelCoach.suggest(__fuel.cur(), 8); return { left: r.M.kcalLeft, prot: r.M.gaps.protein.rem, picks: r.picks.map(x => `${x.c.grp}|${x.c.nm}|${x.label}|${Math.round(x.kc)} kcal|P ${Math.round(x.n.protein || 0)}|Na ${Math.round(x.n.sodium || 0)}`) }; });
  console.log(JSON.stringify(sug, null, 1));
  ok(sug.picks.length >= 5 && /protein|dairy/.test(sug.picks[0].split('|')[0]), 'first pick closes the protein gap');
  await p.click('[data-coach="open"]'); await p.waitForTimeout(500);
  await shot('04-eat-next'); await shot('04b-eat-next-full', true);
  // one tap → review → approve
  const before = await p.evaluate(() => __fuel.totals(__fuel.cur()).count);
  await p.click('[data-coach-pick="0"]'); await p.waitForTimeout(600);
  ok(await p.$('#rapprove'), 'tap opens the existing review flow'); await shot('05-pick-review');
  await p.click('#rapprove'); await p.waitForTimeout(600);
  const after = await p.evaluate(() => __fuel.totals(__fuel.cur()).count); ok(after === before + 1, 'approve logs the pick');
  const via = await p.evaluate(() => { const d = __fuel.S().days[__fuel.cur()]; return d.entries[d.entries.length - 1].via; }); ok(via === 'coach', 'entry tagged via=coach');
  // water pick
  const w0 = await p.evaluate(() => __fuel.totals(__fuel.cur()).t.water);
  const wb = await p.$('[data-coach-water]'); if (wb) { await wb.click(); await p.waitForTimeout(400); const w1 = await p.evaluate(() => __fuel.totals(__fuel.cur()).t.water); ok(w1 > w0, 'water pick logs water'); }
  // caps respected: every pick stays within sodium/sat-fat limits and ULs
  const caps = await p.evaluate(() => { const r = FuelCoach.suggest(__fuel.cur(), 8); return r.picks.every(x => x.e.viol.length === 0); }); ok(caps, 'no pick violates a cap');
  // simulate a salty day: sodium near limit → salty picks excluded
  const salty = await p.evaluate(() => { const M = FuelCoach.gapModel(__fuel.cur()); const lim = M.T.sodium.limit; const d = __fuel.S().days[__fuel.cur()]; d.entries.push({ id: 'na', key: 'x', name: 'Salt test', meal: 'snacks', g: 5, n: { sodium: lim - (M.t.sodium || 0) - 50 }, t: Date.now() });
    const r = FuelCoach.suggest(__fuel.cur(), 8); const res = r.picks.map(x => Math.round(x.n.sodium || 0)); d.entries.pop(); return res; });
  ok(salty.every(v => v <= 50), 'near sodium cap → only picks with ≤ 50 mg sodium: ' + salty.join(','));

  // ---- 3b. user-chosen goals (Fuel Tester 8a71f0d: vitamin D 250 µg, creatine 10 g, Customise overrides) ----
  const cg = await p.evaluate(() => { const F = __fuel, C = FuelCoach, S = F.S();
    const M = C.gapModel(F.cur()); const r = { vitD: [M.gaps.vitD.tgt, M.T.vitD.goal, M.T.vitD.base], cr: M.gaps.creatine && [M.gaps.creatine.tgt, M.T.creatine.goal] };
    S.settings.overrides.magnesium = { goal: 600 }; F.render();
    const M2 = C.gapModel(F.cur()); r.mg = M2.gaps.magnesium.tgt; const A = C.analyse(30); const row = A.nut.find(x => x.k === 'magnesium'); r.mgIns = row && [Math.round(row.tg), row.own];
    r.crIns = (A.nut.find(x => x.k === 'creatine') || {}).own;
    delete S.settings.overrides.magnesium; F.render(); r.mgBack = C.gapModel(F.cur()).gaps.magnesium.tgt; return r; });
  console.log(JSON.stringify(cg));
  ok(cg.vitD[0] === cg.vitD[1] && cg.vitD[0] === 250 && cg.vitD[2] === 15, 'Eat next aims at the vitamin D goal (250 µg), not the RDA (15 µg)');
  ok(cg.cr && cg.cr[0] === 10, 'creatine goal (10 g) is a Coach gap');
  ok(cg.mg === 600 && cg.mgIns && cg.mgIns[0] === 600 && cg.mgIns[1] === true && cg.mgBack !== 600, 'Customise goal (magnesium 600 mg) drives Eat next + Insights shortfalls; removing it restores the default');
  ok(cg.crIns === true, 'Insights tracks creatine against the user goal');
  // ---- 3c. supplement suggestions ----
  const sp = await p.evaluate(() => { const F = __fuel, C = FuelCoach; const r = C.suggest(F.cur(), 8); const M = r.M;
    return { supps: r.supps.map(x => ({ k: x.forK, key: x.c.key, own: x.c.own, nm: x.c.nm, label: x.label, amt: x.n[x.forK], have: M.t[x.forK] || 0, goal: M.T[x.forK].goal, viol: x.e.viol.length, reason: x.reason })),
      foodGaps: ['epaDha', 'magnesium', 'potassium', 'calcium'].map(k => [k, M.gaps[k] && Math.round(M.gaps[k].rem)]) }; });
  console.log(JSON.stringify(sp, null, 1));
  ok(sp.supps.length && sp.supps[0].key === 'sup:creatine' && sp.supps[0].own, "user's own saved supplement (Creatine monohydrate scoop) is suggested first");
  ok(sp.supps.some(x => x.k === 'vitD' && !x.own), 'generic vitamin D supplement suggested for a goal food cannot reach');
  ok(sp.supps.every(x => x.have + x.amt <= x.goal * 1.1 + 1e-6 && x.viol === 0), 'supplement doses stay within the user goal and every cap');
  ok(sp.supps.every(x => ['creatine', 'vitD'].includes(x.k)), 'no supplement for gaps food can fill (omega-3, magnesium, potassium, calcium …)');
  const d10 = sp.supps.find(x => x.k === 'vitD');
  ok(d10 && d10.key === 'sup:d10000' && d10.label === '1 softgel' && d10.amt === 250, 'vitamin D 250 µg goal → 1 × Vitamin D3 10,000 IU softgel (' + (d10 && d10.label) + ')');
  // supplement-only ULs count supplements already logged today (folic acid UL 1000 µg)
  const sul = await p.evaluate(() => { const F = __fuel, C = FuelCoach; const multi = F.suppItem(F.SUPPS.find(x => x.id === 'multi')); const n = C.nOf(multi, 1);
    const d = F.S().days[F.cur()]; const v = () => C.evalN(n, C.gapModel(F.cur()), {}, true).viol.includes('folate');
    const r = { none: v() }; d.entries.push({ id: 'fa1', key: 'x', name: 'Fortified cereal', src: 0, meal: 'snacks', g: 1, n: { folate: 700 }, t: Date.now() }); r.food = v(); d.entries.pop();
    d.entries.push({ id: 'fa2', key: 'sup:multi', name: multi.name, src: 'sup', meal: 'snacks', g: 1, n: { folate: 700 }, t: Date.now() }); r.supp = v(); d.entries.pop(); return r; });
  ok(!sul.none && !sul.food && sul.supp, 'folic-acid UL counts supplements logged today (not food folate): ' + JSON.stringify(sul));
  // portion text plurals
  const pt = await p.evaluate(() => { const f = __fuel.portionText; return [f(2, '1 small can, drained (85 g)', 170), f(0.5, '¼ cup (28 g)', 14), f(1.5, '1 cup cooked', 297), f(2, '1 medium', 346), f(2, '2 large eggs (100 g)', 200), f(2, '1 scoop', 10), f(0.5, '1 cup', 83)]; });
  console.log(pt.join(' | '));
  ok(pt[0] === '2 small cans, drained (170 g)' && pt[1] === '2 tbsp (14 g)' && pt[2] === '1½ cups cooked (297 g)' && pt[3] === '2 medium (346 g)' && pt[4] === '4 large eggs (200 g)' && pt[5] === '2 scoops (10 g)' && pt[6] === '½ cup (83 g)', 'portion text plurals & small cup amounts');
  await p.click('[data-coach-tab="next"]'); await p.waitForTimeout(400);
  const badge = await p.evaluate(() => [...document.querySelectorAll('.co-g-supp')].map(e => e.textContent.trim()));
  ok(badge.length === sp.supps.length && badge.every(t => /Supplement/.test(t)), 'supplement rows carry a Supplement badge');
  ok((await p.textContent('#app')).includes('above the general upper limit'), 'neutral note: vitamin D goal is above the UL');
  await p.evaluate(() => { const e = document.querySelector('.co-supp'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120); }); await shot('11-eat-next-supplements');
  await p.evaluate(() => { const e = document.querySelector('.co-ulnote'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 300); }); await shot('12-ul-goal-note');
  const cr0 = await p.evaluate(() => __fuel.totals(__fuel.cur()).t.creatine || 0);
  await p.click('.co-supp'); await p.waitForTimeout(600); ok(await p.$('#rapprove'), 'supplement opens the existing review flow'); await shot('13-supplement-review');
  await p.click('#rapprove'); await p.waitForTimeout(600);
  const cr1 = await p.evaluate(() => { const d = __fuel.S().days[__fuel.cur()]; const e = d.entries[d.entries.length - 1]; return { cr: __fuel.totals(__fuel.cur()).t.creatine || 0, key: e.key, via: e.via }; });
  ok(cr1.key === 'sup:creatine' && cr1.via === 'coach' && Math.abs(cr1.cr - cr0 - sp.supps[0].amt) < 0.01, `creatine logged via Coach (+${(cr1.cr - cr0).toFixed(1)} g)`);
  const crAfter = await p.evaluate(() => FuelCoach.suggest(__fuel.cur(), 8).supps.filter(x => x.forK === 'creatine').length); ok(crAfter === 0, 'creatine at goal → no more creatine suggested');
  // UL: user resets vitamin D to the RDA → UL 100 µg is a hard cap again, no vitamin D supplement, no note
  const ul = await p.evaluate(() => { const F = __fuel, C = FuelCoach, S = F.S(); S.settings.overrides.vitD = { goal: 15 }; F.render();
    const M = C.gapModel(F.cur()); const r = { cap: C.capFor('vitD', M.T, true), aim: M.gaps.vitD.tgt, dSupp: C.suggest(F.cur(), 8).supps.filter(x => x.forK === 'vitD').length, note: document.getElementById('app').textContent.includes('above the general upper limit') };
    const d = S.days[F.cur()]; d.entries.push({ id: 'vd', key: 'x', name: 'Vit D test', meal: 'snacks', g: 1, n: { vitD: 96 - (M.t.vitD || 0) }, t: Date.now() });
    const s2 = C.suggest(F.cur(), 8); r.maxD = Math.max(0, ...s2.picks.concat(s2.supps).map(x => x.n.vitD || 0)); d.entries.pop();
    S.settings.overrides.vitD = {}; delete S.settings.overrides.vitD;
    // goal 250: with 175 already (75 left, still a ≥ 20% gap), a supplement may only top up to 250
    d.entries.push({ id: 'vd2', key: 'x', name: 'Vit D test', meal: 'snacks', g: 1, n: { vitD: 175 - (M.t.vitD || 0) }, t: Date.now() });
    const s3 = C.suggest(F.cur(), 8); r.top = s3.supps.filter(x => x.forK === 'vitD').map(x => x.n.vitD); d.entries.pop(); F.render(); return r; });
  console.log(JSON.stringify(ul));
  ok(ul.cap === 100 && ul.aim === 15 && ul.dSupp === 0 && !ul.note, 'vitamin D goal at RDA → UL 100 µg cap, no supplement, no note');
  ok(ul.maxD <= 4 + 1e-6, 'near the UL, nothing pushes vitamin D past 100 µg (largest add ' + ul.maxD.toFixed(1) + ' µg)');
  ok(ul.top.length > 0 && ul.top.every(v => v <= 75 + 1e-6), 'goal above UL: suggestions only top up to the user goal (' + ul.top.join(',') + ' µg)');
  await p.click('[data-coach="back"]'); await p.waitForTimeout(3500);   // let toasts clear
  const toCard = () => p.evaluate(() => { const c = document.querySelector('.co-card'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); return scrollY; });
  await cardsLayout(); await toCard(); await p.waitForTimeout(1500); await toCard(); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '14-today-card-supplement.png' });
  ok(await p.$('.co-card .co-g-supp'), 'Today card shows the supplement pick with its badge');
  await p.click('[data-coach="open"]'); await p.waitForTimeout(400);

  // ---- 4. Meal ideas ----
  await p.click('[data-coach-tab="meals"]'); await p.waitForTimeout(500); await shot('06-meal-ideas'); await shot('06b-meal-ideas-full', true);
  const ideas = await p.evaluate(() => { const r = FuelCoach.mealIdeas(__fuel.cur()); return { left: r.M.kcalLeft, meal: r.meal.map(x => `${x.t.nm} ${Math.round(x.kc)} kcal P${Math.round(x.n.protein)}`), snack: r.snack.map(x => `${x.t.nm} ${Math.round(x.kc)} kcal P${Math.round(x.n.protein)}`) }; });
  console.log(JSON.stringify(ideas, null, 1));
  ok(ideas.meal.length && ideas.meal.every(s => +s.match(/(\d+) kcal/)[1] <= ideas.left + 15), 'meal ideas fit remaining calories');
  await p.click('[data-coach-idea="0"]'); await p.waitForTimeout(600); ok(await p.$('#rapprove'), 'meal idea opens review with all foods'); await shot('07-meal-review');
  await p.evaluate(() => document.querySelector('.sheet [data-close]').click()); await p.waitForTimeout(500);

  // ---- 5. Insights ----
  await p.click('[data-coach-tab="insights"]'); await p.waitForTimeout(500);
  for (const r of [7, 30, 90]) { await p.click(`[data-coach-range="${r}"]`); await p.waitForTimeout(500); await shot(`08-insights-${r}d`); if (r === 30) await shot('08b-insights-30d-full', true); }
  const tk = await p.evaluate(() => FuelCoach.takeaways(FuelCoach.analyse(30)).map(x => x.ic + ' ' + x.text.replace(/<[^>]+>/g, '')));
  console.log(tk.join('\n'));
  ok(tk.length >= 4, 'insights produce takeaways');
  // sparse: wipe to 2 days
  await p.evaluate(() => { const S = __fuel.S(); const ks = Object.keys(S.days).sort(); ks.slice(0, -3).forEach(k => delete S.days[k]); __fuel.render(); });
  await p.click('[data-coach-range="7"]'); await p.waitForTimeout(400); ok((await p.textContent('#app')).includes('Need at least 3 full days'), 'sparse data handled'); await shot('09-insights-sparse');

  // ---- 6. other views still render, back button ----
  await p.click('[data-coach="back"]'); await p.waitForTimeout(300); ok(await p.$('[data-coach="open"]'), 'back to Today');
  for (const tab of ['nutrients', 'progress', 'awards', 'today']) { await p.click(`#tabbar [data-tab="${tab}"]`); await p.waitForTimeout(300); }
  // light theme check (if the Designer's theme layer is present)
  await ctx.close();
  const ctx2 = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', serviceWorkers: 'block' });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push('pageerror ' + e.message)); p2.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p2.goto(URL); await p2.waitForTimeout(1500); await p2.evaluate(() => __fuel.loadDB()); await p2.waitForTimeout(300);
  await p2.evaluate(() => __fuel.go('coach')); await p2.waitForTimeout(500); await p2.screenshot({ path: OUT + '10-eat-next-light-scheme.png' });
  ok(errs.length === 0, 'console errors: ' + errs.length + (errs.length ? '\n' + errs.join('\n') : ''));
  await b.close();
})();
