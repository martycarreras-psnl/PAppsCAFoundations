// Generate docs/assets/code-apps-foundations.pdf from docs/index.html using headless Chromium.
import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const indexPath = path.join(repoRoot, 'docs', 'index.html');
const outDir = path.join(repoRoot, 'docs', 'assets');
const outPath = path.join(outDir, 'code-apps-foundations.pdf');

await fs.mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 300_000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--font-render-hinting=none',
    '--disable-gpu',
    '--disable-dev-shm-usage',
  ],
});

try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 2 });

  const url = pathToFileURL(indexPath).href;
  console.log(`Loading ${url}`);
  // Use 'load' instead of 'networkidle0' — the particle canvas animation
  // keeps the network activity alive indefinitely, preventing networkidle0
  // from resolving on slower CI runners.
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });

  // Kill any running animations/requestAnimationFrame loops so the page
  // settles into a static state for PDF rendering.
  await page.evaluate(() => {
    // Stop the particle canvas animation
    const canvas = document.getElementById('particle-canvas');
    if (canvas) canvas.remove();

    // Force-open all <details> so collapsible content is included.
    document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('in');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  });

  // Wait for fonts — with a safety timeout so CI doesn't hang if system
  // fonts (e.g. Segoe UI) aren't available on the runner.
  await Promise.race([
    page.evaluateHandle('document.fonts.ready'),
    new Promise((res) => setTimeout(res, 10_000)),
  ]);
  console.log('Fonts settled');

  // Wait for images — with a per-image timeout.
  await page.evaluate(() => {
    const imgs = Array.from(document.images);
    return Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : Promise.race([
              new Promise((res) => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
              }),
              new Promise((res) => setTimeout(res, 5_000)),
            ])
      )
    );
  });
  console.log('Images settled');

  await page.emulateMediaType('print');

  console.log(`Writing ${outPath}`);
  await page.pdf({
    path: outPath,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    margin: { top: '0.6in', bottom: '0.7in', left: '0.55in', right: '0.55in' },
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-size:8pt;color:#94a3b8;width:100%;padding:0 0.55in;display:flex;justify-content:space-between;font-family:'Segoe UI',system-ui,sans-serif;">
        <span>Power Apps Code Apps Foundations</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
  });

  const stat = await fs.stat(outPath);
  console.log(`OK — ${(stat.size / 1024).toFixed(0)} KB`);
} finally {
  await browser.close();
}
