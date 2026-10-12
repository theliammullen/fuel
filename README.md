# Fuel — nutrition tracker (installable PWA)

Static HTML/CSS/JS, no backend, works offline. All data stays on the phone (localStorage).

## Install on iPhone
1. Host the folder on HTTPS (GitHub Pages works as-is: all paths are relative; `.nojekyll` included).
2. Open the URL in **Safari** → Share → **Add to Home Screen**. It launches full-screen.

## Deploy to GitHub Pages (when you're ready)
```
cd nutrition-app
git init && git add . && git commit -m "Fuel PWA"
gh repo create fuel --public --source=. --push
gh api -X POST repos/<user>/fuel/pages -f "source[branch]=main" -f "source[path]=/"
```
URL: `https://<user>.github.io/fuel/`. `data-build/raw/` (≈400 MB of USDA source files) is git-ignored.

## Logging — 100% free, offline, no API keys
Nothing in Fuel calls a paid service. All parsing runs on the phone.
- **🎙️ Say it**: say or type food names with amounts ("2 eggs, a cup of oatmeal and a black coffee"). The offline parser matches them against the bundled USDA/CNF database and shows a review card. One tap on **Approve** logs everything.
- **🏷️ Read the label**: read a Nutrition Facts table aloud, e.g. "Kirkland protein bar, serving 60 grams, 190 calories, 21 grams protein, 7 fat, 22 carbs, 15 fibre, 1 gram sugar, 200 milligrams sodium, calcium 10 percent".
  - The offline label parser (`parseLabel` in `js/app.js`) understands:
    - nutrient synonyms (fibre/fiber, carbs/carbohydrate, sat fat, "saturated + trans", B12/cobalamin, …);
    - numbers spoken as digits or words ("one hundred ninety", "two point five", "half");
    - units g, mg, mcg/µg, IU, kJ, and % DV;
    - both "21 grams protein" and "protein 21 g", with or without commas.
  - An editable review form opens next:
    - green = heard;
    - cyan = converted from % DV;
    - amber = unit assumed;
    - red box = parts it didn't understand.
  - **⭐ Save item** stores it as a custom food and favourites it. **⚡ Save & log now** also logs one serving.
  - A manual form ("✍️ Enter manually") is always available.
- **My items** (Today screen): favourites, saved label items, and foods you've logged on 2 or more of the last 30 days.
  - **Tap** logs your usual serving, with an Undo toast.
  - **Long-press** or tap **⋯** to change the serving first.
- **Other ways to log**: search, barcode scan (Open Food Facts, which is free), recents, favourites, custom foods and recipes.
- Voice uses the browser's Web Speech API where available. Otherwise the text box auto-focuses so you can use the 🎤 key on the iPhone keyboard.

### % Daily Value references used to convert "%" to amounts
Default is **Canada**: Health Canada, *Food and Drug Regulations*, Table of Daily Values (2016 amendments, on all labels since Dec 2022). Switch to **US** (FDA 21 CFR 101.9, 2016 rule) in the Read-the-label sheet or the review form.

| Nutrient | CA DV | US DV |
|---|---|---|
| Fat | 75 g | 78 g |
| Saturated (+trans in CA) | 20 g | 20 g |
| Carbohydrate | — (US used) | 275 g |
| Fibre | 28 g | 28 g |
| Sugars | 100 g | — |
| Added sugars | — (US used) | 50 g |
| Protein | — (US used) | 50 g |
| Cholesterol | — (US used) | 300 mg |
| Sodium | 2300 mg | 2300 mg |
| Potassium | 3400 mg | 4700 mg |
| Calcium | 1300 mg | 1300 mg |
| Iron | 18 mg | 18 mg |

The vitamin and other mineral DVs are the same in both: A 900 µg RAE, C 90 mg, D 20 µg, E 15 mg, K 120 µg, thiamin 1.2 mg, riboflavin 1.3 mg, niacin 16 mg, B6 1.7 mg, folate 400 µg DFE, B12 2.4 µg, biotin 30 µg, pantothenic acid 5 mg, choline 550 mg, phosphorus 1250 mg, iodine 150 µg, magnesium 420 mg, zinc 11 mg, selenium 55 µg, copper 0.9 mg, manganese 2.3 mg, molybdenum 45 µg.

Conversion notes:
- Older Canadian labels (before 2022) used different DVs, e.g. calcium 1100 mg and iron 14 mg. Check the review form if a label is old.
- IU conversions: vitamin D ÷ 40 → µg; vitamin A × 0.3 → µg; vitamin E × 0.67 → mg. Salt (g) × 400 → sodium (mg). kJ ÷ 4.184 → kcal.
- A calcium, potassium, phosphorus or magnesium value spoken with no unit and ≤ 100 is treated as % DV (that's how Canadian labels print them) and flagged amber.

## Food data (priority order when matching)
USDA Foundation Foods (2026-04) › USDA SR Legacy (2018-04) › USDA FNDDS 2021-2023 › Health Canada Canadian Nutrient File 2015 › Open Food Facts (online, user-contributed).
Rebuild the DB with `python3 data-build/build_foods.py` after placing the source files in `data-build/raw/`.

## Tests
`node test/ui.js`, `node test/label.js`, `node test/smoke.js`, `node test/extra.js` (Playwright + Chrome, iPhone viewport, against `python3 -m http.server 8765`).
