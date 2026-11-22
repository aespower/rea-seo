// Analiza robots.txt + sitemaps: arquitectura, plantillas de URL, SEO programático y frescura.
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from './lib/http.js';
import { getRobots, BOTS, isAllowed } from './lib/robots.js';

const parser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function readSitemap(url, state, depth = 0) {
  if (state.visited.has(url) || state.visited.size >= state.maxSitemaps || depth > 4) return;
  state.visited.add(url);
  const res = await fetchText(url, { accept: 'application/xml,text/xml,*/*' });
  const entry = { url, status: res.status, urls: 0, children: 0 };
  state.sitemaps.push(entry);
  if (!res.ok || !res.body.trim().startsWith('<')) { entry.error = res.error || 'no es XML'; return; }
  let doc;
  try { doc = parser.parse(res.body); } catch (e) { entry.error = String(e.message); return; }

  if (doc.sitemapindex) {
    const kids = arr(doc.sitemapindex.sitemap);
    entry.type = 'index';
    entry.children = kids.length;
    for (const k of kids) if (k.loc) await readSitemap(String(k.loc).trim(), state, depth + 1);
  } else if (doc.urlset) {
    const items = arr(doc.urlset.url);
    entry.type = 'urlset';
    entry.urls = items.length;
    for (const it of items) {
      if (state.urls.length >= state.maxUrls) { state.truncated = true; break; }
      if (!it.loc) continue;
      state.urls.push({
        loc: String(it.loc).trim(),
        lastmod: it.lastmod ? String(it.lastmod) : null,
        changefreq: it.changefreq || null,
        priority: it.priority ?? null,
        images: arr(it.image).length,
        hasNews: !!it.news,
        hasVideo: !!it.video,
        sitemap: url,
      });
    }
  }
}

const isDateSeg = (s) => /^(19|20)\d{2}(-\d{2}){0,2}$/.test(s) || /^\d{2}$/.test(s);
const isIdSeg = (s) => /^\d+$/.test(s) || /^[a-f0-9]{8,}$/i.test(s) || /\d{4,}/.test(s);

/** Agrupa URLs en plantillas tipo /blog/{slug} o /tienda/{categoria}/{slug}. */
export function detectTemplates(urls) {
  const paths = urls.map((u) => { try { return new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return null; } }).filter(Boolean);
  const byLen = new Map();
  for (const p of paths) {
    const segs = p.split('/').filter(Boolean);
    if (!byLen.has(segs.length)) byLen.set(segs.length, []);
    byLen.get(segs.length).push(segs);
  }
  const templates = new Map();
  for (const [len, list] of byLen) {
    const freq = Array.from({ length: len }, () => new Map());
    list.forEach((segs) => segs.forEach((s, i) => freq[i].set(s, (freq[i].get(s) || 0) + 1)));
    for (const segs of list) {
      const tpl = segs.map((s, i) => {
        if (isDateSeg(s)) return '{fecha}';
        if (isIdSeg(s)) return '{id}';
        const f = freq[i].get(s);
        const isLast = i === len - 1;
        return f >= 3 && (!isLast || f / list.length > 0.5) ? s : isLast ? '{slug}' : '{categoria}';
      });
      const key = '/' + tpl.join('/');
      if (!templates.has(key)) templates.set(key, { template: key, count: 0, examples: [], slugs: [] });
      const t = templates.get(key);
      t.count++;
      if (t.examples.length < 3) t.examples.push('/' + segs.join('/'));
      if (t.slugs.length < 2000) t.slugs.push(segs[segs.length - 1] || '');
    }
  }
  const total = paths.length || 1;
  return [...templates.values()]
    .sort((a, b) => b.count - a.count)
    .map((t) => {
      // Tokens repetidos dentro de los slugs = modificadores típicos de SEO programático.
      const tok = new Map();
      t.slugs.forEach((s) => new Set(s.split(/[-_]+/)).forEach((w) => w.length > 1 && tok.set(w, (tok.get(w) || 0) + 1)));
      const modifiers = [...tok.entries()]
        .filter(([, c]) => c >= Math.max(3, t.count * 0.15))
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([w, c]) => ({ token: w, share: Math.round((c / t.count) * 100) }));
      const programmatic = t.count >= 50 && (modifiers.length >= 1 || /\{(slug|id)\}/.test(t.template));
      const { slugs, ...rest } = t;
      return { ...rest, share: Math.round((t.count / total) * 100), modifiers, programmaticSignal: programmatic };
    });
}

function freshness(urls) {
  const dated = urls.map((u) => Date.parse(u.lastmod)).filter((d) => !Number.isNaN(d));
  const now = Date.now();
  const day = 86400000;
  const byMonth = {};
  dated.forEach((d) => { const k = new Date(d).toISOString().slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1; });
  return {
    withLastmod: dated.length,
    withoutLastmod: urls.length - dated.length,
    last7d: dated.filter((d) => now - d <= 7 * day).length,
    last30d: dated.filter((d) => now - d <= 30 * day).length,
    last90d: dated.filter((d) => now - d <= 90 * day).length,
    newest: dated.length ? new Date(Math.max(...dated)).toISOString() : null,
    oldest: dated.length ? new Date(Math.min(...dated)).toISOString() : null,
    byMonth: Object.fromEntries(Object.entries(byMonth).sort().slice(-18)),
    // Si casi todo tiene el mismo lastmod, el sitio lo genera automáticamente (señal poco fiable).
    suspiciousUniformLastmod: dated.length > 20 && new Set(dated.map((d) => new Date(d).toISOString().slice(0, 10))).size <= 2,
  };
}

/** Análisis completo de dominio a partir de robots.txt y sitemaps. */
export async function analyzeSitemaps(domainOrUrl, { maxUrls = 50000, maxSitemaps = 200 } = {}) {
  const base = /^https?:\/\//.test(domainOrUrl) ? domainOrUrl : `https://${domainOrUrl}`;
  const origin = new URL(base).origin;
  const robots = await getRobots(origin);

  const candidates = robots.sitemaps.length
    ? robots.sitemaps
    : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];

  const state = { visited: new Set(), sitemaps: [], urls: [], maxUrls, maxSitemaps, truncated: false };
  for (const c of candidates) await readSitemap(c, state);

  const locs = state.urls.map((u) => u.loc);
  const uniq = [...new Set(locs)];
  const hosts = [...new Set(uniq.map((u) => { try { return new URL(u).host; } catch { return null; } }).filter(Boolean))];
  const langs = {};
  uniq.forEach((u) => { const m = new URL(u).pathname.match(/^\/([a-z]{2}(-[a-z]{2})?)(\/|$)/i); if (m) langs[m[1].toLowerCase()] = (langs[m[1].toLowerCase()] || 0) + 1; });
  const sections = {};
  uniq.forEach((u) => { const s = new URL(u).pathname.split('/').filter(Boolean)[0] || '/'; sections[s] = (sections[s] || 0) + 1; });

  return {
    origin,
    analyzedAt: new Date().toISOString(),
    robots: {
      status: robots.status,
      sitemapsDeclared: robots.sitemaps,
      groups: robots.groups,
      botAccessHome: Object.fromEntries(BOTS.map((b) => [b, isAllowed(robots, b, '/')])),
      raw: robots.raw.slice(0, 5000),
    },
    sitemaps: state.sitemaps,
    totals: {
      urls: uniq.length,
      duplicates: locs.length - uniq.length,
      truncated: state.truncated,
      hosts,
      withImages: state.urls.filter((u) => u.images).length,
      news: state.urls.filter((u) => u.hasNews).length,
      video: state.urls.filter((u) => u.hasVideo).length,
    },
    sections: Object.fromEntries(Object.entries(sections).sort((a, b) => b[1] - a[1]).slice(0, 25)),
    languagePrefixes: langs,
    templates: detectTemplates(uniq).slice(0, 25),
    freshness: freshness(state.urls),
    sampleUrls: uniq.slice(0, 20),
  };
}
