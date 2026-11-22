import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { startFixture } from './fixtures/server.js';
import { parseRobots, isAllowed } from '../src/lib/robots.js';
import { detectTemplates, analyzeSitemaps } from '../src/sitemap-analyzer.js';
import { inspectPage, crawlSite } from '../src/crawler.js';
import { fullAnalysis } from '../src/analyze.js';
import { closeBrowser } from '../src/lib/render.js';

process.env.REA_SEO_DELAY_MS = '0';
let fx;
before(async () => { fx = await startFixture(); });
after(async () => { fx.srv.close(); await closeBrowser(); });

test('robots: reglas por agente y comodines', () => {
  const r = parseRobots('User-agent: *\nDisallow: /a/\nAllow: /a/ok\nDisallow: /*.pdf$\n\nUser-agent: GPTBot\nDisallow: /');
  assert.equal(isAllowed(r, 'Googlebot', '/a/x'), false);
  assert.equal(isAllowed(r, 'Googlebot', '/a/ok'), true);
  assert.equal(isAllowed(r, 'Googlebot', '/doc.pdf'), false);
  assert.equal(isAllowed(r, 'Googlebot', '/doc.pdf?x'), true);
  assert.equal(isAllowed(r, 'GPTBot', '/'), false);
});

test('plantillas: detecta SEO programático', () => {
  const urls = [];
  for (let i = 0; i < 60; i++) urls.push(`https://x.com/servicios/plomero-en-ciudad${i}`);
  urls.push('https://x.com/blog/hola');
  const t = detectTemplates(urls);
  assert.equal(t[0].template, '/servicios/{slug}');
  assert.equal(t[0].programmaticSignal, true);
  assert.ok(t[0].modifiers.some((m) => m.token === 'en'));
});

test('sitemaps: índice recursivo + robots', async () => {
  const s = await analyzeSitemaps(fx.base);
  assert.equal(s.totals.urls, 58);
  assert.equal(s.sitemaps.length, 3);
  assert.equal(s.robots.botAccessHome.GPTBot, false);
  assert.equal(s.robots.botAccessHome.Googlebot, true);
  assert.ok(s.templates.find((t) => t.template === '/servicios/{slug}' && t.count === 54));
});

test('inspect sin render: señales del HTML crudo', async () => {
  const p = await inspectPage(fx.base + '/', { render: false });
  assert.equal(p.http.status, 200);
  assert.equal(p.indexability.indexable, true);
  assert.deepEqual(p.raw.structuredData.schemaTypes.sort(), ['Article', 'Person']);
  assert.equal(p.raw.headingCounts.h1, 1);
  assert.equal(p.raw.content.faqLike, 1);
  assert.equal(p.raw.images.withoutAlt, 1);
  assert.equal(p.raw.links.byZone.nav, 3);
  assert.ok(p.raw.content.topBigrams.some((b) => b.term === 'remedios caseros'));
});

test('crawl: profundidad y respeto a robots', async () => {
  const c = await crawlSite(fx.base + '/', { maxPages: 20, maxDepth: 2 });
  assert.ok(c.crawled >= 4);
  assert.ok(c.blockedByRobots.some((u) => u.includes('/privado/')));
  assert.equal(c.depthDistribution[0], 1);
});

test('render: detecta contenido y schema inyectado por JS', { skip: !process.env.REA_SEO_TEST_RENDER && 'define REA_SEO_TEST_RENDER=1 para probar Playwright' }, async () => {
  const p = await inspectPage(fx.base + '/', { render: true });
  assert.equal(p.renderInfo.ok, true, p.renderInfo.error);
  assert.ok(p.rawVsRendered.schema.injectedByJs.includes('FAQPage'));
  assert.ok(p.rawVsRendered.words.rendered > p.rawVsRendered.words.raw);
  assert.ok(p.rawVsRendered.headingsOnlyInRendered.some((h) => h.text === 'Mascarilla de aguacate'));
  assert.ok(p.renderInfo.network.api.some((a) => a.url.endsWith('/api/extra')));
});

test('analyze completo genera informe', async () => {
  const r = await fullAnalysis(fx.base + '/', { keyword: 'remedios caseros para el cabello', render: false, maxPages: 10 });
  assert.ok(r.saved.reportPath.endsWith('report.md'));
  assert.ok(r.keyword.score > 30);
  await rm(r.saved.folder, { recursive: true });
});
