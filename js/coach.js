/* Fuel Coach — offline "what to eat next", meal ideas, and habits & insights.
   100% local: reads the app through window.__fuel and the bundled food DB. No network calls.
   Loaded after js/app.js; registers the 'coach' view and a Today card (see the two hooks in app.js). */
(function (G) {
'use strict';
const A = () => G.__fuel;
const { N, BY, MICROS } = G.NUTR;
const NS = G.NUTR.SRC;
const SRC = {
  SA18: 'Schoenfeld & Aragon 2018, JISSN — ≥ 0.4 g/kg protein per meal over ≥ 4 meals to maximise muscle growth',
  ISSN_P: NS.ISSN_P + ' — 0.25 g/kg (≈20–40 g) protein every 3–4 h',
  DRI: NS.DRI, DRI_NAK: NS.DRI_NAK + ' — sodium CDRR 2300 mg', DRI_W: NS.DRI_W, ACSM_FLUID: NS.ACSM_FLUID,
  DGA: NS.DGA + ' — saturated fat & added sugars < 10% of calories', WHO_SFA: NS.WHO_SFA, HC_CAF: NS.HC_CAF, CCSA: NS.CCSA,
  REYNOLDS: NS.REYNOLDS, CFG: NS.CFG,
};

/* ---------- curated whole foods (Canadian-grocery staples) → bundled DB ids ----------
   [db id, friendly name, grams, portion label, group, opts]   groups: protein dairy legume grain fruit veg fat drink   */
const STAPLES = [
  [171477, 'Chicken breast, roasted', 120, '120 g cooked (≈1 small breast)', 'protein'],
  [cnf('502087'), 'Turkey breast, roasted', 120, '120 g cooked', 'protein'],
  [174752, 'Lean ground beef (93%), cooked', 100, '100 g cooked patty', 'protein'],
  [cnf('1932'), 'Pork tenderloin, roasted', 120, '120 g cooked', 'protein'],
  [cnf('130'), 'Eggs, hard-boiled', 100, '2 large eggs', 'protein', { snack: 1 }],
  [172183, 'Egg whites', 132, '4 egg whites', 'protein'],
  [173709, 'Light tuna, canned in water', 85, '1 small can, drained (85 g)', 'protein', { snack: 1 }],
  [175175, 'Pink salmon, canned (with bones)', 85, '½ can, drained (85 g)', 'protein', { snack: 1 }],
  [175168, 'Atlantic salmon, baked', 120, '120 g fillet', 'protein'],
  [175139, 'Sardines in oil, canned', 92, '1 can (92 g)', 'protein', { snack: 1 }],
  [cnf('3116'), 'Mussels (PEI), steamed', 100, '100 g meat (≈ 1 lb in shell)', 'protein'],
  [171956, 'Cod, baked', 150, '1 fillet (150 g)', 'protein'],
  [174198, 'Haddock, baked', 150, '1 fillet (150 g)', 'protein'],
  [171971, 'Shrimp, cooked', 100, '100 g (≈ 12 large)', 'protein'],
  [cnf('3418'), 'Tofu, firm', 150, '150 g (≈ ⅓ block)', 'protein'],
  [cnf('3321'), 'Tempeh', 100, '100 g', 'protein'],
  ['sup:whey', 'Whey protein isolate', 30, '1 scoop (30 g)', 'protein', { fixed: 1, snack: 1 }],
  [330137, 'Greek yogurt, plain 0%', 175, '¾ cup (175 g)', 'dairy', { snack: 1 }],
  [cnf('107'), 'Cottage cheese 1%', 119, '½ cup (125 ml)', 'dairy', { snack: 1 }],
  [cnf('63'), 'Milk 1%', 258, '1 cup (250 ml)', 'drink', { snack: 1 }],
  [cnf('114'), 'Skim milk', 259, '1 cup (250 ml)', 'drink', { snack: 1 }],
  [cnf('501950'), 'Soy beverage, fortified', 257, '1 cup (250 ml)', 'drink', { snack: 1 }],
  [2705394, 'Kefir', 244, '1 cup (250 ml)', 'drink', { snack: 1 }],
  [168411, 'Edamame, shelled', 155, '1 cup', 'legume', { snack: 1 }],
  [172421, 'Lentils, cooked', 198, '1 cup cooked', 'legume'],
  [cnf('502262'), 'Chickpeas, canned, rinsed', 164, '1 cup', 'legume'],
  [173735, 'Black beans, cooked', 172, '1 cup cooked', 'legume'],
  [173904, 'Large-flake oats', 40, '½ cup dry (40 g)', 'grain'],
  [cnf('4497'), 'Brown rice, cooked', 155, '¾ cup cooked', 'grain'],
  [170093, 'Potato (PEI), baked with skin', 173, '1 medium', 'grain'],
  [2709699, 'Sweet potato, baked', 150, '1 medium', 'grain'],
  [cnf('4067'), 'Whole-wheat bread', 72, '2 slices', 'grain'],
  [cnf('4517'), 'Whole-wheat spaghetti, cooked', 148, '1 cup cooked', 'grain'],
  [168917, 'Quinoa, cooked', 185, '1 cup cooked', 'grain'],
  [173944, 'Banana', 118, '1 medium', 'fruit', { snack: 1 }],
  [cnf('1696'), 'Apple', 182, '1 medium', 'fruit', { snack: 1 }],
  [cnf('1616'), 'Orange (navel)', 140, '1 orange', 'fruit', { snack: 1 }],
  [2709277, 'Blueberries, frozen', 150, '1 cup', 'fruit', { snack: 1 }],
  [168173, 'Strawberries, frozen', 149, '1 cup', 'fruit', { snack: 1 }],
  [168209, 'Raspberries, frozen', 140, '1 cup', 'fruit', { snack: 1 }],
  [2709239, 'Kiwi', 150, '2 kiwis', 'fruit', { snack: 1 }],
  [cnf('1731'), 'Pear', 178, '1 medium', 'fruit', { snack: 1 }],
  [cnf('2375'), 'Broccoli, cooked', 165, '1 cup', 'veg'],
  [168462, 'Spinach, raw', 60, '2 cups', 'veg'],
  [cnf('2105'), 'Kale, cooked', 137, '1 cup', 'veg'],
  [170393, 'Carrots', 122, '2 medium', 'veg', { snack: 1 }],
  [170108, 'Red bell pepper', 120, '1 medium', 'veg', { snack: 1 }],
  [cnf('2379'), 'Brussels sprouts, cooked', 165, '1 cup', 'veg'],
  [cnf('2412'), 'Green peas, frozen, cooked', 169, '1 cup', 'veg'],
  [170457, 'Tomato', 123, '1 medium', 'veg'],
  [169251, 'Mushrooms', 70, '1 cup sliced', 'veg'],
  [cnf('2452'), 'Butternut squash, baked', 205, '1 cup', 'veg'],
  [170567, 'Almonds', 28, '¼ cup (28 g)', 'fat', { snack: 1, half: 1 }],
  [170187, 'Walnuts', 28, '¼ cup (28 g)', 'fat', { snack: 1, half: 1 }],
  [cnf('6289'), 'Natural peanut butter', 32, '2 tbsp', 'fat', { half: 1 }],
  [2707590, 'Chia seeds', 12, '1 tbsp', 'fat', { fixed: 1 }],
  [169414, 'Ground flaxseed', 14, '2 tbsp', 'fat', { fixed: 1 }],
  [170556, 'Pumpkin seeds', 28, '¼ cup (28 g)', 'fat', { snack: 1, half: 1 }],
  [cnf('1511'), 'Avocado', 100, '½ avocado', 'fat', { half: 1 }],
  [cnf('422'), 'Olive oil', 14, '1 tbsp', 'fat', { fixed: 1 }],
];
function cnf(n) { return 'cnf' + n; }
const GROUP_LABEL = { protein: 'Protein', dairy: 'Dairy', drink: 'Drink', legume: 'Legumes', grain: 'Starch', fruit: 'Fruit', veg: 'Veg', fat: 'Fats', mine: 'Yours', supp: 'Supplement' };

/* meal & snack templates (2–4 foods). parts: [staple id, multiplier of the staple portion] */
const MEALS_T = [
  { nm: 'Chicken, rice & broccoli bowl', ic: '🍗', kind: 'meal', parts: [[171477, 1.25], [cnf('4497'), 1], [cnf('2375'), 1]] },
  { nm: 'Salmon, PEI potato & Brussels sprouts', ic: '🐟', kind: 'meal', parts: [[175168, 1.25], [170093, 1], [cnf('2379'), 1]] },
  { nm: 'Tuna sandwich & red pepper', ic: '🥪', kind: 'meal', parts: [[173709, 1.5], [cnf('4067'), 1], [170108, 1], [168462, 0.5]] },
  { nm: 'Eggs, whites & toast', ic: '🍳', kind: 'meal', parts: [[cnf('130'), 1], [172183, 1], [cnf('4067'), 1], [168462, 0.5]] },
  { nm: 'Overnight oats with Greek yogurt', ic: '🥣', kind: 'meal', parts: [[173904, 1], [330137, 1], [2709277, 0.67], [2707590, 1]] },
  { nm: 'PEI mussels & whole-wheat bread', ic: '🦪', kind: 'meal', parts: [[cnf('3116'), 1.5], [cnf('4067'), 1], [170457, 1]] },
  { nm: 'Lean beef, black bean & pepper bowl', ic: '🌯', kind: 'meal', parts: [[174752, 1.25], [173735, 0.5], [170108, 1], [cnf('4497'), 0.67]] },
  { nm: 'Pork tenderloin, sweet potato & peas', ic: '🥩', kind: 'meal', parts: [[cnf('1932'), 1.25], [2709699, 1], [cnf('2412'), 0.75]] },
  { nm: 'Turkey & quinoa with kale', ic: '🦃', kind: 'meal', parts: [[cnf('502087'), 1.25], [168917, 0.75], [cnf('2105'), 1]] },
  { nm: 'Cod, potato & green peas', ic: '🐠', kind: 'meal', parts: [[171956, 1.25], [170093, 1], [cnf('2412'), 0.75]] },
  { nm: 'Tofu & edamame stir-fry with rice', ic: '🥢', kind: 'meal', parts: [[cnf('3418'), 1.25], [168411, 0.5], [cnf('2375'), 1], [cnf('4497'), 0.67]] },
  { nm: 'Lentil & sardine plate', ic: '🥗', kind: 'meal', parts: [[175139, 1], [172421, 0.75], [168462, 1], [170457, 1]] },
  { nm: 'Greek yogurt & berries', ic: '🫐', kind: 'snack', parts: [[330137, 1], [168209, 0.75]] },
  { nm: 'Cottage cheese & pear', ic: '🍐', kind: 'snack', parts: [[cnf('107'), 1.5], [cnf('1731'), 0.75]] },
  { nm: 'Protein shake (whey + 1% milk + banana)', ic: '🥤', kind: 'snack', parts: [['sup:whey', 1], [cnf('63'), 1], [173944, 1]] },
  { nm: 'Eggs & carrots', ic: '🥚', kind: 'snack', parts: [[cnf('130'), 1], [170393, 1]] },
  { nm: 'Tuna & apple', ic: '🍎', kind: 'snack', parts: [[173709, 1], [cnf('1696'), 1]] },
  { nm: 'Edamame & orange', ic: '🫛', kind: 'snack', parts: [[168411, 0.75], [cnf('1616'), 1]] },
  { nm: 'Skim milk & almonds', ic: '🥛', kind: 'snack', parts: [[cnf('114'), 1], [170567, 0.5]] },
  { nm: 'Kefir & walnuts', ic: '🥛', kind: 'snack', parts: [[2705394, 1], [170187, 0.5]] },
];

const LIMITS = ['sodium', 'satFat', 'transFat', 'addedSugar', 'caffeine'];

/* ---------- user-chosen goals & upper limits ----------
   A nutrient has a "custom goal" when it is a userGoal nutrient (vitamin D, creatine — js/nutrients.js) or the user typed
   a goal under Customise (S.settings.overrides[k].goal). For those the Coach aims at the ACTIVE goal (T[k].goal), not the
   default RDA/AI. ULs stay hard caps for everything the Coach suggests, except that when the user's own goal is above the
   UL the cap becomes that goal: the Coach can help reach what they chose, but never goes past it on its own initiative. */
function customGoal(k) {
  const n = BY[k]; if (!n || n.type !== 'target') return false;
  const ov = ((A().S().settings || {}).overrides || {})[k];
  return !!n.userGoal || !!(ov && ov.goal != null && ov.goal !== '' && !isNaN(ov.goal));
}
/* target the Coach aims for: active goal when the user chose one; otherwise the given default (base/goal) */
function aimFor(k, T, dflt) { const tg = T[k]; if (!tg) return null; return customGoal(k) && tg.goal > 0 ? tg.goal : dflt; }
/* effective upper cap for a nutrient (null = none). ulNote ULs (folic acid, supplemental vit E/niacin, preformed vit A)
   only bite for supplements. */
function capFor(k, T, supp) {
  const tg = T[k], x = BY[k]; if (!tg || !tg.ul || tg.ulSoft || !x) return null;
  if (x.ulNote && !supp) return null;
  return customGoal(k) && tg.goal > tg.ul ? tg.goal * (1 + SUPP_RULE.goalTol) : tg.ul;
}
/* goals the user set above the general UL → one neutral line in the Coach */
function aboveUL(T) { return N.filter(x => customGoal(x.key) && T[x.key] && T[x.key].ul && !T[x.key].ulSoft && T[x.key].goal > T[x.key].ul).map(x => x.key); }
function ulGoalNote(T, keys) {
  const a = A(); keys = keys || aboveUL(T); if (!keys.length) return '';
  const q = k => { const n = BY[k], v = v2 => a.fmt(v2, n.dp || 0) + ' ' + n.unit + (n.iu ? ' / ' + a.fmt(v2 * n.iu) + ' IU' : ''); return `${n.name}: your goal (${v(T[k].goal)}) is above the general upper limit (${v(T[k].ul)})`; };
  return `<div class="co-ulnote">ℹ️ ${keys.map(q).join('; ')} — a goal this high is best followed with a clinician’s guidance.</div>`;
}
/* nutrients the bundled food data has no values for, so only supplements/labels can count (see creatine in nutrients.js) */
const SUPP_ONLY = new Set(['creatine']);
let uidN = 0; const uid = () => 'co' + Date.now().toString(36) + (uidN++);
const r1 = v => Math.round(v * 10) / 10;

/* ---------- item helpers ---------- */
let STAPLE_CACHE = null;
function staples() {
  const a = A(); const DB = a.DB(); if (!DB) return [];
  if (STAPLE_CACHE) return STAPLE_CACHE;
  STAPLE_CACHE = [];
  STAPLES.forEach(s => {
    let it = null;
    if (typeof s[0] === 'string' && s[0].startsWith('sup:')) { const sp = a.SUPPS.find(x => 'sup:' + x.id === s[0]); if (sp) it = a.suppItem(sp); }
    else { const f = DB.byId.get(s[0]); if (f) it = a.usdaItem(f); }
    if (it) STAPLE_CACHE.push({ id: s[0], key: it.key, it, nm: s[1], g: s[2], pl: s[3], grp: s[4], o: s[5] || {} });
  });
  return STAPLE_CACHE;
}
const stapleById = id => staples().find(s => s.id === id);
function nOf(it, g) {
  const n = {}; const f = g / 100;
  for (const k in it.n100) { const v = it.n100[k]; if (v != null && isFinite(v)) n[k] = v * f; }
  n.epaDha = (n.epa || 0) + (n.dha || 0);
  n.water = it.hyd ? (n.moisture != null ? n.moisture : g * 0.9) : 0;
  return n;
}
function addTo(acc, n, f = 1) { for (const k in n) acc[k] = (acc[k] || 0) + n[k] * f; return acc; }
function groupOf(it) {
  const n = it.n100; const kc = n.kcal || 0;
  if (it.hyd) return 'drink';
  if (kc > 0 && (n.protein || 0) * 4 / kc >= 0.35) return 'protein';
  return 'mine';
}
/* user's own: favourites, frequent (≥2 of last 30 days), saved label foods, recipes */
function mine() {
  const a = A(); let list = [];
  try { list = a.myItems(); } catch (e) { list = []; }
  return list.filter(x => x.it && x.it.n100 && (x.it.n100.kcal != null) && !isSupp(x.it)).map(({ it, why }) => {
    const ds = a.defaultServing(it);
    return { id: it.key, key: it.key, it, nm: it.name.split(',').slice(0, 2).join(','), g: ds.g, pl: ds.label, grp: 'mine', mine: why, o: { fixed: 0 } };
  });
}

/* ---------- supplements ----------
   Rule (see suggestSupps): a supplement is suggested for a nutrient only when
     1. the nutrient still has a meaningful gap after today's food picks (≥ 20% of the aim left), and
     2. food can't practically close it: the best single food portion that fits the remaining calories and every cap
        covers < 50% of what's left (always true for supplement-only nutrients such as creatine, and for a vitamin D
        goal far above what fish/fortified milk can supply), and
     3. the dose keeps every cap (sodium/sat fat/added sugar/caffeine, ULs) and doesn't pass the user's own goal.
   The user's own saved supplements (favourites, recent, label-scanned) come first, then the app's generic ones.
   Gaps that food can easily fill (e.g. omega-3 when salmon fits, magnesium when pumpkin seeds fit) get food only. */
const SUPP_RULE = { minGap: 0.2, foodOk: 0.5, maxServ: 4, goalTol: 0.1 };   // goalTol: a dose may land ≤ 10% past a goal (food intake is approximate), e.g. 1 × 250 µg on top of 12 µg from food
const GENERIC_SUPPS = ['creatine', 'd10000', 'd2000', 'd1000', 'fish1', 'algae', 'mg200'];   // no whey (a food staple), multi, caffeine or electrolyte mixes
const SUPP_RE = /supplement|creatine|vitamin|\bd3\b|softgel|capsule|tablet|fish oil|omega-?3|magnesium|multivitamin/i;
function servKcal(it) { const g = it.servingG || (it.portions && it.portions[0] && it.portions[0][1]) || 100; return (it.n100.kcal || 0) * g / 100; }
/* a logged entry that is a supplement (same test as isSupp, on the entry's stored nutrients) */
function entryIsSupp(e) {
  const kc = (e.n && e.n.kcal) || 0;
  if (String(e.key || '').startsWith('sup:')) return e.key !== 'sup:whey';   // every generic supplement except whey (a food here)
  return e.src === 'cus' && SUPP_RE.test(e.name || '') && kc < 20;
}
function isSupp(it) {
  if (!it || !it.n100) return false;
  if (String(it.key || '').startsWith('sup:')) return servKcal(it) < 50;          // whey (113 kcal) stays a food
  return it.src === 'cus' && SUPP_RE.test(it.name || '') && servKcal(it) < 20;    // label-scanned supplement
}
function ownSupps() {
  const a = A(), S = a.S(), out = [], seen = new Set();
  const add = (it, why) => { if (!it || !it.key || seen.has(it.key) || !isSupp(it)) return; seen.add(it.key); out.push({ it, why }); };
  (S.favs || []).forEach(f => add(Object.assign({}, f), 'fav'));
  (S.recent || []).forEach(r => add(Object.assign({}, r), 'freq'));
  (S.customFoods || []).forEach(c => add({ key: 'cus:' + c.id, name: c.name, sub: (c.brand ? c.brand + ' · ' : '') + 'Custom', src: 'cus', n100: c.n100 || {}, portions: c.portions || [], servingG: c.servingG, dens: null, hyd: false }, 'mine'));
  return out;
}
function suppPool() {
  const a = A(), own = ownSupps(), keys = new Set(own.map(x => x.it.key));
  const gen = GENERIC_SUPPS.map(id => a.SUPPS.find(x => x.id === id)).filter(Boolean).map(sp => a.suppItem(sp)).filter(it => !keys.has(it.key));
  const mk = (it, why) => {
    let g, pl; try { const ds = a.defaultServing(it); g = ds.g; pl = ds.label; } catch (e) { g = it.servingG || 1; pl = '1 serving'; }
    if (!(g > 0)) { g = it.servingG || 1; pl = '1 serving'; }
    return { id: it.key, key: it.key, it, nm: it.name, g, pl: pl || '1 serving', grp: 'supp', supp: true, mine: why, own: !!why, o: { fixed: 1 } };
  };
  return own.map(x => mk(x.it, x.why)).concat(gen.map(it => mk(it, null)));
}
/* share of the remaining gap the best practical food portion could cover (within calories & caps) */
function bestFoodShare(k, rem, M, acc, budget, pool) {
  let best = 0, who = null;
  for (const c of pool) {
    const v100 = c.it.n100[k === 'epaDha' ? 'epa' : k] || 0; if (v100 <= 0 && !(k === 'epaDha' && c.it.n100.dha > 0)) continue;
    for (const m of c.o.fixed || c.mine ? [1] : [1, 2]) {
      const n = nOf(c.it, c.g * m); if ((n.kcal || 0) > budget + 10) continue;
      if (evalN(n, M, acc).viol.length) continue;
      const sh = Math.min(n[k] || 0, rem) / rem; if (sh > best) { best = sh; who = { c, m }; }
    }
  }
  return { share: best, who };
}
function suggestSupps(M, acc, budget, foodPool, limit = 3) {
  const out = [], acc2 = Object.assign({}, acc), done = new Set();
  const NON = new Set(['protein', 'fibre', 'carbs', 'fat', 'water', 'ala', 'omega6']);   // food-only gaps
  const gaps = Object.keys(M.gaps).filter(k => !NON.has(k)).map(k => { const g = M.gaps[k]; const rem = Math.max(0, g.rem - (acc[k] || 0)); return { k, rem, tgt: g.tgt, frac: rem / g.tgt }; })
    .filter(x => x.rem > 0 && x.frac >= SUPP_RULE.minGap).sort((x, y) => (customGoal(y.k) - customGoal(x.k)) || (y.frac - x.frac));
  if (!gaps.length) return out;
  const pool = suppPool();
  for (const g of gaps) {
    if (out.length >= limit) break;
    const food = SUPP_ONLY.has(g.k) ? { share: 0, who: null } : bestFoodShare(g.k, g.rem, M, acc2, budget, foodPool);
    if (food.share >= SUPP_RULE.foodOk) continue;                       // food can do it → no supplement
    let best = null;
    for (const c of pool) {
      if (done.has(c.key)) continue;
      const one = nOf(c.it, c.g); const dose = one[g.k] || 0; if (dose <= 0) continue;
      // primary nutrient of this supplement must be g.k (a multi doesn't count as a vitamin D supplement)
      const prim = Object.keys(M.gaps).filter(k => (one[k] || 0) > 0).sort((x, y) => (one[y] / M.gaps[y].tgt) - (one[x] / M.gaps[x].tgt))[0];
      if (prim !== g.k) continue;
      const room = (aimFor(g.k, M.T, g.tgt) || g.tgt) - (M.t[g.k] || 0) - (acc2[g.k] || 0);   // never past the user's goal
      const tol = SUPP_RULE.goalTol * g.tgt;
      let nServ = Math.max(1, Math.min(SUPP_RULE.maxServ, Math.floor((g.rem + tol) / dose)));
      while (nServ > 1 && dose * nServ > room + tol + 1e-9) nServ--;
      if (dose > room + tol) continue;
      const n = nOf(c.it, c.g * nServ);
      const e = evalN(n, M, acc2, true); if (e.viol.length) continue;
      if ((n.kcal || 0) > Math.max(budget, 15) + 10) continue;
      const sc = (c.own ? 2 : 1) + Math.min(n[g.k], g.rem) / g.rem - 0.05 * nServ;     // own supplements first, then best fit, then fewest servings
      if (!best || sc > best.sc) best = { c, nServ, n, e, sc };
    }
    if (!best) continue;
    const c = best.c; done.add(c.key);
    const label = best.nServ === 1 ? c.pl : /^1\s+\S/.test(c.pl) ? c.pl.replace(/^1\s+([^\s(,]+)/, (m, w) => best.nServ + ' ' + (/s$/.test(w) ? w : w + 's')) : best.nServ + ' × ' + c.pl;   // '2 scoops', '4 servings'
    out.push({ c, m: best.nServ, g: Math.round(c.g * best.nServ * 100) / 100, n: best.n, kc: best.n.kcal || 0, e: best.e, label, supp: true, forK: g.k,
      reason: SUPP_ONLY.has(g.k) ? 'not in food data — supplement only' : food.who && food.share >= 0.01 ? `best food (${food.who.c.nm}) covers only ${Math.round(food.share * 100)}% of the ${amtText(g.k, g.rem)} left` : M.kcalLeft > 60 ? `food can’t practically supply the ${amtText(g.k, g.rem)} left` : `no calories left for food sources today` });
    addTo(acc2, best.n); for (const k in best.n) acc2['_s_' + k] = (acc2['_s_' + k] || 0) + best.n[k];
  }
  return out;
}

/* ---------- gap model for a day ---------- */
function gapModel(ds) {
  const a = A(); const T = a.targetsFor(ds); const tot = a.totals(ds); const t = tot.t;
  const gaps = {};
  const add = (k, tgt, w) => { if (!(tgt > 0)) return; const have = t[k] || 0; gaps[k] = { tgt, have, rem: Math.max(0, tgt - have), w }; };
  // default aims: goal for protein/fibre/carbs/water, baseline (RDA/AI, AMDR floor) for the rest; a user-chosen goal always wins
  add('protein', aimFor('protein', T, T.protein.goal), 4);
  add('fibre', aimFor('fibre', T, T.fibre.goal), 1.5);
  add('carbs', aimFor('carbs', T, T.carbs.goal), 0.25);
  add('fat', aimFor('fat', T, T.fat.base), 0.2);                // only the AMDR floor counts as a gap
  add('epaDha', aimFor('epaDha', T, T.epaDha.base), 0.8);
  add('ala', aimFor('ala', T, T.ala.base), 0.4);
  add('omega6', aimFor('omega6', T, T.omega6.base), 0.3);
  add('water', aimFor('water', T, T.water.goal), 0.4);
  MICROS.forEach(k => add(k, aimFor(k, T, T[k].base), ['potassium', 'vitD', 'magnesium', 'calcium'].includes(k) ? 0.5 : 0.35)); // ≈ protein + fibre combined
  // any other nutrient with a user-chosen goal (e.g. creatine 10 g)
  N.forEach(x => { if (!gaps[x.key] && x.type === 'target' && customGoal(x.key) && T[x.key]) add(x.key, T[x.key].goal, 0.5); });
  const kcalLeft = Math.round(T.kcal.goal - (t.kcal || 0));
  // supplement totals already logged today → supplement-only ULs (folic acid, niacin, vit E, preformed A) include them
  const suppT = {}; const dd = a.S().days[ds]; ((dd && dd.entries) || []).filter(entryIsSupp).forEach(e => addTo(suppT, e.n || {}));
  return { ds, T, t, gaps, suppT, kcalLeft, waterLeft: Math.max(0, Math.round(T.water.goal - (t.water || 0))), coverage: tot.coverage, count: tot.count };
}
/* value of adding nutrients n on top of what's eaten (+acc from earlier picks) */
function evalN(n, M, acc, supp) {
  let gain = 0; const contrib = [];
  for (const k in M.gaps) {
    const g0 = M.gaps[k]; const rem = Math.max(0, g0.rem - (acc[k] || 0)); const v = n[k] || 0;
    if (v <= 0 || rem <= 0) continue;
    const f = Math.min(v, rem) / g0.tgt; gain += g0.w * f;
    contrib.push({ k, amt: Math.min(v, rem), f, wf: g0.w * f });
  }
  const T = M.T, t = M.t, viol = [];
  LIMITS.forEach(k => { const lim = T[k] && T[k].limit; if (lim != null && (n[k] || 0) > 0 && (t[k] || 0) + (acc[k] || 0) + n[k] > lim) viol.push(k); });
  N.forEach(x => {
    const v = n[x.key] || 0; if (v <= 0) return; const cap = capFor(x.key, T, supp); if (cap == null) return;
    // ulNote ULs apply to the supplement dose itself (food folate/niacin/vit E/carotenoids don't count toward them)
    const tot = x.ulNote ? ((M.suppT || {})[x.key] || 0) + (acc['_s_' + x.key] || 0) + v : (t[x.key] || 0) + (acc[x.key] || 0) + v;
    if (tot > cap) viol.push(x.key);
  });
  // soft penalties: sodium & saturated fat eat into today's allowance
  const pen = (T.sodium.limit ? 0.6 * (n.sodium || 0) / T.sodium.limit : 0) + (T.satFat.limit ? 0.4 * (n.satFat || 0) / T.satFat.limit : 0);
  contrib.sort((x, y) => y.wf - x.wf);
  return { gain: Math.max(0, gain - pen), contrib, viol };
}
function budgetFor(M) { return M.kcalLeft <= 60 ? 40 : Math.max(120, Math.min(M.kcalLeft, Math.max(250, M.kcalLeft * 0.6))); }
function bestPortion(c, M, acc, budget) {
  // practical servings only: never shrink a main food below one normal portion
  const mults = c.o.fixed || c.mine ? [1] : c.o.half ? [0.5, 1] : ['veg', 'fruit', 'drink'].includes(c.grp) ? [1, 2] : [1, 1.5, 2];
  const opts = [];
  for (const m of mults) {
    const g = c.g * m; const n = nOf(c.it, g); const kc = n.kcal || 0;
    if (kc > budget + 10) continue;
    const e = evalN(n, M, acc); if (e.viol.length || e.gain < 0.03) continue;
    opts.push({ m, g, n, kc, e, val: e.gain / Math.max(kc, 90) * 100 });   // 90-kcal floor so 20-kcal garnishes don't swamp the list
  }
  if (!opts.length) return null;
  const top = Math.max(...opts.map(o => o.val));
  return opts.filter(o => o.val >= top * 0.8).sort((x, y) => y.e.gain - x.e.gain)[0];
}
function portionLabel(c, m) {
  if (m === 1) return c.pl;
  return A().portionText(m, c.pl, Math.round(c.g * m)); // e.g. '1½ cups cooked (297 g)', not '1.5 × 1 cup cooked'
}
/* greedy, diversity-aware picks that close the most gaps per calorie */
function suggest(ds, limit = 6) {
  const M = gapModel(ds);
  const st = staples(); const my = mine(); const seen = new Set(my.map(x => x.key));
  const pool = my.concat(st.filter(s => !seen.has(s.key)));
  const budget = budgetFor(M);
  const picks = [], acc = {}, grpN = {};
  const cap = { protein: 2, veg: 2, mine: 2 };
  const protNeed = M.gaps.protein && M.gaps.protein.rem >= 20, protBig = M.gaps.protein && M.gaps.protein.rem >= 60;
  const isProt = c => ['protein', 'dairy'].includes(c.grp) || (c.mine && groupOf(c.it) === 'protein');
  for (let i = 0; i < limit; i++) {
    let best = null;
    for (const c of pool) {
      if (picks.some(p => p.c === c)) continue;
      if ((grpN[c.grp] || 0) >= (cap[c.grp] || 1)) continue;
      if ((i === 0 && protNeed || i === 1 && protBig) && !isProt(c)) continue;   // big protein gap → lead with protein foods
      const b = bestPortion(c, M, acc, budget); if (!b) continue;
      const s = b.val * (c.mine ? 1.25 : 1);
      if (!best || s > best.s) best = { c, b, s };
    }
    if (!best) break;
    picks.push({ c: best.c, m: best.b.m, g: Math.round(best.b.g), n: best.b.n, kc: best.b.kc, e: best.b.e, label: portionLabel(best.c, best.b.m) });
    addTo(acc, best.b.n); grpN[best.c.grp] = (grpN[best.c.grp] || 0) + 1;
  }
  let supps = []; try { supps = suggestSupps(M, acc, budget, pool); } catch (e) { supps = []; }
  return { M, picks, supps, budget };
}
/* meal & snack ideas */
function mealIdeas(ds) {
  const M = gapModel(ds); const out = { meal: [], snack: [] };
  if (!staples().length) return { M, ...out };
  MEALS_T.forEach(t => {
    const parts = t.parts.map(([id, m]) => ({ s: stapleById(id), m })).filter(p => p.s);
    if (parts.length < 2) return;
    const budget = t.kind === 'snack' ? Math.min(M.kcalLeft, 400) : Math.min(M.kcalLeft, 900);
    let best = null;
    for (const sc of [0.5, 0.75, 1, 1.25, 1.5]) {
      const n = {}; parts.forEach(p => addTo(n, nOf(p.s.it, p.s.g * p.m * sc)));
      const kc = n.kcal || 0; if (kc > budget + 15 || kc < 60) continue;
      const e = evalN(n, M, {}); if (e.viol.length) continue;
      const val = e.gain / Math.max(kc, 80) * 100;
      if (!best || e.gain > best.e.gain) best = { sc, n, kc, e, val };
    }
    if (best) out[t.kind].push({ t, parts, ...best });
  });
  ['meal', 'snack'].forEach(k => out[k].sort((x, y) => (y.e.gain * 0.6 + y.val * 0.4) - (x.e.gain * 0.6 + x.val * 0.4)));
  out.meal = out.meal.slice(0, 4); out.snack = out.snack.slice(0, 3);
  return { M, ...out };
}

/* ---------- text helpers ---------- */
function amtText(k, amt) { const n = BY[k]; return k === 'water' ? fmtMl(amt) : A().fmt(amt, amt < 10 ? 1 : 0) + (n.unit === 'g' ? ' g' : ' ' + n.unit); }
function fmtMl(ml) { return ml >= 1000 ? r1(ml / 1000) + ' L' : Math.round(ml) + ' ml'; }
function whyText(e, M, max = 3) {
  return e.contrib.slice(0, max).map(c => {
    const n = BY[c.k];
    if (['protein', 'fibre', 'carbs', 'water'].includes(c.k)) return `<b>${amtText(c.k, c.amt)}</b> ${n.short.toLowerCase()}`;
    return `<b>${Math.round(c.f * 100)}%</b> ${n.short}`;
  }).join(' · ');
}
function leftLine(M) {
  const a = A(), g = M.gaps;
  const bits = [`<b>${a.fmt(Math.max(0, M.kcalLeft))}</b> kcal`];
  if (g.protein) bits.push(`<b>${a.fmt(g.protein.rem)} g</b> protein`);
  if (g.fibre) bits.push(`<b>${a.fmt(g.fibre.rem)} g</b> fibre`);
  bits.push(`<b>${fmtMl(M.waterLeft)}</b> water`);
  const low = MICROS.filter(k => g[k] && g[k].rem > 0).length;
  return `${M.kcalLeft < 0 ? `<span style="color:var(--s-bad,var(--bad))">${a.fmt(-M.kcalLeft)} kcal over</span> · ` : 'Left: '}${(M.kcalLeft < 0 ? bits.slice(1) : bits).join(' · ')}${low ? ` · ${low} micros below target` : ''}`;
}

/* ---------- logging through the existing review flow ---------- */
let PICKS = [], IDEAS = [];
function logRows(rows, title) {
  A().openReview(rows.map(r => ({ id: uid(), ai: { name: r.nm, portion: r.label }, item: r.it, cands: [], g: Math.max(1, Math.round(r.g)), hyd: !!r.it.hyd })), { title, via: 'coach' });
}
function pickRow(p, i, compact) {
  const a = A(), c = p.c;
  if (p.supp) return `<button class="co-pick co-supp" data-coach-pick="${i}"><span class="co-grp co-g-supp">💊<br>Supplement</span>
    <div class="co-pm"><b>${a.esc(c.nm)}</b><span>${a.esc(p.label)}${p.kc >= 1 ? ' · ' + a.fmt(p.kc) + ' kcal' : ''}${c.own ? ' · <i>yours</i>' : ''}</span><span class="co-why"><b>${amtText(p.forK, p.n[p.forK] || 0)}</b> ${a.esc(BY[p.forK].short)}${compact ? '' : ' · ' + a.esc(p.reason)}</span></div>
    <span class="co-add">＋</span></button>`;
  return `<button class="co-pick" data-coach-pick="${i}"><span class="co-grp co-g-${c.grp}">${c.mine ? (c.mine === 'fav' ? '★' : '🔁') : ''}${GROUP_LABEL[c.grp] || ''}</span>
    <div class="co-pm"><b>${a.esc(c.nm)}</b><span>${a.esc(p.label)} · ${a.fmt(p.kc)} kcal</span>${compact ? '' : `<span class="co-why">${whyText(p.e, null)}</span>`}</div>
    <span class="co-add">＋</span></button>`;
}
function waterRow(M) {
  if (M.waterLeft < 200) return '';
  const ml = Math.min(750, Math.max(250, Math.round(M.waterLeft / 2 / 250) * 250));
  return `<button class="co-pick" data-coach-water="${ml}"><span class="co-grp co-g-drink">Water</span><div class="co-pm"><b>Glass of water</b><span>${fmtMl(ml)} · 0 kcal · ${fmtMl(M.waterLeft)} still to go</span></div><span class="co-add">＋</span></button>`;
}

/* ---------- Today card ---------- */
let dbAsked = false;
function ensureDB() {
  const a = A(); if (a.DB() || dbAsked) return; dbAsked = true;
  a.loadDB().then(() => { STAPLE_CACHE = null; a.render(); }).catch(() => {});
}
function todayCard() {
  const a = A(); if (!a || !a.DB) return '';
  if (!a.DB()) { ensureDB(); return `<div class="card co-card"><h2>🧭 Coach</h2><div class="mut small">Loading food database…</div></div>`; }
  const ds = a.cur(); const R = suggest(ds, 3); const M = R.M; const picks = R.picks.concat(R.supps.slice(0, 2)); PICKS = picks;
  const ulKeys = aboveUL(M.T).filter(k => R.supps.slice(0, 2).some(p => p.forK === k));
  return `<div class="card co-card"><h2>🧭 What to eat next <button class="r" data-coach="open">Coach ›</button></h2>
   <div class="co-left">${leftLine(M)}</div>
   ${picks.length ? `<div class="co-list">${picks.map((p, i) => pickRow(p, i, !!p.supp)).join('')}</div>` : `<div class="mut small" style="margin:8px 0">${M.kcalLeft <= 60 ? 'You’re at your calorie target — nothing calorie-dense needed today.' : 'Nothing in the staples list closes a gap without breaking a limit.'}</div>`}
   ${waterRow(M)}
   ${ulKeys.length ? ulGoalNote(M.T, ulKeys) : ''}
   <div class="tiny dim" style="margin-top:8px">Tap to review &amp; log. Ranked by gaps closed per calorie, within your sodium, sat-fat, added-sugar and UL caps.</div></div>`;
}

/* ---------- Coach view ---------- */
const UI = { tab: 'next', range: 30 };
function header(sub) {
  return `<div class="top"><button class="iconbtn" data-coach="back" aria-label="Back">‹</button><div class="grow"><div class="sub">${sub}</div><h1>Coach</h1></div></div>
  <div class="seg co-seg">${[['next', '🍽️ Eat next'], ['meals', '🥗 Meal ideas'], ['insights', '📊 Insights']].map(([k, l]) => `<button class="${UI.tab === k ? 'on' : ''}" data-coach-tab="${k}">${l}</button>`).join('')}</div>`;
}
function renderCoach() {
  const a = A(); const ds = a.cur();
  if (!a.DB() && UI.tab !== 'insights') { ensureDB(); return header(a.dateLabel(ds)) + '<div class="card"><div class="empty">Loading food database…</div></div>'; }
  if (UI.tab === 'next') return header('For ' + a.dateLabel(ds).toLowerCase()) + nextView(ds);
  if (UI.tab === 'meals') return header('For ' + a.dateLabel(ds).toLowerCase()) + mealsView(ds);
  return header('Your habits') + insightsView();
}
function nextView(ds) {
  const a = A(); const { M, picks, supps } = suggest(ds, 8); PICKS = picks.concat(supps);
  const g = M.gaps;
  const microLow = MICROS.filter(k => g[k] && g[k].rem > 0).sort((x, y) => g[x].have / g[x].tgt - g[y].have / g[y].tgt);
  const extra = Object.keys(g).filter(k => !MICROS.includes(k) && !['protein', 'fibre', 'water', 'carbs', 'fat', 'epaDha', 'ala', 'omega6'].includes(k));   // e.g. creatine
  const own = k => customGoal(k) ? ' (your goal)' : '';
  const bar = (k, label) => { const x = g[k]; if (!x) return ''; const p = Math.min(1, x.have / x.tgt); return `<div class="co-gap"><div class="row"><span>${label}</span><span class="mut small" style="margin-left:auto">${amtText(k, x.have)} / ${amtText(k, x.tgt)}</span></div><div class="bar"><i style="width:${p * 100}%;background:${BY[k].color}"></i></div></div>`; };
  return `<div class="card"><h2>Today’s gaps</h2><div class="co-left">${leftLine(M)}</div>
     ${bar('protein', 'Protein' + own('protein'))}${bar('fibre', 'Fibre' + own('fibre'))}${bar('water', 'Water' + own('water'))}${extra.map(k => bar(k, BY[k].name + own(k))).join('')}
     ${microLow.length ? `<div class="mut small" style="margin-top:10px">Below target: ${microLow.slice(0, 12).map(k => `<span class="pill" style="margin:3px 3px 0 0">${BY[k].short} ${Math.round(g[k].have / g[k].tgt * 100)}%${customGoal(k) ? ' of your goal' : ''}</span>`).join('')}</div>` : '<div class="mut small" style="margin-top:10px">✓ All tracked micronutrients at target.</div>'}
     ${ulGoalNote(M.T)}
     ${lowCoverage(M)}</div>
   <div class="card"><h2>What to eat next</h2>
     ${picks.length ? `<div class="co-list">${picks.map((p, i) => pickRow(p, i, false)).join('')}</div>` : `<div class="empty">${M.kcalLeft <= 60 ? 'You’ve hit your calorie target. Only near-zero-calorie foods and water would fit.' : 'No staple closes a gap without breaking a cap.'}</div>`}
     ${waterRow(M)}
     ${supps.length ? `<h2 style="margin-top:16px">Supplements <span class="r" style="color:var(--mut);font-weight:500">only where food can’t</span></h2><div class="co-list">${supps.map((p, i) => pickRow(p, picks.length + i, false)).join('')}</div>` : ''}
     ${capsNote(M)}
     <div class="tiny dim" style="margin-top:10px">Scoring: each food’s portion is scored by how much of your remaining protein (weighted ×4), fibre, water, essential fats and below-baseline vitamins &amp; minerals it covers, divided by its calories. Your favourites and frequent foods get a 25% boost. Where you set your own goal (e.g. vitamin D, creatine), that goal is the target. Supplements are suggested only for gaps of ≥ 20% that the best food portion fitting your calories and caps can’t cover at least half of (or that foods don’t supply, like creatine) — your own saved supplements first — and never past your goal. Portions that would push sodium, saturated fat, added sugar, caffeine or any Tolerable Upper Intake Level over today’s cap are skipped. Food values: USDA FoodData Central &amp; Health Canada CNF.</div></div>`;
}
function lowCoverage(M) {
  const low = ['vitD', 'vitE', 'vitK', 'choline', 'selenium', 'manganese', 'pantothenic'].filter(k => M.count && M.coverage[k] < 0.8 && M.gaps[k] && M.gaps[k].rem > 0);
  return low.length ? `<div class="note">ℹ️ Some foods you logged have no data for ${low.map(k => BY[k].short).join(', ')}, so those totals may read low.</div>` : '';
}
function capsNote(M) {
  const a = A(); const T = M.T, t = M.t;
  const near = LIMITS.filter(k => T[k] && T[k].limit && (t[k] || 0) >= 0.8 * T[k].limit);
  return near.length ? `<div class="note" style="border-color:rgba(255,181,71,.4)">⚠️ Near or over today’s cap: ${near.map(k => `${BY[k].name} ${a.fmt(t[k] || 0)}/${a.fmt(T[k].limit)} ${BY[k].unit}`).join(', ')} — salty or fatty picks are filtered out.</div>` : '';
}
function mealsView(ds) {
  const a = A(); const R = mealIdeas(ds); const M = R.M; IDEAS = [];
  const card = x => {
    const i = IDEAS.push(x) - 1; const p = x.n.protein || 0;
    return `<div class="co-meal"><div class="row" style="align-items:flex-start"><div style="font-size:26px;line-height:1">${x.t.ic}</div><div style="flex:1;min-width:0"><b>${a.esc(x.t.nm)}</b>
      <div class="co-macros"><span><b>${a.fmt(x.kc)}</b> kcal</span><span><b>${a.fmt(p)}</b> g protein</span><span><b>${a.fmt(x.n.fibre || 0)}</b> g fibre</span><span><b>${a.fmt(x.n.carbs || 0)}</b> C · <b>${a.fmt(x.n.fat || 0)}</b> F</span></div>
      <ul class="co-parts">${x.parts.map(pt => `<li>${a.esc(pt.s.nm)} <span class="mut">— ${a.esc(portionLabel(pt.s, Math.round(pt.m * x.sc * 100) / 100))}</span></li>`).join('')}</ul>
      <div class="co-why">${whyText(x.e, M, 4)}</div></div></div>
      <button class="btn pri block co-logbtn" data-coach-idea="${i}">Review &amp; log ${x.parts.length} foods</button></div>`;
  };
  const pLeft = M.gaps.protein ? M.gaps.protein.rem : 0;
  return `<div class="card"><div class="co-left">${leftLine(M)}</div>${pLeft > 0 ? `<div class="mut small" style="margin-top:6px">Ideas are scaled to fit your remaining ${a.fmt(Math.max(0, M.kcalLeft))} kcal (snacks ≤ 400) while getting as much of the ${a.fmt(pLeft)} g protein left as possible.</div>` : ''}</div>
   <div class="card"><h2>Meals</h2>${R.meal.length ? R.meal.map(card).join('') : `<div class="empty">${M.kcalLeft < 200 ? 'Not enough calories left for a full meal today — try a snack below or a high-protein drink.' : 'No meal fits today’s caps.'}</div>`}</div>
   <div class="card"><h2>Snacks</h2>${R.snack.length ? R.snack.map(card).join('') : '<div class="empty">No snack fits what’s left today.</div>'}</div>`;
}

/* ---------- Habits & insights ---------- */
const PCT = v => Math.round(v * 100) + '%';
function windowDays(n) { const a = A(); const end = a.today(); const out = []; for (let i = n - 1; i >= 0; i--) out.push(a.addDays(end, -i)); return out; }
function analyse(nDays) {
  const a = A(), S = a.S(), td = a.today();
  const days = windowDays(nDays);
  const recs = days.map(ds => {
    const d = S.days[ds]; const has = d && (d.entries.length || d.water.length);
    if (!has) return { ds, logged: false, any: false, wd: a.parseD(ds).getDay() };
    const T = a.targetsFor(ds), tt = a.totals(ds);
    return { ds, any: true, logged: d.entries.length > 0, d, T, t: tt.t, cov: tt.coverage, count: d.entries.length, wd: a.parseD(ds).getDay(), isToday: ds === td };
  });
  const logged = recs.filter(r => r.logged);
  // nutrient patterns use finished days that look fully logged (≥ 50% of the calorie goal)
  const full = logged.filter(r => !r.isToday && (r.t.kcal || 0) >= 0.5 * r.T.kcal.goal);
  const partial = logged.filter(r => !r.isToday && !full.includes(r));
  const R = { nDays, days, recs, logged, full, partial };
  if (!logged.length) return R;
  const mean = arr => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
  // targets
  // aim = the user's active goal where they chose one (vitamin D, creatine, any Customise goal); else goal/baseline
  const tgtOf = (r, k) => aimFor(k, r.T, ['protein', 'fibre', 'water'].includes(k) ? r.T[k].goal : r.T[k].base);
  const TK = ['protein', 'fibre', 'water', 'epaDha', 'ala', 'omega6', ...MICROS];
  N.forEach(x => { if (!TK.includes(x.key) && x.type === 'target' && customGoal(x.key)) TK.push(x.key); });
  R.nut = TK.map(k => {
    const xs = full.map(r => ({ v: k === 'water' ? r.t.water || 0 : r.t[k] || 0, tg: tgtOf(r, k), cov: k === 'water' || SUPP_ONLY.has(k) ? 1 : r.cov[k] })).filter(x => x.tg > 0);
    const n = xs.length; if (!n) return null;
    const below = xs.filter(x => x.v < x.tg * 0.999).length;
    return { k, n, below, avg: mean(xs.map(x => x.v)), tg: mean(xs.map(x => x.tg)), pct: mean(xs.map(x => x.v / x.tg)), cov: mean(xs.map(x => x.cov)), own: customGoal(k) };
  }).filter(Boolean);
  R.lim = LIMITS.map(k => {
    const xs = full.map(r => ({ v: r.t[k] || 0, lim: r.T[k].limit })).filter(x => x.lim != null); const n = xs.length; if (!n) return null;
    return { k, n, over: xs.filter(x => x.v > x.lim).length, avg: mean(xs.map(x => x.v)), lim: mean(xs.map(x => x.lim)), cov: mean(full.map(r => r.cov[k])) };
  }).filter(Boolean);
  // UL days: a goal the user set above the UL moves the line to that goal (their choice); everything else uses the UL
  R.ul = N.filter(x => x.type === 'target' && !x.ulNote && !x.lowData).map(x => {
    const days = full.filter(r => { const cap = capFor(x.key, r.T, false); return cap != null && (r.t[x.key] || 0) > cap; }).length;
    return days ? { k: x.key, days } : null;
  }).filter(Boolean);
  R.kcal = full.length ? { avg: mean(full.map(r => r.t.kcal || 0)), goal: mean(full.map(r => r.T.kcal.goal)), on: full.filter(r => Math.abs((r.t.kcal || 0) / r.T.kcal.goal - 1) <= 0.1).length, over: full.filter(r => (r.t.kcal || 0) > r.T.kcal.goal * 1.1).length, under: full.filter(r => (r.t.kcal || 0) < r.T.kcal.goal * 0.9).length } : null;
  // protein distribution across meals
  if (full.length) {
    const wkg = full[full.length - 1].T._energy.wkg; const thr = Math.round(0.4 * wkg);
    const per = { breakfast: [], lunch: [], dinner: [], snacks: [] }; const hits = [];
    full.forEach(r => {
      const m = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 }; r.d.entries.forEach(e => { m[e.meal] = (m[e.meal] || 0) + (e.n.protein || 0); });
      Object.keys(per).forEach(k => per[k].push(m[k] || 0));
      hits.push(['breakfast', 'lunch', 'dinner'].filter(k => m[k] >= thr).length + (m.snacks >= thr ? 1 : 0));
    });
    const avg = {}; Object.keys(per).forEach(k => avg[k] = mean(per[k]));
    const tot = Object.values(avg).reduce((x, y) => x + y, 0) || 1;
    R.prot = { thr, avg, share: Object.fromEntries(Object.keys(avg).map(k => [k, avg[k] / tot])), hits: mean(hits), wkg, n: full.length };
  }
  // hydration
  const hyd = recs.filter(r => r.any && !r.isToday);
  if (hyd.length) {
    const slots = [0, 0, 0]; let totMl = 0;
    hyd.forEach(r => {
      const evs = r.d.water.map(w => [w.t, w.ml]).concat(r.d.entries.filter(e => e.hyd).map(e => [e.t, a.entryHydration(e)]));
      evs.forEach(([t, ml]) => { if (!t || !ml) return; const h = new Date(t).getHours(); slots[h < 12 ? 0 : h < 18 ? 1 : 2] += ml; totMl += ml; });
    });
    const tr = hyd.filter(r => r.d.training && r.d.training.on), rest = hyd.filter(r => !(r.d.training && r.d.training.on));
    R.hyd = { n: hyd.length, avg: mean(hyd.map(r => r.t.water || 0)), goal: mean(hyd.map(r => r.T.water.goal)), met: hyd.filter(r => (r.t.water || 0) >= r.T.water.goal).length,
      slots: totMl ? slots.map(s => s / totMl) : null, train: tr.length ? { n: tr.length, pct: mean(tr.map(r => (r.t.water || 0) / r.T.water.goal)) } : null, rest: rest.length ? { n: rest.length, pct: mean(rest.map(r => (r.t.water || 0) / r.T.water.goal)) } : null,
      drinkShare: mean(hyd.map(r => { const w = r.d.water.reduce((x, y) => x + y.ml, 0); return r.t.water ? 1 - w / r.t.water : 0; })) };
  }
  // top foods
  const F = {};
  logged.forEach(r => r.d.entries.forEach(e => {
    const k = e.key || e.name; const f = F[k] || (F[k] = { name: e.name, days: new Set(), n: 0, kcal: 0, protein: 0, sodium: 0, fibre: 0, satFat: 0 });
    f.days.add(r.ds); f.n++; ['kcal', 'protein', 'sodium', 'fibre', 'satFat'].forEach(x => f[x] += e.n[x] || 0);
  }));
  const FL = Object.values(F); const sum = x => FL.reduce((s, f) => s + f[x], 0);
  R.top = {}; ['kcal', 'protein', 'sodium', 'fibre', 'satFat'].forEach(x => { const tot = sum(x); R.top[x] = tot > 0 ? FL.filter(f => f[x] > 0).sort((p, q) => q[x] - p[x]).slice(0, 5).map(f => ({ name: f.name, v: f[x], share: f[x] / tot, days: f.days.size })) : []; });
  R.nFoods = FL.length;
  // consistency
  const past = recs.filter(r => !r.isToday);
  const mealsFreq = {}; ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(m => mealsFreq[m] = logged.length ? logged.filter(r => r.d.entries.some(e => e.meal === m)).length / logged.length : 0);
  let streak = 0; for (let i = recs.length - 1; i >= 0; i--) { if (recs[i].logged) streak++; else if (recs[i].isToday) continue; else break; }
  let gap = 0, cur = 0; past.forEach(r => { if (r.logged) cur = 0; else { cur++; gap = Math.max(gap, cur); } });
  R.cons = { rate: logged.length / nDays, pastRate: past.length ? past.filter(r => r.logged).length / past.length : 0, perDay: mean(logged.map(r => r.count)), mealsFreq, streak, gap };
  // weekday vs weekend (full days)
  const we = full.filter(r => r.wd === 0 || r.wd === 6), wk = full.filter(r => r.wd > 0 && r.wd < 6);
  const allWe = past.filter(r => r.wd === 0 || r.wd === 6), allWk = past.filter(r => r.wd > 0 && r.wd < 6);
  R.week = { we: we.length, wk: wk.length, logWe: allWe.length ? allWe.filter(r => r.logged).length / allWe.length : null, logWk: allWk.length ? allWk.filter(r => r.logged).length / allWk.length : null, rows: [] };
  if (we.length >= 2 && wk.length >= 2) {
    [['kcal', 150, 'kcal'], ['protein', 10, 'g'], ['fibre', 4, 'g'], ['sodium', 300, 'mg'], ['satFat', 3, 'g'], ['water', 300, 'ml'], ['alcohol', 10, 'g']].forEach(([k, minAbs, u]) => {
      const x = mean(wk.map(r => r.t[k] || 0)), y = mean(we.map(r => r.t[k] || 0));
      R.week.rows.push({ k, wk: x, we: y, u, diff: y - x, sig: Math.abs(y - x) >= minAbs && Math.abs(y - x) / Math.max(x, y, 1) >= 0.1 });
    });
  }
  // alcohol & caffeine
  const alc = logged.reduce((s, r) => s + (r.t.alcohol || 0), 0);
  R.alc = { g: alc, perWeek: alc / 13.45 / (nDays / 7), daysWith: logged.filter(r => (r.t.alcohol || 0) > 0).length };
  R.caf = { over: full.filter(r => (r.t.caffeine || 0) > 400).length, avg: mean(full.map(r => r.t.caffeine || 0)) };
  return R;
}
/* foods from the staples list that best close a given nutrient per calorie */
function fixFoods(k, tgt) {
  return staples().filter(s => s.it.n100[k] > 0 || (k === 'epaDha' && (s.it.n100.epa || s.it.n100.dha))).map(s => {
    const n = nOf(s.it, s.g); const v = n[k] || 0; return { s, v, f: v / tgt, sc: v / tgt / Math.max(n.kcal || 0, 40) };
  }).filter(x => x.f >= 0.08).sort((p, q) => q.sc - p.sc).slice(0, 3);
}
function takeaways(R) {
  const a = A(), out = [];
  const say = (tone, ic, text, src) => out.push({ tone, ic, text, src });
  const nF = R.full.length;
  if (R.cons.rate < 0.5 && R.nDays >= 7) say('warn', '🗓️', `You logged food on ${Math.round(R.cons.rate * R.nDays)} of the last ${R.nDays} days. Patterns below are only as good as the days you log.`, null);
  if (nF < 3) return out;
  const nm = k => BY[k].name;
  const chronic = R.nut.filter(x => x.below / x.n >= 0.7 && x.cov >= 0.8);
  chronic.filter(x => x.k === 'protein').forEach(x => say('bad', '🥩', `Protein was under your ${a.fmt(x.tg)} g goal on ${x.below} of ${x.n} full days (average ${a.fmt(x.avg)} g, ${PCT(x.pct)}).`, SRC.ISSN_P));
  const microC = chronic.filter(x => x.k !== 'protein' && x.k !== 'water' && !x.own);
  if (microC.length) say('bad', '📉', `Chronic shortfalls (below target on ≥ 70% of full days): ${microC.map(x => `${nm(x.k)} (avg ${PCT(x.pct)})`).join(', ')}.`, SRC.DRI);
  const ownC = chronic.filter(x => x.k !== 'protein' && x.k !== 'water' && x.own);
  if (ownC.length) say('warn', '🎯', `Below the goal you set on ≥ 70% of full days: ${ownC.map(x => `${nm(x.k)} (avg ${amtText(x.k, x.avg)} of ${amtText(x.k, x.tg)})`).join(', ')}.`,
    ownC.some(x => x.k === 'creatine') ? NS.ISSN_CR : null);
  chronic.filter(x => x.k === 'water').forEach(x => say('bad', '💧', `Fluids were under goal on ${x.below} of ${x.n} days (average ${fmtMl(x.avg)} vs ${fmtMl(x.tg)}).`, SRC.DRI_W));
  const unsure = R.nut.filter(x => x.below / x.n >= 0.7 && x.cov < 0.8);
  if (unsure.length) say('info', 'ℹ️', `${unsure.map(x => nm(x.k)).join(', ')} also read low, but many foods you log have no data for ${unsure.length > 1 ? 'them' : 'it'} — the shortfall may be partly a data gap.`, null);
  R.lim.filter(x => x.over / x.n >= 0.3).forEach(x => say('bad', '🧂', `${nm(x.k)} went over the ${a.fmt(x.lim)} ${BY[x.k].unit} limit on ${x.over} of ${x.n} days (average ${a.fmt(x.avg)} ${BY[x.k].unit}).`,
    x.k === 'sodium' ? SRC.DRI_NAK : x.k === 'caffeine' ? SRC.HC_CAF : SRC.DGA));
  R.ul.forEach(x => say('bad', '⚠️', `${nm(x.k)} exceeded its Tolerable Upper Intake Level on ${x.days} day${x.days > 1 ? 's' : ''}.`, SRC.DRI));
  if (R.kcal) {
    const k = R.kcal;
    if (k.over / nF >= 0.4) say('warn', '🔥', `Calories ran > 10% over goal on ${k.over} of ${nF} full days (average ${a.fmt(k.avg)} vs ${a.fmt(k.goal)} kcal).`, null);
    else if (k.under / nF >= 0.6) say('warn', '🔋', `Calories were > 10% under goal on ${k.under} of ${nF} full days (average ${a.fmt(k.avg)} vs ${a.fmt(k.goal)}). Big deficits make it harder to keep muscle.`, NS.GARTHE);
    else if (k.on / nF >= 0.6) say('good', '🎯', `Calories landed within ±10% of goal on ${k.on} of ${nF} full days.`, null);
  }
  if (R.prot) {
    const p = R.prot;
    if (p.hits < 3) say('warn', '⏱️', `On average only ${r1(p.hits)} meals a day reach ~${p.thr} g protein (0.4 g/kg). Spreading protein over ≥ 4 such feedings is the evidence-based pattern for muscle.`, SRC.SA18);
    else say('good', '⏱️', `You average ${r1(p.hits)} meals a day with ≥ ${p.thr} g protein — a good spread.`, SRC.SA18);
    if (p.share.dinner >= 0.45) say('warn', '🍽️', `${PCT(p.share.dinner)} of your protein comes at dinner; breakfast averages ${a.fmt(p.avg.breakfast)} g.`, SRC.ISSN_P);
  }
  if (R.hyd && R.hyd.slots && R.hyd.n >= 3 && R.hyd.slots[2] >= 0.5) say('info', '🌙', `${PCT(R.hyd.slots[2])} of your logged fluids come after 6 pm — front-loading the day keeps you ahead of thirst.`, SRC.ACSM_FLUID);
  if (R.hyd && R.hyd.train && R.hyd.rest && R.hyd.train.n >= 2 && R.hyd.rest.n >= 2 && R.hyd.train.pct < R.hyd.rest.pct - 0.1) say('warn', '🏋️', `On training days you reach ${PCT(R.hyd.train.pct)} of your (higher) fluid goal vs ${PCT(R.hyd.rest.pct)} on rest days.`, SRC.ACSM_FLUID);
  const wkRows = R.week.rows.filter(x => x.sig);
  if (wkRows.length) say('info', '📅', `Weekends differ from weekdays (average per full day): ${wkRows.map(x => `${x.k === 'water' ? 'fluids' : BY[x.k].name.toLowerCase()} ${a.fmt(x.we)} vs ${a.fmt(x.wk)} ${x.u}`).join('; ')}.`, null);
  if (R.alc.g > 0) { const w = R.alc.perWeek; say(w > 2 ? 'warn' : 'info', '🍺', `About ${r1(w)} standard drinks per week (${a.fmt(R.alc.g)} g alcohol over ${R.nDays} days). Canada’s guidance: ≤ 2 per week is low risk; 3–6 moderate risk.`, SRC.CCSA); }
  const good = R.nut.filter(x => x.below / x.n <= 0.2 && x.cov >= 0.8 && MICROS.includes(x.k)).length;
  if (good >= 8) say('good', '🌈', `${good} vitamins & minerals met baseline on at least 80% of full days.`, SRC.DRI);
  return out;
}
function insightsView() {
  const a = A(); const R = analyse(UI.range);
  const seg = `<div class="seg co-seg">${[7, 30, 90].map(n => `<button class="${UI.range === n ? 'on' : ''}" data-coach-range="${n}">${n} days</button>`).join('')}</div>`;
  if (!R.logged.length) return seg + `<div class="card"><div class="empty">No food logged in the last ${UI.range} days yet.<br><br>Log a few full days and this page will show your chronic shortfalls, protein timing, hydration patterns and top foods.</div></div>`;
  const tk = takeaways(R); const nF = R.full.length;
  const toneC = { bad: 'var(--s-bad,var(--bad))', warn: 'var(--s-warn,var(--warn))', good: 'var(--s-good,var(--a3))', info: 'var(--s-water,var(--a2))' };
  const head = `<div class="card"><h2>Summary · last ${R.nDays} days</h2><div class="stat3 co-stat"><div><b>${R.logged.length}/${R.nDays}</b><span>days logged</span></div><div><b>${nF}</b><span>full days analysed</span></div><div><b>🔥 ${R.cons.streak}</b><span>day streak</span></div></div>
    <div class="tiny dim" style="margin-top:8px">Nutrient patterns use finished days with ≥ 50% of your calorie goal logged${R.partial.length ? ` (${R.partial.length} partly-logged day${R.partial.length > 1 ? 's' : ''} left out)` : ''}; today is excluded until it’s over.</div></div>`;
  const tkCard = `<div class="card"><h2>Takeaways</h2>${nF < 3 ? `<div class="note">Need at least 3 full days for nutrient patterns — you have ${nF}. Keep logging!</div>` : ''}
    ${tk.length ? tk.map(x => `<div class="co-tk" style="border-left-color:${toneC[x.tone]}"><span class="co-ic">${x.ic}</span><div>${x.text}${x.src ? `<div class="tiny dim" style="margin-top:3px">Source: ${a.esc(x.src)}</div>` : ''}</div></div>`).join('') : nF >= 3 ? '<div class="mut small">No strong patterns — nice consistency.</div>' : ''}</div>`;
  let nutCard = '';
  if (nF >= 1) {
    const rows = R.nut.slice().sort((x, y) => x.pct - y.pct);
    const fixes = rows.filter(x => nF >= 3 && x.below / x.n >= 0.7 && x.k !== 'water').slice(0, 4).map(x => {
      const ff = SUPP_ONLY.has(x.k) ? [] : fixFoods(x.k, x.tg);
      if (!ff.length || (x.own && ff[0].f < SUPP_RULE.foodOk)) {   // food can't practically get there → name a supplement instead
        const sp = suppPool().find(c => (nOf(c.it, c.g)[x.k] || 0) > 0 && Object.keys(c.it.n100).filter(q => BY[q] && BY[q].type === 'target').length <= 3);
        return sp ? `<div class="co-fix"><b>${BY[x.k].name}</b>: <span class="co-sbadge">💊 Supplement</span> ${a.esc(sp.nm)} <span class="mut">(${a.esc(sp.pl)} = ${amtText(x.k, nOf(sp.it, sp.g)[x.k])}${sp.own ? ', yours' : ''})</span> — food can’t practically supply ${amtText(x.k, x.tg)}.</div>` : '';
      }
      return `<div class="co-fix"><b>${BY[x.k].name}</b>: ${ff.map(f => `${a.esc(f.s.nm)} <span class="mut">(${a.esc(f.s.pl.replace(/\s*\(.*\)$/, ''))} ≈ ${Math.round(f.f * 100)}%)</span>`).join(', ')}</div>`;
    }).join('');
    nutCard = `<div class="card"><h2>Nutrient patterns</h2><div class="mut small" style="margin-bottom:8px">Average intake as % of target (baseline RDA/AI; goal for protein, fibre &amp; water; <b>your own goal</b> where you set one), and how many full days fell short.</div>
      <div class="nlist">${rows.map(x => `<div class="nr"><div class="nm">${BY[x.k].name}<span>${x.own ? 'your goal · ' : ''}${x.n > 0 ? `short ${x.below}/${x.n} days` : ''}${x.cov < 0.8 ? ' · ~incomplete data' : ''}</span></div><div class="bw"><div class="bar"><i style="width:${Math.min(100, x.pct * 100)}%;background:${x.pct >= 1 ? 'var(--s-good,var(--a3))' : x.pct >= 0.7 ? 'var(--s-warn,var(--warn))' : 'var(--s-bad,var(--bad))'}"></i></div></div><div class="v">${PCT(x.pct)}<span>${amtText(x.k, x.avg)}</span></div></div>`).join('')}</div>
      <h2 style="margin-top:16px">Limits</h2><div class="nlist">${R.lim.map(x => `<div class="nr"><div class="nm">${BY[x.k].name}<span>over ${x.over}/${x.n} days${x.cov < 0.8 ? ' · ~incomplete data' : ''}</span></div><div class="bw"><div class="bar"><i style="width:${Math.min(100, x.avg / x.lim * 100)}%;background:${x.avg > x.lim ? 'var(--s-bad,var(--bad))' : x.avg > 0.8 * x.lim ? 'var(--s-warn,var(--warn))' : 'var(--s-good,var(--a3))'}"></i></div></div><div class="v">${PCT(x.avg / x.lim)}<span>${amtText(x.k, x.avg)}</span></div></div>`).join('')}</div>
      ${fixes ? `<h2 style="margin-top:16px">Foods that would close your chronic gaps</h2>${fixes}` : ''}</div>`;
  }
  let protCard = '';
  if (R.prot) {
    const p = R.prot, mx = Math.max(p.thr * 1.5, ...Object.values(p.avg));
    protCard = `<div class="card"><h2>Protein by meal</h2>${[['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']].map(([k, l]) => `<div class="co-gap"><div class="row"><span>${l}</span><span class="mut small" style="margin-left:auto">${a.fmt(p.avg[k])} g · ${PCT(p.share[k])}</span></div><div class="bar"><i style="width:${p.avg[k] / mx * 100}%;background:${p.avg[k] >= p.thr ? 'var(--s-good,var(--a3))' : 'var(--s-warn,var(--warn))'}"></i><span class="mk" style="left:${p.thr / mx * 100}%"></span></div></div>`).join('')}
      <div class="tiny dim" style="margin-top:8px">Marker = ${p.thr} g (0.4 g/kg × ${a.fmt(p.wkg, 1)} kg). ${a.esc(SRC.SA18)}.</div></div>`;
  }
  let hydCard = '';
  if (R.hyd) {
    const h = R.hyd;
    hydCard = `<div class="card"><h2>Hydration</h2><div class="kv"><div>Average fluids</div><div>${fmtMl(h.avg)} / ${fmtMl(h.goal)}</div><div>Days goal met</div><div>${h.met} of ${h.n}</div><div>From other drinks</div><div>${PCT(h.drinkShare)}</div>
      ${h.train ? `<div>Training days (${h.train.n})</div><div>${PCT(h.train.pct)} of goal</div>` : ''}${h.rest ? `<div>Rest days (${h.rest.n})</div><div>${PCT(h.rest.pct)} of goal</div>` : ''}</div>
      ${h.slots ? `<div class="co-slots">${['Morning', 'Afternoon', 'Evening'].map((l, i) => `<div><div class="bar"><i style="width:${h.slots[i] * 100}%;background:var(--s-water,var(--a2))"></i></div><span>${l} ${PCT(h.slots[i])}</span></div>`).join('')}</div>` : ''}</div>`;
  }
  const topList = (x, l, u) => R.top[x] && R.top[x].length ? `<h2 style="margin-top:12px">${l}</h2><div class="nlist">${R.top[x].map(f => `<div class="nr"><div class="nm" style="width:58%">${a.esc(f.name.split(',').slice(0, 2).join(','))}<span>${f.days} day${f.days > 1 ? 's' : ''}</span></div><div class="bw"><div class="bar"><i style="width:${f.share * 100}%;background:var(--grad)"></i></div></div><div class="v">${PCT(f.share)}<span>${a.fmt(f.v)} ${u}</span></div></div>`).join('')}</div>` : '';
  const topCard = `<div class="card"><h2>Top foods <span class="r" style="color:var(--mut)">${R.nFoods} different</span></h2>${topList('kcal', 'Calories', 'kcal')}${topList('protein', 'Protein', 'g')}${topList('fibre', 'Fibre', 'g')}${topList('sodium', 'Sodium', 'mg')}</div>`;
  const c = R.cons;
  const consCard = `<div class="card"><h2>Logging consistency</h2><div class="kv"><div>Days logged</div><div>${R.logged.length} of ${R.nDays} (${PCT(c.rate)})</div><div>Entries per logged day</div><div>${r1(c.perDay)}</div><div>Longest gap</div><div>${c.gap} day${c.gap === 1 ? '' : 's'}</div>
    ${[['breakfast', 'Breakfast logged'], ['lunch', 'Lunch logged'], ['dinner', 'Dinner logged'], ['snacks', 'Snacks logged']].map(([k, l]) => `<div>${l}</div><div>${PCT(c.mealsFreq[k])} of days</div>`).join('')}</div></div>`;
  const w = R.week;
  const weekCard = `<div class="card"><h2>Weekdays vs weekends</h2>${w.logWe != null && w.logWk != null ? `<div class="mut small" style="margin-bottom:8px">Logging rate: weekdays ${PCT(w.logWk)}, weekends ${PCT(w.logWe)}.</div>` : ''}
    ${w.rows.length ? `<div class="co-wk"><div></div><div class="mut">Mon–Fri</div><div class="mut">Sat–Sun</div>${w.rows.map(x => `<div>${BY[x.k] ? BY[x.k].short : x.k}</div><div>${a.fmt(x.wk)} ${x.u}</div><div style="${x.sig ? 'color:var(--s-warn,var(--warn));font-weight:700' : ''}">${a.fmt(x.we)} ${x.u}</div>`).join('')}</div><div class="tiny dim" style="margin-top:6px">Highlighted = ≥ 10% and a meaningful absolute difference.</div>` : `<div class="mut small">Needs ≥ 2 full weekday and ≥ 2 full weekend days (have ${w.wk} and ${w.we}).</div>`}</div>`;
  return seg + head + tkCard + nutCard + protCard + hydCard + topCard + consCard + weekCard +
    `<div class="tiny dim" style="text-align:center;margin:6px 8px 14px">Insights describe your logged data only and aren’t medical advice. Targets: NASEM DRIs (adopted by Health Canada), ISSN and ACSM position stands — see each nutrient’s info sheet.</div>`;
}

/* ---------- events (delegated; no edits to app.js handlers) ---------- */
document.addEventListener('click', e => {
  const a = A(); if (!a) return;
  const t = e.target.closest('[data-coach],[data-coach-pick],[data-coach-water],[data-coach-tab],[data-coach-range],[data-coach-idea]'); if (!t) return;
  const d = t.dataset;
  if (d.coach === 'open') { UI.tab = 'next'; a.go('coach'); return; }
  if (d.coach === 'back') { a.go('today'); return; }
  if (d.coachTab) { UI.tab = d.coachTab; a.go('coach'); return; }
  if (d.coachRange) { UI.range = +d.coachRange; a.render(); return; }
  if (d.coachWater) { a.addWater(+d.coachWater); return; }
  if (d.coachPick != null) { const p = PICKS[+d.coachPick]; if (p) logRows([{ nm: p.c.nm, label: p.label, it: p.c.it, g: p.g }], 'Coach pick'); return; }
  if (d.coachIdea != null) { const x = IDEAS[+d.coachIdea]; if (x) logRows(x.parts.map(pt => ({ nm: pt.s.nm, label: portionLabel(pt.s, Math.round(pt.m * x.sc * 100) / 100), it: pt.s.it, g: pt.s.g * pt.m * x.sc })), x.t.ic + ' ' + x.t.nm); }
});

/* called by app.js render(): place the Today card next to "My items" (works with every Today layout) */
function afterRender(app, view) {
  if (view !== 'today' || !app) return;
  const html = todayCard(); if (!html) return;
  const box = document.createElement('div'); box.innerHTML = html; const card = box.firstElementChild;
  const items = app.querySelector('.qgrid, .qrow'); const anchor = items && (items.closest('.card') || items.closest('.tgrid'));
  if (anchor) anchor.after(card);
  else { const meal = app.querySelector('.meal'); if (meal) meal.before(card); else (app.querySelector('.view') || app).appendChild(card); }
}
G.FuelCoach = { views: { coach: renderCoach }, afterRender, todayCard, suggest, suggestSupps, mealIdeas, analyse, takeaways, staples, STAPLES, MEALS_T, gapModel, customGoal, capFor, aboveUL, SUPP_RULE, evalN, nOf, _ui: UI };
if (G.__fuel) G.__fuel.render();
})(window);
