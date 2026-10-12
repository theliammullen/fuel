/* Appearance / layout test: every theme × layout, contrast + 44px tap-target audit, main flows, 0 console errors.
   Run: python3 -m http.server 8765 & node test/design.js [quick] */
const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const OUT = '/workspace/nutrition-app/screenshots/design/';
const QUICK = process.argv.includes('quick');
const seed = async p => p.evaluate(async () => {
  await __fuel.loadDB(); const S = __fuel.S();
  const pad = n => String(n).padStart(2, '0'); const ds = o => { const d = new Date(); d.setDate(d.getDate() - o); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const menu = [['breakfast', 'egg whole cooked', 100], ['breakfast', 'oatmeal', 250], ['breakfast', 'blueberries raw', 100], ['breakfast', 'coffee brewed', 350],
    ['lunch', 'chicken breast cooked', 190], ['lunch', 'rice white cooked', 200], ['lunch', 'broccoli cooked', 160], ['snacks', 'yogurt greek plain nonfat', 250], ['snacks', 'banana raw', 120],
    ['dinner', 'salmon atlantic farmed cooked', 140], ['dinner', 'sweet potato baked', 220], ['dinner', 'spinach raw', 80]];
  const mk = (q, g, meal) => { const it = __fuel.searchLocal(q)[0]; const n = {}; for (const k in it.n100) n[k] = +(it.n100[k] * g / 100).toPrecision(4); return { id: Math.random().toString(36).slice(2), key: it.key, name: it.name, sub: it.sub, src: it.src, meal, g: Math.round(g), qty: Math.round(g), unit: 'g', qtyLabel: Math.round(g) + ' g', n, hyd: it.hyd || undefined, por: it.portions, dens: it.dens, t: Date.now() }; };
  for (let o = 6; o >= 0; o--) { const day = S.days[ds(o)] = { entries: [], water: [], training: { on: o % 2 === 0, hours: 1 } };
    menu.forEach(([meal, q, g], i) => { if (o === 0 && i > 8) return; day.entries.push(mk(q, g, meal)); });
    [500, 750, 750, 500].forEach((ml, i) => { if (!(o === 0 && i > 1)) day.water.push({ id: 'w' + o + i, ml, t: Date.now() }); }); }
  S.weights = [{ d: ds(6), lb: 194 }, { d: ds(0), lb: 192.5 }]; S.profile.weightLb = 192.5; S.profile.name = 'Liam';
  const snap = (q, last) => { const it = __fuel.searchLocal(q)[0]; return { key: it.key, name: it.name, sub: it.sub, src: it.src, n100: it.n100, portions: it.portions, dens: it.dens, hyd: it.hyd, last }; };
  S.favs = [snap('yogurt greek plain nonfat'), snap('banana raw')];
  S.recent = [snap('egg whole cooked', { qty: 2, unit: 'p0', meal: 'breakfast' }), snap('chicken breast cooked', { qty: 170, unit: 'g', meal: 'lunch' }), snap('coffee brewed', { qty: 1, unit: 'p0', meal: 'breakfast' })];
  localStorage.setItem('fuel.v1', JSON.stringify(S));
});
const setLook = (p, look) => p.evaluate(l => localStorage.setItem('fuel.look', JSON.stringify(l)), look);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(800);
  await seed(p); await p.reload(); await p.waitForTimeout(1500);
  const shot = async (name, full) => { await p.waitForTimeout(1300); await p.screenshot({ path: OUT + name + '.png', fullPage: !!full }); console.log('shot', name); };
  const audit = async label => p.evaluate(label => {
    // tap targets: every visible interactive element ≥ 44×44 (incl. ::before hit-area extension)
    const small = [];
    document.querySelectorAll('button,[role=button],a,input:not([type=hidden]),select,textarea,summary,label.acc,.tcust label').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || getComputedStyle(el).visibility === 'hidden') return;
      if (el.closest('.hidden') || (el.tagName === 'INPUT' && (el.type === 'color' || el.type === 'date') && getComputedStyle(el).opacity === '0')) return;
      let w = r.width, h = r.height; const be = getComputedStyle(el, '::before');
      if (be.content && be.content !== 'none' && be.position === 'absolute') { const t = parseFloat(be.top) || 0, bo = parseFloat(be.bottom) || 0, l = parseFloat(be.left) || 0, ri = parseFloat(be.right) || 0; h = Math.max(h, h - t - bo); w = Math.max(w, w - l - ri); }
      if (w < 43.5 || h < 43.5) small.push((el.className || el.tagName) + ' ' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20) + ' ' + Math.round(w) + 'x' + Math.round(h));
    });
    // text contrast: sampled text nodes vs resolved background (walks up through solid backgrounds)
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [a[0], a[1], a[2], a[3] == null ? 1 : a[3]]; };
    const lum = c => { const a = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
    const blend = (f, bg) => [0, 1, 2].map(i => f[i] * f[3] + bg[i] * (1 - f[3])).concat(1);
    const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && !/gradient\(.*rgba\(var/.test(cs.backgroundImage) && e !== document.body && e !== document.documentElement) return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } }
      let bg = parse(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)})`)) || [0, 0, 0, 1];
      for (let i = stack.length - 1; i >= 0; i--) bg = blend(stack[i], bg); return bg; };
    const fails = []; const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) { const n = walker.currentNode; if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight * 3) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.color === 'rgba(0, 0, 0, 0)') continue;
      if (/^[\p{Extended_Pictographic}\s●★✦✓✎⋯+]+$/u.test(n.textContent.trim())) continue;
      if (el.closest('svg,.toast,#confetti,.chart,.sw,.lay svg')) continue;
      const bg = bgOf(el); if (!bg) continue; let fg = parse(cs.color); if (!fg) continue;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; fg = blend([fg[0], fg[1], fg[2], fg[3] * op], bg);
      const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
      if (cr < (large ? 3 : 4.5)) fails.push(n.textContent.trim().slice(0, 24) + ' ' + cr.toFixed(2)); }
    return { label, small: [...new Set(small)], fails: [...new Set(fails)] };
  }, label);
  const report = r => { console.log(`[${r.label}] tap<44: ${r.small.length}${r.small.length ? ' → ' + r.small.slice(0, 8).join(' | ') : ''}; contrast fails: ${r.fails.length}${r.fails.length ? ' → ' + r.fails.slice(0, 8).join(' | ') : ''}`); return r.small.length + r.fails.length; };
  let issues = 0;
  // default (tiles, midnight, vivid)
  await shot('tiles-default-top'); issues += report(await audit('tiles midnight'));
  await shot('tiles-default-full', true);
  await p.evaluate(() => window.scrollTo(0, 640)); await shot('tiles-default-scrolled'); await p.evaluate(() => window.scrollTo(0, 0));
  if (!QUICK) {
    const themes = ['midnight', 'graphite', 'ember', 'oled', 'daylight', 'paper'];
    for (const th of themes) { await setLook(p, { theme: th, layout: 'tiles' }); await p.reload(); await shot('theme-' + th + '-tiles'); issues += report(await audit('tiles ' + th)); }
    for (const lay of ['rings', 'cards', 'compact']) for (const th of ['midnight', 'daylight']) {
      await setLook(p, { theme: th, layout: lay }); await p.reload(); await shot('layout-' + lay + '-' + th); issues += report(await audit(lay + ' ' + th)); }
    for (const th of ['graphite', 'ember', 'oled', 'paper']) for (const lay of ['rings', 'cards', 'compact']) { await setLook(p, { theme: th, layout: lay }); await p.reload(); await p.waitForTimeout(900); issues += report(await audit(lay + ' ' + th)); }
    for (const pal of ['neon', 'pastel', 'jewel', 'mono']) { await setLook(p, { theme: 'midnight', layout: 'tiles', palette: pal }); await p.reload(); await shot('palette-' + pal); issues += report(await audit('palette ' + pal)); }
    await setLook(p, { theme: 'daylight', accent: '#ffe600', layout: 'tiles', palette: 'mono' }); await p.reload(); await shot('accent-custom-yellow-daylight'); issues += report(await audit('custom accent yellow daylight'));
    await setLook(p, { theme: 'midnight', layout: 'tiles', density: 'compact' }); await p.reload(); await shot('density-compact-tiles'); issues += report(await audit('compact density'));
    await setLook(p, { theme: 'midnight', layout: 'cards', density: 'compact' }); await p.reload(); await p.waitForTimeout(900); issues += report(await audit('compact density cards'));
    // Settings › Appearance (and switching instantly from it)
    await setLook(p, { theme: 'midnight', layout: 'tiles' }); await p.reload(); await p.waitForTimeout(1200);
    await p.click('[data-act=profile]'); await shot('settings-appearance'); issues += report(await audit('settings'));
    await p.click('.sheet [data-look-theme=daylight]'); await p.waitForTimeout(400);
    console.log('instant theme ->', await p.evaluate(() => document.documentElement.dataset.theme)); await shot('settings-appearance-daylight');
    await p.click('.sheet [data-look-layout=rings]'); await p.waitForTimeout(300);
    console.log('layout ->', await p.evaluate(() => document.documentElement.dataset.layout + ' rings rendered:' + !!document.querySelector('#app .ringwrap')));
    await p.click('.sheet [data-look-theme=midnight]'); await p.click('.sheet [data-look-layout=tiles]');
    await p.click('#lookMotion'); console.log('motion ->', await p.evaluate(() => document.documentElement.dataset.motion));
    await p.click('#lookMotion');
    await p.evaluate(() => document.querySelector('.sheet details').open = true); await p.evaluate(() => document.querySelector('.sheet .tcust').scrollIntoView());
    await shot('settings-appearance-tiles-custom');
    // back behaviour: history back closes the sheet
    await p.goBack(); await p.waitForTimeout(600); console.log('sheets after back:', await p.$$eval('.sheet', x => x.length), 'url still app:', p.url());
    // palette button → appearance sheet; Escape closes
    await p.click('[data-act=appearance]'); await p.waitForTimeout(500); await shot('appearance-sheet'); issues += report(await audit('appearance sheet'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(600); console.log('sheets after Esc:', await p.$$eval('.sheet', x => x.length));
    // flows: FAB hub → water, My item one-tap, voice log, label
    await p.click('#fab'); await p.waitForTimeout(600); await shot('quick-log-hub'); issues += report(await audit('fab hub'));
    await p.click('.sheet [data-water]'); await p.waitForTimeout(700); console.log('sheets after water:', await p.$$eval('.sheet.on', x => x.length));
    const n0 = await p.evaluate(() => { const S = __fuel.S(); return S.days[Object.keys(S.days).sort().pop()].entries.length; });
    await p.click('#app .qi >> nth=0'); await p.waitForTimeout(900);
    const n1 = await p.evaluate(() => { const S = __fuel.S(); return S.days[Object.keys(S.days).sort().pop()].entries.length; });
    console.log('one-tap My item logged:', n1 === n0 + 1); await shot('tiles-after-one-tap');
    await p.click('#app [data-act=voice]'); await p.waitForTimeout(500); await p.fill('#vtxt', '2 eggs and a black coffee'); await p.click('#vgo'); await p.waitForTimeout(1500);
    await shot('voice-review'); issues += report(await audit('review')); await p.click('#rapprove'); await p.waitForTimeout(1200);
    await p.click('#app [data-act=label]'); await p.waitForTimeout(500); await p.click('#lex'); await p.click('#lgo'); await p.waitForTimeout(800); await shot('label-review'); await p.click('.sheet [data-close]'); await p.waitForTimeout(500);
    for (const tab of ['nutrients', 'progress', 'awards']) { await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(900); issues += report(await audit(tab)); }
    await setLook(p, { theme: 'daylight' }); await p.reload(); await p.waitForTimeout(900);
    for (const tab of ['nutrients', 'progress', 'awards']) { await p.click(`[data-tab=${tab}]`); await p.waitForTimeout(900); issues += report(await audit(tab + ' daylight')); }
    await shot('daylight-awards');
    // reduce motion via OS setting
    const c2 = await b.newContext({ viewport: { width: 393, height: 852 }, reducedMotion: 'reduce' }); const p2 = await c2.newPage();
    p2.on('pageerror', e => errs.push('pageerror ' + e.message)); p2.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    await p2.goto('http://127.0.0.1:8765/'); await p2.waitForTimeout(800); console.log('OS reduce-motion respected:', await p2.evaluate(() => document.documentElement.dataset.motion));
    // no flash: theme attribute already set at DOMContentLoaded
    await p2.evaluate(() => localStorage.setItem('fuel.look', JSON.stringify({ theme: 'paper' })));
    await p2.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { window.__firstTheme = document.documentElement.dataset.theme + '|' + getComputedStyle(document.body).backgroundColor; }));
    await p2.reload(); await p2.waitForTimeout(500); console.log('theme at first paint:', await p2.evaluate(() => window.__firstTheme));
  }
  console.log('ISSUES', issues, 'CONSOLE ERRORS', errs.length, errs.slice(0, 10));
  await b.close();
})();
