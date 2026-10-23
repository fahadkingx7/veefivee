/* Run with Playwright installed: node scripts/test-navigation.cjs.
 * Optional WEBKIT_EXECUTABLE selects a local WebKit runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webkit } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const root = path.resolve(__dirname, '..');
const pages = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith('.html') && fs.readFileSync(file, 'utf8').includes('data-nav-pill'))
      pages.push(path.relative(root, file).split(path.sep).join('/'));
  }
}
scan(root);
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, 'http://local').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file += '/index.html';
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await webkit.launch(process.env.WEBKIT_EXECUTABLE
    ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {});
  try {
    for (const width of [320, 430, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: width < 768, hasTouch: width < 768 });
      // Deterministic layout with external analytics/fonts disabled; not a network performance test.
      await page.route('https://**/*', route => route.abort());
      for (const file of pages) {
        await page.goto(base + '/' + file);
        const result = await page.evaluate(async () => {
          const pill = document.querySelector('[data-nav-pill]'), nav = pill.parentElement;
          const topSamples = [];
          for (let i = 0; i < 12; i++) {
            await new Promise(requestAnimationFrame);
            topSamples.push(nav.getBoundingClientRect().top);
          }
          const shell = document.querySelector('.vf-site-shell');
          return { direct: nav.parentElement === document.body, topSamples,
            overflow: shell && getComputedStyle(shell).overflowY,
            width: document.documentElement.scrollWidth, viewport: innerWidth };
        });
        assert.equal(result.direct, true, file + ' header must be outside clipped content');
        assert(result.topSamples.every(y => Math.abs(y) < 1), file + ' moving header');
        assert(!result.overflow || result.overflow === 'visible', file + ' nested scroll container');
        assert(result.width <= result.viewport + 1, file + ' horizontal overflow');
      }
      await page.goto(base + '/services.html');
      await page.evaluate(() => { window.__navigationMarker = 1; window.scrollTo({top: 500, behavior:'instant'}); });
      await page.locator('[data-nav-pill] a[href="services.html"]').click();
      assert.equal(await page.evaluate(() => window.__navigationMarker), 1, 'selected link reloaded document');
      assert(await page.evaluate(() => scrollY > 450), 'selected link reset scroll');
      await page.locator('[data-nav-pill] a[href="about.html"]').click();
      await page.waitForURL('**/about.html');
      assert.equal(await page.evaluate(() => scrollY), 0, 'new page must open at top');
      await page.goBack();
      await page.waitForTimeout(900);
      assert(await page.evaluate(() => scrollY > 450), 'back must restore scroll');
      await page.goForward();
      await page.waitForTimeout(900);
      assert.equal(await page.evaluate(() => scrollY), 0, 'forward scroll changed');
      await page.goto(base + '/services.html');
      await page.locator('.service-tabs a').first().click();
      await page.waitForTimeout(900);
      assert(await page.evaluate(() => location.hash.length > 1 && scrollY > 0), 'same-page anchor failed');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(base + '/index.html');
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.home-hero > .mx-auto')).animationName), 'none');
      await page.close();
      console.log(`PASS ${width}px: ${pages.length} pages, header frames, repeat tap, navigation/history, anchors, reduced motion`);
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
