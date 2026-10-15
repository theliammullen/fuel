// OCR field accuracy on rendered + distorted labels. node test/ocr/accuracy.js [filter] [--webkit]
const pw = require('/workspace/pwtest/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const URL_ = process.env.FUEL_URL || 'http://127.0.0.1:8765/';
const T = require('./truth.json'); const filt = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
(async () => {
  const webkit = process.argv.includes('--webkit');
  const b = webkit ? await pw.webkit.launch() : await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL_); await p.waitForTimeout(1200);
  const by = {}; const rows = []; let tot = 0, ok = 0, wrong = 0, miss = 0;
  for (const id of Object.keys(T).filter(k => k.includes(filt) || T[k].variant === filt)) {
    const t = T[id]; const ref = t.fmt === 'us' ? 'US' : 'CA'; const t0 = Date.now();
    const r = await p.evaluate(async ([f, ref]) => { const blob = await (await fetch('test/ocr/img/' + f)).blob(); const o = await FuelScan.ocr(blob); const P = FuelScan.parseOCR(o.lines, ref); return { n: P.n, servingG: P.servingG, how: P.how, canon: P.canonical, raw: o.lines.map(l => l.text).join(' ⏎ ') }; }, [t.file, ref]);
    const ms = Date.now() - t0; let fo = 0, fw = 0, fm = 0; const bad = [];
    for (const [k, v] of Object.entries(t.truth)) {
      const got = k === 'servingG' ? r.servingG : r.n[k];
      if (got == null) { fm++; bad.push(k + ' missing'); }
      else if (Math.abs(got - v) <= Math.max(0.051, v * 0.05)) fo++;
      else { fw++; bad.push(`${k} ${+(+got).toFixed(2)}≠${v}${r.how[k] && r.how[k] !== 'ok' ? '(' + r.how[k] + ')' : '(GREEN)'}`); }
    }
    const n = Object.keys(t.truth).length; tot += n; ok += fo; wrong += fw; miss += fm;
    const v = t.variant; by[v] = by[v] || { n: 0, ok: 0, wrong: 0, miss: 0, imgs: 0, perfect: 0, ms: 0 }; Object.assign(by[v], { n: by[v].n + n, ok: by[v].ok + fo, wrong: by[v].wrong + fw, miss: by[v].miss + fm, imgs: by[v].imgs + 1, perfect: by[v].perfect + (fo === n), ms: by[v].ms + ms });
    rows.push({ id, acc: fo / n, bad, ms }); console.log(`${(fo / n * 100).toFixed(0).padStart(3)}%  ${id.padEnd(28)} ${ms}ms  ${bad.join(', ')}`);
    if (process.env.RAW && fo < n) console.log('    RAW: ' + r.raw.slice(0, 900) + '\n    CANON: ' + r.canon);
  }
  console.log('\nvariant   images  perfect  field-accuracy  wrong  missing  avg ms');
  for (const [v, s] of Object.entries(by)) console.log(`${v.padEnd(9)} ${String(s.imgs).padStart(6)} ${String(s.perfect).padStart(8)}  ${(s.ok / s.n * 100).toFixed(1).padStart(13)}%  ${String(s.wrong).padStart(5)}  ${String(s.miss).padStart(7)}  ${Math.round(s.ms / s.imgs)}`);
  console.log(`ALL: ${(ok / tot * 100).toFixed(1)}% of ${tot} fields (wrong ${wrong}, missing ${miss})  ERRS`, errs);
  fs.writeFileSync(path.join(__dirname, 'report' + (webkit ? '-webkit' : '') + '.json'), JSON.stringify({ by, rows, ok, tot, wrong, miss }, null, 1));
  await b.close();
})();
