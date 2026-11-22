// Orquestador: une crawler, sitemaps, keyword y reporte. Lo usan el CLI y el servidor MCP.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectPage, crawlSite } from './crawler.js';
import { analyzeSitemaps } from './sitemap-analyzer.js';
import { keywordFit } from './lib/keyword.js';
import { saveReport, slugFor } from './report.js';

export async function fullAnalysis(url, { keyword, render = true, crawl = true, sitemaps = true, maxPages = 40, maxDepth = 3, save = true } = {}) {
  const page = await inspectPage(url, { render });
  const sig = page.rendered || page.raw;
  const [sitemap, crawlData] = await Promise.all([
    sitemaps ? analyzeSitemaps(new URL(page.url).origin) : null,
    crawl ? crawlSite(new URL(page.url).origin, { maxPages, maxDepth }) : null,
  ]);
  const kw = keyword ? keywordFit(sig, keyword, page.url) : null;
  const data = { page, sitemap, crawl: crawlData, keyword: kw };
  if (save) data.saved = await saveReport(data);
  return data;
}

/** Compara varias URLs que compiten por la misma keyword. Devuelve tabla de brechas. */
export async function compareUrls(urls, { keyword, render = true, save = true } = {}) {
  const rows = [];
  for (const u of urls) {
    const p = await inspectPage(u, { render });
    const s = p.rendered || p.raw;
    rows.push({
      url: p.url,
      status: p.http.status,
      indexable: p.indexability.indexable,
      title: s.head.title,
      titleLength: s.head.titleLength,
      h1: s.headings.find((h) => h.level === 1)?.text || null,
      words: s.content.mainWordCount,
      h2: s.headingCounts.h2,
      h3: s.headingCounts.h3,
      questions: s.content.faqLike,
      images: s.images.total,
      tables: s.content.tables,
      lists: s.content.lists,
      internalLinks: s.links.internalUnique,
      externalLinks: s.links.externalCount,
      schema: s.structuredData.schemaTypes,
      rendering: p.rawVsRendered.available ? p.rawVsRendered.renderingMode.split(' ')[0] : 'sin render',
      lcp: p.renderInfo?.timing?.lcp ?? null,
      keywordScore: keyword ? keywordFit(s, keyword, p.url).score : null,
      topTerms: s.content.topBigrams.slice(0, 6).map((t) => t.term),
    });
  }
  const median = (k) => {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const benchmark = Object.fromEntries(['words', 'h2', 'h3', 'questions', 'images', 'tables', 'internalLinks', 'externalLinks', 'lcp', 'keywordScore'].map((k) => [k, median(k)]));
  const schemaFreq = {};
  rows.forEach((r) => r.schema.forEach((t) => (schemaFreq[t] = (schemaFreq[t] || 0) + 1)));
  const termFreq = {};
  rows.forEach((r) => r.topTerms.forEach((t) => (termFreq[t] = (termFreq[t] || 0) + 1)));
  const result = {
    keyword: keyword || null,
    analyzedAt: new Date().toISOString(),
    rows,
    benchmark,
    commonSchema: Object.entries(schemaFreq).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ type: t, pages: n })),
    sharedTerms: Object.entries(termFreq).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ term: t, pages: n })),
  };
  if (save) {
    const md = [
      `# REA-SEO · Comparativa${keyword ? ` para "${keyword}"` : ''}`,
      `> ${result.analyzedAt}`, '',
      `| # | URL | Palabras | H2 | H3 | Preguntas | Imgs | Links int. | Schema | Render | LCP | KW |`,
      `|---|---|---|---|---|---|---|---|---|---|---|---|`,
      ...rows.map((r, i) => `| ${i + 1} | ${r.url} | ${r.words} | ${r.h2} | ${r.h3} | ${r.questions} | ${r.images} | ${r.internalLinks} | ${r.schema.join(', ') || '—'} | ${r.rendering} | ${r.lcp ?? '—'} | ${r.keywordScore ?? '—'} |`),
      `| | **Mediana** | ${benchmark.words} | ${benchmark.h2} | ${benchmark.h3} | ${benchmark.questions} | ${benchmark.images} | ${benchmark.internalLinks} | | | ${benchmark.lcp ?? '—'} | ${benchmark.keywordScore ?? '—'} |`,
      '', `**Schema más común:** ${result.commonSchema.map((s) => `${s.type} (${s.pages})`).join(', ') || '—'}`,
      `**Términos compartidos (2-gramas):** ${result.sharedTerms.map((t) => `${t.term} (${t.pages})`).join(', ') || '—'}`,
      '', `## Brechas y plan (análisis del agente)`, `<!-- Claude Code completa esta sección. -->`, '',
    ].join('\n');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const folder = path.join('reports', `comparativa-${slugFor(urls[0])}-${stamp}`);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'data.json'), JSON.stringify(result, null, 2));
    await writeFile(path.join(folder, 'report.md'), md);
    result.saved = { folder, reportPath: path.join(folder, 'report.md') };
  }
  return result;
}
