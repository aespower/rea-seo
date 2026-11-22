// Extrae señales SEO de un HTML con Cheerio. Se usa igual para HTML crudo y DOM renderizado.
import * as cheerio from 'cheerio';
import { wordCount, topNgrams, candidateEntities } from './text.js';

function abs(href, base) {
  try { return new URL(href, base).href.split('#')[0]; } catch { return null; }
}

function flattenSchemaTypes(node, out = new Set()) {
  if (Array.isArray(node)) node.forEach((n) => flattenSchemaTypes(n, out));
  else if (node && typeof node === 'object') {
    const t = node['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach((x) => out.add(String(x)));
    for (const v of Object.values(node)) if (v && typeof v === 'object') flattenSchemaTypes(v, out);
  }
  return out;
}

/** Devuelve un objeto con todas las señales on-page de un documento HTML. */
export function extractSignals(html, pageUrl) {
  const $ = cheerio.load(html || '');
  const origin = new URL(pageUrl).origin;
  const meta = (sel) => $(sel).attr('content')?.trim() || null;

  // --- Meta y head ---
  const head = {
    title: $('head > title').first().text().trim() || null,
    metaDescription: meta('meta[name="description"]'),
    metaRobots: meta('meta[name="robots"]'),
    canonical: $('link[rel="canonical"]').attr('href') ? abs($('link[rel="canonical"]').attr('href'), pageUrl) : null,
    lang: $('html').attr('lang') || null,
    viewport: meta('meta[name="viewport"]'),
    hreflang: $('link[rel="alternate"][hreflang]').map((_, el) => ({
      lang: $(el).attr('hreflang'), href: abs($(el).attr('href'), pageUrl),
    })).get(),
    openGraph: Object.fromEntries($('meta[property^="og:"]').map((_, el) => [[$(el).attr('property'), $(el).attr('content')]]).get()),
    twitter: Object.fromEntries($('meta[name^="twitter:"]').map((_, el) => [[$(el).attr('name'), $(el).attr('content')]]).get()),
  };
  head.titleLength = head.title?.length ?? 0;
  head.metaDescriptionLength = head.metaDescription?.length ?? 0;

  // --- Datos estructurados ---
  const jsonLd = [];
  const jsonLdErrors = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try { jsonLd.push(JSON.parse(raw)); } catch (e) { jsonLdErrors.push(String(e.message)); }
  });
  const schemaTypes = [...flattenSchemaTypes(jsonLd)];
  const microdataTypes = [...new Set($('[itemtype]').map((_, el) => $(el).attr('itemtype').split('/').pop()).get())];

  // --- Encabezados ---
  const headings = $('h1,h2,h3,h4,h5,h6').map((_, el) => ({
    level: Number(el.tagName[1]), text: $(el).text().replace(/\s+/g, ' ').trim(),
  })).get().filter((h) => h.text);
  const headingCounts = Object.fromEntries([1, 2, 3, 4, 5, 6].map((l) => [`h${l}`, headings.filter((h) => h.level === l).length]));

  // --- Contenido principal ---
  const $body = $('body').clone();
  $body.find('script,style,noscript,template,svg,iframe').remove();
  const mainSel = ['main', 'article', '[role="main"]'].find((s) => $body.find(s).length);
  const mainText = (mainSel ? $body.find(mainSel).first() : $body).text().replace(/\s+/g, ' ').trim();
  const bodyText = $body.text().replace(/\s+/g, ' ').trim();

  const content = {
    wordCount: wordCount(bodyText),
    mainWordCount: wordCount(mainText),
    mainContainer: mainSel || 'body',
    topKeywords: topNgrams(mainText, { n: 1, limit: 15 }),
    topBigrams: topNgrams(mainText, { n: 2, limit: 10 }),
    topTrigrams: topNgrams(mainText, { n: 3, limit: 8 }),
    entities: candidateEntities(mainText, 15),
    paragraphs: $('p').length,
    lists: $('ul,ol').length,
    tables: $('table').length,
    faqLike: headings.filter((h) => /\?\s*$/.test(h.text)).length,
  };

  // --- Imágenes ---
  const imgs = $('img');
  const images = {
    total: imgs.length,
    withoutAlt: imgs.filter((_, el) => !$(el).attr('alt')?.trim()).length,
    lazy: imgs.filter((_, el) => $(el).attr('loading') === 'lazy').length,
    modernFormats: imgs.filter((_, el) => /\.(webp|avif)(\?|$)/i.test($(el).attr('src') || '')).length,
  };

  // --- Enlaces ---
  const internal = [];
  const external = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    const url = abs(href, pageUrl);
    if (!url) return;
    const rel = ($(el).attr('rel') || '').toLowerCase();
    const link = {
      url,
      anchor: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120) || $(el).find('img').attr('alt') || '',
      nofollow: /nofollow|ugc|sponsored/.test(rel),
      zone: $(el).closest('nav,header').length ? 'nav' : $(el).closest('footer').length ? 'footer' : 'body',
    };
    (new URL(url).origin === origin ? internal : external).push(link);
  });

  const anchorCounts = new Map();
  internal.forEach((l) => l.anchor && anchorCounts.set(l.anchor.toLowerCase(), (anchorCounts.get(l.anchor.toLowerCase()) || 0) + 1));

  const links = {
    internalCount: internal.length,
    internalUnique: new Set(internal.map((l) => l.url)).size,
    externalCount: external.length,
    nofollowCount: [...internal, ...external].filter((l) => l.nofollow).length,
    byZone: ['nav', 'body', 'footer'].reduce((acc, z) => ({ ...acc, [z]: internal.filter((l) => l.zone === z).length }), {}),
    topInternalAnchors: [...anchorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([anchor, count]) => ({ anchor, count })),
    externalDomains: [...new Set(external.map((l) => new URL(l.url).hostname))].slice(0, 30),
    internal,
    external,
  };

  // --- Scripts / framework ---
  const scripts = $('script[src]').map((_, el) => $(el).attr('src')).get();
  const htmlStr = html || '';
  const frameworks = [
    [/__NEXT_DATA__|\/_next\//, 'Next.js'],
    [/__NUXT__|\/_nuxt\//, 'Nuxt'],
    [/data-reactroot|react-dom/, 'React'],
    [/ng-version=/, 'Angular'],
    [/data-v-[a-f0-9]{6,}|vue(\.runtime)?(\.min)?\.js/, 'Vue'],
    [/astro-island|\/_astro\//, 'Astro'],
    [/wp-content|wp-includes/, 'WordPress'],
    [/cdn\.shopify\.com|Shopify\.theme/, 'Shopify'],
    [/static\.wixstatic\.com/, 'Wix'],
    [/__gatsby|\/page-data\//, 'Gatsby'],
    [/__sveltekit|_app\/immutable/, 'SvelteKit'],
    [/elementor/, 'Elementor'],
  ].filter(([re]) => re.test(htmlStr)).map(([, name]) => name);

  return {
    head,
    structuredData: { jsonLdCount: jsonLd.length, schemaTypes, microdataTypes, jsonLdErrors, jsonLd },
    headings,
    headingCounts,
    content,
    images,
    links,
    tech: { scripts: scripts.length, frameworks, htmlBytes: Buffer.byteLength(htmlStr) },
  };
}
