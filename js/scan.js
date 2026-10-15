/* Fuel — Scan a label: photo of a Nutrition Facts panel → on-device OCR (Tesseract, lazy-loaded from vendor/tesseract)
   → existing label parser (parseLabel) → prefilled review with confidence colours → one tap to log.
   Free and offline after first use: nothing leaves the phone. */
(function () {
'use strict';
const F = window.__fuel;
const BASE = new URL('vendor/tesseract/', location.href).href;

/* ---------- engine (lazy) ---------- */
let workerP = null, progressCb = null;
const hasSimd = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } };
const CORE = () => BASE + (hasSimd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js');
const ASSETS = () => [BASE + 'tesseract.min.js', BASE + 'worker.min.js', CORE(), BASE + 'eng.traineddata.gz'];
function loadScript(src) {
  return new Promise((res, rej) => { if (window.Tesseract) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the OCR engine')); document.head.appendChild(s); });
}
function engine() {
  if (!workerP) workerP = (async () => {
    await loadScript(BASE + 'tesseract.min.js');
    const w = await Tesseract.createWorker('eng', 1, {
      workerPath: BASE + 'worker.min.js', corePath: CORE(), langPath: BASE.replace(/\/$/, ''), gzip: true, workerBlobURL: false, cacheMethod: 'none',
      logger: m => progressCb && progressCb(m),
    });
    await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', user_defined_dpi: '300', debug_file: '/dev/null' });
    return w;
  })().catch(e => { workerP = null; throw e; });
  return workerP;
}

/* ---------- image preprocessing ---------- */
async function loadImage(src) {
  if (src instanceof HTMLCanvasElement) return src;
  try { return await createImageBitmap(src, { imageOrientation: 'from-image' }); } catch (e) {}
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not read that image')); im.src = URL.createObjectURL(src); });
}
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function greyData(c) { const ctx = c.getContext('2d', { willReadFrequently: true }); const d = ctx.getImageData(0, 0, c.width, c.height); const g = new Uint8ClampedArray(c.width * c.height); for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d.data[i] * 299 + d.data[i + 1] * 587 + d.data[i + 2] * 114) / 1000; return g; }
function putGrey(c, g) { const ctx = c.getContext('2d'); const d = ctx.createImageData(c.width, c.height); for (let i = 0, j = 0; j < g.length; i += 4, j++) { d.data[i] = d.data[i + 1] = d.data[i + 2] = g[j]; d.data[i + 3] = 255; } ctx.putImageData(d, 0, 0); }
/* resize → greyscale → flatten uneven lighting (divide by a dilated background estimate) → contrast stretch */
function normalise(img, maxSide = 2000) {
  const W0 = img.width, H0 = img.height; const s = Math.min(maxSide / Math.max(W0, H0), 3);
  const c = cv(W0 * s, H0 * s); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
  const g = greyData(c), W = c.width, H = c.height;
  // background (paper) estimate: block maxima on a coarse grid, smoothed, bilinear upsampled
  const B = Math.max(16, Math.round(Math.max(W, H) / 40)), bw = Math.ceil(W / B), bh = Math.ceil(H / B), bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let m = 0; for (let y = by * B; y < Math.min(H, by * B + B); y += 2) for (let xx = bx * B; xx < Math.min(W, bx * B + B); xx += 2) { const v = g[y * W + xx]; if (v > m) m = v; } bg[by * bw + bx] = m; }
  const bg2 = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = by + dy, xx = bx + dx; if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) m = Math.max(m, bg[yy * bw + xx]); } bg2[by * bw + bx] = m; }
  const out = new Uint8ClampedArray(W * H); const hist = new Uint32Array(256);
  for (let y = 0; y < H; y++) { const fy = Math.min(bh - 1.001, Math.max(0, y / B - .5)), y0 = fy | 0, ty = fy - y0;
    for (let xx = 0; xx < W; xx++) { const fx = Math.min(bw - 1.001, Math.max(0, xx / B - .5)), x0 = fx | 0, tx = fx - x0;
      const b = bg2[y0 * bw + x0] * (1 - tx) * (1 - ty) + bg2[y0 * bw + x0 + 1] * tx * (1 - ty) + bg2[(y0 + 1) * bw + x0] * (1 - tx) * ty + bg2[(y0 + 1) * bw + x0 + 1] * tx * ty;
      const v = Math.min(255, g[y * W + xx] * 255 / Math.max(40, b)); out[y * W + xx] = v; hist[v | 0]++; } }
  let lo = 0, hi = 255, acc = 0; const N = W * H;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > N * .01) { lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > N * .25) { hi = i; break; } }
  if (hi - lo < 30) { lo = Math.max(0, hi - 30); }
  for (let i = 0; i < N; i++) out[i] = Math.max(0, Math.min(255, (out[i] - lo) * 255 / (hi - lo)));
  putGrey(c, out); return c;
}
/* projection-profile skew estimate (deg) on a small binarised copy; also tells whether text runs sideways */
function skewScan(c) {
  const s = 700 / Math.max(c.width, c.height); const t = cv(c.width * s, c.height * s); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  const g = greyData(t), W = t.width, H = t.height; const pts = [];
  // dark pixels next to a bright one (stroke edges): blobs/shadows contribute only their outline, text dominates
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const v = g[y * W + x]; if (v < 120 && (g[y * W + x + 2] - v > 70 || g[y * W + x - 2] - v > 70 || g[(y + 2) * W + x] - v > 70 || g[(y - 2) * W + x] - v > 70)) pts.push(x - W / 2, y - H / 2); }
  const R = Math.ceil(Math.hypot(W, H)) + 2;
  const score = deg => { const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a); const prof = new Float32Array(R * 2); for (let i = 0; i < pts.length; i += 2) prof[Math.round(pts[i + 1] * ca - pts[i] * sa) + R]++; let v = 0; for (let i = 0; i < prof.length; i++) v += prof[i] * prof[i]; return v; };
  const best = (from, to, step) => { let bd = from, bs = -1; for (let d = from; d <= to + 1e-9; d += step) { const sc = score(d); if (sc > bs) { bs = sc; bd = d; } } return [bd, bs]; };
  let [d0, s0] = best(-15, 15, 1); let [d9, s9] = best(75, 105, 1);
  const sideways = s9 > s0 * 1.3; let d = sideways ? d9 : d0;
  d = best(d - 1, d + 1, 0.2)[0];
  // text line height (in source pixels): runs of inked rows in the profile at the chosen angle
  const a = d * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), prof = new Float32Array(R * 2);
  for (let i = 0; i < pts.length; i += 2) prof[Math.round(pts[i + 1] * ca - pts[i] * sa) + R]++;
  let mx = 0; for (let i = 0; i < prof.length; i++) if (prof[i] > mx) mx = prof[i];
  const runs = []; let st = -1;
  for (let i = 0; i < prof.length; i++) { const on = prof[i] > mx * 0.04; if (on && st < 0) st = i; if (!on && st >= 0) { if (i - st >= 3) runs.push(i - st); st = -1; } }
  runs.sort((x, y) => x - y); const lineH = runs.length ? runs[runs.length >> 1] / s : 0;
  return { angle: sideways ? d - 90 : d, sideways, lineH, lines: runs.length };
}
function rotate(c, deg) {
  if (Math.abs(((deg % 360) + 360) % 360) < 0.2) return c;
  const a = deg * Math.PI / 180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
  const o = cv(c.width * ca + c.height * sa, c.width * sa + c.height * ca); const x = o.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.translate(o.width / 2, o.height / 2); x.rotate(a); x.drawImage(c, -c.width / 2, -c.height / 2); return o;
}
/* erase table rules and solid bars (long dark runs in a row or column) — they make Tesseract drop the text rows they touch */
function eraseRules(c, minRun) {
  const W = c.width, H = c.height, g = greyData(c), m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { let st = -1; for (let x = 0; x <= W; x++) { const d = x < W && g[y * W + x] < 140; if (d && st < 0) st = x; if (!d && st >= 0) { if (x - st >= minRun) for (let k = st; k < x; k++) m[y * W + k] = 1; st = -1; } } }
  for (let x = 0; x < W; x++) { let st = -1; for (let y = 0; y <= H; y++) { const d = y < H && g[y * W + x] < 140; if (d && st < 0) st = y; if (!d && st >= 0) { if (y - st >= minRun * 1.5) for (let k = st; k < y; k++) m[k * W + x] = 1; st = -1; } } }
  // grow the mask by 1px so anti-aliased edges go too
  for (let i = 0; i < g.length; i++) if (m[i] || (m[i - 1] === 1) || (m[i + 1] === 1) || m[i - W] === 1 || m[i + W] === 1) g[i] = g[i] < 200 && (m[i] || m[i - 1] || m[i + 1] || m[i - W] || m[i + W]) ? 255 : g[i];
  putGrey(c, g); return c;
}
const KW = /\b(nutrition|facts|valeur|nutritive|calories|fat|lipides|saturated|trans|cholesterol|sodium|carbohydrate|glucides|fibre|fiber|sugars|sucres|protein|proteines|potassium|calcium|iron|fer|serving|per|daily|value|vitamin)\b/g;
function quality(lines) { const t = lines.map(l => l.text).join('\n').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return (t.match(KW) || []).length * 10 + lines.reduce((a, l) => a + l.confidence, 0) / Math.max(1, lines.length) / 10; }
async function recognise(canvas) {
  const w = await engine();
  const r = await w.recognize(canvas, {}, { text: true, blocks: true });
  const lines = []; (r.data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => lines.push({ text: l.text.replace(/\n$/, ''), confidence: l.confidence, words: (l.words || []).map(w => ({ text: w.text, conf: w.confidence })) }))));
  return { lines, text: r.data.text, conf: r.data.confidence };
}
/* full pipeline: image → best-oriented OCR lines */
async function ocr(src, onStep = () => {}) {
  onStep('Preparing photo…', 0.03);
  const img = await loadImage(src); let c = normalise(img, 1600);
  const sk = skewScan(c);
  // rescale so a typical text line is ~TARGET px tall (Tesseract's sweet spot); big "Calories 190" type then stays readable too
  if (sk.lineH > 0) { const f = Math.max(0.3, Math.min(2.5, FuelScan.TARGET / sk.lineH)); if (Math.abs(f - 1) > 0.1) c = normalise(img, Math.min(2600, Math.max(c.width, c.height) * f)); }
  c = rotate(c, -((sk.sideways ? 90 : 0) + sk.angle));
  eraseRules(c, Math.max(40, Math.round(FuelScan.TARGET * 3.2)));
  onStep('Loading reader…', 0.08);
  await engine();
  onStep('Reading label…', 0.15);
  let best = await recognise(c), q = quality(best.lines); const c0 = c;
  // low keyword score → probably upside down or sideways: try the other orientations, keep the best
  for (const turn of [180, 90, 270]) {
    if (q >= 60) break;
    onStep('Trying another angle…', 0.45 + turn / 1000);
    const c2 = rotate(c0, turn), r2 = await recognise(c2), q2 = quality(r2.lines);
    if (q2 > q) { best = r2; q = q2; c = c2; }
  }
  best.quality = q; best.skew = sk; best.size = [c.width, c.height]; best.canvas = c;
  return best;
}

/* ---------- OCR text → label fields ----------
   Robust to OCR noise: bilingual CA lines ("Fat / Lipides 7 g 9 %"), US lines ("Total Fat 7g 9%"), French-only words,
   O/0 l/1 S/5 I/1 confusions, g read as 9/¢/a ("19" = 1 g), mg variants (rng, m9, mq), split decimals ("4 5g"),
   and values on the next/previous line (big US "Calories … 250"). Candidates are checked against the printed %DV and
   against 4·P + 4·C + 9·F ≈ kcal; the chosen text is then run through the app's own parseLabel(). */
const strip = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const WORDS = {   // OCR word → key (accent-stripped, lower case)
  calories: 'kcal', calorie: 'kcal', energy: 'kcal', energie: 'kcal', cal: 'kcal',
  fat: 'fat', lipides: 'fat', lipids: 'fat', saturated: 'satFat', satures: 'satFat', saturates: 'satFat', sat: 'satFat', trans: 'transFat',
  monounsaturated: 'monoFat', monoinsatures: 'monoFat', polyunsaturated: 'polyFat', polyinsatures: 'polyFat',
  cholesterol: 'cholesterol', sodium: 'sodium', carbohydrate: 'carbs', carbohydrates: 'carbs', glucides: 'carbs', carbs: 'carbs',
  fibre: 'fibre', fiber: 'fibre', fibres: 'fibre', fibers: 'fibre', sugars: 'sugars', sugar: 'sugars', sucres: 'sugars',
  protein: 'protein', proteins: 'protein', proteines: 'protein', potassium: 'potassium', calcium: 'calcium', iron: 'iron', fer: 'iron', ron: 'iron', lron: 'iron',
  magnesium: 'magnesium', zinc: 'zinc', phosphorus: 'phosphorus', phosphore: 'phosphorus', folate: 'folate', thiamine: 'thiamin', thiamin: 'thiamin',
  riboflavin: 'riboflavin', riboflavine: 'riboflavin', niacin: 'niacin', niacine: 'niacin', selenium: 'selenium', iodine: 'iodine', iode: 'iodine',
};
const VIT = { a: 'vitA', c: 'vitC', d: 'vitD', e: 'vitE', k: 'vitK', b6: 'b6', b12: 'b12', cc: 'vitC', dd: 'vitD', b1: 'thiamin', b2: 'riboflavin' };
const KEY_TEXT = { kcal: 'calories', fat: 'fat', satFat: 'saturated fat', transFat: 'trans fat', monoFat: 'monounsaturated fat', polyFat: 'polyunsaturated fat', cholesterol: 'cholesterol', sodium: 'sodium',
  carbs: 'carbohydrate', fibre: 'fibre', sugars: 'sugars', addedSugar: 'added sugars', protein: 'protein', potassium: 'potassium', calcium: 'calcium', iron: 'iron', magnesium: 'magnesium', zinc: 'zinc',
  phosphorus: 'phosphorus', folate: 'folate', thiamin: 'thiamin', riboflavin: 'riboflavin', niacin: 'niacin', selenium: 'selenium', iodine: 'iodine',
  vitA: 'vitamin a', vitC: 'vitamin c', vitD: 'vitamin d', vitE: 'vitamin e', vitK: 'vitamin k', b6: 'vitamin b6', b12: 'vitamin b12' };
const MG_KEYS = new Set(['cholesterol', 'sodium', 'potassium', 'calcium', 'iron', 'magnesium', 'zinc', 'phosphorus', 'vitC', 'vitE', 'thiamin', 'riboflavin', 'niacin', 'b6']);
const G_KEYS = new Set(['fat', 'satFat', 'transFat', 'monoFat', 'polyFat', 'carbs', 'fibre', 'sugars', 'addedSugar', 'protein']);
function lev(a, b) { if (Math.abs(a.length - b.length) > 2) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
function wordKey(w) {
  if (WORDS[w]) return WORDS[w];
  if (w.length < 5) return null;
  let best = null, bd = 9; for (const k in WORDS) { if (k.length < 5) continue; const d = lev(w, k); if (d < bd) { bd = d; best = k; } }
  return bd <= (w.length >= 9 ? 2 : 1) ? WORDS[best] : null;
}
const UNIT_RE = /^(mg|m9|rng|mq|mg\.|mcg|meg|ug|µg|μg|pg|g|9|¢|q|%|ml|kj|kcal|cal)$/;
const normUnit = u => !u ? null : /^(mg|m9|rng|mq|mg\.)$/.test(u) ? 'mg' : /^(mcg|meg|ug|µg|μg|pg)$/.test(u) ? 'mcg' : /^(g|¢|q|9)$/.test(u) ? 'g' : u === 'cal' ? 'kcal' : u;
/* tokenise one OCR line into words and numbers {v, raw, unit, conf} */
function lineTokens(line) {
  let t = strip(line.text).replace(/[|\[\]{}\\]/g, ' / ').replace(/([^\d\s])\/|\/([^\d\s])/g, (m, a, b) => (a ? a + ' / ' : ' / ' + b)).replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2').replace(/(\d)\s*%/g, '$1 %').replace(/°/g, ' ');
  t = t.replace(/\bvitamine?\s*([a-e]|k|b\s?\d{1,2})\b/g, (m, x) => ' vit_' + x.replace(/\s/g, '') + ' ');
  const words = t.split(/\s+/).filter(Boolean); const out = [];
  const wc = (line.words || []).map(w => w.conf); let wi = 0;
  for (let i = 0; i < words.length; i++) {
    let w = words[i].replace(/^[(*•:;,"'“”]+|[)*•:;,"'“”]+$/g, ''); if (!w) continue;
    const conf = wc[Math.min(wi++, wc.length - 1)] ?? line.confidence;
    if (w.startsWith('vit_')) { out.push({ k: VIT[w.slice(4)] || null, w }); continue; }
    // number (+unit) token, fixing O/0 l/1 I/1 S/5 B/8 inside numbers
    const m = w.match(/^([0-9oilsb.]*[0-9][0-9oilsb.]*|[oil])(mg|m9|rng|mq|mcg|meg|ug|µg|pg|g|¢|q|%|ml|kj|kcal)?$/);
    if (m && (/\d/.test(m[1]) || m[2])) {
      let raw = m[1].replace(/o/g, '0').replace(/[il]/g, '1').replace(/s/g, '5').replace(/b/g, '8'); let unit = normUnit(m[2]);
      if (words[i + 1] === '%' && /^(daily|valeur|dv|value|of)/.test(words[i + 2] || '')) { out.push({ v: parseFloat(raw), raw, unit, conf, fixed: raw !== m[1] }); i++; continue; }
      let sepFix = false;
      if (!unit && words[i + 1] && UNIT_RE.test(words[i + 1].replace(/[)*.,]+$/, ''))) { const u0 = words[i + 1].replace(/[)*.,]+$/, ''); sepFix = /^(9|¢|q|m9|rng|mq)$/.test(u0); unit = normUnit(u0); i++; }
      if (unit === '%' || (words[i + 1] === '%')) { if (words[i + 1] === '%') i++; out.push({ v: parseFloat(raw), raw, unit: '%', conf }); continue; }
      const prev = out[out.length - 1];   // "4 5g" → 4.5 g (OCR dropped the decimal point)
      if (prev && prev.v != null && !prev.unit && /^\d$/.test(prev.raw) && ((/^\d$/.test(raw) && unit && unit !== '%') || (!unit && /^\d9$/.test(raw)))) { prev.raw = prev.raw + '.' + raw[0]; prev.v = parseFloat(prev.raw); prev.unit = unit || 'g'; prev.fixed = true; continue; }
      if (unit && unit !== '%' && /^0\d$/.test(raw)) { raw = '0.' + raw[1]; out.push({ v: parseFloat(raw), raw, unit, conf, fixed: true }); continue; }
      out.push({ v: parseFloat(raw), raw, unit, conf, fixed: raw !== m[1] || sepFix });
      continue;
    }
    const k = wordKey(w.replace(/[^a-z]/g, '')); out.push({ k, w });
  }
  // modifiers: "added sugars", "saturated fat", "trans fat", "total …"
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    if (a.w && /^(added|ajoutes|includes?)$/.test(a.w)) { const nx = out.slice(i + 1).find(x => x.k); if (nx && nx.k === 'sugars' && a.w !== 'includes' && a.w !== 'include') nx.k = 'addedSugar'; if (nx && nx.k === 'sugars' && /^includ/.test(a.w)) { const nx2 = out.slice(i + 1).find(x => x.w && /^(added|ajoutes)$/.test(x.w)); if (nx2) nx.k = 'addedSugar'; } }
    if (a.k === 'satFat' || a.k === 'transFat' || a.k === 'monoFat' || a.k === 'polyFat') { const nx = out[i + 1]; if (nx && nx.k === 'fat') nx.k = null; }
  }
  return out;
}
const TOL = (v, x) => Math.abs(v - x) <= Math.max(0.6, x * 0.12);
/* candidate values for a key from its number tokens; returns [{v, unit, how, note}] best first */
function candidates(k, nums, ref, DVT) {
  let amt = nums.filter(n => n.unit !== '%'), pct = nums.find(n => n.unit === '%');
  const pcts = nums.filter(n => n.unit === '%');
  if (!amt.length && pcts.length >= 2 && k !== 'kcal') { amt = [Object.assign({}, pcts[0], { unit: null, fixed: true })]; pct = pcts[pcts.length - 1]; }   // "Total Fat 9% 12%": g read as %
  const c = [];
  for (const n of amt) {
    const low = n.conf < 72 || n.fixed;
    if (n.unit === 'g9' || (!n.unit && G_KEYS.has(k) && /9$/.test(n.raw) && n.raw.length >= 2)) {   // g misread as 9
      let r = n.raw.slice(0, -1); if (/^0\d/.test(r)) r = r[0] + '.' + r.slice(1);
      c.push({ v: parseFloat(r), unit: 'g', how: 'assumed', note: `camera read “${n.raw}” — 9 taken as g`, p: n.unit === 'g9' ? 1 : 2 });
      if (n.unit !== 'g9') c.push({ v: n.v, unit: 'g', how: 'assumed', note: 'no unit read', p: 3 });
      continue;
    }
    if (k === 'kcal') { if (!n.unit || n.unit === 'kcal') c.push({ v: n.v, unit: '', how: low ? 'assumed' : 'ok', note: low ? 'camera unsure' : '', p: 1 }); else if (n.unit === 'kj') c.push({ v: n.v, unit: 'kj', how: 'ok', p: 1 }); continue; }
    let unit = n.unit; if (unit === 'g' && MG_KEYS.has(k) && k !== 'iron') unit = 'mg';   // "200 g sodium" is OCR noise for mg
    if (!unit) unit = G_KEYS.has(k) ? 'g' : MG_KEYS.has(k) ? 'mg' : k === 'vitD' || k === 'vitA' || k === 'vitK' || k === 'folate' || k === 'b12' ? 'mcg' : 'g';
    c.push({ v: n.v, unit, how: low || !n.unit ? 'assumed' : 'ok', note: !n.unit ? 'unit not read' : low ? 'camera unsure' : '', p: n.unit ? 1 : 2 });
    if (/^\d\d$/.test(n.raw) && pct && MG_KEYS.has(k)) c.push({ v: n.v * 10, unit, how: 'assumed', note: `camera read “${n.raw}” — a digit looked missing; ×10 matches %DV`, p: 5 });
    if (/^\d\d+$/.test(n.raw) && pct) c.push({ v: n.v / 10, unit, how: 'assumed', note: `camera read “${n.raw}” — decimal point added to match %DV`, p: 4 });
  }
  if (pct && DVT[k] != null && c.length) {   // %DV cross-check picks between candidates
    const want = pct.v / 100 * DVT[k];
    const toDisp = x => x.unit === 'mg' && BYU(k) === 'g' ? x.v / 1000 : x.unit === 'g' && BYU(k) === 'mg' ? x.v * 1000 : x.v;
    c.forEach(x => { const d = Math.abs(toDisp(x) - want); x.dv = d <= Math.max(DVT[k] * 0.012, want * 0.12) ? 1 : 0; });
    c.sort((a, b) => (b.dv - a.dv) || (a.p - b.p));
    if (c[0].dv && c[0].how === 'assumed' && c[0].p > 1) c[0].note += ' · matches %DV';
  } else c.sort((a, b) => a.p - b.p);
  if (!c.length && pct) c.push({ v: pct.v, unit: '%', how: pct.conf < 72 ? 'assumed' : 'dv', note: '', p: 1 });
  return c;
}
const BYU = k => (window.NUTR && NUTR.BY[k] ? NUTR.BY[k].unit : 'g');
function parseOCR(lines, ref = 'CA') {
  const DVT = Object.assign({}, ref === 'US' ? {} : {}, DVREF(ref));
  const L = lines.map(l => ({ l, toks: lineTokens(l), s: strip(l.text) }));
  const found = {}; let serving = null, servingLine = -1;
  // serving: "Per 1 bar (60 g) / pour …", "Serving size 1/2 cup (55g)", "Portion …"
  L.forEach((x, i) => {
    if (serving || /servings?\s*per|portions?\s*par|per container|par contenant/.test(x.s)) return;
    const m = x.s.match(/\b(per|pour|serving size|serving|portion)\b(.*)/); if (!m) return;
    let rest = m[2]; if (!/\d/.test(rest) && L[i + 1] && !L[i + 1].toks.some(t => t.k)) rest += ' ' + L[i + 1].s;
    const par = rest.match(/\(([^)]*)\)/) || rest.match(/(\d[\d\s.,o]*\s*(?:g|9|ml|a)\b)/);
    let g = null, ml = false;
    if (par) { const inner = par[1].replace(/o/g, '0').replace(/\s+/g, ''); const mm = inner.match(/^(\d+(?:[.,]\d+)?)(ml|g|9|a|q)?/); if (mm) { let r = mm[1].replace(',', '.'); if (!mm[2] && /9$/.test(r) && r.length > 1) r = r.slice(0, -1); if (mm[2] === '9' || mm[2] === 'a' || mm[2] === 'q') {} g = parseFloat(r); ml = mm[2] === 'ml'; } }
    if (!g) return;
    let label = rest.split('(')[0].split('/ pour')[0].split(' / ')[0].replace(/[^a-z0-9/ .]/g, ' ').replace(/\b(and|with|then)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^\d+(\.\d+)?\s*(g|ml)$/.test(label)) label = '';
    serving = { g, ml, label, conf: x.l.confidence }; servingLine = i;
  });
  const pending = [];   // keys with no numbers on their line, for next/previous-line values
  L.forEach((x, i) => {
    if (i === servingLine) return;
    if (/or less|ou moins|contributes|calories a day|daily diet|general nutrition|% daily value \(dv\)/.test(x.s)) return;
    const toks = x.toks.filter(t => t.k !== undefined ? t.k : t.v != null);
    // segments: key followed by its numbers; numbers before the first key belong to it if it has none ("Includes 10g Added Sugars")
    const segs = []; let pre = [];
    toks.forEach(t => { if (t.k) { const last = segs[segs.length - 1]; if (last && last.k === t.k) return; segs.push({ k: t.k, nums: [] }); } else if (t.v != null) { if (segs.length) segs[segs.length - 1].nums.push(t); else pre.push(t); } });
    if (segs.length && pre.length && !segs[0].nums.filter(n => n.unit !== '%').length) segs[0].nums.unshift(...pre), pre = [];
    // CA "Saturated / saturés 3 g + Trans / trans 0 g 15 %": the % belongs to sat+trans; keep it on saturated only
    segs.forEach(sg => { if (!sg.nums.length) pending.push({ k: sg.k, i }); else if (found[sg.k] == null) found[sg.k] = { nums: sg.nums, line: i }; });
    if (!segs.length && pre.length) {   // a number-only line: give it to a waiting key on the line just above/below
      const w = pending.find(p => Math.abs(p.i - i) <= 2 && found[p.k] == null);
      if (w) { found[w.k] = { nums: pre, line: i, moved: true }; pending.splice(pending.indexOf(w), 1); }
      else L._orphans = (L._orphans || []).concat([{ nums: pre, i }]);
    }
  });
  (L._orphans || []).forEach(o => { const w = pending.find(p => Math.abs(p.i - o.i) <= 2 && found[p.k] == null); if (w) found[w.k] = { nums: o.nums, line: o.i, moved: true }; });
  // choose values
  const pick = {};
  for (const k in found) { const c = candidates(k, found[k].nums, ref, DVT); if (c.length) pick[k] = { c, i: 0, moved: found[k].moved }; }
  // energy check: try alternative fat/carbs/protein candidates if 4P+4C+9F is far from kcal
  if (pick.kcal && pick.kcal.c[0].unit !== 'kj') {
    const kc = pick.kcal.c[0].v; const mk = ['fat', 'carbs', 'protein'].filter(k => pick[k]);
    const locked = k => { const x = pick[k].c[0]; return x.dv === 1 || (x.how === 'ok' && x.p === 1); };   // a clearly read or %DV-confirmed value is never swapped
    const val = (k, j) => { const x = pick[k].c[j]; return x.unit === 'g' ? x.v : 0; };
    const fib = pick.fibre ? (pick.fibre.c[0].unit === 'g' ? pick.fibre.c[0].v : 0) : 0;
    const err = sel => { const g = k => (pick[k] ? val(k, sel[k]) : 0); const e = 4 * g('protein') + 4 * Math.max(0, g('carbs') - fib) + 2 * fib + 9 * g('fat'); return Math.abs(e - kc); };
    let best = Object.fromEntries(mk.map(k => [k, 0])), be = mk.length === 3 ? err(best) : 0;
    if (be > Math.max(20, kc * 0.2)) {
      const combos = [{}]; mk.forEach(k => { const n = []; combos.forEach(cb => (locked(k) ? [0] : pick[k].c.map((_, j) => j)).forEach(j => n.push(Object.assign({}, cb, { [k]: j })))); combos.splice(0, combos.length, ...n); });
      combos.forEach(cb => { const e = err(cb); if (e < be - 5) { be = e; best = cb; } });
      mk.forEach(k => { if (best[k] !== pick[k].i) { pick[k].i = best[k]; pick[k].c[best[k]].note = (pick[k].c[best[k]].note || '') + ' · fits the calories'; pick[k].c[best[k]].how = 'assumed'; } });
    }
    if (be > Math.max(25, kc * 0.25)) ['fat', 'carbs', 'protein'].forEach(k => { if (pick[k]) { const x = pick[k].c[pick[k].i]; if (x.how === 'ok') { x.how = 'assumed'; x.note = 'calories don’t add up — check'; } } });
  }
  // canonical text → app's own parser (does %DV → amounts, kJ, units)
  const segsOut = []; const meta = {};
  if (serving) segsOut.push(`serving ${serving.label} ${serving.g} ${serving.ml ? 'ml' : 'g'}`.replace(/\s+/g, ' '));
  for (const k in pick) {
    const x = pick[k].c[pick[k].i]; if (!KEY_TEXT[k]) continue;
    segsOut.push(`${KEY_TEXT[k]} ${+(+x.v).toPrecision(4)} ${x.unit === 'kj' ? 'kj' : x.unit === '%' ? 'percent' : x.unit}`.trim()); meta[k] = x;
  }
  const text = segsOut.join(', ');
  const P = F.parseLabel(text, ref);
  for (const k in meta) { const x = meta[k]; if (P.n[k] == null) continue;
    if (x.how === 'assumed') { P.how[k] = 'assumed'; P.notes[k] = [x.note, P.notes[k]].filter(Boolean).join(' · '); }
    else if (x.unit === '%' || P.how[k] === 'dv') P.how[k] = 'dv'; else P.how[k] = 'ok'; }
  if (serving && serving.conf < 70) P.notes._serving = 'camera unsure';
  P.servingLabel = serving && serving.label ? serving.label : P.servingLabel;
  P.unparsed = []; P.canonical = text; P.name = '';
  return P;
}
function DVREF(ref) { const d = F.DV ? F.DV[ref] : null; if (d) return Object.assign({}, ref === 'CA' && F.DV.US ? F.DV.US : {}, d); return {}; }

/* ---------- UI: camera → progress → review ---------- */
function open(opts = {}) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  if (!opts.library) inp.setAttribute('capture', 'environment');
  inp.style.cssText = 'position:fixed;left:-9999px;opacity:0'; document.body.appendChild(inp);
  inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) run(f, opts); };
  inp.addEventListener('cancel', () => inp.remove());
  inp.click();
  engine().catch(() => {});   // warm up the reader while the camera is open
}
async function run(file, opts = {}) {
  const ref = (F.S().settings.dvRef) || 'CA';
  const thumb = URL.createObjectURL(file); let cancelled = false;
  const rec = F.openSheet('Scan label', `<div class="scanprog"><img class="scanthumb big" src="${thumb}" alt="Your photo">
     <div style="flex:1;min-width:0"><b id="scst">Preparing photo…</b><div class="pbar" role="progressbar" aria-label="Reading the label" aria-valuemin="0" aria-valuemax="100"><i id="scbar" style="width:3%"></i></div>
     <div class="tiny mut" id="scsub">Reading happens on this phone — nothing is uploaded.</div></div></div>
     <div id="scerr"></div>`, { onClose: () => { cancelled = true; } });
  const st = (t, f) => { const a = rec.sh.querySelector('#scst'), b = rec.sh.querySelector('#scbar'), pb = rec.sh.querySelector('.pbar'); if (a && t) a.textContent = t; if (b && f != null) { b.style.width = Math.round(f * 100) + '%'; pb.setAttribute('aria-valuenow', Math.round(f * 100)); } };
  let phase = [0.15, 0.95];
  progressCb = m => { if (m.status === 'recognizing text') st(null, phase[0] + (phase[1] - phase[0]) * (m.progress || 0)); else if (/loading|initializ/.test(m.status) && m.progress != null) st('Loading reader (first time only)…', 0.05 + 0.1 * m.progress); };
  try {
    const o = await ocr(file, (t, f) => { st(t, f); if (/another angle/.test(t)) phase = [f, Math.min(0.97, f + 0.3)]; });
    if (cancelled) return;
    st('Done', 1);
    cacheAssets();
    const P = parseOCR(o.lines, ref);
    const nFound = Object.keys(P.n).length;
    if (nFound < 2) {
      rec.sh.querySelector('#scerr').innerHTML = `<div class="unparsed" style="margin-top:14px"><b>Couldn't find a Nutrition Facts table</b>Fill the frame with the label, hold steady, avoid glare — or type it in.</div>
        <div class="grid2" style="margin-top:12px"><button class="btn pri" id="scre">📷 Retake</button><button class="btn" id="sctype">⌨️ Type label</button></div><button class="btn block" id="sclib" style="margin-top:10px">🖼️ Choose from library</button>`;
      rec.sh.querySelector('#scre').onclick = () => { F.closeSheet(rec); open(opts); };
      rec.sh.querySelector('#sclib').onclick = () => { F.closeSheet(rec); open(Object.assign({}, opts, { library: true })); };
      rec.sh.querySelector('#sctype').onclick = () => { F.closeSheet(rec); F.openLabel(); };
      return;
    }
    F.closeSheet(rec);
    review(P, o, thumb, opts);
  } catch (e) {
    if (cancelled) return;
    rec.sh.querySelector('#scerr').innerHTML = `<div class="unparsed" style="margin-top:14px"><b>Couldn't read the photo</b>${F.esc(e.message || String(e))}${navigator.onLine ? '' : ' — the reader downloads once (about 7 MB) the first time, so connect once and try again.'}</div><div class="grid2" style="margin-top:12px"><button class="btn pri" id="scre">📷 Retake</button><button class="btn" id="sctype">⌨️ Type label</button></div>`;
    rec.sh.querySelector('#scre').onclick = () => { F.closeSheet(rec); open(opts); };
    rec.sh.querySelector('#sctype').onclick = () => { F.closeSheet(rec); F.openLabel(); };
  } finally { progressCb = null; }
}
function review(P, o, thumb, opts, ref) {
  const c = F.labelToCustom(P); c.name = ''; if (opts.code) c.code = String(opts.code);
  const text = o.lines.map(l => l.text).filter(t => t.trim()).join('\n');
  F.openCustomFood(c, { title: 'Check & log', primaryLog: true, review: {
    hl: P.how, notes: P.notes, unparsed: [], text: P.canonical, ref: P.ref, servingMissing: !P.servingG, nameMissing: true, code: opts.code,
    scan: { thumb, text, retake: () => open(opts) },
    redo: r => review(parseOCR(o.lines, r), o, thumb, opts),
  } });
}
/* keep the reader for offline use: put the OCR files in the long-lived OCR cache after the first successful read */
function cacheAssets() {
  if (!('caches' in window)) return;
  caches.open('fuel-ocr-v7').then(c => Promise.all(ASSETS().map(u => c.match(u).then(h => h || c.add(u))))).catch(() => {});
}

const FuelScan = { open, run, cacheAssets, TARGET: 18, parseOCR, ocr, engine, normalise, skewScan, ASSETS, BASE };
window.FuelScan = FuelScan;
})();
