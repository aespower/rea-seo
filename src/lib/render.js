// Renderiza una página con Playwright (Chromium headless) y captura la red.
import { USER_AGENT } from './http.js';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      // REA_SEO_CHROME_PATH: usa un Chrome/Chromium ya instalado. REA_SEO_CHROME_CHANNEL=chrome usa el Chrome del sistema.
      const opts = { headless: true };
      if (process.env.REA_SEO_CHROME_PATH) opts.executablePath = process.env.REA_SEO_CHROME_PATH;
      else if (process.env.REA_SEO_CHROME_CHANNEL) opts.channel = process.env.REA_SEO_CHROME_CHANNEL;
      return chromium.launch(opts);
    })();
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close();
  }
}

/**
 * Devuelve { ok, html, finalUrl, status, timing, network, consoleErrors, error }.
 * network.api = peticiones fetch/xhr que suelen alimentar contenido dinámico.
 */
export async function renderPage(url, { waitMs = 1500, mobile = true } = {}) {
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: mobile ? { width: 412, height: 915 } : { width: 1366, height: 900 },
      isMobile: mobile,
      locale: 'es-ES',
    });
    const page = await context.newPage();
    const requests = [];
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
    page.on('requestfinished', async (req) => {
      const res = await req.response().catch(() => null);
      requests.push({
        url: req.url(),
        method: req.method(),
        type: req.resourceType(),
        status: res?.status() ?? null,
        contentType: res?.headers()['content-type'] ?? null,
      });
    });

    const t0 = Date.now();
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const domContentLoaded = Date.now() - t0;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(waitMs);

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return {
        ttfb: nav ? Math.round(nav.responseStart) : null,
        fcp: fcp ? Math.round(fcp.startTime) : null,
        lcp: lcp ? Math.round(lcp.startTime) : null,
        transferKB: nav ? Math.round(nav.transferSize / 1024) : null,
      };
    }).catch(() => ({}));

    const html = await page.content();
    const origin = new URL(url).origin;
    const api = requests.filter((r) => ['fetch', 'xhr'].includes(r.type));
    const byType = requests.reduce((acc, r) => ({ ...acc, [r.type]: (acc[r.type] || 0) + 1 }), {});
    return {
      ok: true,
      html,
      finalUrl: page.url(),
      status: resp?.status() ?? null,
      timing: { domContentLoaded, ...perf },
      network: {
        total: requests.length,
        byType,
        thirdPartyHosts: [...new Set(requests.map((r) => new URL(r.url).host).filter((h) => !origin.endsWith(h)))].slice(0, 40),
        api: api.slice(0, 50),
      },
      consoleErrors: consoleErrors.slice(0, 20),
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err).split('\n')[0] };
  } finally {
    await context?.close().catch(() => {});
  }
}
