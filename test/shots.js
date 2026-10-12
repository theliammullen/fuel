const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500);
  for (const [i, y] of [[1, 800], [2, 1500], [3, 2200]]) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(400); await p.screenshot({ path: `/tmp/scroll${i}.png` }); }
  await b.close();
})();
