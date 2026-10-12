/* Fuel — gamified nutrition tracker (offline PWA). All data stays on this device (localStorage). */
(function () {
'use strict';
const { N, BY, GROUPS, MICROS, VITAMINS, MINERALS, ACTIVITY, computeTargets, energy } = window.NUTR;
const STORE_KEY = 'fuel.v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const today = () => dstr(new Date());
const LB = 0.45359237;
const MEALS = [['breakfast','Breakfast','🍳'],['lunch','Lunch','🥗'],['dinner','Dinner','🍽️'],['snacks','Snacks','🍎']];
const UNITS = { g:{l:'g',g:1}, oz:{l:'oz',g:28.3495}, lb:{l:'lb',g:453.592}, ml:{l:'ml',ml:1}, cup:{l:'cup',ml:236.588}, tbsp:{l:'tbsp',ml:14.787}, tsp:{l:'tsp',ml:4.929}, floz:{l:'fl oz',ml:29.5735} };

function fmt(v, dp = 0) {
  if (v == null || isNaN(v)) return '–';
  if (Math.abs(v) >= 10000) return Math.round(v).toLocaleString();
  if (dp === 0 || Math.abs(v) >= 100) return Math.round(v).toLocaleString();
  return (+v.toFixed(dp)).toLocaleString(undefined, { maximumFractionDigits: dp });
}
const fmtN = (k, v) => fmt(v, BY[k] ? (v < 10 && BY[k].dp === 0 ? 1 : BY[k].dp) : 0);

/* ---------------- state ---------------- */
const DEFAULT_PINS = ['kcal','protein','carbs','fat','fibre','water','vitD','magnesium','potassium','epaDha'];
function defaults() {
  return {
    v: 1,
    profile: { age: 29, sex: 'male', heightCm: 170, weightLb: null, goalLb: 170, activity: 'moderate', ratePct: 0.7, proteinG: 170, fatPerLb: 0.35, useLatestWeight: true, name: '' },
    settings: { tier: 'peak', pinned: DEFAULT_PINS.slice(), overrides: {}, waterUnit: 'ml', quickWater: [250, 500, 750], defaultTrainingHours: 1 },
    days: {}, weights: [], customFoods: [], recipes: [], favs: [], recent: [],
    goals: [
      { id: 'g1', period: 'week', metric: 'avg', key: 'protein', value: 170, cmp: 'gte' },
      { id: 'g2', period: 'week', metric: 'daysHit', key: 'protein', value: 6 },
      { id: 'g3', period: 'week', metric: 'daysHit', key: 'water', value: 6 },
      { id: 'g4', period: 'month', metric: 'daysLogged', value: 26 },
      { id: 'g5', period: 'month', metric: 'avgScore', value: 80 },
    ],
    achievements: {}, counters: { scans: 0 }, created: today(),
  };
}
let S;
function load() {
  try { S = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { S = null; }
  const d = defaults();
  if (!S) S = d;
  for (const k in d) if (S[k] == null) S[k] = d[k];
  for (const k in d.profile) if (S.profile[k] == null) S.profile[k] = d.profile[k];
  for (const k in d.settings) if (S.settings[k] == null) S.settings[k] = d.settings[k];
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 120); }
function saveNow() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('⚠️', 'Storage full', 'Export a backup and clear old data.'); }
}
function day(ds, create) {
  let d = S.days[ds];
  if (!d && create) d = S.days[ds] = { entries: [], water: [], training: { on: false, hours: S.settings.defaultTrainingHours || 1 } };
  return d || { entries: [], water: [], training: { on: false, hours: 1 } };
}
function profileNow() {
  const p = Object.assign({}, S.profile);
  if (p.useLatestWeight && S.weights.length) p.weightLb = S.weights[S.weights.length - 1].lb;
  if (!(p.weightLb > 0)) { p.weightLb = 180; p.weightEst = true; }   // placeholder until the user enters a weight
  return p;
}
const targetsFor = ds => computeTargets(profileNow(), S.settings, day(ds));

/* ---------------- food database ---------------- */
let DB = null, DBP = null;
function loadDB() {
  if (DBP) return DBP;
  DBP = fetch('data/foods.json').then(r => r.json()).then(j => {
    const ki = j.keys;
    DB = { keys: ki, cats: j.cats, source: j.source, foods: j.foods.map(f => ({ id: f[0], name: f[1], cat: f[2], sc: f[3], v: f[4], por: f[5], dens: f[6], hyd: f[7], l: f[1].toLowerCase() })) };
    DB.byId = new Map(DB.foods.map(f => [f.id, f]));
    return DB;
  }).catch(e => { DBP = null; throw e; });
  return DBP;
}
const SRC_KEYS = ['usda', 'f', 'fndds', 'cnf']; // DB source codes: 0 SR Legacy, 1 Foundation, 2 FNDDS, 3 CNF
const SRC_NAME = { f: 'USDA Foundation Foods', usda: 'USDA SR Legacy', fndds: 'USDA FNDDS (survey foods)', cnf: 'Health Canada Canadian Nutrient File', off: 'Open Food Facts (user-contributed label data)', cus: 'Your custom food', rec: 'Your recipe', sup: 'Generic supplement', label: 'Nutrition label (read aloud)' };
const SRC_RANK = { f: 12, usda: 9, fndds: 6, cnf: 2 };
function usdaItem(f) {
  const n = {};
  DB.keys.forEach((k, i) => { const v = f.v[i]; if (v != null && BY[k]) n[k] = v * BY[k].dbMult; });
  impliedZeros(n);
  const src = SRC_KEYS[f.sc] || 'usda';
  return { key: 'db:' + f.id, id: f.id, name: f.name, sub: DB.cats[f.cat], src, n100: n, portions: f.por || [], dens: f.dens || (f.hyd ? 1 : null), hyd: !!f.hyd };
}
function impliedZeros(n) {
  if (n.carbs === 0) ['fibre', 'sugars', 'addedSugar'].forEach(k => { if (n[k] == null) n[k] = 0; });
  if (n.fat === 0) ['satFat', 'monoFat', 'polyFat', 'transFat', 'ala', 'epa', 'dha', 'dpa', 'omega6', 'cholesterol'].forEach(k => { if (n[k] == null) n[k] = 0; });
  return n;
}
/* bundled generic supplements (edit amounts to match your label) */
const SUPPS = [
  { id: 'd1000', name: 'Vitamin D3 1000 IU (25 µg)', n: { vitD: 25 } },
  { id: 'd2000', name: 'Vitamin D3 2000 IU (50 µg)', n: { vitD: 50 } },
  { id: 'fish1', name: 'Fish oil softgel, 1 g (≈180 EPA / 120 DHA)', n: { kcal: 9, fat: 1, epa: 180, dha: 120, polyFat: 0.35 } },
  { id: 'fish3', name: 'Concentrated fish oil, 1 tsp (≈650 EPA / 450 DHA)', n: { kcal: 40, fat: 4.5, epa: 650, dha: 450, polyFat: 1.6 } },
  { id: 'algae', name: 'Algae omega-3 softgel (≈300 DHA / 150 EPA)', n: { kcal: 9, fat: 1, epa: 150, dha: 300 } },
  { id: 'mg200', name: 'Magnesium (glycinate/citrate), 200 mg elemental', n: { magnesium: 200 } },
  { id: 'whey', name: 'Whey protein isolate, 1 scoop (30 g)', g: 30, n: { kcal: 113, protein: 25, carbs: 1.5, fat: 0.5, calcium: 150, sodium: 60, potassium: 150, leucine: 2.7 } },
  { id: 'creatine', name: 'Creatine monohydrate, 5 g', g: 5, n: {} },
  { id: 'multi', name: 'Men\'s multivitamin (typical, edit to label)', n: { vitA: 900, vitC: 90, vitD: 25, vitE: 15, vitK: 80, thiamin: 1.2, riboflavin: 1.3, niacin: 16, b6: 1.7, folate: 400, b12: 6, biotin: 30, pantothenic: 5, zinc: 11, selenium: 55, copper: 0.9, manganese: 2.3, iodine: 150, magnesium: 50, calcium: 200, molybdenum: 45 } },
  { id: 'preworkout', name: 'Pre-workout, 1 scoop (≈200 mg caffeine)', g: 10, n: { caffeine: 200, kcal: 5 } },
  { id: 'electrolyte', name: 'Electrolyte mix, 1 stick (≈500 mg Na)', g: 6, n: { sodium: 500, potassium: 200, magnesium: 60, kcal: 10 } },
];
function suppItem(s) { return { key: 'sup:' + s.id, name: s.name, sub: 'Supplement · generic', src: 'sup', perServing: true, servingG: s.g || 1, n100: scaleN(s.n, 100 / (s.g || 1)), portions: [['1 serving', s.g || 1]], dens: null, hyd: false }; }
function customItem(c) { return { key: 'cus:' + c.id, name: c.name, sub: (c.brand ? c.brand + ' · ' : '') + 'Custom', src: 'cus', n100: c.n100, portions: c.portions || [], dens: c.dens || (c.hyd ? 1 : null), hyd: !!c.hyd, servingG: c.servingG }; }
function recipeItem(r) {
  const tot = {}; let g = 0;
  r.items.forEach(it => { g += it.g; addN(tot, it.n); });
  const per = g > 0 ? scaleN(tot, 100 / g) : {};
  const sg = g / (r.servings || 1);
  return { key: 'rec:' + r.id, name: r.name, sub: 'Recipe · ' + (r.servings || 1) + ' servings', src: 'rec', n100: per, portions: [['1 serving', +sg.toFixed(1)], ['whole recipe', +g.toFixed(1)]], dens: null, hyd: false, servingG: sg };
}
function scaleN(n, f) { const o = {}; for (const k in n) if (n[k] != null) o[k] = n[k] * f; return o; }
function addN(t, n) { for (const k in n) if (n[k] != null) t[k] = (t[k] || 0) + n[k]; return t; }
function roundN(n) { const o = {}; for (const k in n) { const v = n[k]; if (v != null && isFinite(v)) o[k] = Math.abs(v) >= 100 ? Math.round(v * 10) / 10 : +v.toPrecision(4); } return o; }

/* Open Food Facts */
const OFF_MAP = [ // [offKey, appKey, multiplier from OFF base unit (g) to display unit]
  ['energy-kcal','kcal',1],['proteins','protein',1],['carbohydrates','carbs',1],['fiber','fibre',1],['sugars','sugars',1],['added-sugars','addedSugar',1],
  ['fat','fat',1],['saturated-fat','satFat',1],['monounsaturated-fat','monoFat',1],['polyunsaturated-fat','polyFat',1],['trans-fat','transFat',1],
  ['alpha-linolenic-acid','ala',1],['eicosapentaenoic-acid','epa',1000],['docosahexaenoic-acid','dha',1000],['linoleic-acid','omega6',1],['cholesterol','cholesterol',1000],
  ['vitamin-a','vitA',1e6],['vitamin-c','vitC',1000],['vitamin-d','vitD',1e6],['vitamin-e','vitE',1000],['vitamin-k','vitK',1e6],['vitamin-b1','thiamin',1000],['vitamin-b2','riboflavin',1000],
  ['vitamin-pp','niacin',1000],['pantothenic-acid','pantothenic',1000],['vitamin-b6','b6',1000],['biotin','biotin',1e6],['vitamin-b9','folate',1e6],['folates','folate',1e6],['vitamin-b12','b12',1e6],['choline','choline',1000],
  ['calcium','calcium',1000],['iron','iron',1000],['magnesium','magnesium',1000],['phosphorus','phosphorus',1000],['potassium','potassium',1000],['sodium','sodium',1000],['zinc','zinc',1000],
  ['copper','copper',1000],['manganese','manganese',1000],['selenium','selenium',1e6],['iodine','iodine',1e6],['molybdenum','molybdenum',1e6],['fluoride','fluoride',1000],['caffeine','caffeine',1000],
];
const OFF_FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_quantity,serving_size,quantity,categories_tags,image_front_small_url';
function offItem(p) {
  const nm = p.nutriments || {}; const n = {};
  OFF_MAP.forEach(([ok, ak, m]) => { const v = nm[ok + '_100g']; if (v != null && v !== '' && !isNaN(v) && n[ak] == null) n[ak] = +v * m; });
  if (n.kcal == null && nm['energy_100g'] != null) n.kcal = nm['energy_100g'] / 4.184;
  if (n.sodium == null && nm['salt_100g'] != null) n.sodium = nm['salt_100g'] * 400;
  if (nm['alcohol_100g'] != null) n.alcohol = +nm['alcohol_100g'] * 0.789;
  const cats = (p.categories_tags || []).join(' ');
  const hyd = /beverages|drinks|waters|milks|juices/.test(cats) && !/powder/.test(cats);
  if (hyd) n.moisture = Math.max(0, 100 - (n.protein || 0) - (n.carbs || 0) - (n.fat || 0) - (n.fibre || 0));
  const name = p.product_name || p.product_name_en || 'Unnamed product';
  const sg = +p.serving_quantity || null;
  const portions = sg ? [['1 serving' + (p.serving_size ? ' (' + String(p.serving_size).slice(0, 24) + ')' : ''), sg]] : [];
  return { key: 'off:' + p.code, code: p.code, name, sub: (p.brands ? String(p.brands).split(',')[0] + ' · ' : '') + 'Open Food Facts', src: 'off', n100: n, portions, dens: hyd ? 1 : null, hyd, servingG: sg };
}
async function offBarcode(code) {
  const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(code) + '.json?fields=' + OFF_FIELDS);
  if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j.product || j.status === 0) return null;
  j.product.code = j.product.code || code;
  return offItem(j.product);
}
async function offSearch(q) {
  const urls = [
    'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=25&search_terms=' + encodeURIComponent(q) + '&fields=' + OFF_FIELDS,
    'https://search.openfoodfacts.org/search?page_size=25&q=' + encodeURIComponent(q) + '&fields=' + OFF_FIELDS,
  ];
  let lastErr;
  for (const u of urls) {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(u, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const list = (j.products || j.hits || []).filter(p => p.nutriments && (p.nutriments['energy-kcal_100g'] != null || p.nutriments['energy_100g'] != null));
      return list.map(offItem);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Search failed');
}

/* ---------------- totals & status ---------------- */
function entryHydration(e) { return e.hyd ? (e.n.moisture != null ? e.n.moisture : e.g * 0.9) : 0; }
function totals(ds) {
  const d = day(ds); const t = {}; const cov = {}; let gTot = 0;
  d.entries.forEach(e => { addN(t, e.n); const w = Math.max(e.n.kcal || 0, 1); gTot += w; for (const k in e.n) cov[k] = (cov[k] || 0) + w; });
  t.epaDha = (t.epa || 0) + (t.dha || 0);
  cov.epaDha = Math.min(cov.epa || 0, cov.dha || 0);
  const waterMl = d.water.reduce((a, w) => a + w.ml, 0);
  const drinkMl = d.entries.reduce((a, e) => a + entryHydration(e), 0);
  t.water = waterMl + drinkMl;
  const coverage = {};
  N.forEach(n => { coverage[n.key] = n.key === 'water' ? 1 : (gTot ? clamp((cov[n.key] || 0) / gTot, 0, 1) : 1); });
  return { t, coverage, count: d.entries.length, waterMl, drinkMl, gTot };
}
/* state of a nutrient value against its targets */
function status(k, v, T) {
  const n = BY[k], tg = T[k] || {};
  v = v || 0;
  if (n.type === 'limit') {
    const lim = tg.limit;
    if (lim == null) return { pct: 0, state: 'track', label: 'Tracked' };
    const pct = v / lim;
    const st = pct > 1 ? 'over' : pct >= 0.9 ? 'near' : 'ok';
    return { pct, state: st, label: st === 'over' ? 'Over limit' : st === 'near' ? 'Near limit' : 'Under limit', goal: lim };
  }
  if (n.type === 'track' || tg.goal == null) return { pct: 0, state: 'track', label: 'Tracked' };
  const goal = tg.goal; const pct = goal ? v / goal : 0;
  if (k === 'kcal') {
    const st = pct > 1.1 ? 'over' : pct >= 0.9 ? 'peak' : pct >= 0.5 ? 'base' : 'low';
    return { pct, state: st, label: st === 'over' ? 'Over target' : st === 'peak' ? 'On target' : 'Remaining ' + fmt(goal - v) , goal };
  }
  if (tg.ul && v > tg.ul && !(BY[k].ulNote)) return { pct, state: 'ul', label: tg.ulSoft ? 'Above upper range' : 'Above UL', goal };
  if (tg.peak != null && tg.peak > (tg.base || 0) && v >= tg.peak) return { pct, state: 'peak', label: 'Peak ✦', goal };
  if (tg.base != null && v >= tg.base) return { pct, state: tg.peak > tg.base ? 'base' : 'peak', label: tg.peak > tg.base ? 'Baseline ✓' : 'Goal ✓', goal };
  return { pct, state: 'low', label: Math.round(pct * 100) + '%', goal };
}
const stateColor = st => ({ peak: 'var(--gold)', base: '#6ee7b7', low: 'var(--mut)', over: 'var(--bad)', ul: 'var(--bad)', near: 'var(--warn)', ok: '#6ee7b7', track: 'var(--dim)' }[st]);
function hit(k, v, T) { const s = status(k, v, T); return k === 'kcal' ? s.state === 'peak' : ['peak', 'base'].includes(s.state) && (v || 0) >= (T[k].goal || 0) - 1e-9; }
function atBase(k, v, T) { const tg = T[k]; return tg && tg.base != null && (v || 0) >= tg.base; }

/* day evaluation → score, hits, peak day */
const LIMIT_KEYS = ['sodium', 'satFat', 'transFat', 'addedSugar', 'caffeine'];
function evalDay(ds) {
  const d = S.days[ds];
  if (!d || (!d.entries.length && !d.water.length)) return { logged: false, ds, score: 0 };
  const T = targetsFor(ds); const { t, count } = totals(ds);
  const logged = count > 0;
  const h = { kcal: hit('kcal', t.kcal, T), protein: hit('protein', t.protein, T), fibre: hit('fibre', t.fibre, T), water: (t.water || 0) >= T.water.goal, carbs: hit('carbs', t.carbs, T), fat: (t.fat || 0) >= T.fat.goal * 0.9 && (t.fat || 0) <= T.fat.goal * 1.15 };
  const microBase = MICROS.filter(k => atBase(k, t[k], T));
  const vits = VITAMINS.every(k => atBase(k, t[k], T)), mins = MINERALS.every(k => atBase(k, t[k], T));
  const over = LIMIT_KEYS.filter(k => T[k].limit != null && (t[k] || 0) > T[k].limit);
  const ulOver = N.filter(n => T[n.key] && T[n.key].ul && !T[n.key].ulSoft && !n.ulNote && (t[n.key] || 0) > T[n.key].ul).map(n => n.key);
  const peakKeys = N.filter(n => n.type === 'target' && T[n.key] && T[n.key].peak != null && T[n.key].base != null && T[n.key].peak > T[n.key].base).map(n => n.key);
  const peakDay = logged && peakKeys.every(k => (t[k] || 0) >= T[k].peak) && microBase.length === MICROS.length && !over.length && !ulOver.length;
  let score = 0;
  if (logged) {
    const kp = (t.kcal || 0) / T.kcal.goal, dev = Math.abs(kp - 1);
    score += 20 * (dev <= 0.1 ? 1 : clamp(1 - (dev - 0.1) / 0.3, 0, 1));
    score += 25 * clamp((t.protein || 0) / T.protein.goal, 0, 1);
    score += 10 * clamp((t.fibre || 0) / T.fibre.goal, 0, 1);
    score += 15 * clamp((t.water || 0) / T.water.goal, 0, 1);
    score += 20 * (MICROS.reduce((a, k) => a + clamp((t[k] || 0) / T[k].base, 0, 1), 0) / MICROS.length);
    score += clamp(10 - 2.5 * (over.length + ulOver.length), 0, 10);
  } else score = 15 * clamp((t.water || 0) / T.water.goal, 0, 1);
  score = Math.round(score);
  const macroAll = logged && Math.abs((t.kcal || 0) / T.kcal.goal - 1) <= 0.05 && (t.protein || 0) >= T.protein.goal && Math.abs((t.carbs || 0) / T.carbs.goal - 1) <= 0.1 && Math.abs((t.fat || 0) / T.fat.goal - 1) <= 0.1;
  return { ds, logged, count, t, T, h, microBase: microBase.length, allMicros: microBase.length === MICROS.length, vits, mins, over, ulOver, peakDay, score, macroAll,
    omega: (t.epaDha || 0) >= T.epaDha.peak, vitD: (t.vitD || 0) >= T.vitD.base };
}

/* ---------------- gamification ---------------- */
let EVC = null; // eval cache (invalidated on change)
function invalidate() { EVC = null; }
function allEvals() {
  if (EVC) return EVC;
  const ds = Object.keys(S.days).sort();
  EVC = { list: ds.map(evalDay), map: {} };
  EVC.list.forEach(e => EVC.map[e.ds] = e);
  return EVC;
}
function dayXP(e) {
  if (!e.logged) return e.h && e.h.water ? 30 : 0;
  let x = Math.min(e.count * 5, 50);
  if (e.h.protein) x += 50; if (e.h.kcal) x += 40; if (e.h.water) x += 30; if (e.h.fibre) x += 30;
  x += e.microBase * 3; if (e.allMicros) x += 50; if (e.peakDay) x += 100; if (e.macroAll) x += 40;
  x += Math.floor(e.score / 10) * 5;
  return x;
}
/* streak of consecutive days satisfying fn, ending today (or yesterday if today not yet satisfied) */
function streak(fn) {
  const m = allEvals().map; let ds = today(), n = 0;
  if (!(m[ds] && fn(m[ds]))) ds = addDays(ds, -1);
  while (m[ds] && fn(m[ds])) { n++; ds = addDays(ds, -1); }
  return n;
}
function bestStreak(fn) {
  const ev = allEvals().list; let best = 0, cur = 0, prev = null;
  ev.forEach(e => { if (fn(e)) { cur = (prev && addDays(prev, 1) === e.ds) ? cur + 1 : 1; prev = e.ds; best = Math.max(best, cur); } else { cur = 0; prev = null; } });
  return best;
}
const levelXP = L => Math.round(120 * Math.pow(L - 1, 1.55));
function levelInfo(xp) { let L = 1; while (levelXP(L + 1) <= xp) L++; const a = levelXP(L), b = levelXP(L + 1); return { L, xp, into: xp - a, need: b - a, pct: (xp - a) / (b - a) }; }
const RANKS = ['Rookie', 'Rookie', 'Grinder', 'Grinder', 'Athlete', 'Athlete', 'Athlete', 'Shredder', 'Shredder', 'Shredder', 'Machine', 'Machine', 'Machine', 'Elite', 'Elite', 'Elite', 'Legend'];
const rankName = L => RANKS[Math.min(L, RANKS.length - 1)];

const ACH = [
  { id: 'first', ic: '🍽️', nm: 'First Bite', d: 'Log your first food', xp: 25, f: c => c.loggedDays >= 1, p: c => [c.loggedDays, 1] },
  { id: 'hydro1', ic: '💧', nm: 'Hydrated', d: 'Hit your water goal', xp: 25, f: c => c.waterDays >= 1, p: c => [c.waterDays, 1] },
  { id: 'prot1', ic: '🥩', nm: 'Protein Pro', d: 'Hit your protein goal', xp: 50, f: c => c.protDays >= 1, p: c => [c.protDays, 1] },
  { id: 'prot7', ic: '🔥', nm: 'Protein Week', d: '7-day protein streak', xp: 150, f: c => c.protBest >= 7, p: c => [c.protBest, 7] },
  { id: 'prot30', ic: '🏛️', nm: 'Protein Pillar', d: '30-day protein streak', xp: 500, f: c => c.protBest >= 30, p: c => [c.protBest, 30] },
  { id: 'log7', ic: '📅', nm: 'Week Warrior', d: 'Log 7 days in a row', xp: 100, f: c => c.logBest >= 7, p: c => [c.logBest, 7] },
  { id: 'log30', ic: '🗓️', nm: 'Month Master', d: 'Log 30 days in a row', xp: 400, f: c => c.logBest >= 30, p: c => [c.logBest, 30] },
  { id: 'log100', ic: '💯', nm: 'Centurion', d: 'Log 100 days total', xp: 600, f: c => c.loggedDays >= 100, p: c => [c.loggedDays, 100] },
  { id: 'hydro7', ic: '🌊', nm: 'Tidal Wave', d: '7-day hydration streak', xp: 120, f: c => c.waterBest >= 7, p: c => [c.waterBest, 7] },
  { id: 'fibre1', ic: '🌾', nm: 'Fibre Fiend', d: 'Hit your fibre goal', xp: 40, f: c => c.fibreDays >= 1, p: c => [c.fibreDays, 1] },
  { id: 'sun', ic: '☀️', nm: 'Sun Seeker', d: 'Reach baseline vitamin D', xp: 40, f: c => c.vitDDays >= 1, p: c => [c.vitDDays, 1] },
  { id: 'omega', ic: '🐟', nm: 'Omega Hero', d: 'Hit peak EPA + DHA (1 g)', xp: 60, f: c => c.omegaDays >= 1, p: c => [c.omegaDays, 1] },
  { id: 'vits', ic: '🍊', nm: 'Vitamin Vault', d: 'Every vitamin at baseline in one day', xp: 120, f: c => c.vitDays >= 1, p: c => [c.vitDays, 1] },
  { id: 'mins', ic: '⛏️', nm: 'Mineral Miner', d: 'Every mineral at baseline in one day', xp: 120, f: c => c.minDays >= 1, p: c => [c.minDays, 1] },
  { id: 'rainbow', ic: '🌈', nm: 'Full Spectrum', d: 'All vitamins + minerals at baseline', xp: 200, f: c => c.allMicroDays >= 1, p: c => [c.allMicroDays, 1] },
  { id: 'peak1', ic: '⛰️', nm: 'Peak Day', d: 'Every peak target met, nothing over a limit', xp: 300, f: c => c.peakDays >= 1, p: c => [c.peakDays, 1] },
  { id: 'peak5', ic: '🏔️', nm: 'Summit Club', d: '5 Peak Days', xp: 600, f: c => c.peakDays >= 5, p: c => [c.peakDays, 5] },
  { id: 'macro', ic: '🎯', nm: 'Bullseye', d: 'Cals ±5%, protein met, carbs & fat ±10%', xp: 80, f: c => c.macroDays >= 1, p: c => [c.macroDays, 1] },
  { id: 'clean7', ic: '🧼', nm: 'Clean Week', d: '7 logged days in a row under every limit', xp: 150, f: c => c.cleanBest >= 7, p: c => [c.cleanBest, 7] },
  { id: 's90', ic: '⭐', nm: 'A-Game', d: 'Daily score of 90+', xp: 80, f: c => c.best >= 90, p: c => [c.best, 90] },
  { id: 's100', ic: '🌟', nm: 'Perfect 100', d: 'A perfect daily score', xp: 250, f: c => c.best >= 100, p: c => [c.best, 100] },
  { id: 'weigh1', ic: '⚖️', nm: 'Step On', d: 'Log your first weigh-in', xp: 20, f: c => c.weighDays >= 1, p: c => [c.weighDays, 1] },
  { id: 'weigh7', ic: '📉', nm: 'Data Driven', d: 'Weigh in on 7 days', xp: 60, f: c => c.weighDays >= 7, p: c => [c.weighDays, 7] },
  { id: 'down5', ic: '✂️', nm: 'First Cut', d: 'Trend weight down 5 lb', xp: 150, f: c => c.lost >= 5, p: c => [Math.max(0, c.lost), 5] },
  { id: 'down10', ic: '🪓', nm: 'Double Digits', d: 'Trend weight down 10 lb', xp: 300, f: c => c.lost >= 10, p: c => [Math.max(0, c.lost), 10] },
  { id: 'goalw', ic: '🏆', nm: 'Shredded', d: 'Reach your goal weight', xp: 1000, f: c => c.atGoal, p: c => [c.atGoal ? 1 : 0, 1] },
  { id: 'scan', ic: '📷', nm: 'Scanner', d: 'Scan a barcode', xp: 20, f: c => c.scans >= 1, p: c => [c.scans, 1] },
  { id: 'chef', ic: '👨‍🍳', nm: 'Chef', d: 'Create a recipe', xp: 40, f: c => c.recipes >= 1, p: c => [c.recipes, 1] },
  { id: 'goalwk', ic: '🥇', nm: 'Goal Getter', d: 'Complete a weekly goal', xp: 100, f: c => c.weeklyDone >= 1, p: c => [c.weeklyDone, 1] },
  { id: 'lvl5', ic: '🚀', nm: 'Level 5', d: 'Reach level 5', xp: 0, f: c => c.level >= 5, p: c => [c.level, 5] },
  { id: 'lvl10', ic: '💎', nm: 'Level 10', d: 'Reach level 10', xp: 0, f: c => c.level >= 10, p: c => [c.level, 10] },
  { id: 'lvl25', ic: '👑', nm: 'Level 25', d: 'Reach level 25', xp: 0, f: c => c.level >= 25, p: c => [c.level, 25] },
];
function weightTrend() {
  const w = S.weights; if (!w.length) return [];
  let ema = w[0].lb, prev = w[0].d; return w.map(x => { const days = Math.max(1, Math.round((parseD(x.d) - parseD(prev)) / 864e5)); const a = 1 - Math.pow(0.9, days); ema = ema + a * (x.lb - ema); prev = x.d; return { d: x.d, lb: x.lb, tr: ema }; });
}
function gameCtx() {
  const ev = allEvals().list; const L = ev.filter(e => e.logged);
  const tr = weightTrend();
  const c = {
    loggedDays: L.length, waterDays: ev.filter(e => e.h && e.h.water).length, protDays: L.filter(e => e.h.protein).length, fibreDays: L.filter(e => e.h.fibre).length,
    vitDDays: L.filter(e => e.vitD).length, omegaDays: L.filter(e => e.omega).length, vitDays: L.filter(e => e.vits).length, minDays: L.filter(e => e.mins).length,
    allMicroDays: L.filter(e => e.allMicros).length, peakDays: L.filter(e => e.peakDay).length, macroDays: L.filter(e => e.macroAll).length,
    best: Math.max(0, ...L.map(e => e.score)),
    protBest: bestStreak(e => e.logged && e.h.protein), logBest: bestStreak(e => e.logged), waterBest: bestStreak(e => e.h && e.h.water),
    cleanBest: bestStreak(e => e.logged && !e.over.length && !e.ulOver.length),
    weighDays: new Set(S.weights.map(w => w.d)).size, lost: tr.length ? S.weights[0].lb - tr[tr.length - 1].tr : 0,
    atGoal: tr.length > 0 && tr[tr.length - 1].tr <= S.profile.goalLb, scans: S.counters.scans || 0, recipes: S.recipes.length,
    weeklyDone: weeklyGoalsCompleted(),
  };
  const baseXP = ev.reduce((a, e) => a + dayXP(e), 0);
  const achXP = ACH.filter(a => S.achievements[a.id]).reduce((a, x) => a + x.xp, 0);
  c.xp = baseXP + achXP; c.level = levelInfo(c.xp).L;
  return c;
}
function checkAchievements(silent) {
  const c = gameCtx(); const fresh = [];
  ACH.forEach(a => { if (!S.achievements[a.id] && a.f(c)) { S.achievements[a.id] = today(); fresh.push(a); } });
  if (fresh.length) { save(); if (!silent) { fresh.forEach((a, i) => setTimeout(() => toast(a.ic, 'Achievement: ' + a.nm, a.d + (a.xp ? ' · +' + a.xp + ' XP' : '')), i * 900)); confetti(); } }
  return fresh;
}

/* ---------------- custom goals ---------------- */
function periodRange(period, ref) {
  const d = parseD(ref || today());
  if (period === 'day') return [dstr(d), dstr(d)];
  if (period === 'week') { const wd = (d.getDay() + 6) % 7; const s = new Date(d); s.setDate(d.getDate() - wd); const e = new Date(s); e.setDate(s.getDate() + 6); return [dstr(s), dstr(e)]; }
  const s = new Date(d.getFullYear(), d.getMonth(), 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [dstr(s), dstr(e)];
}
function goalProgress(g, ref) {
  const [a, b] = periodRange(g.period, ref); const m = allEvals().map;
  const evs = []; for (let ds = a; ds <= b; ds = addDays(ds, 1)) if (m[ds] && m[ds].logged) evs.push(m[ds]);
  const totalDays = Math.round((parseD(b) - parseD(a)) / 864e5) + 1;
  let cur = 0, target = +g.value, label = '', done = false, pct = 0; const n = BY[g.key];
  if (g.metric === 'avg') {
    cur = evs.length ? evs.reduce((s, e) => s + (e.t[g.key] || 0), 0) / evs.length : 0;
    const lower = g.cmp === 'lte';
    done = evs.length > 0 && (lower ? cur <= target : cur >= target);
    pct = lower ? (evs.length ? clamp(target / Math.max(cur, 1e-9), 0, 1) : 0) : clamp(cur / target, 0, 1);
    label = (g.period === 'day' ? '' : 'Avg ') + n.name + (lower ? ' ≤ ' : ' ≥ ') + fmt(target, n.dp) + ' ' + n.unit;
  } else if (g.metric === 'daysHit') {
    cur = evs.filter(e => g.key === 'water' ? e.h.water : n.type === 'limit' ? (e.t[g.key] || 0) <= e.T[g.key].limit : hit(g.key, e.t[g.key], e.T)).length;
    done = cur >= target; pct = clamp(cur / target, 0, 1); label = n.name + ' goal hit on ' + target + ' days';
  } else if (g.metric === 'daysLogged') {
    cur = evs.length; done = cur >= target; pct = clamp(cur / target, 0, 1); label = 'Log ' + target + ' days';
  } else if (g.metric === 'avgScore') {
    cur = evs.length ? evs.reduce((s, e) => s + e.score, 0) / evs.length : 0; done = cur >= target; pct = clamp(cur / target, 0, 1); label = 'Avg daily score ≥ ' + target;
  } else if (g.metric === 'weightLoss') {
    const tr = weightTrend().filter(w => w.d >= addDays(a, -1) && w.d <= b);
    cur = tr.length > 1 ? tr[0].tr - tr[tr.length - 1].tr : 0; done = cur >= target; pct = clamp(cur / target, 0, 1); label = 'Lose ' + target + ' lb (trend)';
  }
  return { cur, target, done, pct, label, range: [a, b], days: evs.length, totalDays };
}
function weeklyGoalsCompleted() {
  // count completed weekly goals over all past weeks with data
  const wk = S.goals.filter(g => g.period === 'week'); if (!wk.length) return 0;
  const ds = Object.keys(S.days).sort(); if (!ds.length) return 0;
  const seen = new Set(); let n = 0;
  ds.forEach(d => { const r = periodRange('week', d)[0]; if (seen.has(r)) return; seen.add(r); if (r > today()) return; wk.forEach(g => { if (g.metric !== 'avgScore' || true) { const p = goalProgress(g, r); if (p.done) n++; } }); });
  return n;
}

/* ---------------- UI infrastructure ---------------- */
let VIEW = 'today', CUR = today();
const ICON = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>',
};
function toast(ic, title, sub, opt) {
  const el = document.createElement('div'); el.className = 'toast' + (opt && opt.action ? ' act' : '');
  el.innerHTML = `<div class="e">${ic}</div><div style="flex:1;min-width:0"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${opt && opt.action ? `<button class="tbtn">${esc(opt.action)}</button>` : ''}`;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 350); };
  if (opt && opt.action) $('.tbtn', el).onclick = e => { e.stopPropagation(); kill(); opt.onAction(); };
  $('#toasts').appendChild(el);
  setTimeout(kill, opt && opt.action ? 6000 : 3200);
}
function haptic() { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
/* confetti */
function confetti(power = 1) {
  const cv = $('#confetti'), ctx = cv.getContext('2d'); const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cols = ['#7c5cff', '#22d3ee', '#34d399', '#ffd166', '#ff5d8f', '#ffffff'];
  const P = Array.from({ length: Math.round(140 * power) }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * 0.35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[(Math.random() * cols.length) | 0], life: 0 }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight); f++;
    P.forEach(p => { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - f / 140); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (f < 140) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}
/* bottom sheets (stackable) */
const SHEETS = [];
function openSheet(title, html, opts = {}) {
  const bd = document.createElement('div'); bd.className = 'backdrop';
  const sh = document.createElement('div'); sh.className = 'sheet' + (opts.full ? ' full' : '');
  sh.innerHTML = `<div class="grab"></div><div class="sh"><h2>${title}</h2>${opts.head || ''}<button class="iconbtn" data-close>${ICON.x}</button></div><div class="sb">${html}</div>`;
  document.body.append(bd, sh);
  const rec = { bd, sh, onClose: opts.onClose };
  SHEETS.push(rec);
  requestAnimationFrame(() => { bd.classList.add('on'); sh.classList.add('on'); });
  bd.onclick = () => closeSheet(rec);
  $('[data-close]', sh).onclick = () => closeSheet(rec);
  // swipe down to close from grab/header
  let y0 = null; const hd = $('.sh', sh), gr = $('.grab', sh);
  [hd, gr].forEach(el => {
    el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; sh.style.transition = 'none'; }, { passive: true });
    el.addEventListener('touchmove', e => { if (y0 == null) return; const dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translate(-50%,${dy}px)`; }, { passive: true });
    el.addEventListener('touchend', e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; sh.style.transition = ''; sh.style.transform = ''; y0 = null; if (dy > 110) closeSheet(rec); });
  });
  if (opts.mount) opts.mount(sh, rec);
  return rec;
}
function closeSheet(rec) {
  rec = rec || SHEETS[SHEETS.length - 1]; if (!rec) return;
  const i = SHEETS.indexOf(rec); if (i >= 0) SHEETS.splice(i, 1);
  rec.bd.classList.remove('on'); rec.sh.classList.remove('on');
  if (rec.onClose) rec.onClose();
  setTimeout(() => { rec.bd.remove(); rec.sh.remove(); }, 380);
}
function closeAllSheets() { while (SHEETS.length) closeSheet(SHEETS[SHEETS.length - 1]); }

function ring(r, w, pct, grad, track = true) {
  const C = 2 * Math.PI * r; const p = clamp(pct, 0, 1);
  return `${track ? `<circle class="ring-track" cx="100" cy="100" r="${r}" stroke-width="${w}"/>` : ''}<circle class="ring-arc" cx="100" cy="100" r="${r}" stroke-width="${w}" stroke="url(#${grad})" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - p)}"/>`;
}
const RING_DEFS = `<defs>
 <linearGradient id="gK" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d8f"/><stop offset="1" stop-color="#ffb547"/></linearGradient>
 <linearGradient id="gP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
 <linearGradient id="gC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#f6ad55"/></linearGradient>
 <linearGradient id="gF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#7c5cff"/></linearGradient>
 <linearGradient id="gS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#34d399"/></linearGradient>
 <linearGradient id="gO" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5d73"/><stop offset="1" stop-color="#ff2d55"/></linearGradient>
</defs>`;
function animateRings(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.ring-arc', root).forEach(c => c.style.strokeDashoffset = c.dataset.off)));
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.bar>i[data-w]', root).forEach(b => b.style.width = b.dataset.w)));
}
function meter(k, v, T) {
  const n = BY[k], tg = T[k] || {}; const st = status(k, v, T);
  let max;
  if (n.type === 'limit') max = (tg.limit || 1) * 1.25;
  else max = Math.max(tg.peak || 0, tg.base || 0, tg.goal || 0) * 1.08 || 1;
  if (k === 'kcal') max = (tg.goal || 1) * 1.15;
  const w = clamp((v || 0) / max, 0, 1) * 100;
  const macro = ['kcal', 'protein', 'carbs', 'fat'].includes(k);
  const col = st.state === 'over' || st.state === 'ul' ? 'linear-gradient(90deg,#ff5d73,#ff2d55)' : st.state === 'near' ? 'linear-gradient(90deg,#ffb547,#ff8a3d)' : st.state === 'peak' && !macro ? 'linear-gradient(90deg,#ffd166,#ffb547)' : n.type === 'limit' ? 'linear-gradient(90deg,#34d399,#22d3ee)' : `linear-gradient(90deg,${n.color}aa,${n.color})`;
  let mk = '';
  if (n.type === 'limit') mk = `<span class="mk" style="left:${(tg.limit / max) * 100}%;background:var(--bad)"></span>`;
  else {
    if (tg.base != null && k !== 'kcal') mk += `<span class="mk" style="left:${clamp(tg.base / max, 0, 1) * 100}%"></span>`;
    if (tg.peak != null && tg.peak > (tg.base || 0) && k !== 'kcal') mk += `<span class="mk peak" style="left:${clamp(tg.peak / max, 0, 1) * 100}%"></span>`;
    if (k === 'kcal') mk = `<span class="mk" style="left:${(tg.goal / max) * 100}%"></span>`;
  }
  return `<div class="bar"><i data-w="${w}%" style="width:0;background:${col}"></i>${mk}</div>`;
}

/* ---------------- render: Today ---------------- */
function greet() { const h = new Date().getHours(); return h < 5 ? 'Late night fuel' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function dateLabel(ds) {
  const t = today(); if (ds === t) return 'Today'; if (ds === addDays(t, -1)) return 'Yesterday'; if (ds === addDays(t, 1)) return 'Tomorrow';
  return parseD(ds).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function dateBar() {
  return `<div class="datebar"><button class="iconbtn" data-act="prevday">${ICON.left}</button><div class="d">${dateLabel(CUR)}<input type="date" id="datepick" value="${CUR}" max="${addDays(today(), 1)}"></div><button class="iconbtn" data-act="nextday" ${CUR >= today() ? 'style="opacity:.35"' : ''}>${ICON.right}</button></div>`;
}
function renderToday() {
  const T = targetsFor(CUR); const { t, coverage, count } = totals(CUR); const d = day(CUR);
  const c = gameCtx(); const lv = levelInfo(c.xp); const ev = evalDay(CUR);
  const logStreak = streak(e => e.logged);
  const kG = T.kcal.goal, kV = t.kcal || 0, rem = kG - kV;
  const kp = kV / kG;
  const microN = MICROS.filter(k => atBase(k, t[k], T)).length;
  const html = `
  <div class="top"><div class="grow"><div class="sub">${greet()}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</div><h1>Fuel</h1></div>
    <button class="iconbtn" data-act="profile" aria-label="Profile & settings">${ICON.gear}</button></div>
  ${dateBar()}
  <div class="card" style="padding:12px"><div class="grid2">
    <button class="tile" data-act="voice" style="padding:16px 12px;text-align:center;background:linear-gradient(135deg,rgba(52,211,153,.22),rgba(34,211,238,.12))"><div style="font-size:30px">🎙️</div><b style="display:block;margin-top:4px;font-size:16px">Say it</b><span class="mut tiny">“2 eggs and a coffee”</span></button>
    <button class="tile" data-act="label" style="padding:16px 12px;text-align:center;background:linear-gradient(135deg,rgba(124,92,255,.28),rgba(34,211,238,.14))"><div style="font-size:30px">🏷️</div><b style="display:block;margin-top:4px;font-size:16px">Read the label</b><span class="mut tiny">Say the nutrition facts</span></button></div>
    <div class="row" style="margin-top:10px;gap:8px"><button class="btn" data-act="search" style="flex:1;padding:11px">🔍 Search</button><button class="btn" data-act="scan" style="flex:1;padding:11px">${ICON.scan.replace('<svg', '<svg width="18" height="18"')} Scan</button><button class="btn" data-act="recent" style="flex:1;padding:11px">🕘 Recent</button></div></div>
  ${profileNow().weightEst ? `<button class="card" data-act="log-weight" style="display:block;width:100%;text-align:left;border-color:rgba(255,181,71,.4)"><b>⚖️ Add your current weight</b><div class="mut small" style="margin-top:4px">Calorie & macro targets are using a 180 lb placeholder. Tap to weigh in.</div></button>` : ''}
  ${myItemsCard()}
  <div class="card"><div class="lvl"><div class="badge">${lv.L}</div><div class="xp"><div class="row"><b>${rankName(lv.L)}</b><span class="mut small" style="margin-left:auto">${fmt(lv.into)} / ${fmt(lv.need)} XP</span></div><div class="xpbar"><i style="width:${lv.pct * 100}%"></i></div></div></div>
    <div class="stat3"><div><b class="score">${ev.score || 0}</b><span>Daily score</span></div><div><b>🔥 ${logStreak}</b><span>Day streak</span></div><div><b>🏅 ${Object.keys(S.achievements).length}</b><span>Badges</span></div></div></div>
  <div class="card"><div class="hero">
    <div class="ringwrap"><svg viewBox="0 0 200 200">${RING_DEFS}${ring(92, 11, kp, kp > 1.1 ? 'gO' : 'gK')}${ring(77, 11, (t.protein || 0) / T.protein.goal, 'gP')}${ring(62, 11, (t.carbs || 0) / T.carbs.goal, 'gC')}${ring(47, 11, (t.fat || 0) / T.fat.goal, 'gF')}</svg>
      <div class="ringcenter"><div><div class="big">${fmt(Math.abs(rem))}</div><div class="lbl">${rem >= 0 ? 'kcal left' : 'kcal over'}</div></div></div></div>
    <div class="macros">
      ${[['kcal', 'Calories', '#ff7a59'], ['protein', 'Protein', '#34d399'], ['carbs', 'Carbs', '#ffd166'], ['fat', 'Fat', '#a78bfa']].map(([k, l, c]) => `<button class="macro" data-nut="${k}" style="text-align:left"><div class="t"><span><span style="color:${c}">●</span> ${l}</span><span>${fmt(t[k] || 0)}/${fmt(T[k].goal)}${k === 'kcal' ? '' : 'g'}</span></div>${meter(k, t[k], T)}</button>`).join('')}
    </div></div></div>
  <div class="card"><h2>Focus <button class="r" data-act="pins">Edit</button></h2><div class="grid2">${S.settings.pinned.filter(k => BY[k] && !['kcal'].includes(k)).map(k => tile(k, t, T, coverage)).join('')}</div></div>
  ${waterCard(t, T, d)}
  ${MEALS.map(([mk, ml, mi]) => mealCard(mk, ml, mi, d)).join('')}
  <div class="card"><h2>Micronutrients <button class="r" data-act="go-nutrients">All nutrients ›</button></h2>
    <div class="row"><div style="flex:1"><div style="font-size:24px;font-weight:800">${microN}<span class="mut" style="font-size:15px"> / ${MICROS.length} at baseline</span></div>
    <div class="bar" style="margin-top:8px"><i data-w="${microN / MICROS.length * 100}%" style="width:0;background:var(--grad)"></i></div></div></div>
    ${ev.over && ev.over.length ? `<div class="note" style="border-color:rgba(255,93,115,.4)">⚠️ Over limit: ${ev.over.map(k => BY[k].name).join(', ')}</div>` : ''}
    ${ev.ulOver && ev.ulOver.length ? `<div class="note" style="border-color:rgba(255,93,115,.4)">⚠️ Above Upper Limit: ${ev.ulOver.map(k => BY[k].name).join(', ')}</div>` : ''}
  </div>`;
  return html;
}
function tile(k, t, T, coverage) {
  const n = BY[k], v = t[k] || 0, st = status(k, v, T), tg = T[k];
  const goal = n.type === 'limit' ? tg.limit : tg.goal;
  const covWarn = coverage[k] < 0.85 && v > 0 ? `<span title="Data missing for some foods">~</span>` : '';
  return `<button class="tile ${st.state === 'peak' && k !== 'kcal' ? 'peak' : ''}" data-nut="${k}"><div class="glow" style="background:${n.color}"></div>
   <div class="nm"><span>${n.short}</span><span style="color:${stateColor(st.state)};font-size:10.5px">${st.state === 'track' ? '' : st.label}</span></div>
   <div class="val">${covWarn}${fmtN(k, v)}<small>${goal != null ? '/ ' + fmtN(k, goal) + ' ' : ''}${n.unit}</small></div>${meter(k, v, T)}
   <div class="st"><span>${n.type === 'limit' ? 'limit' : tg.base != null && k !== 'kcal' ? 'base ' + fmtN(k, tg.base) : ''}</span><span>${n.type !== 'limit' && tg.peak > tg.base ? '✦ ' + fmtN(k, tg.peak) : ''}</span></div></button>`;
}
function waterCard(t, T, d) {
  const g = T.water.goal, v = t.water || 0, pct = clamp(v / g, 0, 1);
  const oz = S.settings.waterUnit === 'oz';
  const show = ml => oz ? fmt(ml / 29.5735) + ' oz' : ml >= 1000 ? (ml / 1000).toFixed(2).replace(/0$/, '') + ' L' : fmt(ml) + ' ml';
  const qs = oz ? [8, 16, 24] : S.settings.quickWater;
  return `<div class="card"><h2>Hydration <span class="r" style="color:var(--mut)">${d.water.length ? `<button data-act="water-list" style="color:var(--a2)">${d.water.length} logged</button>` : ''}</span></h2>
  <div class="water"><div class="glass"><i style="height:${pct * 100}%"></i></div>
   <div style="flex:1"><div style="font-size:26px;font-weight:800">${show(v)}<span class="mut" style="font-size:14px;font-weight:600"> / ${show(g)}</span></div>
   <div class="mut small">${v >= g ? '✦ Goal reached' : show(g - v) + ' to go'}${T._energy.training ? ' · training day' : ''}${t.water && (v - (d.water.reduce((a, w) => a + w.ml, 0))) > 0 ? ' · incl. ' + show(v - d.water.reduce((a, w) => a + w.ml, 0)) + ' from drinks' : ''}</div>
   <div class="qbtns">${qs.map(q => `<button class="qb" data-water="${oz ? Math.round(q * 29.5735) : q}">+${oz ? q + ' oz' : q >= 1000 ? q / 1000 + ' L' : q + ' ml'}</button>`).join('')}<button class="qb" data-act="water-custom">+…</button></div></div></div>
   <div class="sep"></div>
   <div class="row"><div style="flex:1"><b style="font-size:14px">Training day</b><div class="mut small">${d.training.on ? `${d.training.hours} h · +${fmt(d.training.hours * 700)} ml water, +${fmt(d.training.hours * 500)} mg sodium allowance` : 'Raises water & sodium targets for sweat losses'}</div></div>
   ${d.training.on ? `<select class="inp" id="trainHours" style="width:auto;padding:8px 30px 8px 10px">${[0.5, 1, 1.5, 2, 3].map(h => `<option ${h == d.training.hours ? 'selected' : ''} value="${h}">${h} h</option>`).join('')}</select>` : ''}
   <button class="switch ${d.training.on ? 'on' : ''}" data-act="training" aria-label="Training day"></button></div></div>`;
}
function mealCard(mk, ml, mi, d) {
  const es = d.entries.filter(e => e.meal === mk);
  const kc = es.reduce((a, e) => a + (e.n.kcal || 0), 0), pr = es.reduce((a, e) => a + (e.n.protein || 0), 0);
  return `<div class="card meal"><h3><span>${mi} ${ml}</span><span class="k">${es.length ? fmt(kc) + ' kcal · ' + fmt(pr) + 'g P' : ''}</span></h3>
   ${es.map(e => `<button class="entry" data-entry="${e.id}" style="width:100%;text-align:left"><div class="nm"><b>${esc(e.name)}</b><span>${esc(e.qtyLabel || fmt(e.g) + ' g')}</span></div><div class="kc">${fmt(e.n.kcal || 0)}<span>${fmt(e.n.protein || 0, 1)}g P</span></div></button>`).join('')}
   <button class="addmeal" data-add="${mk}">+ Add to ${ml.toLowerCase()}</button></div>`;
}

/* ---------------- logging: search sheet ---------------- */
function defaultMeal() { const h = new Date().getHours(); return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 20.5 ? 'dinner' : 'snacks'; }
function snapshot(item) { return { key: item.key, name: item.name, sub: item.sub, src: item.src, n100: roundN(item.n100), portions: item.portions, dens: item.dens, hyd: item.hyd, servingG: item.servingG, code: item.code }; }
function tagFor(src) { return { f: '<span class="tag f">USDA·FOUND</span>', usda: '<span class="tag f">USDA·SR</span>', fndds: '<span class="tag fn">USDA·FNDDS</span>', cnf: '<span class="tag cnf">CNF·CA</span>', off: '<span class="tag off">OFF·USER</span>', cus: '<span class="tag cus">MINE</span>', rec: '<span class="tag cus">RECIPE</span>', sup: '<span class="tag sup">SUPP</span>', label: '<span class="tag cus">LABEL</span>' }[src] || ''; }
function itemRow(it, extra = '') {
  const p = it.portions && it.portions[0]; const kc100 = it.n100.kcal || 0;
  const per = p ? `${fmt(kc100 * p[1] / 100)} kcal / ${esc(String(p[0]).slice(0, 28))}` : `${fmt(kc100)} kcal / 100 g`;
  return `<button class="it" data-item="${esc(it.key)}"><div class="nm"><b>${tagFor(it.src)}${esc(it.name)}</b><span>${per}${it.sub ? ' · ' + esc(it.sub) : ''}</span></div><div class="kc"><b>${fmt(it.n100.protein || 0, 1)}g</b>P / 100g</div>${extra}</button>`;
}
const ITEMS = new Map(); // key → item for current list rendering
function rememberItems(arr) { arr.forEach(i => ITEMS.set(i.key, i)); return arr; }
const PENALTY = /\b(dried|dehydrated|powder|powdered|meatless|imitation|glutinous|overripe|babyfood|baby food|toddler|infant|formula|industrial|substitute|roll|frozen|canned|unenriched|dry|mix|concentrate|unprepared|flour|stuffed|breaded|lunchmeat|luncheon|loaf|pickled)\b/g;
const BOOST = /\b(raw|cooked|boiled|baked|roasted|brewed|nfs|hard-boiled|grilled|whole)\b/g;
function searchLocal(q, _depth) {
  const toks = q.toLowerCase().replace(/[^a-z0-9%\s,'-]/g, ' ').split(/[\s,]+/).filter(t => t && !STOP.has(t)).map(stem).slice(0, 6);
  if (!toks.length) return [];
  const res = [];
  const re = toks.map(t => new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const qraw = q.toLowerCase();
  const own = [...S.customFoods.map(customItem), ...S.recipes.map(recipeItem), ...SUPPS.map(suppItem)];
  own.forEach(it => { const l = it.name.toLowerCase(); if (re.every(r => r.test(l))) res.push({ it, s: 200 - l.length / 4 }); });
  if (DB) {
    const badCat = { 'Baby Foods': 30, 'American Indian/Alaska Native Foods': 25, 'Fast Foods': 6, 'Restaurant Foods': 6, 'Formula, prepared from powder': 30, 'Formula, ready-to-feed': 30, 'Baby food: cereals': 30, 'Baby food: fruit': 30, 'Baby food: vegetables': 30, 'Baby food: mixtures': 30, 'Baby food: meat and dinners': 30, 'Baby food: snacks and sweets': 30, 'Baby food: yogurt': 30, 'Baby juice': 30, 'Baby water': 30, 'Human milk': 40 };
    for (const f of DB.foods) {
      const l = f.l; if (!re.every(r => r.test(l))) continue;
      const seg0 = l.replace(/^(fish|beverages|spices|cereals|nuts|seeds|alcoholic beverages?|cheese), /, '').split(',')[0];
      let s = 100 - l.length / 5;
      if (re[0].test(seg0)) s += 25;
      if (seg0 === toks[0] || seg0 === toks[0] + 's' || seg0 === toks.join(' ') || stem(seg0) === toks.join(' ')) s += 25;
      if (toks.every(t => seg0.includes(t))) s += 12;
      s += SRC_RANK[SRC_KEYS[f.sc]] || 0;
      const pen = l.match(PENALTY); if (pen) pen.forEach(w => { if (!qraw.includes(w)) s -= 14; });
      const bo = l.match(BOOST); if (bo) s += Math.min(6, bo.length * 3);
      s -= badCat[DB.cats[f.cat]] || 0;
      res.push({ f, s });
    }
  }
  if (!res.length && toks.length > 1 && !_depth) {
    // relax: drop one token at a time (e.g. "black coffee" → "coffee")
    for (let i = 0; i < toks.length; i++) { const r = searchLocal(toks.filter((_, j) => j !== i).join(' '), 1); if (r.length) return r; }
  }
  res.sort((a, b) => b.s - a.s);
  return res.slice(0, 50).map(r => r.it || usdaItem(r.f));
}
const STOP = new Set(['of', 'a', 'an', 'the', 'some', 'with', 'and', 'my', 'fresh']);
function stem(t) { if (t.length <= 3) return t; if (/ies$/.test(t)) return t.slice(0, -3); if (/(oes|ches|shes|sses|xes)$/.test(t)) return t.slice(0, -2); if (/[^s]s$/.test(t)) return t.slice(0, -1); return t; }
let LOG = null; // current log sheet context
function openLog(opts = {}) {
  LOG = { meal: opts.meal || (CUR === today() ? defaultMeal() : 'snacks'), tab: opts.tab || 'search', q: '', mode: opts.mode || 'log', onPick: opts.onPick, offRes: null };
  const ctx = LOG; const rec = openSheet(opts.mode === 'recipe' ? 'Add ingredient' : opts.mode === 'pick' ? 'Choose food' : 'Log food', `<div id="logbody"></div>`, { full: true, onClose: () => { stopScan(); if (LOG === ctx) LOG = ctx.parent || null; } });
  LOG.parent = opts.parent || null;
  LOG.rec = rec; renderLog(); loadDB().then(() => { if (LOG && LOG.q) renderResults(); }).catch(() => {});
  return rec;
}
function renderLog() {
  const b = $('#logbody', LOG.rec.sh); if (!b) return;
  b.innerHTML = `${LOG.mode === 'log' ? `<div class="chips" style="margin-bottom:12px">${MEALS.map(([k, l, i]) => `<button class="chip ${LOG.meal === k ? 'on' : ''}" data-meal="${k}">${i} ${l}</button>`).join('')}</div>` : ''}
   <div class="seg">${[['search', 'Search'], ['recent', 'Recent'], ['favs', 'Favourites'], ['mine', 'My foods'], ['scan', 'Scan']].map(([k, l]) => `<button class="${LOG.tab === k ? 'on' : ''}" data-ltab="${k}">${l}</button>`).join('')}</div>
   <div id="logtab"></div>`;
  $$('[data-meal]', b).forEach(el => el.onclick = () => { LOG.meal = el.dataset.meal; $$('[data-meal]', b).forEach(x => x.classList.toggle('on', x === el)); });
  $$('[data-ltab]', b).forEach(el => el.onclick = () => { stopScan(); LOG.tab = el.dataset.ltab; renderLog(); });
  const tb = $('#logtab', b);
  if (LOG.tab === 'search') {
    tb.innerHTML = `<div class="search">${ICON.search}<input class="inp" id="q" placeholder="Search 8,000 foods… e.g. chicken breast" autocomplete="off" enterkeyhint="search" value="${esc(LOG.q)}"></div><div id="res" class="list"></div>`;
    const q = $('#q', tb); let tmo;
    q.oninput = () => { clearTimeout(tmo); tmo = setTimeout(() => { LOG.q = q.value.trim(); LOG.offRes = null; renderResults(); }, 140); };
    q.onkeydown = e => { if (e.key === 'Enter') { q.blur(); LOG.q = q.value.trim(); if (LOG.q.length > 1) runOff(); } };
    renderResults();
    if (!LOG.q) setTimeout(() => q.focus(), 350);
  } else if (LOG.tab === 'recent') {
    const y = addDays(CUR, -1), yd = S.days[y];
    const copyMeals = yd ? MEALS.filter(([k]) => yd.entries.some(e => e.meal === k)) : [];
    const items = rememberItems(S.recent.map(r => Object.assign({}, r)));
    tb.innerHTML = `${LOG.mode === 'log' && copyMeals.length ? `<div class="card" style="padding:12px"><h2 style="margin-bottom:8px">Repeat yesterday</h2><div class="chips">${copyMeals.map(([k, l, i]) => { const es = yd.entries.filter(e => e.meal === k); return `<button class="chip" data-copy="${k}">${i} ${l} · ${es.length} items · ${fmt(es.reduce((a, e) => a + (e.n.kcal || 0), 0))} kcal</button>`; }).join('')}<button class="chip" data-copy="*">📋 Whole day</button></div></div>` : ''}
      <div class="list">${items.length ? items.map(i => itemRow(i)).join('') : '<div class="empty">Foods you log will appear here for one-tap re-logging.</div>'}</div>`;
    $$('[data-copy]', tb).forEach(el => el.onclick = () => copyMeal(y, el.dataset.copy));
  } else if (LOG.tab === 'favs') {
    const items = rememberItems(S.favs.map(r => Object.assign({}, r)));
    tb.innerHTML = `<div class="list">${items.length ? items.map(i => itemRow(i)).join('') : '<div class="empty">Tap ☆ on any food to favourite it.</div>'}</div>`;
  } else if (LOG.tab === 'mine') {
    const cus = rememberItems(S.customFoods.map(customItem)), rec = rememberItems(S.recipes.map(recipeItem)), sup = rememberItems(SUPPS.map(suppItem));
    tb.innerHTML = `<div class="f2" style="margin-bottom:12px"><button class="btn" data-act="new-custom">＋ Custom food</button>${LOG.mode === 'log' ? '<button class="btn" data-act="new-recipe">＋ Recipe</button>' : '<span></span>'}</div>
      <h2 class="mut small" style="margin:8px 0 0">MY FOODS & RECIPES</h2><div class="list">${cus.concat(rec).map(i => itemRow(i, `<span class="iconbtn" data-edit="${esc(i.key)}" style="width:34px;height:34px">✎</span>`)).join('') || '<div class="empty">Create foods from labels, or build recipes from ingredients.</div>'}</div>
      <h2 class="mut small" style="margin:16px 0 0">SUPPLEMENTS (generic — edit to your label)</h2><div class="list">${sup.map(i => itemRow(i)).join('')}</div>`;
    $$('[data-edit]', tb).forEach(el => el.onclick = ev => { ev.stopPropagation(); const k = el.dataset.edit; if (k.startsWith('cus:')) openCustomFood(S.customFoods.find(c => 'cus:' + c.id === k)); else openRecipe(S.recipes.find(r => 'rec:' + r.id === k)); });
  } else if (LOG.tab === 'scan') {
    tb.innerHTML = `<div class="scan" id="scanbox"><video id="vid" playsinline muted></video><div class="frame"></div><div class="laser"></div></div>
     <div class="mut small" id="scanmsg" style="margin:10px 2px">Point the camera at a barcode. Looks up Open Food Facts (needs internet).</div>
     <div class="row"><input class="inp" id="bcode" inputmode="numeric" placeholder="Or type barcode (UPC/EAN)"><button class="btn pri" id="bgo">Look up</button></div>`;
    $('#bgo', tb).onclick = () => { const v = $('#bcode', tb).value.replace(/\D/g, ''); if (v.length >= 6) lookupBarcode(v); };
    startScan();
  }
  b.onclick = e => { const it = e.target.closest('[data-item]'); if (it && !e.target.closest('[data-edit]')) { const item = ITEMS.get(it.dataset.item); if (item) { if (LOG.mode === 'pick') { const cb = LOG.onPick, r = LOG.rec; cb(item); closeSheet(r); } else openFood(item, { meal: LOG.meal, mode: LOG.mode, onPick: LOG.onPick }); } } };
}
function renderResults() {
  const r = $('#res', LOG && LOG.rec.sh); if (!r) return;
  if (!LOG.q) { r.innerHTML = `<div class="empty">Search USDA FoodData Central (${DB ? DB.foods.length.toLocaleString() : '8,000+'} foods with full micronutrients), your foods, and supplements.<br><br>For packaged/branded foods press <b>Enter</b> or use <b>Scan</b>.</div>`; return; }
  if (!DB) { r.innerHTML = '<div class="empty">Loading food database…</div>'; }
  const loc = rememberItems(searchLocal(LOG.q));
  const off = LOG.offRes;
  r.innerHTML = loc.map(i => itemRow(i)).join('') + (loc.length ? '' : DB ? '<div class="empty">No matches in the local database.</div>' : '') +
    `<div style="padding:14px 0">${off === 'loading' ? '<div class="empty">Searching Open Food Facts…</div>' : off && off.err ? `<div class="empty">Online search unavailable (${esc(off.err)}). Try a barcode.</div>` : Array.isArray(off) ? `<h2 class="mut small">PACKAGED FOODS · OPEN FOOD FACTS</h2>${rememberItems(off).map(i => itemRow(i)).join('') || '<div class="empty">No packaged matches.</div>'}` : `<button class="btn block" id="offbtn">🌐 Search packaged foods online</button>`}</div>`;
  const ob = $('#offbtn', r); if (ob) ob.onclick = runOff;
}
async function runOff() {
  if (!LOG || !LOG.q) return;
  if (!navigator.onLine) { LOG.offRes = { err: 'offline' }; renderResults(); return; }
  LOG.offRes = 'loading'; renderResults();
  const q = LOG.q;
  try { const res = await offSearch(q); if (LOG && LOG.q === q) { LOG.offRes = res; renderResults(); } }
  catch (e) { if (LOG) { LOG.offRes = { err: e.name === 'AbortError' ? 'timed out' : e.message || 'error' }; renderResults(); } }
}
function copyMeal(fromDs, meal) {
  const src = S.days[fromDs]; if (!src) return;
  const d = day(CUR, true); let n = 0;
  src.entries.filter(e => meal === '*' || e.meal === meal).forEach(e => { d.entries.push(Object.assign({}, e, { id: uid(), t: Date.now() })); n++; });
  afterChange(); closeSheet(LOG.rec); toast('📋', `Copied ${n} item${n === 1 ? '' : 's'}`, 'from ' + dateLabel(fromDs).toLowerCase());
}

/* ---------------- barcode scanning ---------------- */
let SCAN = null;
async function startScan() {
  const vid = $('#vid'), msg = $('#scanmsg'); if (!vid) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'Camera not available here — type the barcode instead.'; $('#scanbox').classList.add('hidden'); return; }
  try {
    SCAN = { active: true };
    if ('BarcodeDetector' in window) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!SCAN || !SCAN.active) { stream.getTracks().forEach(t => t.stop()); return; }
      SCAN.stream = stream; vid.srcObject = stream; await vid.play();
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      const loop = async () => { if (!SCAN || !SCAN.active) return; try { const r = await det.detect(vid); if (r && r[0]) { const c = r[0].rawValue; stopScan(); lookupBarcode(c); return; } } catch (e) {} setTimeout(loop, 180); };
      loop();
    } else {
      msg.textContent = 'Starting camera…';
      await loadScript('vendor/zxing.min.js');
      if (!SCAN || !SCAN.active) return;
      const hints = new Map(); const ZX = window.ZXing;
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E, ZX.BarcodeFormat.CODE_128]);
      const reader = new ZX.BrowserMultiFormatReader(hints, 250); SCAN.reader = reader;
      await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, vid, (res) => { if (res && SCAN && SCAN.active) { const c = res.getText(); stopScan(); lookupBarcode(c); } });
      msg.textContent = 'Point the camera at a barcode. Looks up Open Food Facts (needs internet).';
    }
  } catch (e) { msg.textContent = 'Camera unavailable (' + (e.name || e.message) + '). Type the barcode below.'; const sb = $('#scanbox'); if (sb) sb.classList.add('hidden'); }
}
function stopScan() {
  if (!SCAN) return; SCAN.active = false;
  try { SCAN.reader && SCAN.reader.reset(); } catch (e) {}
  try { SCAN.stream && SCAN.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  const v = $('#vid'); if (v && v.srcObject) { try { v.srcObject.getTracks().forEach(t => t.stop()); } catch (e) {} v.srcObject = null; }
  SCAN = null;
}
const loaded = {};
function loadScript(src) { return loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('load failed')); }; document.head.appendChild(s); })); }
async function lookupBarcode(code) {
  const msg = $('#scanmsg'); if (msg) msg.textContent = 'Looking up ' + code + '…';
  haptic();
  try {
    const it = await offBarcode(code);
    S.counters.scans = (S.counters.scans || 0) + 1; save(); checkAchievements();
    if (!it) { if (msg) msg.innerHTML = `No product found for <b>${esc(code)}</b>. <button class="btn" style="padding:6px 10px" id="mkc">Create it</button>`; const mk = $('#mkc'); if (mk) mk.onclick = () => openCustomFood({ name: '', brand: '', code }); return; }
    ITEMS.set(it.key, it);
    if (msg) msg.textContent = 'Found: ' + it.name;
    if (LOG && LOG.mode === 'pick') { const cb = LOG.onPick, r = LOG.rec; cb(it); closeSheet(r); return; }
    openFood(it, { meal: LOG ? LOG.meal : defaultMeal(), mode: LOG ? LOG.mode : 'log', onPick: LOG && LOG.onPick });
  } catch (e) { if (msg) msg.textContent = 'Lookup failed (' + (navigator.onLine ? e.message : 'offline') + '). Try again when online.'; }
}

/* ---------------- food detail / portion sheet ---------------- */
function unitsFor(item) {
  const u = [];
  (item.portions || []).forEach((p, i) => u.push({ id: 'p' + i, label: p[0], g: p[1], portion: true }));
  if (!item.perServing) {
    u.push({ id: 'g', label: 'g', g: 1 }, { id: 'oz', label: 'oz', g: UNITS.oz.g });
    if (item.dens) ['ml', 'cup', 'tbsp', 'tsp', 'floz'].forEach(k => u.push({ id: k, label: UNITS[k].l, g: UNITS[k].ml * item.dens }));
  }
  return u;
}
function itemFromEntry(e) { return { key: e.key, name: e.name, sub: e.sub, src: e.src, n100: e.g > 0 ? scaleN(e.n, 100 / e.g) : {}, portions: e.por || [], dens: e.dens, hyd: e.hyd, perServing: e.src === 'sup' }; }
function isFav(key) { return S.favs.some(f => f.key === key); }
function openFood(item, opts = {}) {
  const e = opts.entry; const units = unitsFor(item);
  const rc = S.recent.find(r => r.key === item.key);
  let unit = e ? e.unit : rc && rc.last ? rc.last.unit : units[0].id === 'p0' ? 'p0' : 'g';
  if (!units.find(u => u.id === unit)) unit = units[0].id;
  let qty = e ? e.qty : rc && rc.last && rc.last.unit === unit ? rc.last.qty : (unit === 'g' ? 100 : 1);
  let meal = e ? e.meal : opts.meal || defaultMeal();
  let hyd = e ? !!e.hyd : !!item.hyd;
  const mode = opts.mode || 'log';
  const btnLabel = e ? 'Save changes' : mode === 'recipe' ? 'Add to recipe' : 'Add to ' + MEALS.find(m => m[0] === meal)[1].toLowerCase();
  const html = `
   <div class="mut small" style="margin:-4px 0 12px">${tagFor(item.src)}${esc(item.sub || '')}</div>
   <div class="f2"><div class="field"><label>Amount</label><input class="inp" id="fq" type="number" inputmode="decimal" step="any" min="0" value="${qty}"></div>
   <div class="field"><label>Unit</label><select class="inp" id="fu">${units.map(u => `<option value="${u.id}" ${u.id === unit ? 'selected' : ''}>${esc(u.label)}${u.portion ? ` (${fmt(u.g, 1)} g)` : ''}</option>`).join('')}</select></div></div>
   ${mode === 'log' ? `<div class="chips" style="margin-bottom:6px">${MEALS.map(([k, l, i]) => `<button class="chip ${meal === k ? 'on' : ''}" data-fmeal="${k}">${i} ${l}</button>`).join('')}</div>` : ''}
   <div id="fprev"></div>
   ${mode === 'log' ? `<div class="row" style="margin:12px 0"><div style="flex:1"><b style="font-size:14px">Counts toward hydration</b><div class="mut small">Adds this drink's water content to your fluid goal</div></div><button class="switch ${hyd ? 'on' : ''}" id="fhyd"></button></div>` : ''}
   <div class="row" style="gap:10px;margin-top:8px">
    <button class="iconbtn" id="ffav" style="width:52px;height:52px;color:${isFav(item.key) ? 'var(--gold)' : 'var(--mut)'}">${isFav(item.key) ? ICON.star : ICON.starO}</button>
    <button class="btn pri" id="fadd" style="flex:1">${btnLabel}</button></div>
   ${e ? `<div class="f2" style="margin-top:10px"><button class="btn" id="fdup">Duplicate</button><button class="btn danger" id="fdel">Delete</button></div>` : ''}
   ${item.src === 'off' ? `<button class="btn block" id="fsave" style="margin-top:10px">Save as my food (edit values)</button>` : ''}
   <div class="tiny dim" style="margin-top:14px">Source: ${esc(SRC_NAME[item.src] || item.src)}${item.id ? ' · ID ' + esc(item.id) : ''}${item.src === 'off' ? ' — community-entered label values; micronutrients often missing. Barcode ' + esc(item.code || '') : item.src === 'sup' ? ' — generic values; create a custom food to match your label.' : ['f', 'usda', 'fndds', 'cnf'].includes(item.src) ? ' — values per 100 g, scaled to your portion.' : ''}</div>`;
  const rec = openSheet(esc(item.name), html, { full: false });
  const sh = rec.sh;
  const calc = () => { const u = units.find(x => x.id === $('#fu', sh).value); const q = parseFloat($('#fq', sh).value) || 0; const g = q * u.g; return { u, q, g, n: scaleN(item.n100, g / 100) }; };
  const prev = () => {
    const { g, n } = calc(); const T = targetsFor(CUR);
    const rows = N.filter(x => x.type !== 'energy' && !['protein', 'carbs', 'fat', 'moisture', 'epa', 'dha', 'dpa'].includes(x.key));
    const nn = Object.assign({}, n); nn.epaDha = (n.epa || 0) + (n.dha || 0);
    const known = rows.filter(x => x.key === 'epaDha' ? (n.epa != null || n.dha != null) : nn[x.key] != null && x.key !== 'water');
    $('#fprev', sh).innerHTML = `<div class="macro4"><div><b style="color:#ff9a7a">${fmt(n.kcal || 0)}</b><span>kcal</span></div><div><b style="color:#6ee7b7">${fmt(n.protein || 0, 1)}</b><span>protein g</span></div><div><b style="color:#ffd166">${fmt(n.carbs || 0, 1)}</b><span>carbs g</span></div><div><b style="color:#c4b5fd">${fmt(n.fat || 0, 1)}</b><span>fat g</span></div></div>
      <div class="mut small" style="margin-bottom:6px">${fmt(g, 1)} g · % of your daily goal</div>
      <div class="nlist">${known.filter(x => nn[x.key] > 0).sort((a, b) => pctOf(b.key, nn, T) - pctOf(a.key, nn, T)).slice(0, 14).map(x => { const p = pctOf(x.key, nn, T); return `<div class="nr"><div class="nm">${x.name}</div><div class="bw"><div class="bar"><i style="width:${clamp(p, 0, 100)}%;background:${x.type === 'limit' ? 'linear-gradient(90deg,#ffb547,#ff5d73)' : x.color}"></i></div></div><div class="v">${fmtN(x.key, nn[x.key])} ${x.unit}<span>${x.type === 'track' ? '' : Math.round(p) + '%'}</span></div></div>`; }).join('')}</div>
      ${known.length < 10 && item.src === 'off' ? '<div class="note">Packaged-food labels rarely list micronutrients, so this item will under-count vitamins & minerals.</div>' : ''}`;
  };
  prev();
  $('#fq', sh).oninput = prev;
  $('#fu', sh).onchange = () => { const u = units.find(x => x.id === $('#fu', sh).value); const q = $('#fq', sh); if (u.id === 'g' && parseFloat(q.value) < 5) q.value = 100; else if (u.portion && parseFloat(q.value) >= 20) q.value = 1; prev(); };
  $$('[data-fmeal]', sh).forEach(el => el.onclick = () => { meal = el.dataset.fmeal; $$('[data-fmeal]', sh).forEach(x => x.classList.toggle('on', x === el)); if (!e) $('#fadd', sh).textContent = 'Add to ' + MEALS.find(m => m[0] === meal)[1].toLowerCase(); });
  const hb = $('#fhyd', sh); if (hb) hb.onclick = () => { hyd = !hyd; hb.classList.toggle('on', hyd); };
  $('#ffav', sh).onclick = () => {
    const i = S.favs.findIndex(f => f.key === item.key);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.unshift(snapshot(item));
    const on = i < 0; $('#ffav', sh).innerHTML = on ? ICON.star : ICON.starO; $('#ffav', sh).style.color = on ? 'var(--gold)' : 'var(--mut)'; save(); haptic();
  };
  $('#fadd', sh).onclick = () => {
    const { u, q, g, n } = calc(); if (!(g > 0)) { toast('✋', 'Enter an amount'); return; }
    const qtyLabel = u.portion ? `${fmt(q, 2)} × ${u.label}` : `${fmt(q, 2)} ${u.label}`;
    if (mode === 'recipe') { opts.onPick && opts.onPick({ name: item.name, g, n: roundN(n), qtyLabel }); closeSheet(rec); if (LOG && LOG.mode === 'recipe') closeSheet(LOG.rec); return; }
    const before = beforeSnap();
    const ent = { id: e ? e.id : uid(), key: item.key, name: item.name, sub: item.sub, src: item.src, meal, g: +g.toFixed(2), qty: q, unit: u.id, qtyLabel: qtyLabel + (u.portion || u.id === 'g' ? '' : ` · ${fmt(g)} g`), n: roundN(n), hyd: hyd || undefined, por: item.portions, dens: item.dens, t: e ? e.t : Date.now() };
    const d = day(CUR, true);
    if (e) { const i = d.entries.findIndex(x => x.id === e.id); if (i >= 0) d.entries[i] = ent; } else d.entries.push(ent);
    // recents
    const snap = snapshot(item); snap.last = { qty: q, unit: u.id, meal };
    S.recent = [snap, ...S.recent.filter(r => r.key !== item.key)].slice(0, 60);
    afterChange(before);
    closeSheet(rec); if (!e && LOG && LOG.mode === 'log') closeSheet(LOG.rec);
    if (!e) toast('✅', 'Logged ' + item.name.split(',').slice(0, 2).join(','), `${fmt(n.kcal || 0)} kcal · ${fmt(n.protein || 0, 1)} g protein · +5 XP`);
  };
  if (e) {
    $('#fdel', sh).onclick = () => { const d = day(CUR, true); d.entries = d.entries.filter(x => x.id !== e.id); afterChange(); closeSheet(rec); toast('🗑️', 'Entry deleted'); };
    $('#fdup', sh).onclick = () => { const d = day(CUR, true); d.entries.push(Object.assign({}, e, { id: uid(), t: Date.now() })); afterChange(); closeSheet(rec); toast('➕', 'Duplicated'); };
  }
  const fs = $('#fsave', sh); if (fs) fs.onclick = () => { openCustomFood({ name: item.name, brand: (item.sub || '').split(' · ')[0], n100: item.n100, servingG: item.servingG, hyd: item.hyd, code: item.code, portions: item.portions }); };
}
function pctOf(k, n, T) { const tg = T[k]; if (!tg) return 0; const g = BY[k].type === 'limit' ? tg.limit : (tg.goal || tg.base); return g ? (n[k] || 0) / g * 100 : 0; }

/* after any data change: save, re-render, celebrate */
function afterChange(before) {
  invalidate(); save();
  if (before) {
    const after = evalDay(CUR);
    const wins = [];
    if (after.h && before.h) {
      if (!before.h.protein && after.h.protein) wins.push(['🥩', 'Protein goal crushed!', '+50 XP']);
      if (!before.h.fibre && after.h.fibre) wins.push(['🌾', 'Fibre goal hit', '+30 XP']);
      if (!before.h.water && after.h.water) wins.push(['💧', 'Hydration goal reached', '+30 XP']);
      if (!before.allMicros && after.allMicros) wins.push(['🌈', 'All micronutrients at baseline!', '+50 XP']);
      if (!before.peakDay && after.peakDay) wins.push(['⛰️', 'PEAK DAY unlocked', '+100 XP']);
    } else if (after.h && after.h.water && !(before.h && before.h.water)) wins.push(['💧', 'Hydration goal reached', '+30 XP']);
    const lv0 = before.lvl, lv1 = levelInfo(gameCtx().xp).L;
    if (lv0 && lv1 > lv0) wins.push(['🚀', 'Level up! Level ' + lv1, rankName(lv1)]);
    wins.forEach((w, i) => setTimeout(() => toast(...w), 400 + i * 700));
    if (wins.length) setTimeout(() => confetti(), 300);
  }
  checkAchievements();
  render();
}
function beforeSnap() { return Object.assign(evalDay(CUR), { lvl: levelInfo(gameCtx().xp).L }); }

/* ---------------- custom foods ---------------- */
const CF_MAIN = ['kcal', 'protein', 'carbs', 'fibre', 'sugars', 'addedSugar', 'fat', 'satFat', 'transFat', 'cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'vitD', 'caffeine'];
function openCustomFood(c, opts = {}) {
  c = c || {}; const editing = !!c.id; const R = opts.review;
  const hlc = k => R && R.hl[k] ? ' hl-' + R.hl[k] : '';
  const note = k => R && R.notes[k] ? `<div class="hlnote">${esc(R.notes[k])}</div>` : '';
  const sg = c.servingG || 100;
  const per = c.per || (c.servingG ? 'serving' : '100g');
  const vals = k => { const v = c.n100 && c.n100[k]; if (v == null) return ''; const x = per === 'serving' ? v * sg / 100 : v; return +x.toPrecision(4); };
  const more = N.filter(n => !CF_MAIN.includes(n.key) && !n.derived && n.key !== 'moisture');
  const fld = n => `<div class="field"><label>${n.name} (${n.unit})</label><input class="inp${hlc(n.key)}" inputmode="decimal" type="number" step="any" data-cf="${n.key}" value="${vals(n.key)}">${note(n.key)}</div>`;
  const moreOpen = R && more.some(n => R.hl[n.key]);
  const nParsed = R ? Object.keys(R.hl).length : 0;
  const reviewHead = R ? `<div class="card" style="margin:0 0 12px;padding:12px">
     <div class="row"><b style="flex:1">🏷️ Found ${nParsed} nutrient${nParsed === 1 ? '' : 's'}</b><div class="seg" id="cfdv" style="margin:0;width:auto"><button data-v="CA" class="${R.ref === 'CA' ? 'on' : ''}">🇨🇦 DV</button><button data-v="US" class="${R.ref === 'US' ? 'on' : ''}">🇺🇸 DV</button></div></div>
     <div class="mut small" style="margin-top:6px">“${esc(R.text)}”</div>
     <div class="tiny" style="margin-top:8px"><span class="lg ok"></span>heard <span class="lg dv"></span>from % DV <span class="lg assumed"></span>unit assumed — check</div>
     ${R.unparsed.length ? `<div class="unparsed"><b>Didn't understand (${R.unparsed.length})</b>${R.unparsed.map(u => `<div>• ${esc(u)}</div>`).join('')}</div>` : ''}</div>` : '';
  const html = reviewHead + `<div class="field"><label>Name</label><input class="inp${R && R.nameMissing ? ' hl-bad' : R ? ' hl-ok' : ''}" id="cfn" value="${esc(c.name || '')}" placeholder="e.g. Oikos Pro yogurt"></div>
   <div class="f2"><div class="field"><label>Brand (optional)</label><input class="inp" id="cfb" value="${esc(c.brand || '')}"></div><div class="field"><label>Serving size (g or ml)</label><input class="inp" id="cfs" type="number" inputmode="decimal" step="any" value="${sg}"></div></div>
   <div class="field"><label>Serving label (optional)</label><input class="inp" id="cfsl" value="${esc(c.servingLabel || '')}" placeholder="e.g. 1 cup, 1 bar, 1 scoop"></div>
   <label class="mut small">Nutrition values entered per</label>
   <div class="seg" id="cfper"><button data-per="serving" class="${per === 'serving' ? 'on' : ''}">Serving</button><button data-per="100g" class="${per === '100g' ? 'on' : ''}">100 g / 100 ml</button></div>
   <div class="f2">${N.filter(n => CF_MAIN.includes(n.key)).map(fld).join('')}</div>
   <details style="margin-bottom:12px"${moreOpen ? ' open' : ''}><summary class="mut" style="padding:8px 0;font-weight:600">More nutrients (vitamins, minerals, omegas)</summary><div class="f2" style="margin-top:8px">${more.map(fld).join('')}</div></details>
   <div class="row" style="margin-bottom:14px"><div style="flex:1"><b style="font-size:14px">It's a drink</b><div class="mut small">Counts toward hydration; enables ml/cup units</div></div><button class="switch ${c.hyd ? 'on' : ''}" id="cfh"></button></div>
   ${R || !editing ? `<label class="mut small">Log to</label><div class="chips" id="cfmeal" style="margin:6px 0 12px">${MEALS.map(m => `<button class="chip ${m[0] === defaultMeal() ? 'on' : ''}" data-m="${m[0]}">${m[2]} ${m[1]}</button>`).join('')}</div>
   <div class="grid2"><button class="btn pri" id="cfsave">⭐ Save item</button><button class="btn" id="cflog" style="background:linear-gradient(135deg,rgba(52,211,153,.35),rgba(34,211,238,.2))">⚡ Save & log now</button></div>
   <div class="tiny dim" style="margin-top:8px">Saved items are favourited and appear in <b>My items</b> on Today for one-tap logging.</div>` : `<button class="btn pri block" id="cfsave">Save food</button>`}
   ${editing ? '<button class="btn danger block" id="cfdel" style="margin-top:10px">Delete food</button>' : ''}`;
  const rec = openSheet(editing ? 'Edit food' : 'Custom food', html, { full: true });
  const sh = rec.sh; let perSel = per, hyd = !!c.hyd; let mealSel = defaultMeal();
  if (R && R.servingMissing) { const i = $('#cfs', sh); i.classList.add('hl-assumed'); i.insertAdjacentHTML('afterend', '<div class="hlnote">No serving size heard — values treated as per 100 g</div>'); }
  $$('#cfmeal .chip', sh).forEach(b => b.onclick = () => { mealSel = b.dataset.m; $$('#cfmeal .chip', sh).forEach(x => x.classList.toggle('on', x === b)); });
  $$('#cfdv button', sh).forEach(b => b.onclick = () => { if (b.dataset.v === R.ref) return; S.settings.dvRef = b.dataset.v; save(); closeSheet(rec); openLabelReview(parseLabel(R.text, b.dataset.v), R.text); });
  $$('#cfper button', sh).forEach(b => b.onclick = () => { perSel = b.dataset.per; $$('#cfper button', sh).forEach(x => x.classList.toggle('on', x === b)); });
  $('#cfh', sh).onclick = e => { hyd = !hyd; e.currentTarget.classList.toggle('on', hyd); };
  const doSave = logNow => {
    const name = $('#cfn', sh).value.trim(); if (!name) { toast('✋', 'Give it a name'); $('#cfn', sh).focus(); return; }
    const s = parseFloat($('#cfs', sh).value) || 100; const f = perSel === 'serving' ? 100 / s : 1;
    const n100 = {}; $$('[data-cf]', sh).forEach(i => { if (i.value !== '' && !isNaN(i.value)) n100[i.dataset.cf] = parseFloat(i.value) * f; });
    if (hyd) n100.moisture = Math.max(0, 100 - (n100.protein || 0) - (n100.carbs || 0) - (n100.fat || 0));
    const sl = $('#cfsl', sh).value.trim();
    const obj = { id: c.id || uid(), name, brand: $('#cfb', sh).value.trim(), servingG: s, servingLabel: sl, per: perSel, n100: roundN(n100), hyd, code: c.code, dens: hyd ? 1 : null,
      portions: [[(sl || '1 serving'), s]].concat((c.portions || []).filter(p => !/serving/.test(p[0]))) };
    const i = S.customFoods.findIndex(x => x.id === obj.id); if (i >= 0) S.customFoods[i] = obj; else S.customFoods.unshift(obj);
    const item = customItem(obj);
    if (!editing && !S.favs.some(f => f.key === item.key)) S.favs.unshift(snapshot(item));
    else { const fi = S.favs.findIndex(f => f.key === item.key); if (fi >= 0) S.favs[fi] = snapshot(item); }
    save(); closeSheet(rec);
    if (logNow) quickLog(item, mealSel); else { toast('⭐', editing ? 'Food saved' : 'Saved to My items', name); if (VIEW === 'today') render(); }
    if (LOG) { LOG.tab = 'mine'; renderLog(); }
  };
  $('#cfsave', sh).onclick = () => doSave(false);
  const lg = $('#cflog', sh); if (lg) lg.onclick = () => doSave(true);
  const del = $('#cfdel', sh); if (del) del.onclick = () => { if (!confirm('Delete this food? Logged entries stay.')) return; S.customFoods = S.customFoods.filter(x => x.id !== c.id); save(); closeSheet(rec); if (LOG) renderLog(); };
}

/* ---------------- recipes ---------------- */
function openRecipe(r) {
  const R = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', servings: 1, items: [] }; const editing = !!r;
  const rec = openSheet(editing ? 'Edit recipe' : 'New recipe', '<div id="rb"></div>', { full: true });
  const draw = () => {
    const tot = R.items.reduce((t, i) => addN(t, i.n), {}); const g = R.items.reduce((a, i) => a + i.g, 0); const sv = R.servings || 1;
    $('#rb', rec.sh).innerHTML = `<div class="field"><label>Recipe name</label><input class="inp" id="rn" value="${esc(R.name)}" placeholder="e.g. Chicken burrito bowl"></div>
     <div class="field"><label>Servings it makes</label><input class="inp" id="rs" type="number" inputmode="decimal" step="any" min="1" value="${sv}"></div>
     <div class="macro4"><div><b>${fmt((tot.kcal || 0) / sv)}</b><span>kcal/serv</span></div><div><b>${fmt((tot.protein || 0) / sv, 1)}</b><span>P g</span></div><div><b>${fmt((tot.carbs || 0) / sv, 1)}</b><span>C g</span></div><div><b>${fmt((tot.fat || 0) / sv, 1)}</b><span>F g</span></div></div>
     <div class="list">${R.items.map((i, x) => `<div class="it"><div class="nm"><b>${esc(i.name)}</b><span>${esc(i.qtyLabel)} · ${fmt(i.n.kcal || 0)} kcal</span></div><button class="iconbtn" data-rm="${x}" style="width:34px;height:34px">${ICON.x}</button></div>`).join('') || '<div class="empty">No ingredients yet.</div>'}</div>
     <button class="btn block" id="radd" style="margin:12px 0">＋ Add ingredient</button>
     <button class="btn pri block" id="rsave">${editing ? 'Save recipe' : 'Create recipe'}</button>
     ${editing ? '<button class="btn danger block" id="rdel" style="margin-top:10px">Delete recipe</button>' : ''}
     <div class="tiny dim" style="margin-top:10px">Total ${fmt(g)} g raw weight · ${fmt(g / sv)} g per serving.</div>`;
    const sh = rec.sh;
    $('#rn', sh).oninput = e => R.name = e.target.value;
    $('#rs', sh).onchange = e => { R.servings = Math.max(1, parseFloat(e.target.value) || 1); draw(); };
    $$('[data-rm]', sh).forEach(b => b.onclick = () => { R.items.splice(+b.dataset.rm, 1); draw(); });
    $('#radd', sh).onclick = () => openLog({ mode: 'recipe', parent: LOG, onPick: it => { R.items.push(it); draw(); } });
    $('#rsave', sh).onclick = () => {
      if (!R.name.trim()) { toast('✋', 'Name your recipe'); return; } if (!R.items.length) { toast('✋', 'Add at least one ingredient'); return; }
      const i = S.recipes.findIndex(x => x.id === R.id); if (i >= 0) S.recipes[i] = R; else S.recipes.unshift(R);
      save(); closeSheet(rec); toast('👨‍🍳', 'Recipe saved', R.name); checkAchievements(); if (LOG) { LOG.tab = 'mine'; renderLog(); }
    };
    const del = $('#rdel', sh); if (del) del.onclick = () => { if (!confirm('Delete recipe?')) return; S.recipes = S.recipes.filter(x => x.id !== R.id); save(); closeSheet(rec); if (LOG) renderLog(); };
  };
  draw();
}

/* ---------------- nutrient info sheet ---------------- */
function openNutrient(k) {
  const n = BY[k]; const T = targetsFor(CUR); const tg = T[k]; const { t, coverage } = totals(CUR); const v = t[k] || 0; const st = status(k, v, T);
  const pinned = S.settings.pinned.includes(k);
  const ov = (S.settings.overrides[k] || {});
  const contrib = k === 'water' ? [] : day(CUR).entries.map(e => ({ nm: e.name, v: k === 'epaDha' ? (e.n.epa || 0) + (e.n.dha || 0) : e.n[k] || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
  const tierBox = (cls, lbl, val, sub) => `<div class="${cls}"><span>${lbl}</span><b>${val == null ? '—' : fmtN(k, val)}</b><div class="tiny mut">${sub}</div></div>`;
  const html = `
   <div class="row" style="margin-bottom:6px"><div style="font-size:34px;font-weight:800;letter-spacing:-.02em">${fmtN(k, v)}<span class="mut" style="font-size:16px"> ${n.unit}</span></div><span class="pill" style="margin-left:auto;color:${stateColor(st.state)}">${st.label}</span></div>
   ${meter(k, v, T)}
   ${coverage[k] < 0.999 && t.kcal ? `<div class="tiny mut" style="margin-top:6px">Data available for ${Math.round(coverage[k] * 100)}% of what you logged today${coverage[k] < 0.85 ? ' — true intake is likely higher' : ''}.</div>` : ''}
   ${n.type === 'limit' ? `<div class="tiers">${tierBox('', 'Baseline', tg.base, tg.base ? 'minimum (AI)' : 'no minimum')}${tierBox('u', 'Limit', tg.limit, 'stay under')}${tierBox('', 'Today', v, Math.round(st.pct * 100) + '% of limit')}</div>`
     : n.type === 'track' ? '<div class="note">Tracked for information — no evidence-based daily target.</div>'
     : `<div class="tiers">${tierBox('', 'Baseline', tg.base, k === 'kcal' ? 'daily target' : 'optimal health')}${tierBox('p', 'Peak', tg.peak, tg.peak > tg.base ? 'performance' : 'no evidence for higher')}${tierBox('u', 'Upper limit', tg.ul, tg.ul ? (n.ulNote ? 'supplements only' : tg.ulSoft ? 'upper range' : 'UL') : 'none set')}</div>`}
   ${k === 'kcal' ? energyExplain() : ''}
   <div class="why">${esc(n.why)}</div>
   <div class="note"><b style="color:var(--text)">Targets:</b> ${esc(n.peakNote || '')}${n.ulNote ? ' ' + esc(n.ulNote) : ''}</div>
   <h2 class="mut small" style="margin:14px 0 4px;letter-spacing:.08em">TOP FOOD SOURCES</h2><div style="font-size:14px;line-height:1.5">${esc(n.foods)}</div>
   ${contrib.length ? `<h2 class="mut small" style="margin:14px 0 4px;letter-spacing:.08em">YOUR TOP SOURCES TODAY</h2><div class="kv">${contrib.map(c => `<div>${esc(c.nm.split(',').slice(0, 3).join(','))}</div><div>${fmtN(k, c.v)} ${n.unit}</div>`).join('')}</div>` : ''}
   <h2 class="mut small" style="margin:14px 0 0;letter-spacing:.08em">SOURCES</h2><ul class="srcs">${n.src.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
   <div class="sep"></div>
   ${n.type !== 'track' ? `<h2 class="mut small" style="margin:0 0 8px;letter-spacing:.08em">CUSTOMISE</h2>
   <div class="f2">${n.type === 'limit' ? `<div class="field"><label>Limit (${n.unit})</label><input class="inp" type="number" inputmode="decimal" step="any" data-ov="limit" value="${ov.limit ?? ''}" placeholder="${fmtN(k, tg.limit)}"></div>` : `<div class="field"><label>My goal (${n.unit})</label><input class="inp" type="number" inputmode="decimal" step="any" data-ov="goal" value="${ov.goal ?? ''}" placeholder="${fmtN(k, tg.goal)}"></div>`}
   ${n.type !== 'limit' && k !== 'kcal' ? `<div class="field"><label>Baseline (${n.unit})</label><input class="inp" type="number" inputmode="decimal" step="any" data-ov="base" value="${ov.base ?? ''}" placeholder="${fmtN(k, tg.base)}"></div>` : '<div></div>'}</div>
   <button class="btn block" id="ovreset" style="margin-bottom:10px">Reset to evidence-based defaults</button>` : ''}
   <button class="btn ${pinned ? '' : 'pri'} block" id="npin">${pinned ? 'Unpin from dashboard' : '📌 Pin to dashboard'}</button>`;
  const rec = openSheet(n.name, html);
  animateRings(rec.sh);
  $$('[data-ov]', rec.sh).forEach(i => i.onchange = () => { const o = S.settings.overrides[k] = S.settings.overrides[k] || {}; if (i.value === '') delete o[i.dataset.ov]; else o[i.dataset.ov] = parseFloat(i.value); if (!Object.keys(o).length) delete S.settings.overrides[k]; invalidate(); save(); render(); toast('🎯', n.name + ' target updated'); });
  const rs = $('#ovreset', rec.sh); if (rs) rs.onclick = () => { delete S.settings.overrides[k]; invalidate(); save(); render(); closeSheet(rec); openNutrient(k); };
  $('#npin', rec.sh).onclick = () => { const p = S.settings.pinned; const i = p.indexOf(k); if (i >= 0) p.splice(i, 1); else p.push(k); save(); render(); closeSheet(rec); toast('📌', i >= 0 ? 'Unpinned ' + n.name : 'Pinned ' + n.name); };
}
function energyExplain() {
  const E = targetsFor(CUR)._energy; const p = profileNow();
  return `<div class="note"><div class="kv"><div>BMR (Mifflin–St Jeor)</div><div>${fmt(E.bmr)} kcal</div><div>× activity (${(ACTIVITY[p.activity] || ACTIVITY.moderate).mult})</div><div>${fmt(E.tdee)} kcal</div><div>Deficit (${p.ratePct}%/wk of ${fmt(p.weightLb)} lb)</div><div>−${fmt(E.deficit)} kcal</div><div>Goal</div><div>${fmt(E.kcal)} kcal</div><div>Protein / fat / carbs</div><div>${E.protein} / ${E.fatG} / ${E.carbsG} g</div></div>
   <div class="tiny" style="margin-top:8px">Expected loss ≈ ${fmt(E.deficit * 7 / 3500, 1)} lb/week. ${p.weightLb > p.goalLb ? `≈ ${Math.ceil((p.weightLb - p.goalLb) / Math.max(0.1, E.deficit * 7 / 3500))} weeks to ${p.goalLb} lb at this pace (it slows as you get lighter — the app recalculates as you log weight).` : 'At goal — eating at maintenance.'} Edit in Profile.</div></div>`;
}

/* ---------------- render: Nutrients ---------------- */
let NUT_GROUP = 'all';
function renderNutrients() {
  const T = targetsFor(CUR); const { t, coverage } = totals(CUR);
  const groups = GROUPS.filter(([g]) => NUT_GROUP === 'all' || g === NUT_GROUP);
  return `<div class="top"><div class="grow"><div class="sub">Every nutrient vs. baseline ▏& peak ✦</div><h1>Nutrients</h1></div></div>
   ${dateBar()}
   <div class="seg">${[['all', 'All'], ...GROUPS.map(([g, l]) => [g, l.split(' ')[0]])].map(([g, l]) => `<button class="${NUT_GROUP === g ? 'on' : ''}" data-ng="${g}">${l}</button>`).join('')}</div>
   ${groups.map(([g, l]) => `<div class="card"><h2>${l}</h2><div class="nlist">${N.filter(n => n.group === g && !['epa', 'dha', 'dpa'].includes(n.key) || (g === 'fat' && NUT_GROUP === 'fat' && ['epa', 'dha', 'dpa'].includes(n.key))).filter(n => n.group === g).map(n => {
      const v = t[n.key] || 0, st = status(n.key, v, T), tg = T[n.key]; const goal = n.type === 'limit' ? tg.limit : tg.goal;
      return `<button class="nr" data-nut="${n.key}"><div class="nm">${S.settings.pinned.includes(n.key) ? '<span style="display:inline;color:var(--a2)">● </span>' : ''}${n.name}<span>${n.type === 'limit' ? 'limit ' + fmtN(n.key, goal) + ' ' + n.unit : n.type === 'track' ? 'tracked' : 'goal ' + fmtN(n.key, goal) + ' ' + n.unit}${coverage[n.key] < 0.85 && t.kcal ? ' · ~' + Math.round(coverage[n.key] * 100) + '% data' : ''}${n.lowData ? ' · sparse data' : ''}</span></div><div class="bw">${n.type === 'track' ? '' : meter(n.key, v, T)}</div><div class="v" style="color:${stateColor(st.state)}">${fmtN(n.key, v)}<span>${n.unit}${n.type !== 'track' && goal ? ' · ' + Math.round(v / goal * 100) + '%' : ''}</span></div></button>`;
    }).join('')}</div></div>`).join('')}
   <div class="tiny dim" style="text-align:center;padding:4px 10px 10px">White tick = baseline (RDA/AI) · gold tick = peak target · red = limit. Tap any nutrient for its evidence, sources and to pin it.</div>`;
}

/* ---------------- charts ---------------- */
function barChart(vals, labels, target, opts = {}) {
  const W = 340, H = opts.h || 150, pl = 30, pb = 18, pt = 8; const n = vals.length || 1;
  const mx = Math.max(target || 0, ...vals.map(v => v || 0)) * 1.12 || 1;
  const bw = (W - pl) / n; const y = v => pt + (H - pt - pb) * (1 - v / mx);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  [0, .5, 1].forEach(f => { const v = mx * f; s += `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.06)"/><text x="0" y="${y(v) + 3}">${fmt(v)}</text>`; });
  vals.forEach((v, i) => {
    const x = pl + i * bw + bw * 0.18, w = bw * 0.64; const h = v ? (H - pt - pb) * (v / mx) : 0;
    const good = target && v ? (opts.limit ? v <= target : v >= target * (opts.within ? 0.9 : 1) && (!opts.within || v <= target * 1.1)) : false;
    s += `<rect x="${x}" y="${H - pb - h}" width="${w}" height="${h}" rx="${Math.min(4, w / 2)}" fill="${v ? (good ? 'url(#cg)' : 'rgba(154,163,199,.45)') : 'none'}"/>`;
    if (labels[i] && (n <= 10 || i % Math.ceil(n / 8) === 0)) s += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle">${labels[i]}</text>`;
  });
  if (target) s += `<line x1="${pl}" x2="${W}" y1="${y(target)}" y2="${y(target)}" stroke="#ffd166" stroke-dasharray="4 4" stroke-width="1.5"/>`;
  s += `<defs><linearGradient id="cg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs></svg>`;
  return s;
}
function weightChart() {
  const tr = weightTrend(); if (!tr.length) return '<div class="empty">Log your weight to see your trend toward ' + S.profile.goalLb + ' lb.</div>';
  const W = 340, H = 180, pl = 34, pb = 18, pt = 10; const goal = S.profile.goalLb;
  const t0 = parseD(tr[0].d).getTime(); const proj = projection(); let t1 = Math.max(parseD(tr[tr.length - 1].d).getTime(), t0 + 7 * 864e5);
  if (proj && proj.date) t1 = Math.max(t1, Math.min(parseD(proj.date).getTime(), t1 + 120 * 864e5));
  const lbs = tr.map(x => x.lb).concat(goal); const mn = Math.min(...lbs) - 2, mx = Math.max(...lbs) + 2;
  const X = d => pl + (W - pl - 6) * ((parseD(d).getTime() - t0) / (t1 - t0 || 1)), Y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  for (let i = 0; i <= 3; i++) { const v = mn + (mx - mn) * i / 3; s += `<line x1="${pl}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.06)"/><text x="0" y="${Y(v) + 3}">${fmt(v)}</text>`; }
  s += `<line x1="${pl}" x2="${W}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#34d399" stroke-dasharray="5 4"/><text x="${W - 4}" y="${Y(goal) - 4}" text-anchor="end" style="fill:#6ee7b7">goal ${goal}</text>`;
  tr.forEach(p => s += `<circle cx="${X(p.d)}" cy="${Y(p.lb)}" r="2.6" fill="rgba(154,163,199,.7)"/>`);
  s += `<path d="${tr.map((p, i) => (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p.tr).toFixed(1)).join(' ')}" fill="none" stroke="url(#wg)" stroke-width="3" stroke-linecap="round"/>`;
  if (proj && proj.date) { const last = tr[tr.length - 1]; const pd = parseD(proj.date).getTime() <= t1 ? proj.date : dstr(new Date(t1)); const pv = parseD(proj.date).getTime() <= t1 ? goal : last.tr + proj.slope * ((t1 - parseD(last.d).getTime()) / 864e5); s += `<path d="M${X(last.d)} ${Y(last.tr)} L${X(pd)} ${Y(pv)}" stroke="#ffd166" stroke-dasharray="3 4" stroke-width="2" fill="none"/>`; }
  const fd = d => parseD(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  s += `<text x="${pl}" y="${H - 3}">${fd(tr[0].d)}</text><text x="${W}" y="${H - 3}" text-anchor="end">${fd(dstr(new Date(t1)))}</text>`;
  s += `<defs><linearGradient id="wg" x1="0" x2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs></svg>`;
  return s;
}
function projection() {
  const tr = weightTrend(); if (tr.length < 3) return null;
  const last = tr[tr.length - 1]; const win = tr.filter(p => p.d >= addDays(last.d, -28)); if (win.length < 3) return null;
  const xs = win.map(p => (parseD(p.d) - parseD(win[0].d)) / 864e5), ys = win.map(p => p.tr);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
  const goal = S.profile.goalLb; let date = null;
  if (slope < -0.005 && last.tr > goal) date = addDays(last.d, Math.ceil((last.tr - goal) / -slope));
  return { slope, perWeek: slope * 7, date };
}

/* ---------------- render: Progress ---------------- */
let PR_RANGE = 7;
function renderProgress() {
  const days = []; for (let i = PR_RANGE - 1; i >= 0; i--) days.push(addDays(today(), -i));
  const m = allEvals().map; const T = targetsFor(today());
  const lab = days.map(d => PR_RANGE <= 7 ? 'MTWTFSS'[(parseD(d).getDay() + 6) % 7] : String(parseD(d).getDate()));
  const g = k => days.map(d => m[d] && m[d].logged ? m[d].t[k] || 0 : 0);
  const sc = days.map(d => m[d] ? m[d].score : 0);
  const tr = weightTrend(); const proj = projection(); const lastW = tr.length ? tr[tr.length - 1] : null;
  const logged = days.filter(d => m[d] && m[d].logged);
  const avg = k => logged.length ? logged.reduce((a, d) => a + (m[d].t[k] || 0), 0) / logged.length : 0;
  return `<div class="top"><div class="grow"><div class="sub">Goals, trends & weight</div><h1>Progress</h1></div></div>
   <div class="card"><h2>Goals <button class="r" data-act="add-goal">＋ Add</button></h2>
    ${S.goals.map(gl => { const p = goalProgress(gl); const per = { day: 'Today', week: 'This week', month: 'This month' }[gl.period]; return `<div class="goalc"><div class="row"><b>${esc(p.label)}</b>${p.done ? '<span class="pill gold">✓ Done</span>' : `<span class="pill">${per}</span>`}<button class="iconbtn" data-delgoal="${gl.id}" style="width:28px;height:28px;border-radius:9px">${ICON.x}</button></div>
     <div class="bar" style="margin:8px 0 4px"><i data-w="${p.pct * 100}%" style="width:0;background:${p.done ? 'linear-gradient(90deg,#ffd166,#ffb547)' : 'var(--grad)'}"></i></div>
     <div class="tiny mut">${gl.metric === 'avg' || gl.metric === 'avgScore' ? 'Now ' + fmt(p.cur, gl.metric === 'avg' ? BY[gl.key].dp : 0) + (gl.metric === 'avg' ? ' ' + BY[gl.key].unit : '') + ' over ' + p.days + ' logged day' + (p.days === 1 ? '' : 's') : gl.metric === 'weightLoss' ? fmt(p.cur, 1) + ' / ' + p.target + ' lb' : p.cur + ' / ' + p.target + ' days'} · ${p.range[0].slice(5)} → ${p.range[1].slice(5)}</div></div>`; }).join('') || '<div class="empty">Add daily, weekly or monthly goals.</div>'}</div>
   <div class="seg">${[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([r, l]) => `<button class="${PR_RANGE === r ? 'on' : ''}" data-range="${r}">${l}</button>`).join('')}</div>
   <div class="card"><h2>Calories <span class="r" style="color:var(--mut)">avg ${fmt(avg('kcal'))}</span></h2>${barChart(g('kcal'), lab, T.kcal.goal, { within: true })}<div class="legend"><span><i style="background:#22d3ee"></i>within ±10% of target</span><span><i style="background:#ffd166"></i>target ${fmt(T.kcal.goal)}</span></div></div>
   <div class="card"><h2>Protein <span class="r" style="color:var(--mut)">avg ${fmt(avg('protein'))} g</span></h2>${barChart(g('protein'), lab, T.protein.goal)}</div>
   <div class="card"><h2>Daily score <span class="r" style="color:var(--mut)">avg ${fmt(logged.length ? logged.reduce((a, d) => a + m[d].score, 0) / logged.length : 0)}</span></h2>${barChart(sc, lab, 80)}</div>
   <div class="card"><h2>Water <span class="r" style="color:var(--mut)">avg ${fmt(days.filter(d => m[d]).length ? days.filter(d => m[d]).reduce((a, d) => a + (m[d].t ? m[d].t.water || 0 : 0), 0) / days.filter(d => m[d]).length : 0)} ml</span></h2>${barChart(days.map(d => m[d] && m[d].t ? m[d].t.water || 0 : 0), lab, T.water.goal)}</div>
   <div class="card"><h2>Weight <button class="r" data-act="log-weight">＋ Weigh in</button></h2>
    <div class="stat3" style="margin:0 0 12px"><div><b>${lastW ? fmt(lastW.tr, 1) : '–'}</b><span>Trend lb</span></div><div><b>${proj ? (proj.perWeek > 0 ? '+' : '') + fmt(proj.perWeek, 1) : '–'}</b><span>lb / week</span></div><div><b style="font-size:15px;line-height:24px">${proj && proj.date ? parseD(proj.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : lastW && lastW.tr <= S.profile.goalLb ? '🏆 Goal' : '–'}</b><span>ETA ${S.profile.goalLb} lb</span></div></div>
    ${weightChart()}
    <div class="legend"><span><i style="background:#7c5cff"></i>trend (smoothed)</span><span><i style="background:#9aa3c7"></i>weigh-ins</span><span><i style="background:#ffd166"></i>projection</span></div>
    ${proj && proj.perWeek < -(profileNow().weightLb * 0.01) ? '<div class="note">⚠️ Losing faster than ~1% body weight per week raises the risk of muscle loss. Consider eating a little more.</div>' : ''}
    ${S.weights.length ? `<details style="margin-top:10px"><summary class="mut small" style="padding:6px 0">History (${S.weights.length})</summary><div class="kv" style="margin-top:6px">${S.weights.slice().reverse().slice(0, 60).map(w => `<div>${w.d}</div><div>${fmt(w.lb, 1)} lb <button data-delw="${w.d}" class="dim" style="margin-left:6px">✕</button></div>`).join('')}</div></details>` : ''}</div>`;
}
function openAddGoal() {
  const tn = N.filter(n => n.type !== 'track');
  const html = `<div class="field"><label>Period</label><div class="seg" id="gp"><button data-v="day">Daily</button><button data-v="week" class="on">Weekly</button><button data-v="month">Monthly</button></div></div>
   <div class="field"><label>Type</label><select class="inp" id="gm"><option value="avg">Average of a nutrient</option><option value="daysHit">Days hitting a nutrient goal</option><option value="daysLogged">Days logged</option><option value="avgScore">Average daily score</option><option value="weightLoss">Weight loss (lb, trend)</option></select></div>
   <div class="field" id="gkw"><label>Nutrient</label><select class="inp" id="gk">${tn.map(n => `<option value="${n.key}">${n.name}</option>`).join('')}</select></div>
   <div class="field hidden" id="gcw"><label>Direction</label><select class="inp" id="gc"><option value="gte">At least</option><option value="lte">At most</option></select></div>
   <div class="field"><label>Target value</label><input class="inp" id="gv" type="number" inputmode="decimal" step="any" placeholder="e.g. 170"></div>
   <button class="btn pri block" id="gsave">Add goal</button>`;
  const rec = openSheet('New goal', html); const sh = rec.sh; let period = 'week';
  $$('#gp button', sh).forEach(b => b.onclick = () => { period = b.dataset.v; $$('#gp button', sh).forEach(x => x.classList.toggle('on', x === b)); });
  const upd = () => { const m = $('#gm', sh).value; $('#gkw', sh).classList.toggle('hidden', !['avg', 'daysHit'].includes(m)); $('#gcw', sh).classList.toggle('hidden', m !== 'avg'); };
  $('#gm', sh).onchange = upd; upd();
  $('#gsave', sh).onclick = () => { const v = parseFloat($('#gv', sh).value); if (!(v > 0)) { toast('✋', 'Enter a target'); return; } const m = $('#gm', sh).value; S.goals.push({ id: uid(), period, metric: m, key: ['avg', 'daysHit'].includes(m) ? $('#gk', sh).value : undefined, cmp: $('#gc', sh).value, value: v }); invalidate(); save(); closeSheet(rec); render(); toast('🎯', 'Goal added'); };
}
function openWeigh() {
  const last = S.weights.length ? S.weights[S.weights.length - 1].lb : '';
  const rec = openSheet('Weigh in', `<div class="f2"><div class="field"><label>Weight (lb)</label><input class="inp" id="wl" type="number" inputmode="decimal" step="0.1" value="${last}" placeholder="e.g. 185"></div><div class="field"><label>Date</label><input class="inp" id="wd" type="date" value="${today()}" max="${today()}"></div></div>
   <div class="tiny mut" style="margin-bottom:12px">Tip: weigh first thing in the morning after the bathroom. Daily noise is normal — the smoothed trend line is what matters. Your calorie target updates automatically.</div><button class="btn pri block" id="wsave">Save weight</button>`);
  setTimeout(() => $('#wl', rec.sh).focus(), 350);
  $('#wsave', rec.sh).onclick = () => { const lb = parseFloat($('#wl', rec.sh).value), d = $('#wd', rec.sh).value || today(); if (!(lb > 50 && lb < 700)) { toast('✋', 'Enter weight in lb'); return; }
    S.weights = S.weights.filter(w => w.d !== d); S.weights.push({ d, lb }); S.weights.sort((a, b) => a.d < b.d ? -1 : 1); if (S.profile.useLatestWeight) S.profile.weightLb = S.weights[S.weights.length - 1].lb;
    invalidate(); save(); closeSheet(rec); checkAchievements(); render(); toast('⚖️', 'Weight logged', fmt(lb, 1) + ' lb'); };
}

/* ---------------- render: Awards ---------------- */
function renderAwards() {
  const c = gameCtx(); const lv = levelInfo(c.xp); const got = ACH.filter(a => S.achievements[a.id]).length;
  const st = [['🔥', 'Logging streak', streak(e => e.logged), c.logBest], ['🥩', 'Protein streak', streak(e => e.logged && e.h.protein), c.protBest], ['💧', 'Hydration streak', streak(e => e.h && e.h.water), c.waterBest], ['🧼', 'Clean streak', streak(e => e.logged && !e.over.length && !e.ulOver.length), c.cleanBest]];
  const recent = allEvals().list.filter(e => e.logged).slice(-14);
  return `<div class="top"><div class="grow"><div class="sub">XP, streaks & badges</div><h1>Awards</h1></div></div>
   <div class="card" style="text-align:center;padding:22px 16px">
    <div class="ringwrap" style="margin:0 auto;width:150px;height:150px"><svg viewBox="0 0 200 200">${RING_DEFS}${ring(88, 16, lv.pct, 'gS')}</svg><div class="ringcenter"><div><div class="tiny mut" style="letter-spacing:.1em">LEVEL</div><div class="big" style="font-size:46px">${lv.L}</div></div></div></div>
    <div style="font-size:20px;font-weight:800;margin-top:8px">${rankName(lv.L)}</div><div class="mut small">${fmt(c.xp)} XP total · ${fmt(lv.need - lv.into)} XP to level ${lv.L + 1}</div></div>
   <div class="card"><h2>Streaks</h2><div class="grid2">${st.map(([i, l, cur, best]) => `<div class="tile"><div class="nm"><span>${l}</span></div><div class="val">${i} ${cur}<small>days</small></div><div class="st"><span>best ${best}</span></div></div>`).join('')}</div></div>
   <div class="card"><h2>Badges <span class="r" style="color:var(--mut)">${got} / ${ACH.length}</span></h2><div class="badges">${ACH.map(a => { const on = !!S.achievements[a.id]; const [p, q] = a.p(c); return `<div class="bdg ${on ? 'on' : 'off'}"><div class="ic">${a.ic}</div><b>${a.nm}</b><span>${a.d}</span>${on ? `<span style="color:var(--gold)">${S.achievements[a.id]}</span>` : `<div class="pg"><i style="width:${clamp(p / q, 0, 1) * 100}%"></i></div>`}</div>`; }).join('')}</div></div>
   <div class="card"><h2>Recent daily scores</h2>${recent.length ? barChart(recent.map(e => e.score), recent.map(e => String(parseD(e.ds).getDate())), 80) : '<div class="empty">Log food to start earning XP.</div>'}
    <div class="tiny mut" style="margin-top:8px">Score = calories on target (20) + protein (25) + fibre (10) + water (15) + micronutrients at baseline (20) + staying under limits (10).</div></div>
   <div class="card"><h2>How to earn XP</h2><div class="kv small"><div>Each item logged (max 10/day)</div><div>+5</div><div>Protein goal</div><div>+50</div><div>Calories within ±10%</div><div>+40</div><div>Water / fibre goal</div><div>+30 each</div><div>Each micronutrient at baseline</div><div>+3</div><div>All micros at baseline</div><div>+50</div><div>Bullseye macros</div><div>+40</div><div>Peak Day</div><div>+100</div><div>Daily score</div><div>+5 per 10 pts</div><div>Badges</div><div>+20 – 1000</div></div></div>`;
}

/* ======================================================================
   QUICK LOGGING (100% free, offline): VOICE/TEXT food names + VOICE NUTRITION LABELS
   → match to food DB (Foundation > SR Legacy > FNDDS > CNF > Open Food Facts)
   → one-tap review card
   ====================================================================== */
/* ---------- offline rule-based parser ---------- */
const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, half: 0.5, quarter: 0.25, couple: 2, few: 3, several: 3, dozen: 12, single: 1, double: 2 };
const UNIT_WORDS = [ // [regex, unit kind, value]
  [/^(g|gr|grams?|gm)$/, 'g', 1], [/^(kg|kilos?|kilograms?)$/, 'g', 1000], [/^(oz|ounces?)$/, 'g', 28.35], [/^(lbs?|pounds?)$/, 'g', 453.6],
  [/^(ml|mls|millilit(er|re)s?)$/, 'ml', 1], [/^(l|lit(er|re)s?)$/, 'ml', 1000], [/^(cups?)$/, 'ml', 236.6], [/^(tbsps?|tbs|tablespoons?)$/, 'ml', 14.8], [/^(tsps?|teaspoons?)$/, 'ml', 4.93],
  [/^(fl ?oz|fluid ounces?)$/, 'ml', 29.57], [/^(glass(es)?)$/, 'ml', 250], [/^(mugs?)$/, 'ml', 300], [/^(cans?)$/, 'ml', 355], [/^(bottles?)$/, 'ml', 500], [/^(pints?)$/, 'ml', 473], [/^(shots?)$/, 'ml', 44],
  [/^(bowls?)$/, 'ml', 355], [/^(handfuls?)$/, 'g', 30], [/^(scoops?)$/, 'por', 'scoop'], [/^(slices?)$/, 'por', 'slice'], [/^(pieces?|pcs?)$/, 'por', 'piece'], [/^(servings?|portions?)$/, 'por', 'serving'],
  [/^(fillets?)$/, 'por', 'fillet'], [/^(breasts?)$/, 'por', 'breast'], [/^(strips?)$/, 'por', 'slice'], [/^(sticks?)$/, 'por', 'stick'], [/^(bars?)$/, 'por', 'bar'], [/^(patty|patties)$/, 'por', 'patty'],
];
const SIZE_WORDS = ['extra large', 'jumbo', 'large', 'medium', 'small'];
const ALIAS = { 'black coffee': 'coffee brewed', 'coffee': 'coffee brewed', 'americano': 'coffee brewed', 'espresso': 'coffee espresso', 'tea': 'tea brewed', 'green tea': 'tea green brewed',
  'eggs': 'egg whole cooked', 'egg': 'egg whole cooked', 'boiled egg': 'egg whole hard-boiled', 'boiled eggs': 'egg whole hard-boiled', 'scrambled eggs': 'egg scrambled', 'fried egg': 'egg whole fried',
  'oatmeal': 'oatmeal', 'oats': 'oats', 'toast': 'bread toasted', 'water': 'water tap', 'protein shake': 'whey protein', 'whey': 'whey protein', 'chicken breast': 'chicken breast cooked',
  'rice': 'rice white cooked', 'bacon': 'pork bacon cooked', 'salmon': 'salmon cooked', 'steak': 'beef steak cooked', 'ground beef': 'ground beef cooked', 'tuna': 'tuna canned water', 'potato': 'potato baked', 'sweet potato': 'sweet potato baked', 'avocado': 'avocado raw', 'peanut butter': 'peanut butter', 'bread': 'bread whole wheat', 'pasta': 'pasta cooked', 'broccoli': 'broccoli cooked', 'brown rice': 'rice brown cooked', 'milk': 'milk 2%', 'banana': 'banana raw', 'apple': 'apple raw', 'beer': 'beer regular', 'wine': 'wine red', 'orange juice': 'orange juice' };
function parseNum(tok, next) {
  if (/^\d+(\.\d+)?$/.test(tok)) return +tok; if (/^\d+\/\d+$/.test(tok)) { const [a, b] = tok.split('/'); return a / b; }
  if (/^\d+(\.\d+)?(g|ml|oz|kg|l)$/.test(tok)) return null; return WORDNUM[tok] != null ? WORDNUM[tok] : null;
}
function localParse(text) {
  const chunks = text.toLowerCase().replace(/[.!?]/g, ',').replace(/\b(i had|i ate|i drank|for (breakfast|lunch|dinner|snack)|just|about|around|roughly|approximately)\b/g, ' ')
    .split(/,|;|&|\band then\b|\bthen\b|\band\b|\bwith\b|\bplus\b|\balso\b|\btopped with\b/).map(x => x.trim()).filter(Boolean);
  return chunks.map(ch => {
    let t = ch.replace(/(\d)(g|ml|oz|kg|l)\b/g, '$1 $2').replace(/\bfl\.? oz\b/g, 'floz').replace(/\bfluid ounces?\b/g, 'floz').split(/\s+/).filter(Boolean);
    let qty = null, unit = null, size = null; let i = 0;
    // "half a cup", "1 1/2 cups", "a couple of"
    while (i < t.length) {
      const n = parseNum(t[i]);
      if (n == null) break;
      qty = qty == null ? n : (n < 1 && qty >= 1 ? qty + n : qty * n); i++;
      if (t[i] === 'a' || t[i] === 'an' || t[i] === 'of') i++;
    }
    if (t[i] === 'floz') { unit = ['ml', 29.57]; i++; }
    else if (t[i]) { for (const [re, k, v] of UNIT_WORDS) if (re.test(t[i]) || (t[i + 1] && re.test(t[i] + ' ' + t[i + 1]) && (i++, true))) { unit = [k, v]; i++; break; } }
    if (t[i] === 'of') i++;
    let rest = t.slice(i).join(' ');
    for (const sz of SIZE_WORDS) if (new RegExp('\\b' + sz + '\\b').test(rest)) { size = sz; rest = rest.replace(new RegExp('\\b' + sz + '\\b'), '').trim(); break; }
    rest = rest.replace(/^(of|some|a|an)\s+/, '').trim();
    if (!rest) return null;
    return { name: rest, search: ALIAS[rest] || rest, qty: qty == null ? 1 : qty, unit, size, is_drink: /coffee|tea|water|milk|juice|soda|cola|beer|wine|shake|smoothie|latte|drink|kombucha|lemonade/.test(rest), confidence: 0.6, portion: ch };
  }).filter(Boolean);
}
const BIG_PORTION = /pot|pitcher|package|container|loaf|whole pie|cake|batch|recipe|jar|carton|gallon|quart|half gallon|bag|box|lb\b|pound|nlea|racc/i;
function portionByWord(item, word, drink) {
  const ps = (item.portions || []).filter(p => !BIG_PORTION.test(p[0])); if (!ps.length) return null;
  if (word) { const p = ps.find(p => new RegExp('\\b' + word, 'i').test(p[0])); if (p) return p[1]; }
  if (drink) { const p = ps.find(p => /^1 (mug|cup)\b/i.test(p[0])) || ps.find(p => /^(8|12) fl oz/i.test(p[0])); return p ? p[1] : 250 * (item.dens || 1); }
  const cnt = ps.find(p => /\b(large|medium|egg|slice|piece|fillet|breast|bar|patty|link|stick|item|each)\b/i.test(p[0]) && !/cup|tbsp|tsp|fl oz/i.test(p[0])) || ps.find(p => !/cup|tbsp|tsp|\boz\b|ml|serving \(racc\)|\bg\b/i.test(p[0]));
  return (cnt || ps[0])[1];
}
function gramsFor(item, parsed) {
  const q = parsed.qty || 1; const dens = item.dens || (parsed.is_drink ? 1 : null);
  if (parsed.grams) return parsed.grams;
  if (parsed.ml) return parsed.ml * (dens || 1);
  if (parsed.unit) {
    const [k, v] = parsed.unit;
    if (k === 'g') return q * v;
    if (k === 'ml') { const cupP = (item.portions || []).find(p => /^1 cup\b/i.test(p[0])); if (!dens && cupP) return q * v / 236.6 * cupP[1]; return q * v * (dens || 0.85); }
    if (k === 'por') { const g = portionByWord(item, v === 'serving' ? null : v); return q * (g || (v === 'scoop' ? 30 : 100)); }
  }
  const drink = parsed.is_drink || item.hyd;
  if (parsed.count) return parsed.count * (portionByWord(item, parsed.size, drink) || 100);
  const g = portionByWord(item, parsed.size, drink); return q * (g || (drink ? 250 : 100));
}
/* turn parsed items into review rows with matched DB foods */
async function matchItems(list) {
  await loadDB().catch(() => {});
  const rows = [];
  for (const it of list) {
    let cands = [], item = null;
    if (!item) {
      const qs = [it.search, it.name].filter(Boolean);
      for (const q of qs) { cands = searchLocal(q).filter(c => c.src !== 'sup'); if (cands.length) break; }
      if (!cands.length && it.name) { const w = it.name.split(/\s+/); for (let k = w.length - 1; k > 0 && !cands.length; k--) cands = searchLocal(w.slice(0, k).join(' ')); }
      // prefer drinks for drinks
      if (it.is_drink && cands.length) { const d = cands.find(c => c.hyd || c.dens); if (d) cands = [d, ...cands.filter(c => c !== d)]; }
      cands = cands.slice(0, 8); item = cands[0] || null;
    }
    if (item) { rememberItems([item, ...cands]); }
    const parsed = Object.assign({}, it);
    rows.push({ id: uid(), ai: it, item, cands, g: item ? Math.round(gramsFor(item, parsed)) : 0, hyd: item ? (item.hyd || (it.is_drink && !/beer|wine|liquor|vodka|whisk|rum|gin|cocktail/i.test(it.name || ''))) : false });
  }
  return rows;
}
function openReview(rows, meta = {}) {
  let meal = meta.meal || (CUR === today() ? defaultMeal() : 'snacks');
  const rec = openSheet(meta.title || 'Review & approve', '<div id="rv"></div>', { full: true });
  const draw = () => {
    const tot = {}; rows.forEach(r => { if (r.item && r.g > 0) addN(tot, scaleN(r.item.n100, r.g / 100)); });
    $('#rv', rec.sh).innerHTML = `
     ${meta.notes ? `<div class="note" style="margin-top:0">🎙️ ${esc(meta.notes)}</div>` : ''}
     <div class="chips" style="margin-bottom:10px">${MEALS.map(([k, l, i]) => `<button class="chip ${meal === k ? 'on' : ''}" data-rmeal="${k}">${i} ${l}</button>`).join('')}</div>
     ${rows.map((r, x) => { const n = r.item ? scaleN(r.item.n100, r.g / 100) : {}; const conf = r.ai.confidence; return `<div class="card" style="padding:12px;margin-bottom:10px">
       <div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><b style="font-size:15px">${esc(r.ai.name || r.ai.search || 'Item')}</b>${conf != null && conf < 0.6 ? ' <span class="pill warn">check</span>' : ''}
        <div class="small mut" style="margin-top:3px">${r.ai.portion ? esc(r.ai.portion) + ' → ' : ''}${r.item ? tagFor(r.item.src) + esc(r.item.name) : '<span style="color:var(--bad)">No match — tap “Change”</span>'}</div></div>
        <button class="iconbtn" data-rrm="${x}" style="width:32px;height:32px;flex:none">${ICON.x}</button></div>
       <div class="row" style="margin-top:10px;gap:8px"><button class="iconbtn" data-rminus="${x}" style="width:40px;flex:none">−</button>
        <div style="position:relative;flex:1"><input class="inp" data-rg="${x}" type="number" inputmode="decimal" value="${r.g}" style="text-align:center;padding-right:30px"><span class="mut small" style="position:absolute;right:10px;top:14px">${r.item && r.item.hyd ? 'ml' : 'g'}</span></div>
        <button class="iconbtn" data-rplus="${x}" style="width:40px;flex:none">+</button>
        <select class="inp" data-rch="${x}" style="width:auto;flex:none;max-width:42%;padding-right:28px"><option value="">Change…</option>${r.cands.filter(c => !r.item || c.key !== r.item.key).slice(0, 7).map(c => `<option value="${esc(c.key)}">${esc(c.name.slice(0, 48))}</option>`).join('')}<option value="__search">🔍 Search database…</option></select></div>
       <div class="small" style="margin-top:8px;display:flex;gap:12px;color:var(--mut)"><span><b style="color:#ff9a7a">${fmt(n.kcal || 0)}</b> kcal</span><span><b style="color:#6ee7b7">${fmt(n.protein || 0, 1)}</b> P</span><span><b style="color:#ffd166">${fmt(n.carbs || 0, 1)}</b> C</span><span><b style="color:#c4b5fd">${fmt(n.fat || 0, 1)}</b> F</span>${r.hyd ? '<span>💧 hydrates</span>' : ''}</div></div>`; }).join('') || '<div class="empty">Nothing recognised. Try again or add items manually.</div>'}
     <button class="btn block" id="radd2" style="margin-bottom:12px">＋ Add another item</button>
     <div class="macro4"><div><b style="color:#ff9a7a">${fmt(tot.kcal || 0)}</b><span>kcal</span></div><div><b style="color:#6ee7b7">${fmt(tot.protein || 0)}</b><span>protein g</span></div><div><b style="color:#ffd166">${fmt(tot.carbs || 0)}</b><span>carbs g</span></div><div><b style="color:#c4b5fd">${fmt(tot.fat || 0)}</b><span>fat g</span></div></div>
     <button class="btn pri block" id="rapprove" style="padding:17px;font-size:17px">✓ Approve & log ${rows.filter(r => r.item && r.g > 0).length} item${rows.filter(r => r.item && r.g > 0).length === 1 ? '' : 's'}</button>
     <div class="tiny dim" style="margin-top:10px">Portions are estimates — adjust grams if needed. Source priority: USDA Foundation › SR Legacy › FNDDS › Canadian Nutrient File › Open Food Facts.</div>`;
    const sh = rec.sh;
    $$('[data-rmeal]', sh).forEach(b => b.onclick = () => { meal = b.dataset.rmeal; draw(); });
    $$('[data-rrm]', sh).forEach(b => b.onclick = () => { rows.splice(+b.dataset.rrm, 1); draw(); });
    $$('[data-rg]', sh).forEach(i => i.onchange = () => { rows[+i.dataset.rg].g = Math.max(0, parseFloat(i.value) || 0); draw(); });
    $$('[data-rminus]', sh).forEach(b => b.onclick = () => { const r = rows[+b.dataset.rminus]; r.g = Math.max(0, Math.round(r.g * 0.85)); draw(); });
    $$('[data-rplus]', sh).forEach(b => b.onclick = () => { const r = rows[+b.dataset.rplus]; r.g = Math.round((r.g || 10) * 1.15); draw(); });
    $$('[data-rch]', sh).forEach(sel => sel.onchange = () => {
      const r = rows[+sel.dataset.rch]; const v = sel.value; if (!v) return;
      if (v === '__search') { openLog({ mode: 'pick', parent: LOG, onPick: it => { const old = r.item; r.item = it; r.cands = [old, ...r.cands].filter(Boolean); r.g = Math.round(gramsFor(it, r.ai)) || r.g; r.hyd = !!it.hyd; draw(); } }); sel.value = ''; return; }
      const it = ITEMS.get(v); if (it) { const old = r.item; r.item = it; r.cands = [old, ...r.cands.filter(c => c.key !== v)].filter(Boolean); r.g = Math.round(gramsFor(it, r.ai)) || r.g; r.hyd = !!it.hyd || r.hyd; draw(); }
    });
    $('#radd2', sh).onclick = () => openLog({ mode: 'pick', parent: LOG, onPick: it => { rows.push({ id: uid(), ai: { name: it.name }, item: it, cands: [], g: Math.round(gramsFor(it, { qty: 1 })), hyd: !!it.hyd }); draw(); } });
    $('#rapprove', sh).onclick = () => {
      const ok = rows.filter(r => r.item && r.g > 0); if (!ok.length) { toast('✋', 'Nothing to log'); return; }
      const before = beforeSnap(); const d = day(CUR, true);
      ok.forEach(r => {
        const n = roundN(scaleN(r.item.n100, r.g / 100));
        d.entries.push({ id: uid(), key: r.item.key, name: r.item.name, sub: r.item.sub, src: r.item.src, meal, g: r.g, qty: r.g, unit: 'g', qtyLabel: (r.ai.portion ? r.ai.portion + ' · ' : '') + fmt(r.g) + ' g', n, hyd: r.hyd || undefined, por: r.item.portions, dens: r.item.dens, t: Date.now(), via: meta.via });
        if (!/^label:/.test(r.item.key)) { const snap = snapshot(r.item); snap.last = { qty: r.g, unit: 'g', meal }; S.recent = [snap, ...S.recent.filter(x => x.key !== r.item.key)].slice(0, 60); }
      });
      closeSheet(rec); afterChange(before);
      const kc = ok.reduce((a, r) => a + (r.item.n100.kcal || 0) * r.g / 100, 0);
      toast('✅', `Logged ${ok.length} item${ok.length === 1 ? '' : 's'}`, `${fmt(kc)} kcal · +${Math.min(ok.length * 5, 50)} XP`);
    };
  };
  draw();
}
/* ---------- VOICE NUTRITION FACTS: offline label parser ---------- */
/* %DV references (display units). CA = Health Canada, Food and Drug Regulations — Table of Daily Values (2016 amendments,
   mandatory on labels since Dec 2022). US = FDA 21 CFR 101.9 (2016 rule). Canada sets no DV for carbohydrate, protein,
   cholesterol or added sugars, so the US value is used for those (flagged in the review). */
const DV = {
  CA: { fat: 75, satFat: 20, fibre: 28, sugars: 100, sodium: 2300, potassium: 3400, calcium: 1300, iron: 18, vitA: 900, vitC: 90, vitD: 20, vitE: 15, vitK: 120,
    thiamin: 1.2, riboflavin: 1.3, niacin: 16, b6: 1.7, folate: 400, b12: 2.4, biotin: 30, pantothenic: 5, choline: 550, phosphorus: 1250, iodine: 150, magnesium: 420,
    zinc: 11, selenium: 55, copper: 0.9, manganese: 2.3, molybdenum: 45 },
  US: { fat: 78, satFat: 20, cholesterol: 300, sodium: 2300, carbs: 275, fibre: 28, addedSugar: 50, protein: 50, vitD: 20, calcium: 1300, iron: 18, potassium: 4700,
    vitA: 900, vitC: 90, vitE: 15, vitK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, b6: 1.7, folate: 400, b12: 2.4, biotin: 30, pantothenic: 5, choline: 550,
    phosphorus: 1250, iodine: 150, magnesium: 420, zinc: 11, selenium: 55, copper: 0.9, manganese: 2.3, molybdenum: 45 },
};
const LABEL_SYN = [ // phrase (regex source) → key. Longest/most specific first.
  ['calories from fat', '_ignore'], ['sugar alcohols?', '_ignore'], ['saturated (?:fats? )?(?:and|plus|\\+) trans(?: fats?)?', 'satTrans'],
  ['serving size', 'serving'], ['per serving', 'serving'], ['servings? per container', '_ignore'], ['serving', 'serving'], ['portion', 'serving'],
  ['total carbohydrates?', 'carbs'], ['total carbs?', 'carbs'], ['carbohydrates?', 'carbs'], ['carbs?', 'carbs'],
  ['dietary fib(?:re|er)s?', 'fibre'], ['fib(?:re|er)s?', 'fibre'], ['added sugars?', 'addedSugar'], ['total sugars?', 'sugars'], ['sugars?', 'sugars'],
  ['saturated fats?', 'satFat'], ['sat fats?', 'satFat'], ['saturates', 'satFat'], ['saturated', 'satFat'], ['trans fats?', 'transFat'], ['trans', 'transFat'],
  ['monounsaturated fats?', 'monoFat'], ['monounsaturated', 'monoFat'], ['polyunsaturated fats?', 'polyFat'], ['polyunsaturated', 'polyFat'],
  ['omega 3s?', 'ala'], ['alpha linolenic acid', 'ala'], ['omega 6s?', 'omega6'], ['linoleic acid', 'omega6'], ['epa', 'epa'], ['dha', 'dha'],
  ['total fats?', 'fat'], ['fats?', 'fat'], ['lipids?', 'fat'],
  ['kilocalories', 'kcal'], ['calories', 'kcal'], ['calorie', 'kcal'], ['kcals?', 'kcal'], ['cals?', 'kcal'], ['energy', 'kcal'],
  ['proteins?', 'protein'], ['cholesterol', 'cholesterol'], ['sodium', 'sodium'], ['salt', 'salt'], ['potassium', 'potassium'],
  ['calcium', 'calcium'], ['iron', 'iron'], ['magnesium', 'magnesium'], ['zinc', 'zinc'], ['phosphor(?:us|ous)', 'phosphorus'],
  ['vitamin a', 'vitA'], ['vitamin c', 'vitC'], ['ascorbic acid', 'vitC'], ['vitamin d', 'vitD'], ['vitamin e', 'vitE'], ['vitamin k', 'vitK'],
  ['thiamine?', 'thiamin'], ['(?:vitamin )?b1', 'thiamin'], ['riboflavin', 'riboflavin'], ['(?:vitamin )?b2', 'riboflavin'], ['niacin', 'niacin'], ['(?:vitamin )?b3', 'niacin'],
  ['(?:vitamin )?b6', 'b6'], ['folate', 'folate'], ['folic acid', 'folate'], ['(?:vitamin )?b9', 'folate'], ['(?:vitamin )?b12', 'b12'], ['cobalamin', 'b12'],
  ['biotin', 'biotin'], ['(?:vitamin )?b7', 'biotin'], ['pantothen(?:ic acid|ate)', 'pantothenic'], ['(?:vitamin )?b5', 'pantothenic'], ['choline', 'choline'],
  ['selenium', 'selenium'], ['copper', 'copper'], ['manganese', 'manganese'], ['iodine', 'iodine'], ['iodide', 'iodine'], ['molybdenum', 'molybdenum'],
  ['caffeine', 'caffeine'], ['alcohol', 'alcohol'],
].map(([p, k]) => [new RegExp('\\b' + p + '\\b', 'g'), k]);
const UNIT_SYN = [[/^(g|gr|gm|grams?)$/, 'g'], [/^(mg|milligrams?|milli ?grams?)$/, 'mg'], [/^(mcg|ug|µg|micrograms?|micro ?grams?)$/, 'mcg'], [/^(iu|ius)$/, 'iu'],
  [/^(percent|pct|%|dv)$/, '%'], [/^(kj|kilojoules?)$/, 'kj'], [/^(kcal)$/, 'kcal'], [/^(ml|millilit(?:er|re)s?)$/, 'ml'], [/^(oz|ounces?)$/, 'oz'], [/^(l|lit(?:er|re)s?)$/, 'l']];
const NUMW = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/* "one hundred ninety" → 190, "two point five" → 2.5, "a half" → 0.5, "twenty-one" → 21 */
function wordsToDigits(text) {
  const t = text.split(/\s+/); const out = []; let i = 0;
  const isW = w => w in NUMW || w === 'hundred' || w === 'thousand';
  while (i < t.length) {
    const w = t[i];
    if (isW(w) || (w === 'a' && (t[i + 1] === 'hundred' || t[i + 1] === 'thousand'))) {
      let total = 0, cur = 0, any = false;
      if (w === 'a') { cur = 1; i++; }
      while (i < t.length && isW(t[i])) {
        const x = t[i];
        if (x === 'hundred') cur = (cur || 1) * 100; else if (x === 'thousand') { total += (cur || 1) * 1000; cur = 0; } else cur += NUMW[x];
        any = true; i++;
      }
      let val = total + cur;
      if (t[i] === 'point' && i + 1 < t.length && (t[i + 1] in NUMW || /^\d+$/.test(t[i + 1]))) {
        i++; let dec = ''; while (i < t.length && (t[i] in NUMW && NUMW[t[i]] < 10 || /^\d$/.test(t[i]))) { dec += t[i] in NUMW ? NUMW[t[i]] : t[i]; i++; }
        val = parseFloat(val + '.' + dec);
      }
      out.push(any || w === 'a' ? String(val) : w);
    } else if (/^\d+(\.\d+)?$/.test(w) && t[i + 1] === 'point' && /^\d+$/.test(t[i + 2] || '')) { out.push(w + '.' + t[i + 2]); i += 3; }
    else if (w === 'half' || w === 'a half') { out.push('0.5'); i++; }
    else { out.push(w); i++; }
  }
  return out.join(' ');
}
function normLabel(text) {
  let s = ' ' + String(text).toLowerCase() + ' ';
  s = s.replace(/µg/g, 'mcg').replace(/μg/g, 'mcg').replace(/%/g, ' percent ').replace(/per ?cent\b/g, 'percent').replace(/percent (of )?(the )?daily value|percent dv|\bdv\b|daily value/g, 'percent');
  s = s.replace(/([a-z])-([a-z0-9])/g, '$1 $2').replace(/(\d),(\d{3})\b/g, '$1$2');
  s = s.replace(/(\d)\s*([a-z%µ]+)/g, '$1 $2').replace(/([a-z])(\d)/g, (m, a, d) => a + ' ' + d);
  s = s.replace(/[“”"()]/g, ' ').replace(/([,;:!?]|\.(?!\d))/g, ' $1 ').replace(/\s+/g, ' ');
  s = wordsToDigits(s.trim());
  s = s.replace(/\bb ?(12|1|2|3|5|6|7|9)\b/g, 'b$1').replace(/\bvitamin ([dk]) ?([23]) (?=\d)/g, 'vitamin $1 ');
  s = s.replace(/\bomega (3|6)\b/g, 'omega $1');
  return s;
}
function convLabel(key, val, unit, ref) {
  // returns {v (display units), how: 'ok'|'assumed'|'dv', note}
  const n = BY[key]; const du = n ? n.unit : 'g';
  const toG = { g: 1, mg: 1e-3, mcg: 1e-6 }, fromG = { g: 1, mg: 1e3, 'µg': 1e6 };
  if (unit === '%') {
    let dv = DV[ref][key], used = ref;
    if (dv == null && ref === 'CA' && DV.US[key] != null) { dv = DV.US[key]; used = 'US'; }
    if (dv == null) return { v: null, how: 'bad', note: '%DV not defined for ' + (n ? n.name : key) };
    return { v: val / 100 * dv, how: 'dv', note: `${val}% DV × ${dv} ${du} (${used})` };
  }
  if (key === 'kcal') return unit === 'kj' ? { v: val / 4.184, how: 'ok', note: val + ' kJ' } : { v: val, how: 'ok' };
  if (unit === 'iu') {
    const f = { vitD: 0.025, vitA: 0.3, vitE: 0.67 }[key];
    return f ? { v: val * f, how: 'ok', note: `${val} IU` } : { v: null, how: 'bad', note: 'IU only valid for vitamins A, D, E' };
  }
  if (unit && toG[unit] != null && fromG[du] != null) return { v: val * toG[unit] * fromG[du], how: 'ok', note: unit !== (du === 'µg' ? 'mcg' : du) ? `${val} ${unit}` : '' };
  // no unit given → assume. Calcium/potassium/phosphorus/magnesium ≤100 with no unit are almost always "%" on Canadian labels.
  if (!unit && ['calcium', 'potassium', 'phosphorus', 'magnesium'].includes(key) && val <= 100) { const r = convLabel(key, val, '%', ref); r.how = 'assumed'; r.note = 'assumed %DV: ' + r.note; return r; }
  const STD = ['kcal', 'protein', 'fat', 'carbs', 'fibre', 'sugars', 'addedSugar', 'satFat', 'transFat', 'monoFat', 'polyFat', 'sodium', 'cholesterol'];
  if (!unit) return STD.includes(key) ? { v: val, how: 'ok' } : { v: val, how: 'assumed', note: 'assumed ' + du };
  return { v: val, how: 'assumed', note: 'unit "' + unit + '" ignored' };
}
function segWords(seg, tok, words) {
  // text before tok in the tagged word list, with placeholders restored to their matched phrase
  return words.slice(0, tok.i).map(w => { const m = w.match(/^@@(\d+)@@$/); return m ? (seg.match(LABEL_SYN[+m[1]][0]) || [''])[0] : w; }).join(' ').trim();
}
function parseLabel(text, ref = 'CA') {
  const out = { name: '', servingG: null, servingLabel: '', n: {}, how: {}, notes: {}, unparsed: [], ref, drink: false };
  let s = normLabel(text);
  const nm = s.match(/^(?:(?:the )?(?:name is|it'?s called|called|product is|item is|this is)\s+)([^,.;]+)/);
  if (nm) { out.name = nm[1].trim(); s = s.slice(nm[0].length); }
  const segs = s.split(/\s*(?:,|;|\n|\.(?!\d)|\band\b(?! trans)|\bthen\b|\bwith\b|\bnext\b)\s*/).map(x => x.trim()).filter(Boolean);
  segs.forEach((seg, si) => {
    let tagged = ' ' + seg + ' ';
    LABEL_SYN.forEach(([re, k], ix) => { tagged = tagged.replace(re, ` @@${ix}@@ `); });
    const words = tagged.trim().split(/\s+/);
    const toks = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const nk = w.match(/^@@(\d+)@@$/);
      if (nk) { toks.push({ t: 'N', k: LABEL_SYN[+nk[1]][1], i }); continue; }
      if (/^\d+(\.\d+)?$/.test(w) || /^\d+\/\d+$/.test(w)) {
        let v = w.includes('/') ? w.split('/')[0] / w.split('/')[1] : parseFloat(w); let unit = null;
        const nx = words[i + 1];
        if (nx) for (const [re, u] of UNIT_SYN) if (re.test(nx)) { unit = u; i++; break; }
        if (unit === 'l') { unit = 'ml'; v *= 1000; }
        toks.push({ t: 'V', v, unit, i }); continue;
      }
      if (UNIT_SYN.some(([re]) => re.test(w)) && toks.length && toks[toks.length - 1].t === 'V' && !toks[toks.length - 1].unit) { toks[toks.length - 1].unit = UNIT_SYN.find(([re]) => re.test(w))[1]; continue; }
      if (/^[,;.:!?\-–—+]$/.test(w)) continue;
      if (!['of', 'is', 'has', 'contains', 'a', 'the', 'per', 'about', 'with', 'total', 'there', 'are', 'it', 'its', "it's", 'value', 'size'].includes(w)) toks.push({ t: 'W', w, i });
    }
    // serving: "serving (size) [label words] <amount g|ml|oz>" — consumes only up to its gram/ml amount
    const svx = toks.findIndex(x => x.t === 'N' && x.k === 'serving');
    if (svx >= 0) {
      let j = svx + 1, mass = null; const lab = [];
      while (j < toks.length && !(toks[j].t === 'N' && toks[j].k !== 'serving')) {
        const x = toks[j];
        if (x.t === 'V' && ['g', 'ml', 'oz'].includes(x.unit)) { mass = x; j++; break; }
        if (x.t === 'V' && !x.unit && (toks[j + 1] && toks[j + 1].t === 'N' || j + 1 >= toks.length) && x.v > 5 && !lab.some(l => /\d/.test(l))) { mass = x; out.notes._serving = 'assumed grams'; j++; break; }
        if (x.t === 'V' && toks[j + 1] && toks[j + 1].t === 'N') break; // value belongs to the next nutrient
        lab.push(x.t === 'V' ? fmt(x.v, 2) + (x.unit ? ' ' + x.unit : '') : x.w || ''); j++;
      }
      if (mass) { out.servingG = mass.unit === 'oz' ? mass.v * 28.35 : mass.v; if (mass.unit === 'ml') out.drink = true; }
      else out.unparsed.push('serving size (no g/ml amount) — “' + seg + '”');
      if (lab.length) out.servingLabel = lab.join(' ');
      if (si === 0 && svx > 0 && !out.name) out.name = segWords(seg, toks[svx], words);
      toks.splice(0, j);
    } else if (si === 0 && !out.name) {
      // leading name with no commas: words up to the last plain word before the first number ("kirkland protein bar 190 calories …")
      const fv = toks.findIndex(x => x.t === 'V');
      if (fv > 0) { let lw = -1; for (let k = 0; k < fv; k++) if (toks[k].t === 'W') lw = k; if (lw >= 0) { out.name = segWords(seg, toks[lw + 1] || toks[fv], words); toks.splice(0, lw + 1); } }
    }
    const sig = toks.filter(x => x.t !== 'W' && x.k !== '_ignore' && x.k !== 'serving');
    if (si === 0 && !out.name && svx < 0 && !sig.some(x => x.t === 'V')) { out.name = seg; return; }
    if (!sig.length) { if (svx < 0 && toks.some(x => x.t === 'W')) out.unparsed.push(seg); return; }
    const pairUp = (N_, V_) => {
      let key = N_.k; const { v, unit } = V_;
      if (key === 'salt') { const g = unit === 'mg' ? v / 1000 : v; out.n.sodium = g * 400; out.how.sodium = 'ok'; out.notes.sodium = `${fmt(g, 2)} g salt × 400`; return; }
      if (key === 'satTrans') { key = 'satFat'; out.notes.satFat = 'saturated + trans combined'; }
      if (!BY[key]) return;
      const r = convLabel(key, v, unit, ref);
      if (r.v == null) { out.unparsed.push((BY[key].name) + ' — ' + r.note); return; }
      out.n[key] = r.v; out.how[key] = r.how; if (r.note) out.notes[key] = (out.notes[key] ? out.notes[key] + '; ' : '') + r.note;
    };
    const valueFirst = sig[0].t === 'V';
    const used = new Set();
    for (let i = 0; i < sig.length; i++) {
      const a = sig[i], b = sig[i + 1];
      if (valueFirst ? (a.t === 'V' && b && b.t === 'N') : (a.t === 'N' && b && b.t === 'V')) {
        const N_ = valueFirst ? b : a, V_ = valueFirst ? a : b; used.add(a); used.add(b); i++;
        pairUp(N_, V_);
      }
    }
    // second pass: leftovers in the other orientation ("… 200 mg sodium, calcium 10 percent" without commas)
    let left = sig.filter(x => !used.has(x));
    for (let i = 0; i < left.length - 1; i++) {
      const a = left[i], b = left[i + 1];
      if (a.t !== b.t && sig.indexOf(b) === sig.indexOf(a) + 1) { const N_ = a.t === 'N' ? a : b, V_ = a.t === 'V' ? a : b; pairUp(N_, V_); used.add(a); used.add(b); i++; }
    }
    left = sig.filter(x => !used.has(x));
    const short = seg.length > 50 ? '' : ' — “' + seg + '”';
    if (left.length) out.unparsed.push(left.map(x => x.t === 'N' ? (BY[x.k] ? BY[x.k].name : x.k) + ' (no amount)' : '“' + fmt(x.v, 2) + (x.unit ? ' ' + x.unit : '') + '” (no nutrient)').join(', ') + short);
    const odd = toks.filter(x => x.t === 'W' && !/^[,;.:!?]$/.test(x.w)).map(x => x.w);
    if (odd.length && used.size) out.unparsed.push('“' + odd.join(' ') + '” not recognised');
  });
  if (out.name) out.name = out.name.replace(/\b\w/g, c => c.toUpperCase());
  if (/\b(drink|juice|milk|soda|shake|beverage|water|coffee|tea|kombucha|beer)\b/i.test(out.name)) out.drink = true;
  return out;
}
function openLabel() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ref = S.settings.dvRef || 'CA';
  const ex = 'Kirkland protein bar, serving 60 grams, 190 calories, 21 grams protein, 7 fat, 22 carbs, 15 fibre, 1 gram sugar, 200 milligrams sodium, calcium 10 percent';
  const rec = openSheet('Read the label', `
    <div class="mut small" style="margin:-4px 0 10px">Say the <b>name</b>, the <b>serving size</b>, then each nutrient, in any order. Numbers as words or digits; g, mg, mcg, IU or % daily value.</div>
    <div class="field"><textarea class="inp" id="ltxt" rows="5" style="resize:none;font-size:16.5px;line-height:1.4" placeholder="${esc(ex)}"></textarea></div>
    <div class="row" style="gap:10px">${SR ? `<button class="btn" id="lmic" style="flex:none;width:64px;font-size:22px">🎙️</button>` : ''}<button class="btn pri" id="lgo" style="flex:1;padding:16px">🏷️ Read nutrients</button></div>
    <div class="mut small" id="lst" style="margin-top:10px">Tip: tap the 🎤 key on the iPhone keyboard to dictate. Nothing leaves your phone.</div>
    <div class="row" style="margin-top:12px"><span class="mut small" style="flex:1">% Daily Value reference</span><div class="seg" id="ldv" style="margin:0;width:auto"><button data-v="CA" class="${ref === 'CA' ? 'on' : ''}">🇨🇦 Canada</button><button data-v="US" class="${ref === 'US' ? 'on' : ''}">🇺🇸 US</button></div></div>
    <div class="chips" style="margin-top:12px"><button class="chip" id="lex">Try the example</button><button class="chip" data-act="manual-food">✍️ Type into a form instead</button></div>`);
  const ta = $('#ltxt', rec.sh); setTimeout(() => ta.focus(), 380);
  let dvRef = ref;
  $$('#ldv button', rec.sh).forEach(b => b.onclick = () => { dvRef = b.dataset.v; S.settings.dvRef = dvRef; save(); $$('#ldv button', rec.sh).forEach(x => x.classList.toggle('on', x === b)); });
  $('#lex', rec.sh).onclick = () => { ta.value = ex; };
  const mic = $('#lmic', rec.sh);
  if (mic) attachMic(mic, ta, $('#lst', rec.sh));
  $('#lgo', rec.sh).onclick = () => {
    const text = ta.value.trim(); if (!text) { ta.focus(); return; }
    const P = parseLabel(text, dvRef);
    if (!Object.keys(P.n).length && !P.name) { $('#lst', rec.sh).innerHTML = '<span style="color:var(--bad)">Couldn\'t find any nutrients. Try “protein 21 grams, fat 7 grams”.</span>'; return; }
    closeSheet(rec); openLabelReview(P, text);
  };
}
function labelToCustom(P) {
  const sg = P.servingG || 100; const n100 = {};
  for (const k in P.n) n100[k] = P.n[k] * 100 / sg;
  return { name: P.name, brand: '', servingG: sg, servingLabel: P.servingLabel || '', per: 'serving', n100, hyd: P.drink };
}
function openLabelReview(P, text) {
  openCustomFood(labelToCustom(P), { review: { hl: P.how, notes: P.notes, unparsed: P.unparsed, text, ref: P.ref, servingMissing: !P.servingG, nameMissing: !P.name } });
}
function attachMic(mic, ta, st) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let r = null;
  mic.onclick = () => {
    if (r) { r.stop(); return; }
    try {
      r = new SR(); r.lang = navigator.language || 'en-CA'; r.interimResults = true; r.continuous = true;
      const base = ta.value ? ta.value + ', ' : '';
      r.onresult = e => { ta.value = base + [...e.results].map(x => x[0].transcript).join(' '); };
      r.onerror = e => { if (st) st.textContent = 'Mic unavailable (' + e.error + ') — use the keyboard 🎤 instead.'; ta.focus(); };
      r.onend = () => { r = null; mic.textContent = '🎙️'; mic.style.background = ''; };
      r.start(); mic.textContent = '⏹'; mic.style.background = 'rgba(255,93,115,.3)';
    } catch (e) { r = null; ta.focus(); }
  };
}

/* ---------- one-tap "My items" ---------- */
function defaultServing(item) {
  const units = unitsFor(item); const rc = S.recent.find(r => r.key === item.key);
  let unit = rc && rc.last ? rc.last.unit : units[0].id; let u = units.find(x => x.id === unit);
  if (!u) { u = units[0]; unit = u.id; }
  let qty = rc && rc.last && rc.last.unit === unit ? rc.last.qty : (unit === 'g' ? 100 : 1);
  return { u, qty, g: qty * u.g, label: u.portion ? (qty === 1 ? u.label : fmt(qty, 2) + ' × ' + u.label) : fmt(qty, 2) + ' ' + u.label };
}
const QI = new Map(); let QI_ALL = false;
function myItems() {
  const seen = new Set(), out = [];
  const add = (it, why) => { if (!it || seen.has(it.key) || out.length >= 12) return; seen.add(it.key); QI.set(it.key, it); out.push({ it, why }); };
  S.favs.forEach(f => add(Object.assign({}, f), 'fav'));
  // frequent: logged on ≥2 days in the last 30 days
  const cnt = {}; const from = addDays(today(), -30);
  Object.keys(S.days).filter(d => d >= from).forEach(d => { const ks = new Set(S.days[d].entries.map(e => e.key)); ks.forEach(k => cnt[k] = (cnt[k] || 0) + 1); });
  Object.keys(cnt).filter(k => cnt[k] >= 2).sort((a, b) => cnt[b] - cnt[a]).forEach(k => { const r = S.recent.find(x => x.key === k); if (r) add(Object.assign({}, r), 'freq'); });
  S.customFoods.forEach(c => add(customItem(c), 'mine'));
  S.recipes.forEach(r => add(recipeItem(r), 'mine'));
  return out;
}
function quickLog(item, mealIn) {
  const ds = defaultServing(item); const meal = mealIn || (CUR === today() ? defaultMeal() : 'snacks');
  const before = beforeSnap(); const d = day(CUR, true);
  const n = roundN(scaleN(item.n100, ds.g / 100));
  const ent = { id: uid(), key: item.key, name: item.name, sub: item.sub, src: item.src, meal, g: +ds.g.toFixed(2), qty: ds.qty, unit: ds.u.id, qtyLabel: ds.label + (ds.u.portion || ds.u.id === 'g' ? '' : ` · ${fmt(ds.g)} g`), n, hyd: item.hyd || undefined, por: item.portions, dens: item.dens, t: Date.now(), via: 'quick' };
  d.entries.push(ent);
  const snap = snapshot(item); snap.last = { qty: ds.qty, unit: ds.u.id, meal }; S.recent = [snap, ...S.recent.filter(r => r.key !== item.key)].slice(0, 60);
  haptic(); afterChange(before);
  toast('⚡', 'Logged ' + item.name.split(',')[0], `${ds.label} · ${fmt(n.kcal || 0)} kcal → ${MEALS.find(m => m[0] === meal)[1]}`, { action: 'Undo', onAction: () => { const dd = day(CUR, true); dd.entries = dd.entries.filter(e => e.id !== ent.id); afterChange(); toast('↩️', 'Removed ' + item.name.split(',')[0]); } });
}
function myItemsCard() {
  const items = myItems();
  return `<div class="card"><h2>My items <span class="r" style="color:var(--mut);font-weight:500">tap = log · hold = change</span></h2>
   ${items.length ? `<div class="qgrid">${items.slice(0, QI_ALL ? 12 : 6).map(({ it, why }) => { const ds = defaultServing(it); const kc = (it.n100.kcal || 0) * ds.g / 100, pr = (it.n100.protein || 0) * ds.g / 100;
     return `<div class="qi" data-qi="${esc(it.key)}" role="button" tabindex="0"><div class="qn">${why === 'fav' ? '<span style="color:var(--gold)">★</span> ' : why === 'freq' ? '🔁 ' : ''}${esc(it.name.split(',').slice(0, 2).join(','))}</div><div class="qs">${esc(ds.label.slice(0, 22))}</div><div class="qk"><b>${fmt(kc)}</b> kcal · <b>${fmt(pr)}</b>g P</div><button class="qe" data-qiedit="${esc(it.key)}" aria-label="Change serving">⋯</button></div>`; }).join('')}</div>${items.length > 6 ? `<button class="btn block" data-act="qi-all" style="margin-top:8px;padding:9px;font-size:13px">${QI_ALL ? 'Show fewer' : `Show all ${items.length}`}</button>` : ''}`
     : `<div class="empty" style="padding:14px 6px">Save foods with <b>🏷️ Read the label</b>, ☆ favourite anything, or log something twice — it shows up here for one-tap logging.</div>`}</div>`;
}

/* ---------- voice / text flow ---------- */
function openVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const rec = openSheet('Say or type it', `
    <div class="field"><textarea class="inp" id="vtxt" rows="4" style="resize:none;font-size:17px;line-height:1.4" placeholder="e.g. two eggs, a cup of oatmeal with blueberries and a black coffee"></textarea></div>
    <div class="row" style="gap:10px">${SR ? `<button class="btn" id="vmic" style="flex:none;width:64px;font-size:22px">🎙️</button>` : ''}<button class="btn pri" id="vgo" style="flex:1;padding:16px">⚡ Find foods</button></div>
    <div id="vst" class="mut small" style="margin-top:10px">${SR && !standalone ? 'Tap 🎙️ and speak, or type.' : 'Tip: tap the 🎤 key on your iPhone keyboard to dictate.'} Include amounts: “200 g chicken”, “2 slices toast”, “a cup of milk”. Works offline.</div>
    <div class="chips" style="margin-top:14px">${['2 eggs and 2 slices of toast', '1 cup greek yogurt with blueberries', '200g chicken breast, 1 cup rice', 'protein shake with 300 ml milk'].map(x => `<button class="chip" data-vex="${esc(x)}">${esc(x)}</button>`).join('')}</div>`);
  const ta = $('#vtxt', rec.sh); setTimeout(() => ta.focus(), 380);
  $$('[data-vex]', rec.sh).forEach(b => b.onclick = () => { ta.value = b.dataset.vex; ta.focus(); });
  const mic = $('#vmic', rec.sh);
  if (mic) {
    let r = null;
    mic.onclick = () => {
      if (r) { r.stop(); return; }
      try {
        r = new SR(); r.lang = navigator.language || 'en-CA'; r.interimResults = true; r.continuous = false;
        const base = ta.value ? ta.value + ', ' : '';
        r.onresult = e => { ta.value = base + [...e.results].map(x => x[0].transcript).join(' '); };
        r.onerror = e => { $('#vst', rec.sh).textContent = 'Mic unavailable (' + e.error + ') — use the keyboard 🎤 instead.'; ta.focus(); };
        r.onend = () => { r = null; mic.textContent = '🎙️'; mic.style.background = ''; };
        r.start(); mic.textContent = '⏹'; mic.style.background = 'rgba(255,93,115,.3)';
      } catch (e) { r = null; ta.focus(); }
    };
  }
  $('#vgo', rec.sh).onclick = async () => {
    const text = ta.value.trim(); if (!text) { ta.focus(); return; }
    const b = $('#vgo', rec.sh), st = $('#vst', rec.sh); b.disabled = true; b.textContent = 'Parsing…';
    const items = localParse(text), notes = '', via = 'voice';
    const rows = await matchItems(items);
    b.disabled = false; b.textContent = 'Parse again';
    closeSheet(rec); openReview(rows, { notes: notes || ('“' + text + '”'), via, title: 'Review' });
  };
}
function openQuickLog(meal) {
  openSheet('Log', `<div class="grid2" style="margin-bottom:10px">
    <button class="tile" data-act="voice" style="padding:18px;text-align:center"><div style="font-size:34px">🎙️</div><b style="display:block;margin-top:6px">Say it</b><span class="mut small">Food name + amount</span></button>
    <button class="tile" data-act="label" style="padding:18px;text-align:center"><div style="font-size:34px">🏷️</div><b style="display:block;margin-top:6px">Read the label</b><span class="mut small">Nutrition facts</span></button></div>
    <div class="grid2"><button class="btn" data-act="search" ${meal ? `data-meal="${meal}"` : ''}>🔍 Search</button><button class="btn" data-act="scan">▦ Barcode</button></div>
    <div class="grid2" style="margin-top:10px"><button class="btn" data-act="recent">🕘 Recent</button><button class="btn" data-act="manual-food">✍️ Enter manually</button></div>`);
}

/* ---------------- profile & settings ---------------- */
function openProfile() {
  const p = S.profile; const E = targetsFor(today())._energy; const ft = Math.floor(p.heightCm / 2.54 / 12), inch = Math.round(p.heightCm / 2.54 - ft * 12);
  const html = `
   <div class="card"><h2>Body</h2>
    <div class="f2"><div class="field"><label>Name (optional)</label><input class="inp" data-p="name" value="${esc(p.name || '')}"></div><div class="field"><label>Age</label><input class="inp" data-p="age" type="number" inputmode="numeric" value="${p.age}"></div></div>
    <div class="f3"><div class="field"><label>Sex</label><select class="inp" data-p="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></div>
     <div class="field"><label>Height ft</label><input class="inp" id="hft" type="number" inputmode="numeric" value="${ft}"></div><div class="field"><label>in</label><input class="inp" id="hin" type="number" inputmode="numeric" value="${inch}"></div></div>
    <div class="f2"><div class="field"><label>Current weight (lb)</label><input class="inp" data-p="weightLb" type="number" inputmode="decimal" step="0.1" value="${p.weightLb ?? ''}" placeholder="enter weight"></div><div class="field"><label>Goal weight (lb)</label><input class="inp" data-p="goalLb" type="number" inputmode="decimal" step="0.1" value="${p.goalLb}"></div></div>
    <div class="row" style="margin-bottom:6px"><div style="flex:1;font-size:13px" class="mut">Use latest weigh-in as current weight</div><button class="switch ${p.useLatestWeight ? 'on' : ''}" id="ulw"></button></div></div>
   <div class="card"><h2>Training & cut</h2>
    <div class="field"><label>Activity level</label><select class="inp" data-p="activity">${Object.entries(ACTIVITY).map(([k, a]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${a.label}</option>`).join('')}</select></div>
    <div class="field"><label>Fat-loss pace: ${p.ratePct}% body weight / week</label><input type="range" min="0" max="1.2" step="0.1" data-p="ratePct" value="${p.ratePct}" style="width:100%"><div class="tiny mut">0.5–1.0%/wk is the evidence-based range for keeping muscle (Helms 2014; Garthe 2011 favoured ~0.7%). 0 = maintenance.</div></div>
    <div class="f2"><div class="field"><label>Protein goal (g)</label><input class="inp" data-p="proteinG" type="number" inputmode="numeric" value="${p.proteinG}"></div><div class="field"><label>Fat floor (g per lb goal wt)</label><input class="inp" data-p="fatPerLb" type="number" inputmode="decimal" step="0.05" value="${p.fatPerLb}"></div></div>
    <div class="field"><label>Rings & meters aim for</label><div class="seg" id="tier"><button data-v="peak" class="${S.settings.tier === 'peak' ? 'on' : ''}">✦ Peak targets</button><button data-v="base" class="${S.settings.tier !== 'peak' ? 'on' : ''}">Baseline (RDA/AI)</button></div></div>
    <div class="note"><div class="kv"><div>BMR</div><div>${fmt(E.bmr)} kcal</div><div>TDEE</div><div>${fmt(E.tdee)} kcal</div><div>Daily target</div><div>${fmt(E.kcal)} kcal</div><div>Protein · fat · carbs</div><div>${E.protein} · ${E.fatG} · ${E.carbsG} g</div></div>${profileNow().weightEst ? '<div class="tiny" style="margin-top:6px;color:var(--warn)">Using a 180 lb placeholder until you enter your weight.</div>' : ''}</div></div>
   <div class="card"><h2>Preferences</h2>
    <div class="field"><label>Water units</label><div class="seg" id="wu"><button data-v="ml" class="${S.settings.waterUnit !== 'oz' ? 'on' : ''}">ml / L</button><button data-v="oz" class="${S.settings.waterUnit === 'oz' ? 'on' : ''}">fl oz</button></div></div>
    <button class="btn block" data-act="pins">📌 Edit dashboard pins</button></div>
   <div class="card"><h2>Data</h2>
    <div class="f2"><button class="btn" id="exp">⬇️ Export backup</button><button class="btn" id="imp">⬆️ Import backup</button></div>
    <input type="file" id="impf" accept="application/json,.json" class="hidden">
    <div class="tiny mut" style="margin:10px 0">Everything lives on this phone only. Export regularly (e.g. save to Files/iCloud). Food data: ${DB ? fmt(DB.foods.length) + ' foods — ' : ''}USDA FoodData Central (Foundation, SR Legacy, FNDDS), Health Canada CNF 2015, Open Food Facts. No paid services, no accounts, no API keys.</div>
    <button class="btn danger block" id="wipe">Erase all data</button></div>
   <div class="tiny dim" style="text-align:center;margin:6px 0 10px">Fuel v1.2 · 100% free & offline-first · Not medical advice. Targets from NASEM/Health Canada DRIs & sports-nutrition position stands.</div>`;
  const rec = openSheet('Profile & settings', html, { full: true, onClose: () => { invalidate(); render(); } });
  const sh = rec.sh;
  $$('[data-p]', sh).forEach(i => i.onchange = () => { const k = i.dataset.p; let v = i.value; if (i.type === 'number' || i.type === 'range') v = v === '' ? null : parseFloat(v); S.profile[k] = v; if (k === 'weightLb' && v > 0) { S.profile.useLatestWeight = false; } if (k === 'ratePct') i.previousElementSibling.textContent = `Fat-loss pace: ${v}% body weight / week`; invalidate(); save(); });
  const hset = () => { const f = parseFloat($('#hft', sh).value) || 0, n = parseFloat($('#hin', sh).value) || 0; if (f > 0) { S.profile.heightCm = Math.round((f * 12 + n) * 2.54); invalidate(); save(); } };
  $('#hft', sh).onchange = hset; $('#hin', sh).onchange = hset;
  $('#ulw', sh).onclick = e => { S.profile.useLatestWeight = !S.profile.useLatestWeight; e.currentTarget.classList.toggle('on', S.profile.useLatestWeight); invalidate(); save(); };
  $$('#tier button', sh).forEach(b => b.onclick = () => { S.settings.tier = b.dataset.v; $$('#tier button', sh).forEach(x => x.classList.toggle('on', x === b)); invalidate(); save(); });
  $$('#wu button', sh).forEach(b => b.onclick = () => { S.settings.waterUnit = b.dataset.v; $$('#wu button', sh).forEach(x => x.classList.toggle('on', x === b)); save(); });
  $('#exp', sh).onclick = exportData;
  $('#imp', sh).onclick = () => $('#impf', sh).click();
  $('#impf', sh).onchange = e => importData(e.target.files[0]);
  $('#wipe', sh).onclick = () => { if (confirm('Erase ALL data on this device? Export a backup first.') && confirm('Really erase everything?')) { localStorage.removeItem(STORE_KEY); load(); invalidate(); closeAllSheets(); render(); toast('🧹', 'All data erased'); } };
}
function exportData() {
  const copy = JSON.parse(JSON.stringify(S));
  const blob = new Blob([JSON.stringify({ app: 'fuel', exported: new Date().toISOString(), data: copy }, null, 1)], { type: 'application/json' });
  const name = 'fuel-backup-' + today() + '.json'; const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('⬇️', 'Backup exported', name);
}
function importData(file) {
  if (!file) return; const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); const d = j.data || j; if (!d.days || !d.profile) throw new Error('Not a Fuel backup'); if (!confirm('Replace current data with this backup (' + Object.keys(d.days).length + ' days)?')) return; if (d.settings) delete d.settings.ai; localStorage.setItem(STORE_KEY, JSON.stringify(d)); load(); saveNow(); invalidate(); closeAllSheets(); render(); toast('⬆️', 'Backup restored'); } catch (e) { toast('⚠️', 'Import failed', e.message); } };
  r.readAsText(file);
}
function openPins() {
  const html = `<div class="mut small" style="margin-bottom:10px">Choose what shows in your Focus panel.</div>${GROUPS.map(([g, l]) => `<h2 class="mut small" style="margin:12px 0 6px">${l.toUpperCase()}</h2><div class="chips">${N.filter(n => n.group === g && n.key !== 'kcal').map(n => `<button class="chip ${S.settings.pinned.includes(n.key) ? 'on' : ''}" data-pin="${n.key}">${n.name}</button>`).join('')}</div>`).join('')}
   <button class="btn block" id="pinreset" style="margin-top:16px">Reset to defaults</button>`;
  const rec = openSheet('Dashboard pins', html, { full: true, onClose: render });
  $$('[data-pin]', rec.sh).forEach(b => b.onclick = () => { const k = b.dataset.pin, p = S.settings.pinned, i = p.indexOf(k); if (i >= 0) p.splice(i, 1); else p.push(k); b.classList.toggle('on', i < 0); save(); });
  $('#pinreset', rec.sh).onclick = () => { S.settings.pinned = DEFAULT_PINS.slice(); save(); closeSheet(rec); };
}
function addWater(ml) {
  const before = beforeSnap(); const d = day(CUR, true); d.water.push({ id: uid(), ml, t: Date.now() }); haptic(); afterChange(before);
  toast('💧', '+' + (S.settings.waterUnit === 'oz' ? fmt(ml / 29.5735) + ' oz' : fmt(ml) + ' ml'), 'Water logged');
}
function openWaterCustom() {
  const oz = S.settings.waterUnit === 'oz';
  const rec = openSheet('Add water', `<div class="field"><label>Amount (${oz ? 'fl oz' : 'ml'})</label><input class="inp" id="wml" type="number" inputmode="decimal" placeholder="${oz ? '12' : '330'}"></div><button class="btn pri block" id="wadd">Add</button>`);
  setTimeout(() => $('#wml', rec.sh).focus(), 350);
  $('#wadd', rec.sh).onclick = () => { const v = parseFloat($('#wml', rec.sh).value); if (v > 0) { closeSheet(rec); addWater(Math.round(oz ? v * 29.5735 : v)); } };
}
function openWaterList() {
  const d = day(CUR);
  const rec = openSheet('Water today', `<div class="list">${d.water.map(w => `<div class="it"><div class="nm"><b>💧 ${fmt(w.ml)} ml</b><span>${new Date(w.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><button class="iconbtn" data-wdel="${w.id}" style="width:34px;height:34px">${ICON.x}</button></div>`).join('')}</div>`);
  $$('[data-wdel]', rec.sh).forEach(b => b.onclick = () => { const dd = day(CUR, true); dd.water = dd.water.filter(w => w.id !== b.dataset.wdel); afterChange(); closeSheet(rec); });
}

/* ---------------- router & events ---------------- */
function render() {
  const app = $('#app'); const y = window.scrollY;
  const fn = { today: renderToday, nutrients: renderNutrients, progress: renderProgress, awards: renderAwards }[VIEW];
  app.innerHTML = `<div class="view">${fn()}</div>`;
  $$('#tabbar .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === VIEW));
  animateRings(app);
  const dp = $('#datepick'); if (dp) dp.onchange = () => { if (dp.value) { CUR = dp.value; render(); } };
  const th = $('#trainHours'); if (th) th.onchange = () => { day(CUR, true).training.hours = parseFloat(th.value); S.settings.defaultTrainingHours = parseFloat(th.value); afterChange(); };
  if (render.keep) window.scrollTo(0, y); render.keep = true;
}
function go(v) { VIEW = v; render.keep = false; render(); window.scrollTo(0, 0); }
/* My items: tap = log default serving, long-press or ⋯ = change serving */
let LP = { timer: null, fired: false, x: 0, y: 0 };
document.addEventListener('pointerdown', e => {
  const q = e.target.closest('[data-qi]'); if (!q || e.target.closest('[data-qiedit]')) return;
  LP.fired = false; LP.x = e.clientX; LP.y = e.clientY; clearTimeout(LP.timer);
  q.classList.add('press');
  LP.timer = setTimeout(() => { LP.fired = true; q.classList.remove('press'); haptic(); const it = QI.get(q.dataset.qi); if (it) openFood(it, { meal: defaultMeal() }); }, 480);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(LP.timer); $$('.qi.press').forEach(x => x.classList.remove('press')); }, true));
document.addEventListener('pointermove', e => { if (LP.timer && Math.hypot(e.clientX - LP.x, e.clientY - LP.y) > 10) { clearTimeout(LP.timer); $$('.qi.press').forEach(x => x.classList.remove('press')); } });
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-qi]')) e.preventDefault(); });
document.addEventListener('click', e => {
  const qe = e.target.closest('[data-qiedit]'); if (qe) { const it = QI.get(qe.dataset.qiedit); if (it) openFood(it, { meal: defaultMeal() }); return; }
  const qi = e.target.closest('[data-qi]'); if (qi) { if (LP.fired) { LP.fired = false; return; } const it = QI.get(qi.dataset.qi); if (it) quickLog(it); return; }
  const t = e.target.closest('[data-act],[data-nut],[data-add],[data-entry],[data-water],[data-ng],[data-range],[data-delgoal],[data-delw]'); if (!t) return;
  const a = t.dataset.act;
  if (t.dataset.nut) return openNutrient(t.dataset.nut);
  if (t.dataset.add) return openQuickLog(t.dataset.add), (window._pendingMeal = t.dataset.add);
  if (t.dataset.entry) { const en = day(CUR).entries.find(x => x.id === t.dataset.entry); if (en) openFood(itemFromEntry(en), { entry: en }); return; }
  if (t.dataset.water) return addWater(+t.dataset.water);
  if (t.dataset.ng) { NUT_GROUP = t.dataset.ng; return render(); }
  if (t.dataset.range) { PR_RANGE = +t.dataset.range; return render(); }
  if (t.dataset.delgoal) { if (confirm('Remove this goal?')) { S.goals = S.goals.filter(g => g.id !== t.dataset.delgoal); save(); render(); } return; }
  if (t.dataset.delw) { S.weights = S.weights.filter(w => w.d !== t.dataset.delw); invalidate(); save(); render(); return; }
  const inSheet = !!t.closest('.sheet'); const pm = window._pendingMeal; 
  const closeQ = () => { if (inSheet && ['voice', 'label', 'manual-food', 'search', 'scan', 'recent'].includes(a)) closeSheet(SHEETS[SHEETS.length - 1]); };
  switch (a) {
    case 'prevday': CUR = addDays(CUR, -1); render(); break;
    case 'nextday': if (CUR < today()) { CUR = addDays(CUR, 1); render(); } break;
    case 'profile': openProfile(); break;
    case 'pins': openPins(); break;
    case 'go-nutrients': go('nutrients'); break;
    case 'training': { const d = day(CUR, true); d.training.on = !d.training.on; afterChange(); toast(d.training.on ? '🏋️' : '🛋️', d.training.on ? 'Training day on' : 'Rest day', d.training.on ? 'Water & sodium targets raised' : ''); break; }
    case 'water-custom': openWaterCustom(); break;
    case 'water-list': openWaterList(); break;
    case 'add-goal': openAddGoal(); break;
    case 'log-weight': openWeigh(); break;
    case 'label': closeQ(); openLabel(); break;
    case 'qi-all': QI_ALL = !QI_ALL; render(); break;
    case 'manual-food': closeQ(); openCustomFood(null); break;
    case 'voice': closeQ(); openVoice(); break;
    case 'search': closeQ(); openLog({ meal: t.dataset.meal || pm }); break;
    case 'scan': closeQ(); openLog({ tab: 'scan', meal: pm }); break;
    case 'recent': closeQ(); openLog({ tab: 'recent', meal: pm }); break;
    case 'new-custom': openCustomFood(); break;
    case 'new-recipe': openRecipe(); break;
  }
});
$$('#tabbar .tab').forEach(b => b.onclick = () => go(b.dataset.tab));
$('#fab').onclick = () => { window._pendingMeal = null; openQuickLog(); };

/* ---------------- init ---------------- */
load();
checkAchievements(true);
render();
loadDB().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
let lastToday = today();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { const t = today(); if (t !== lastToday) { if (CUR === lastToday) CUR = t; lastToday = t; invalidate(); render(); } } });
window.__fuel = { S: () => S, totals, evalDay, targetsFor, searchLocal, localParse, parseLabel, matchItems, openReview, gameCtx, loadDB, render, go, setDay: d => { CUR = d; render(); } };
})();
