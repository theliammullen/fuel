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

## AI photo / voice logging
Profile (⚙️) → **AI logging** → choose OpenAI or Google Gemini, paste your API key, tap **Test key**.
The key is stored only in this device's localStorage. It's never written to source files or included in exports.
Requests go straight from the phone to the provider.
- OpenAI key: https://platform.openai.com/api-keys (default model `gpt-4.1-mini`; `gpt-4.1` / `gpt-4o` work too)
- Gemini key: https://aistudio.google.com/apikey (default `gemini-2.5-flash`)
Without a key, voice/text still works through the built-in offline parser.

## Food data (priority order when matching)
USDA Foundation Foods (2026-04) › USDA SR Legacy (2018-04) › USDA FNDDS 2021-2023 › Health Canada Canadian Nutrient File 2015 › Open Food Facts (online, user-contributed).
Rebuild the DB with `python3 data-build/build_foods.py` after placing the source files in `data-build/raw/`.

## Tests
`node test/ui.js`, `node test/smoke.js`, `node test/extra.js` (Playwright + Chrome, iPhone viewport, against `python3 -m http.server 8765`).
