// Label-parser checks: runs parseLabel() in the page and prints each result.
const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const CASES = [
  ['Kirkland protein bar, serving 60 grams, 190 calories, 21 grams protein, 7 fat, 22 carbs, 15 fibre, 1 gram sugar, 200 milligrams sodium, calcium 10 percent', 'CA'],
  ['kirkland protein bar serving size sixty grams one hundred ninety calories twenty one grams of protein seven grams fat twenty two grams carbohydrates fifteen grams fiber one gram sugar two hundred milligrams sodium calcium ten percent', 'CA'],
  ['Oikos Pro yogurt. Serving size 3/4 cup 175 g. Calories 140. Fat 0 g. Saturated fat 0 g. Trans 0. Cholesterol 10 mg. Sodium 95 mg. Carbohydrate 9 g. Sugars 7 g. Protein 20 g. Potassium 6 percent. Calcium 15 percent', 'CA'],
  ['Name is Fairlife chocolate milk, serving 340 ml, 150 calories, protein 30 g, fat 2.5 g, saturated fat 1.5 g, carbs 6 g, sugars 6 g, added sugar 0, sodium 290 mg, vitamin D 25 percent, calcium 1,000 milligrams', 'US'],
  ['multivitamin, serving 1 tablet 1.5 g, vitamin D 1000 IU, vitamin A 2500 IU, vitamin E 30 IU, vitamin B12 25 mcg, vitamin C 90 mg, zinc 11 milligrams, folate 400 micrograms', 'CA'],
  ['granola, serving size 1/2 cup 55 g, energy 920 kJ, total fat 9 g, saturated plus trans 1.5 g, omega 3 0.4 g, carbohydrate 35 g, dietary fibre 5 g, sugars 12 g, protein 6 g, iron 15%, salt 0.3 g', 'CA'],
  ['two point five grams of saturated fat, 140 calories, protein twelve, sodium 410', 'CA'],
  ['Protein: 21g; Fat: 7g; Sodium: 200mg; Calcium 10%; Iron 4%; Vitamin B 12 2.4 micrograms; half a gram trans fat', 'CA'],
  ['coconut water serving one cup two hundred forty millilitres calories forty five potassium four hundred seventy milligrams sugars ten grams sodium sixty five milligrams', 'CA'],
  ['almond butter serving 32 g calories 200 protein 7 g fat 18 g carbs 6 g fibre 3 g magnesium 25 percent vitamin E 40 percent wombat 5', 'CA'],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(800);
  for (const [t, ref] of CASES) {
    const r = await p.evaluate(([t, ref]) => __fuel.parseLabel(t, ref), [t, ref]);
    console.log('\n» [' + ref + '] ' + t);
    console.log('  name:', JSON.stringify(r.name), '| serving:', r.servingG, 'g', r.servingLabel ? '(' + r.servingLabel + ')' : '', r.drink ? '| drink' : '');
    console.log('  ' + Object.entries(r.n).map(([k, v]) => `${k}=${+v.toFixed(2)}${r.how[k] !== 'ok' ? '[' + r.how[k] + ']' : ''}`).join(', '));
    const notes = Object.entries(r.notes).map(([k, v]) => k + ': ' + v); if (notes.length) console.log('  notes:', notes.join(' | '));
    if (r.unparsed.length) console.log('  UNPARSED:', r.unparsed.join(' || '));
  }
  console.log('\nERRS', errs); await b.close();
})();
