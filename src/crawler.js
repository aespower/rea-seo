// Crawler REA-SEO: inspección profunda de una URL + rastreo BFS para profundidad de clics.
import { fetchText, USER_AGENT } from './lib/http.js';
import { getRobots, isAllowed, BOTS } from './lib/robots.js';
import { extractSignals } from './lib/extract.js';
import { renderPage } from './lib/render.js';
import { compareRawRendered } from './lib/compare.js';

const SKIP_EXT = /\.(jpg|jpeg|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|css|js|xml|ico|woff2?)(\?|$)/i;

function normalize(u) {
  const url = new URL(u);
  url.hash = '';
  for (const p of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/.test(p)) url.searchParams.delete(p);
  return url.href;
}

/**
 * Inspección completa de UNA url: HTML crudo, DOM renderizado, diff, headers y robots.
 * opts.render=false salta Playwright (más rápido, sin diff).
 */
export async function inspectPage(url, { render = true, mobile = true } = {}) {
  const target = normalize(url);
  const origin = new URL(target).origin;
  const robots = await getRobots(origin);
  const path = new URL(target).pathname + new URL(target).search;
  const botAccess = Object.fromEntries(BOTS.map((b) => [b, isAllowed(robots, b, path)]));

  const raw = await fetchText(target, { accept: 'text/html' });
  const rawSignals = extractSignals(raw.body, raw.url || target);

  const headers = raw.headers || {};
  const http = {
    status: raw.status,
    finalUrl: raw.url,
    redirected: raw.redirected,
    responseMs: raw.ms,
    error: raw.error,
    xRobotsTag: headers['x-robots-tag'] || null,
    cacheControl: headers['cache-control'] || null,
    server: headers.server || null,
    poweredBy: headers['x-powered-by'] || null,
    contentEncoding: headers['content-encoding'] || null,
    cdn: headers['cf-ray'] ? 'Cloudflare' : headers['x-vercel-id'] ? 'Vercel' : headers['x-amz-cf-id'] ? 'CloudFront' : headers['x-served-by']?.includes('cache') ? 'Fastly' : headers['x-nf-request-id'] ? 'Netlify' : null,
  };

  let rendered = null;
  let renderedSignals = null;
  if (render) {
    rendered = await renderPage(target, { mobile });
    if (rendered.ok) renderedSignals = extractSignals(rendered.html, rendered.finalUrl || target);
  }

  const best = renderedSignals || rawSignals;
  const indexability = {
    statusOk: raw.status >= 200 && raw.status < 300,
    noindex: /noindex/i.test(best.head.metaRobots || '') || /noindex/i.test(http.xRobotsTag || ''),
    canonicalSelf: best.head.canonical ? normalize(best.head.canonical) === normalize(raw.url || target) : null,
    googlebotAllowed: botAccess.Googlebot,
  };
  indexability.indexable = indexability.statusOk && !indexability.noindex && indexability.googlebotAllowed && indexability.canonicalSelf !== false;

  return {
    url: target,
    analyzedAt: new Date().toISOString(),
    userAgent: USER_AGENT,
    http,
    indexability,
    botAccess,
    raw: rawSignals,
    rendered: renderedSignals,
    renderInfo: rendered ? { ok: rendered.ok, error: rendered.error, timing: rendered.timing, network: rendered.network, consoleErrors: rendered.consoleErrors } : null,
    rawVsRendered: compareRawRendered(rawSignals, renderedSignals),
  };
}

/**
 * Rastreo BFS solo con HTML crudo (rápido, educado). Mide profundidad de clics,
 * enlaces entrantes por URL y anchors que recibe cada página.
 */
export async function crawlSite(startUrl, { maxPages = 50, maxDepth = 3 } = {}) {
  const start = normalize(startUrl);
  const origin = new URL(start).origin;
  const robots = await getRobots(origin);
  const queue = [{ url: start, depth: 0 }];
  const seen = new Map([[start, 0]]);
  const inlinks = new Map();
  const pages = [];
  const blocked = [];

  while (queue.length && pages.length < maxPages) {
    const { url, depth } = queue.shift();
    const u = new URL(url);
    if (!isAllowed(robots, 'REA-SEO', u.pathname + u.search)) { blocked.push(url); continue; }
    const res = await fetchText(url, { accept: 'text/html' });
    if (!/html/i.test(res.headers['content-type'] || '') && res.ok) continue;
    const sig = extractSignals(res.body, res.url || url);
    pages.push({
      url,
      depth,
      status: res.status,
      title: sig.head.title,
      h1: sig.headings.find((h) => h.level === 1)?.text || null,
      words: sig.content.wordCount,
      canonical: sig.head.canonical,
      schemaTypes: sig.structuredData.schemaTypes,
      outInternal: sig.links.internalUnique,
    });
    for (const l of sig.links.internal) {
      if (SKIP_EXT.test(l.url)) continue;
      const n = normalize(l.url);
      if (!inlinks.has(n)) inlinks.set(n, { count: 0, anchors: new Map() });
      const e = inlinks.get(n);
      e.count++;
      if (l.anchor) e.anchors.set(l.anchor, (e.anchors.get(l.anchor) || 0) + 1);
      if (!seen.has(n) && depth + 1 <= maxDepth) {
        seen.set(n, depth + 1);
        queue.push({ url: n, depth: depth + 1 });
      }
    }
  }

  const depthDistribution = pages.reduce((acc, p) => ({ ...acc, [p.depth]: (acc[p.depth] || 0) + 1 }), {});
  const mostLinked = [...inlinks.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([url, e]) => ({
      url, inlinks: e.count,
      topAnchors: [...e.anchors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a),
    }));

  return {
    start,
    crawled: pages.length,
    discovered: seen.size,
    blockedByRobots: blocked,
    depthDistribution,
    mostLinked,
    pages,
  };
}
