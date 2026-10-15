// Renders realistic Canadian (2022 + pre-2022) and US (2016) Nutrition Facts panels to PNG with ground truth.
// node test/ocr/render.js  → test/ocr/img/*.png + truth.json
const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const P = require('./labels.js');
const OUT = path.join(__dirname, 'img'); fs.mkdirSync(OUT, { recursive: true });
const pc = (v, dv) => Math.round(v / dv * 100);
const n = v => String(v);
const fr = v => String(v).replace('.', ','); // French decimal comma appears on some CA labels; we keep '.' in English column
const CSS = `body{margin:0;background:#fff}.lab{display:inline-block;margin:24px;padding:6px 8px 8px;border:2px solid #000;font-family:FONT;color:#000;width:WIDTHpx;background:#fff}
 h1{font-size:30px;font-weight:900;margin:0;line-height:1.05;letter-spacing:-.5px}.r{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #000;padding:2px 0;font-size:15px}
 .th{border-top:8px solid #000}.md{border-top:4px solid #000}.in{padding-left:14px}.in2{padding-left:28px}.b{font-weight:800}.cal{font-size:30px;font-weight:900}.sm{font-size:11px;line-height:1.25}.nb{border:0}`;
function ca(p) {
  const s = p.per;
  const u = p.ml ? 'mL' : 'g';
  return `<div class="lab"><h1>Nutrition Facts</h1><h1>Valeur nutritive</h1>
  <div class="r nb">Per ${s[0]} (${s[1]} ${u})</div><div class="r nb" style="margin-top:-4px">pour ${p.perFr} (${s[1]} ${u})</div>
  <div class="r th"><span class="cal">Calories ${p.kcal}</span><span class="sm" style="text-align:right">% Daily Value*<br>% valeur quotidienne*</span></div>
  <div class="r md"><span><b>Fat</b> / Lipides ${n(p.fat)} g</span><b>${pc(p.fat, 75)} %</b></div>
  <div class="r in"><span>Saturated / saturés ${n(p.sat)} g<br>+ Trans / trans ${n(p.trans)} g</span><b>${pc(p.sat + p.trans, 20)} %</b></div>
  <div class="r"><span><b>Carbohydrate</b> / Glucides ${n(p.carbs)} g</span><span></span></div>
  <div class="r in"><span>Fibre / Fibres ${n(p.fibre)} g</span><b>${pc(p.fibre, 28)} %</b></div>
  <div class="r in"><span>Sugars / Sucres ${n(p.sugars)} g</span><b>${pc(p.sugars, 100)} %</b></div>
  <div class="r"><span><b>Protein</b> / Protéines ${n(p.protein)} g</span><span></span></div>
  <div class="r"><span><b>Cholesterol</b> / Cholestérol ${n(p.chol)} mg</span><span></span></div>
  <div class="r"><span><b>Sodium</b> ${n(p.sodium)} mg</span><b>${pc(p.sodium, 2300)} %</b></div>
  <div class="r th"><span>Potassium ${n(p.potassium)} mg</span><b>${pc(p.potassium, 3400)} %</b></div>
  <div class="r"><span>Calcium ${n(p.calcium)} mg</span><b>${pc(p.calcium, 1300)} %</b></div>
  <div class="r"><span>Iron / Fer ${n(p.iron)} mg</span><b>${pc(p.iron, 18)} %</b></div>
  <div class="r md sm" style="display:block">*5% or less is <b>a little</b>, 15% or more is <b>a lot</b><br>*5 % ou moins c'est <b>peu</b>, 15 % ou plus c'est <b>beaucoup</b></div></div>`;
}
function caOld(p) {
  const s = p.per, u = p.ml ? 'mL' : 'g';
  return `<div class="lab"><h1>Nutrition Facts</h1><h1>Valeur nutritive</h1>
  <div class="r nb">Per ${s[0]} (${s[1]} ${u}) / pour ${p.perFr} (${s[1]} ${u})</div>
  <div class="r th sm"><b>Amount<br>Teneur</b><b style="text-align:right">% Daily Value<br>% valeur quotidienne</b></div>
  <div class="r"><span><b>Calories</b> / Calories ${p.kcal}</span><span></span></div>
  <div class="r"><span><b>Fat</b> / Lipides ${n(p.fat)} g</span><span>${pc(p.fat, 65)} %</span></div>
  <div class="r in"><span>Saturated / saturés ${n(p.sat)} g<br>+ Trans / trans ${n(p.trans)} g</span><span>${pc(p.sat + p.trans, 20)} %</span></div>
  <div class="r"><span><b>Cholesterol</b> / Cholestérol ${n(p.chol)} mg</span><span></span></div>
  <div class="r"><span><b>Sodium</b> ${n(p.sodium)} mg</span><span>${pc(p.sodium, 2400)} %</span></div>
  <div class="r"><span><b>Carbohydrate</b> / Glucides ${n(p.carbs)} g</span><span>${pc(p.carbs, 300)} %</span></div>
  <div class="r in"><span>Fibre / Fibres ${n(p.fibre)} g</span><span>${pc(p.fibre, 25)} %</span></div>
  <div class="r in"><span>Sugars / Sucres ${n(p.sugars)} g</span><span></span></div>
  <div class="r"><span><b>Protein</b> / Protéines ${n(p.protein)} g</span><span></span></div>
  <div class="r th"><span>Vitamin A / Vitamine A</span><span>0 %</span></div>
  <div class="r"><span>Vitamin C / Vitamine C</span><span>0 %</span></div>
  <div class="r"><span>Calcium / Calcium</span><span>${pc(p.calcium, 1100)} %</span></div>
  <div class="r"><span>Iron / Fer</span><span>${pc(p.iron, 14)} %</span></div></div>`;
}
function us(p) {
  const s = p.per, u = p.ml ? 'mL' : 'g';
  return `<div class="lab"><h1 style="font-size:38px">Nutrition Facts</h1><div class="r nb">8 servings per container</div>
  <div class="r nb b" style="font-size:18px"><span>Serving size</span><span>${s[0]} (${s[1]}${u})</span></div>
  <div class="r th sm b">Amount per serving</div><div class="r nb"><span class="cal" style="font-size:34px">Calories</span><span class="cal" style="font-size:40px">${p.kcal}</span></div>
  <div class="r md sm b" style="justify-content:flex-end">% Daily Value*</div>
  <div class="r"><span><b>Total Fat</b> ${n(p.fat)}g</span><b>${pc(p.fat, 78)}%</b></div>
  <div class="r in"><span>Saturated Fat ${n(p.sat)}g</span><b>${pc(p.sat, 20)}%</b></div>
  <div class="r in"><span><i>Trans</i> Fat ${n(p.trans)}g</span><span></span></div>
  <div class="r"><span><b>Cholesterol</b> ${n(p.chol)}mg</span><b>${pc(p.chol, 300)}%</b></div>
  <div class="r"><span><b>Sodium</b> ${n(p.sodium)}mg</span><b>${pc(p.sodium, 2300)}%</b></div>
  <div class="r"><span><b>Total Carbohydrate</b> ${n(p.carbs)}g</span><b>${pc(p.carbs, 275)}%</b></div>
  <div class="r in"><span>Dietary Fiber ${n(p.fibre)}g</span><b>${pc(p.fibre, 28)}%</b></div>
  <div class="r in"><span>Total Sugars ${n(p.sugars)}g</span><span></span></div>
  <div class="r in2"><span>Includes ${n(p.added)}g Added Sugars</span><b>${pc(p.added, 50)}%</b></div>
  <div class="r"><span><b>Protein</b> ${n(p.protein)}g</span><span></span></div>
  <div class="r th"><span>Vitamin D ${n(p.vitD)}mcg</span><span>${pc(p.vitD, 20)}%</span></div>
  <div class="r"><span>Calcium ${n(p.calcium)}mg</span><span>${pc(p.calcium, 1300)}%</span></div>
  <div class="r"><span>Iron ${n(p.iron)}mg</span><span>${pc(p.iron, 18)}%</span></div>
  <div class="r"><span>Potassium ${n(p.potassium)}mg</span><span>${pc(p.potassium, 4700)}%</span></div>
  <div class="r md sm" style="display:block">* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div></div>`;
}
function truth(p, fmt) {
  const t = { servingG: p.per[1], kcal: p.kcal, fat: p.fat, protein: p.protein, carbs: p.carbs, fibre: p.fibre, sugars: p.sugars, sodium: p.sodium, cholesterol: p.chol };
  if (fmt === 'us') Object.assign(t, { satFat: p.sat, transFat: p.trans, addedSugar: p.added, potassium: p.potassium, calcium: p.calcium, iron: p.iron, vitD: p.vitD });
  if (fmt === 'ca') Object.assign(t, { satFat: p.sat, transFat: p.trans, potassium: p.potassium, calcium: p.calcium, iron: p.iron });
  if (fmt === 'caold') Object.assign(t, { satFat: p.sat, transFat: p.trans, calcium: Math.round(pc(p.calcium, 1100) / 100 * 1300), iron: +(pc(p.iron, 14) / 100 * 18).toFixed(2) }); // old %DV × current CA DV (by design)
  return t;
}
const FONTS = ['"Liberation Sans", Arial, Helvetica, sans-serif', '"Roboto Condensed", "Arial Narrow", sans-serif', 'Inter, Helvetica, sans-serif'];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const pg = await b.newPage({ deviceScaleFactor: 2 });
  const T = {};
  let i = 0;
  for (const p of P) for (const [fmt, fn] of [['ca', ca], ['us', us], ['caold', caOld]]) {
    if (fmt === 'caold' && i % 2) { i++; continue; }
    const font = FONTS[i % FONTS.length]; const width = fmt === 'us' ? 300 : 330; i++;
    await pg.setContent(`<style>${CSS.replace('FONT', font).replace('WIDTH', width)}</style>${fn(p)}`);
    await pg.waitForTimeout(150);
    const id = `${p.id}-${fmt}`;
    await (await pg.$('.lab')).screenshot({ path: path.join(OUT, id + '.png') });
    T[id] = { fmt, truth: truth(p, fmt) };
  }
  fs.writeFileSync(path.join(__dirname, 'truth.json'), JSON.stringify(T, null, 1));
  console.log('rendered', Object.keys(T).length); await b.close();
})();
