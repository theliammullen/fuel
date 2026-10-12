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
