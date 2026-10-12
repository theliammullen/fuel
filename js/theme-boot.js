/* Fuel appearance core — loaded synchronously in <head> so the theme is applied before first paint (no flash).
   Owns: theme palettes, tile palettes, accent maths (WCAG contrast), and apply(). UI lives in js/appearance.js. */
(function () {
'use strict';
var KEY = 'fuel.look';
var DEF = { theme: 'midnight', accent: null, layout: 'tiles', density: 'comfortable', motion: null, palette: 'vivid', tiles: {} };
/* ---- colour maths ---- */
function hex2rgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? [0, 0, 0] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
function lum(h) { var c = typeof h === 'string' ? hex2rgb(h) : h; var a = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); return rgb2hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
function rgb2hsl(h) { var c = hex2rgb(h).map(function (v) { return v / 255; }); var mx = Math.max.apply(0, c), mn = Math.min.apply(0, c), l = (mx + mn) / 2, s = 0, hh = 0, d = mx - mn;
  if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === c[0] ? (c[1] - c[2]) / d + (c[1] < c[2] ? 6 : 0) : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; hh *= 60; }
  return [hh, s, l]; }
function hsl2hex(h, s, l) { h = ((h % 360) + 360) % 360; var f = function (n) { var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return rgb2hex([f(0), f(8), f(4)]); }
/* move colour lightness until it reaches `min` contrast against every bg in `bgs` */
function ensure(col, bgs, min) {
  var hsl = rgb2hsl(col), ok = function (c) { return bgs.every(function (b) { return contrast(c, b) >= min; }); };
  if (ok(col)) return col;
  var dark = bgs.every(function (b) { return lum(b) < 0.2; });
  for (var i = 1; i <= 40; i++) { var l = Math.max(0, Math.min(1, hsl[2] + (dark ? 1 : -1) * i * 0.02)); var c = hsl2hex(hsl[0], hsl[1], l); if (ok(c)) return c; }
  return dark ? '#ffffff' : '#000000';
}
var INK = '#0b0d14', WHITE = '#ffffff';
/* text colour for a filled colour; nudges the fill if neither ink passes AA (also for 86% opacity secondary text) */
function onColor(fill) {
  var sc = function (f, ink) { return Math.min(contrast(ink, f), contrast(mix(f, ink, 0.86), f)); };
  var hsl = rgb2hsl(fill), i, c;
  // prefer white ink (bold, Xbox-like) if a small darkening gets it to AA
  if (sc(fill, WHITE) >= 4.5) return { fill: fill, on: WHITE };
  for (i = 1; i <= 8; i++) { c = hsl2hex(hsl[0], hsl[1], Math.max(0, hsl[2] - i * 0.015)); if (sc(c, WHITE) >= 4.5) return { fill: c, on: WHITE }; }
  if (sc(fill, INK) >= 4.5) return { fill: fill, on: INK };
  for (i = 1; i <= 40; i++) { c = hsl2hex(hsl[0], hsl[1], Math.min(1, hsl[2] + i * 0.015)); if (sc(c, INK) >= 4.5) return { fill: c, on: INK }; }
  return { fill: fill, on: contrast(WHITE, fill) > contrast(INK, fill) ? WHITE : INK };
}
/* ---- themes ---- */
var DARK_SEM = { good: '#6ee7b7', gold: '#ffd166', warn: '#ffc970', bad: '#ff8fa0', cyan: '#67e8f9', violet: '#c4b5fd', kKcal: '#ff9a7a', kPro: '#6ee7b7', kCarb: '#ffd166', kFat: '#c4b5fd', water: '#a5e4ff' };
var LIGHT_SEM = { good: '#047857', gold: '#8a5a00', warn: '#9a4d00', bad: '#be123c', cyan: '#0e7490', violet: '#6d28d9', kKcal: '#c2410c', kPro: '#047857', kCarb: '#8a5a00', kFat: '#6d28d9', water: '#075985' };
var THEMES = {
  midnight: { name: 'Midnight', mode: 'dark', bg: '#0b0c14', surface: '#161827', surface2: '#202338', text: '#f4f5fb', mut: '#a9b0cc', dim: '#9097b6', accent: '#7c5cff', glow: 0.5 },
  graphite: { name: 'Graphite', mode: 'dark', bg: '#121314', surface: '#1e1f21', surface2: '#2a2b2e', text: '#f5f5f6', mut: '#b4b6bb', dim: '#9a9ca3', accent: '#3b82f6', glow: 0 },
  ember:    { name: 'Ember', mode: 'dark', bg: '#140d0b', surface: '#231715', surface2: '#30211d', text: '#fbf3ee', mut: '#cdb6ab', dim: '#b09a90', accent: '#ff7a45', glow: 0.35 },
  oled:     { name: 'OLED Black', mode: 'dark', bg: '#000000', surface: '#0e0e10', surface2: '#1a1a1d', text: '#ffffff', mut: '#ababb3', dim: '#93939b', accent: '#22d3ee', glow: 0 },
  daylight: { name: 'Daylight', mode: 'light', bg: '#eef0f6', surface: '#ffffff', surface2: '#e4e7f0', text: '#0f1222', mut: '#464d6b', dim: '#575e7a', accent: '#5b3df5', glow: 0.25 },
  paper:    { name: 'Paper', mode: 'light', bg: '#f4eee4', surface: '#fffdf8', surface2: '#ebe2d3', text: '#1d1712', mut: '#574b41', dim: '#665a50', accent: '#c2410c', glow: 0 },
};
/* ---- tile palettes (Today "Tiles" layout) ---- */
var TILE_KEYS = [['say', 'Say it'], ['label', 'Read the label'], ['kcal', 'Calories'], ['protein', 'Protein'], ['water', 'Water'], ['carbs', 'Carbs'], ['fat', 'Fat'], ['items', 'My items'], ['micro', 'Micros'], ['score', 'Score'], ['focus', 'Focus nutrients']];
var PALETTES = {
  vivid:  { name: 'Vivid', c: { say: '#16a34a', label: '#7c3aed', kcal: '#ea580c', protein: '#e11d48', water: '#0284c7', carbs: '#facc15', fat: '#c026d3', items: '#0f766e', micro: '#4f46e5', score: '#a3e635', focus: '#334155' } },
  neon:   { name: 'Neon', c: { say: '#22c55e', label: '#a855f7', kcal: '#fb923c', protein: '#fb7185', water: '#38bdf8', carbs: '#fde047', fat: '#e879f9', items: '#2dd4bf', micro: '#818cf8', score: '#bef264', focus: '#94a3b8' } },
  pastel: { name: 'Pastel', c: { say: '#86efac', label: '#c4b5fd', kcal: '#fdba74', protein: '#fda4af', water: '#7dd3fc', carbs: '#fde68a', fat: '#f0abfc', items: '#5eead4', micro: '#a5b4fc', score: '#d9f99d', focus: '#cbd5e1' } },
  jewel:  { name: 'Jewel', c: { say: '#166534', label: '#5b21b6', kcal: '#9a3412', protein: '#9f1239', water: '#075985', carbs: '#854d0e', fat: '#86198f', items: '#115e59', micro: '#3730a3', score: '#3f6212', focus: '#1e293b' } },
  mono:   { name: 'Accent', c: null },
};
function load() { var o = {}; try { o = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {} var r = {}; for (var k in DEF) r[k] = o[k] == null ? (typeof DEF[k] === 'object' && DEF[k] ? {} : DEF[k]) : o[k]; if (!THEMES[r.theme] && r.theme !== 'auto') r.theme = DEF.theme; if (!PALETTES[r.palette]) r.palette = DEF.palette; return r; }
var mqDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
var mqMotion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
function themeId(L) { return L.theme === 'auto' ? (mqDark && !mqDark.matches ? 'daylight' : 'midnight') : L.theme; }
function tilesFor(L, T, acc) {
  var src = PALETTES[L.palette] && PALETTES[L.palette].c, out = {};
  TILE_KEYS.forEach(function (tk, i) {
    var k = tk[0], c = (L.tiles && L.tiles[k]) || (src ? src[k] : null);
    if (!c) { var h = rgb2hsl(acc); c = hsl2hex(h[0] + (i * 29) % 120 - 40, Math.max(0.45, h[1]), 0.36 + (i % 4) * 0.08); }
    out[k] = onColor(c);
  });
  return out;
}
function compute(L) {
  L = L || load();
  var id = themeId(L), T = THEMES[id], dark = T.mode === 'dark', S = dark ? DARK_SEM : LIGHT_SEM;
  var acc = /^#[0-9a-f]{6}$/i.test(L.accent || '') ? L.accent : T.accent;
  var accText = ensure(acc, [T.bg, T.surface, T.surface2], 4.5);
  var h = rgb2hsl(acc), acc2 = hsl2hex(h[0] + 32, h[1], h[2]);
  // primary button / FAB gradient: both stops must give AA with the chosen ink
  var b1 = onColor(acc), b2fill = b1.on === WHITE ? ensure(acc2, [WHITE], 4.5) : ensure(acc2, [INK], 4.5);
  if (contrast(b1.on, b2fill) < 4.5) b2fill = b1.fill;
  var tiles = tilesFor(L, T, acc);
  var fg = dark ? '255,255,255' : '15,23,42';
  var v = {
    '--bg': T.bg, '--bg2': T.surface, '--surface': T.surface, '--surface2': T.surface2, '--text': T.text, '--mut': T.mut, '--dim': T.dim,
    '--fg-rgb': fg, '--line': 'rgba(' + fg + ',' + (dark ? '.08' : '.10') + ')', '--panel': 'rgba(' + fg + ',.055)', '--panel2': 'rgba(' + fg + ',.085)',
    '--acc': acc, '--acc-rgb': hex2rgb(acc).join(','), '--acc-text': accText, '--acc2': acc2, '--btn1': b1.fill, '--btn2': b2fill, '--on-acc': b1.on,
    '--a1': acc, '--a2': accText, '--grad': 'linear-gradient(135deg,' + acc + ' 0%,' + acc2 + ' 100%)', '--grad-btn': 'linear-gradient(135deg,' + b1.fill + ',' + b2fill + ')',
    '--glow': String(T.glow), '--sheet': dark ? mix(T.surface, T.bg, 0.35) : T.surface, '--tabbar': dark ? 'rgba(' + hex2rgb(T.surface).join(',') + ',.82)' : 'rgba(255,255,255,.86)',
    '--toast': dark ? 'rgba(' + hex2rgb(T.surface2).join(',') + ',.96)' : 'rgba(255,255,255,.97)', '--shadow': dark ? 'rgba(0,0,0,.45)' : 'rgba(15,23,42,.12)',
    '--s-good': S.good, '--s-gold': S.gold, '--s-warn': S.warn, '--s-bad': S.bad, '--s-cyan': S.cyan, '--s-violet': S.violet, '--s-water': S.water,
    '--k-kcal': S.kKcal, '--k-pro': S.kPro, '--k-carb': S.kCarb, '--k-fat': S.kFat,
  };
  ['--s-good', '--s-gold', '--s-warn', '--s-bad', '--s-cyan', '--s-violet', '--s-water', '--k-kcal', '--k-pro', '--k-carb', '--k-fat'].forEach(function (k) { v[k] = ensure(v[k], [T.bg, T.surface, T.surface2], 4.6); });
  TILE_KEYS.forEach(function (tk) { v['--t-' + tk[0]] = tiles[tk[0]].fill; v['--t-' + tk[0] + '-on'] = tiles[tk[0]].on; });
  var reduce = L.motion == null ? !!(mqMotion && mqMotion.matches) : !!L.motion;
  return { L: L, id: id, theme: T, mode: T.mode, vars: v, reduce: reduce, tiles: tiles };
}
function apply(L) {
  var C = compute(L), de = document.documentElement, st = de.style;
  for (var k in C.vars) st.setProperty(k, C.vars[k]);
  de.setAttribute('data-theme', C.id); de.setAttribute('data-mode', C.mode);
  de.setAttribute('data-layout', C.L.layout || 'tiles'); de.setAttribute('data-density', C.L.density || 'comfortable');
  de.setAttribute('data-motion', C.reduce ? 'reduce' : 'full');
  st.colorScheme = C.mode;
  var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', C.theme.bg);
  return C;
}
function save(patch) { var L = load(); for (var k in patch) L[k] = patch[k]; try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) {} return apply(L); }
var listeners = [];
function onSystem() { var L = load(); if (L.theme === 'auto' || L.motion == null) { apply(L); listeners.forEach(function (f) { f(); }); } }
[mqDark, mqMotion].forEach(function (mq) { if (mq) (mq.addEventListener ? mq.addEventListener('change', onSystem) : mq.addListener(onSystem)); });
var TONE = { vivid: 0.42, neon: 0.6, pastel: 0.8, jewel: 0.28 };
/* colour for a "focus nutrient" tile, derived from the nutrient's own hue so each tile differs, toned to the palette */
function nutrientTile(hex) { var L = load(); if ((L.tiles && L.tiles.focus) || !TONE[L.palette]) return null; var h = rgb2hsl(hex); return onColor(hsl2hex(h[0], Math.max(0.65, h[1]), TONE[L.palette])); }
window.FuelTheme = { nutrientTile: nutrientTile, KEY: KEY, DEF: DEF, THEMES: THEMES, PALETTES: PALETTES, TILE_KEYS: TILE_KEYS, load: load, save: save, apply: apply, compute: compute,
  contrast: contrast, onColor: onColor, ensure: ensure, mix: mix, onChange: function (f) { listeners.push(f); },
  reduced: function () { return document.documentElement.getAttribute('data-motion') === 'reduce'; } };
apply();
})();
