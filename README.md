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

## Appearance (Settings › Appearance, or the 🎨 button on Today)
Everything is stored on the phone (`localStorage['fuel.look']`) and applied before first paint by `js/theme-boot.js`.
- **Default look** (new installs, or when nothing is saved): **Kitchen** on **Auto** (follows iOS Light/Dark), with **Kitchen Vivid** tiles and the **Tiles** layout. It is applied before first paint.
- **Themes**: Kitchen (default), Midnight, Graphite, Ember, OLED Black (pure #000), Daylight, Paper, or Auto (follows the device's light/dark setting).
- **Kitchen** (theme family, v1.4.2; the default since v1.4.3): wood and frosted glass, with a **Light / Dark / Auto** switch (Auto follows the iPhone's Light/Dark setting). Kitchen Light uses pale oak, maple and ash with cream stone and brass. Kitchen Dark uses walnut, smoked oak and ebony with charcoal stone and amber/brass. The wood is on the header, bottom bar, tile shelf edges and neutral tiles. Cards, sheets and the date bar are frosted glass (`backdrop-filter` blur with a brass top highlight, and a solid fallback where blur isn't supported). The tiles stay vivid: the default is the **Kitchen Vivid** palette, and **Harmonised** (sage, terracotta, deep teal, mustard, plum) is the softer option. Textures are two local seamless JPEGs (`img/wood-light.jpg`, `img/wood-dark.jpg`, about 21 KB total, made by `data-build/make_wood.py`) plus an inline SVG stone speckle. Both are in the offline cache.
- **Accent colour**: 9 presets or any custom colour. Accent text is tuned to keep 4.5:1 (WCAG AA) contrast on the theme. Text on accent buttons switches between white and dark automatically.
- **Today layout**: **Tiles** (default: flat colour blocks with big numbers, two hero tiles — **Scan barcode** and **Scan label** — with small Search / Recent / Type label / water options below, one-tap water and My items), **Rings**, **Cards**, or **Compact**.
- **Tile colours**: Vivid, Neon, Pastel, Jewel, or Accent palettes. You can also set any tile's colour yourself. Fuel picks white or dark text for each tile and nudges the shade if needed to keep AA contrast.
- **Card density** (Comfortable / Compact) and **Reduce motion**. Reduce motion follows the device setting until you change it. It turns off confetti, shine, ring and bar animations.
- **Ease of use**: the + sheet holds Scan barcode, Scan label, Say it, Type label, My items (one tap logs and closes) and water. Browser/OS back and Escape close the top sheet. Every control has a touch area of at least 44×44 px. The Undo toast sits above the tab bar, stays clear of an open sheet's header and close button, and lasts 8 s. Pinch-zoom is allowed, and every text field is at least 16 px so iOS doesn't auto-zoom.

## Scan barcode and Scan label (v1.5)
- **▦ Scan barcode** (camera scanner with the bundled ZXing, or type the number). Lookup order: your **saved items** first (instant, works offline) → **USDA FoodData Central Branded Foods** by `gtinUpc` (UPC-A / EAN-13 / GTIN-14 zero-padding all match; uses the public `DEMO_KEY`, or paste a free key from https://fdc.nal.usda.gov/api-key-signup under Settings › *USDA API key (free, optional)*; the key stays on the phone and is never included in exports) → **Open Food Facts** (world, then ca), badged *community*. The review sheet shows the source badge; **Looks right — log it** and **Save only** both save a custom food + favourite keyed by the barcode, so rescans are instant. No match → **Scan the label instead** (the barcode is stored with the result) or type it in.
- **📷 Scan label**: photo (camera or 🖼️ library) → on-device OCR with Tesseract.js 7 (vendor/tesseract, ~7 MB, loaded only when you first scan and then cached for offline use) → resize, greyscale, background flattening, contrast stretch, deskew / sideways / upside-down detection, ruled-line removal → a noise-tolerant parser (English and French CA labels, US labels, %DV, O/0, l/1, S/5, g read as 9) → the same review form with colours: green read clearly, cyan from %DV, amber check this. Nothing is uploaded.
- OCR accuracy on 67 rendered test labels (CA 2022, pre-2022 CA, US 2016; clean, rotated 5°/90°/180°, blurred and photo-like with perspective, lighting, noise and JPEG): **96.3% of 978 nutrient fields**. Clean 100%, rot5 100%, rot90 100%, rot180 100%, photo-like 92.5%, blur 86.3%. Run `node test/ocr/accuracy.js`.

## Vitamin D and creatine (v1.4.1)
- **Vitamin D**: your daily goal is **250 µg (10,000 IU)**, shown in both µg and IU. The baseline (RDA 15 µg / 600 IU) is what the daily score and "micros at baseline" use. The NASEM upper limit of 100 µg (4,000 IU) is shown for information only. Going over it gives no red warning and no score penalty. The info sheet notes that the goal is above the NASEM UL and suggests checking blood 25(OH)D with a doctor. Change the goal under the nutrient's **Customise** section.
- **Creatine** (g): goal **10 g/day**. The info sheet follows the ISSN 2017 position stand: 3–5 g/day maintenance, optionally after ~20 g/day loading for 5–7 days. The bundled USDA/CNF data has no creatine values, so creatine is counted **from supplements and labels only**. No values are invented for meat or fish. **Creatine monohydrate** (1 scoop = 5 g = 5 g creatine) sits in My items for one-tap logging. Creatine is pinned on Today by default. A one-time, additive migration pins it and adds the scoop for existing users without touching other data. Read the label and the manual form both accept creatine.

## Backups
Settings › Data › Export saves everything, including Appearance, to one JSON file. Import replaces the data on this phone with the backup (after a confirmation). Saves are written immediately when the app goes to the background.

## Food data (priority order when matching)
USDA Foundation Foods (2026-04) › USDA SR Legacy (2018-04) › USDA FNDDS 2021-2023 › Health Canada Canadian Nutrient File 2015 › Open Food Facts (online, user-contributed).
Rebuild the DB with `python3 data-build/build_foods.py` after placing the source files in `data-build/raw/`.

## Tests
`node test/barcode.js [--webkit] [--real]` (barcode lookup chain, offline rescan, not-found → label), `node test/ocr/accuracy.js` (label OCR accuracy), `node test/design.js kitchen` (Kitchen only: pixel-level contrast of text over wood, glass and blur at several scroll positions, plus Auto/Light/Dark switching), `node test/fixes.js` (v1.4.1 regression tests), `node test/qa.js [before|after] [webkit]` (first-time-user QA pass with tap counts, layout/input audit, export→import round-trip and offline reload; screenshots in `screenshots/qa/`), `node test/ui.js`, `node test/label.js`, `node test/smoke.js`, `node test/extra.js`, `node test/design.js` (every theme × layout: WCAG contrast + 44 px tap-target audit, screenshots in `screenshots/design/`; set `FUEL_URL` to override the default `http://127.0.0.1:8766/`) (Playwright + Chrome, iPhone viewport, against `python3 -m http.server 8765`).
