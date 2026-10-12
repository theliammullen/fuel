/* Fuel — Settings › Appearance UI (themes, accent, Today layout, tile colours, density, motion).
   Pure UI over window.FuelTheme (js/theme-boot.js). Everything persists on-device in localStorage('fuel.look'). */
(function () {
'use strict';
var F = window.FuelTheme; if (!F) return;
var ACCENTS = ['#7c5cff', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899'];
var LAYOUTS = [
  ['tiles', 'Tiles', '<svg viewBox="0 0 44 44"><rect x="4" y="4" width="17" height="17" rx="4" fill="#16a34a"/><rect x="23" y="4" width="17" height="17" rx="4" fill="#7c3aed"/><rect x="4" y="23" width="36" height="8" rx="3" fill="#ea580c"/><rect x="4" y="33" width="17" height="7" rx="3" fill="#e11d48"/><rect x="23" y="33" width="17" height="7" rx="3" fill="#0284c7"/></svg>'],
  ['rings', 'Rings', '<svg viewBox="0 0 44 44" fill="none" stroke-width="4" stroke-linecap="round"><circle cx="22" cy="22" r="17" stroke="#ff7a59" stroke-dasharray="80 200"/><circle cx="22" cy="22" r="11" stroke="#34d399" stroke-dasharray="50 200"/><circle cx="22" cy="22" r="5" stroke="#ffd166" stroke-dasharray="22 200"/></svg>'],
  ['cards', 'Cards', '<svg viewBox="0 0 44 44" fill="currentColor" opacity=".75"><rect x="4" y="5" width="17" height="15" rx="4"/><rect x="23" y="5" width="17" height="15" rx="4"/><rect x="4" y="24" width="17" height="15" rx="4"/><rect x="23" y="24" width="17" height="15" rx="4"/></svg>'],
  ['compact', 'Compact', '<svg viewBox="0 0 44 44" fill="currentColor" opacity=".75"><rect x="4" y="7" width="36" height="5" rx="2.5"/><rect x="4" y="16" width="28" height="5" rx="2.5"/><rect x="4" y="25" width="33" height="5" rx="2.5"/><rect x="4" y="34" width="22" height="5" rx="2.5"/></svg>'],
];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function themeSwatch(id, T, on) {
  var bg = T ? T.bg : 'linear-gradient(135deg,#0b0c14 50%,#eef0f6 50%)', fg = T ? T.text : '#f4f5fb', acc = T ? T.accent : '#7c5cff', sf = T ? T.surface : '#161827';
  return '<button class="sw' + (on ? ' on' : '') + '" data-look-theme="' + id + '" aria-pressed="' + on + '" style="background:' + bg + ';color:' + fg + '">' +
    '<b' + (T ? '' : ' style="color:#fff;text-shadow:0 1px 3px #000"') + '>' + (T ? esc(T.name) : 'Auto') + '</b><span class="dots"><i style="background:' + acc + '"></i><i style="background:' + sf + '"></i><i style="background:' + fg + '"></i></span></button>';
}
function section() {
  var L = F.load(), C = F.compute(L), html = '';
  html += '<div class="card" id="lookcard"><h2>Appearance</h2>';
  html += '<div class="field"><label>Theme</label><div class="swatches">' + themeSwatch('auto', null, L.theme === 'auto');
  Object.keys(F.THEMES).forEach(function (id) { if (!F.THEMES[id].family) html += themeSwatch(id, F.THEMES[id], L.theme === id); });
  Object.keys(F.FAMILIES).forEach(function (fid) { var on = L.theme === fid;
    html += '<button class="sw kit' + (on ? ' on' : '') + '" data-look-theme="' + fid + '" aria-pressed="' + on + '"><b>' + esc(F.FAMILIES[fid].name) + '</b><span class="dots"><i style="background:' + F.THEMES[F.FAMILIES[fid].light].accent + '"></i><i style="background:' + F.THEMES[F.FAMILIES[fid].dark].accent + '"></i><i style="background:#c9a24a"></i></span></button>'; });
  html += '</div>';
  if (F.FAMILIES[L.theme]) {
    var km = L.kitchenMode || 'auto';
    html += '<div class="prow" style="margin-top:10px"><div><b style="font-size:14px">' + esc(F.FAMILIES[L.theme].name) + ' mode</b><div class="mut small">' + (km === 'auto' ? 'Auto follows your iPhone’s Light/Dark setting · now ' + (C.mode === 'dark' ? 'Dark' : 'Light') : km === 'light' ? 'Pale oak & maple, cream stone, brass' : 'Walnut & smoked oak, charcoal stone, amber') + '</div></div></div>' +
      '<div class="seg" id="lookKitMode" role="radiogroup" aria-label="Kitchen mode">' + [['light', '☀️ Light'], ['dark', '🌙 Dark'], ['auto', '◐ Auto']].map(function (m) { return '<button role="radio" aria-checked="' + (km === m[0]) + '" data-look-kit="' + m[0] + '" class="' + (km === m[0] ? 'on' : '') + '">' + m[1] + '</button>'; }).join('') + '</div>';
  }
  html += '</div>';
  html += '<div class="field"><label>Accent colour</label><div class="accs"><button class="acc' + (!L.accent ? ' on' : '') + '" data-look-acc="" aria-label="Theme default" style="background:' + F.onColor(C.theme.accent).fill + '"><span style="font-size:10px;font-weight:800;color:' + F.onColor(C.theme.accent).on + '">AUTO</span></button>';
  ACCENTS.forEach(function (a) { html += '<button class="acc' + (L.accent === a ? ' on' : '') + '" data-look-acc="' + a + '" aria-label="Accent ' + a + '" style="background:' + a + '"></button>'; });
  var custom = L.accent && ACCENTS.indexOf(L.accent) < 0;
  html += '<label class="acc' + (custom ? ' on' : '') + '" aria-label="Custom accent" style="background:' + (custom ? L.accent : 'conic-gradient(#f43f5e,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#f43f5e)') + '"><input type="color" id="lookAccPick" value="' + (L.accent || C.theme.accent) + '"></label></div>';
  html += '<div class="tiny mut" style="margin-top:6px">Text on accent switches between white and dark automatically, and accent text is tuned to stay readable (WCAG AA) on this theme.</div></div>';
  html += '<div class="field"><label>Today layout</label><div class="lays">';
  LAYOUTS.forEach(function (l) { html += '<button class="lay' + (L.layout === l[0] ? ' on' : '') + '" data-look-layout="' + l[0] + '" aria-pressed="' + (L.layout === l[0]) + '">' + l[2] + l[1] + '</button>'; });
  html += '</div></div>';
  html += '<div class="field"><label>Tile colours</label><div class="swatches">';
  Object.keys(F.PALETTES).forEach(function (id) {
    var P = F.PALETTES[id], tc = F.compute(Object.assign({}, L, { palette: id, tiles: {} })).tiles, on = C.palette === id;
    html += '<button class="sw' + (on ? ' on' : '') + '" data-look-pal="' + id + '" aria-pressed="' + on + '" style="background:var(--surface2);color:var(--text)"><b>' + esc(P.name) + (on && !L.palette ? ' <span class="tiny mut" style="font-weight:600">· default</span>' : '') + '</b><span class="dots">' +
      ['say', 'kcal', 'protein', 'water', 'carbs'].map(function (k) { return '<i style="background:' + tc[k].fill + '"></i>'; }).join('') + '</span></button>';
  });
  html += '</div><details style="margin-top:10px"' + (Object.keys(L.tiles || {}).length ? ' open' : '') + '><summary class="mut small" style="padding:10px 0;font-weight:700;min-height:44px">Customise each tile</summary><div class="tcust">';
  F.TILE_KEYS.forEach(function (tk) { var t = C.tiles[tk[0]]; html += '<label style="background:' + t.fill + ';color:' + t.on + '">' + esc(tk[1]) + (L.tiles && L.tiles[tk[0]] ? ' ✎' : '') + '<input type="color" data-look-tile="' + tk[0] + '" value="' + t.fill + '"></label>'; });
  html += '</div><button class="btn block" id="lookTileReset" style="margin-top:8px">Reset tile colours</button><div class="tiny mut" style="margin-top:6px">Any colour works: Fuel picks white or dark text and nudges the shade if needed to keep AA contrast.</div></details></div>';
  html += '<div class="field"><label>Card density</label><div class="seg" id="lookDensity"><button data-look-density="comfortable" class="' + (L.density !== 'compact' ? 'on' : '') + '">Comfortable</button><button data-look-density="compact" class="' + (L.density === 'compact' ? 'on' : '') + '">Compact</button></div></div>';
  var sys = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  html += '<div class="prow"><div><b style="font-size:14px">Reduce motion</b><div class="mut small">' + (L.motion == null ? (sys ? 'On — following your device setting' : 'Following your device setting') : 'Set manually · <button class="r" id="lookMotionSys" style="color:var(--acc-text);font-weight:700;min-height:44px">use device setting</button>') + '</div></div><button class="switch' + (C.reduce ? ' on' : '') + '" id="lookMotion" role="switch" aria-checked="' + C.reduce + '" aria-label="Reduce motion"></button></div>';
  html += '<button class="btn block" id="lookReset" style="margin-top:8px">Reset appearance</button></div>';
  return html;
}
/* bind controls inside `root`; cb(patch) after each change (the app re-renders Today on layout changes) */
function bind(root, cb) {
  var redraw = function (patch) {
    F.save(patch);
    var card = root.querySelector('#lookcard'); if (card) { var open = card.querySelector('details') && card.querySelector('details').open; var tmp = document.createElement('div'); tmp.innerHTML = section(); var nc = tmp.firstChild; if (open && nc.querySelector('details')) nc.querySelector('details').open = true; card.replaceWith(nc); }
    wire(); if (cb) cb(patch);
  };
  var on = function (sel, ev, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) { el['on' + ev] = function (e) { fn(el, e); }; }); };
  function wire() {
    on('[data-look-theme]', 'click', function (el) { redraw({ theme: el.dataset.lookTheme }); });
    on('[data-look-acc]', 'click', function (el) { redraw({ accent: el.dataset.lookAcc || null }); });
    on('#lookAccPick', 'input', function (el) { F.save({ accent: el.value }); });
    on('#lookAccPick', 'change', function (el) { redraw({ accent: el.value }); });
    on('[data-look-kit]', 'click', function (el) { redraw({ kitchenMode: el.dataset.lookKit }); });
    on('[data-look-layout]', 'click', function (el) { redraw({ layout: el.dataset.lookLayout }); });
    on('[data-look-pal]', 'click', function (el) { var id = el.dataset.lookPal; redraw({ palette: id === (F.THEMES[F.themeId(F.load())].palette || 'vivid') ? null : id, tiles: {} }); });
    on('[data-look-tile]', 'change', function (el) { var t = Object.assign({}, F.load().tiles); t[el.dataset.lookTile] = el.value; redraw({ tiles: t }); });
    on('#lookTileReset', 'click', function () { redraw({ tiles: {} }); });
    on('[data-look-density]', 'click', function (el) { redraw({ density: el.dataset.lookDensity }); });
    on('#lookMotion', 'click', function () { redraw({ motion: !F.compute().reduce }); });
    on('#lookMotionSys', 'click', function () { redraw({ motion: null }); });
    on('#lookReset', 'click', function () { redraw(JSON.parse(JSON.stringify(F.DEF))); });
  }
  wire();
}
window.FuelLook = { section: section, bind: bind, layout: function () { return F.load().layout || 'tiles'; }, reduced: F.reduced };
})();
