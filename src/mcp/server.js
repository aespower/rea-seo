#!/usr/bin/env node
// Servidor MCP (stdio) de REA-SEO. Expone las herramientas a Claude Code, Claude Desktop o Cursor.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { inspectPage, crawlSite } from '../crawler.js';
import { analyzeSitemaps } from '../sitemap-analyzer.js';
import { fullAnalysis, compareUrls } from '../analyze.js';
import { keywordFit } from '../lib/keyword.js';
import { closeBrowser } from '../lib/render.js';

// Recorta campos pesados para no saturar el contexto del modelo.
function slim(signals) {
  if (!signals) return null;
  const { links, structuredData, ...rest } = signals;
  const { internal, external, ...linkStats } = links;
  return {
    ...rest,
    headings: rest.headings.slice(0, 60),
    links: { ...linkStats, sampleInternal: internal.slice(0, 25) },
    structuredData: { ...structuredData, jsonLd: JSON.stringify(structuredData.jsonLd).slice(0, 6000) },
  };
}

const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: `Error: ${e.message || e}` }] });
const wrap = (fn) => async (args) => { try { return ok(await fn(args)); } catch (e) { return fail(e); } };

const server = new McpServer({ name: 'rea-seo', version: '0.1.0' });

server.registerTool('inspect_seo_architecture', {
  title: 'Inspeccionar arquitectura SEO',
  description: 'Analiza una URL: head, schema, encabezados, contenido, enlazado, acceso de bots y un rastreo BFS corto del dominio (profundidad de clics y páginas más enlazadas).',
  inputSchema: {
    url: z.string().url(),
    maxPages: z.number().int().min(1).max(200).optional().describe('Páginas a rastrear (por defecto 30)'),
  },
}, wrap(async ({ url, maxPages = 30 }) => {
  const page = await inspectPage(url, { render: false });
  const crawl = await crawlSite(new URL(page.url).origin, { maxPages, maxDepth: 3 });
  return { url: page.url, http: page.http, indexability: page.indexability, botAccess: page.botAccess, signals: slim(page.raw), crawl: { ...crawl, pages: crawl.pages.slice(0, 60) } };
}));

server.registerTool('compare_raw_vs_rendered', {
  title: 'HTML crudo vs renderizado',
  description: 'Compara el HTML inicial (sin JS) con el DOM renderizado en Chromium móvil. Detecta SSR/CSR, contenido y schema inyectado por JS, APIs internas y tiempos.',
  inputSchema: { url: z.string().url() },
}, wrap(async ({ url }) => {
  const p = await inspectPage(url, { render: true });
  return { url: p.url, rawVsRendered: p.rawVsRendered, renderInfo: p.renderInfo };
}));

server.registerTool('extract_programmatic_patterns', {
  title: 'Patrones programáticos del dominio',
  description: 'Lee robots.txt y todos los sitemaps de un dominio. Devuelve secciones, plantillas de URL, modificadores, señales de SEO programático y frescura (lastmod).',
  inputSchema: { domain: z.string().describe('Dominio o URL, ej. ejemplo.com') },
}, wrap(async ({ domain }) => {
  const s = await analyzeSitemaps(domain);
  return { ...s, robots: { ...s.robots, raw: s.robots.raw.slice(0, 2000) } };
}));

server.registerTool('reverse_engineer_serp_winner', {
  title: 'Ingeniería inversa del ganador de la SERP',
  description: 'Análisis completo de una URL que rankea para una keyword: página + render + sitemaps + rastreo + ajuste a la keyword. Guarda el informe en reports/ y devuelve hallazgos y ruta.',
  inputSchema: { url: z.string().url(), target_keyword: z.string().min(2) },
}, wrap(async ({ url, target_keyword }) => {
  const r = await fullAnalysis(url, { keyword: target_keyword, maxPages: 30 });
  const s = r.page.rendered || r.page.raw;
  return {
    saved: r.saved,
    keyword: r.keyword ?? keywordFit(s, target_keyword, r.page.url),
    page: { http: r.page.http, indexability: r.page.indexability, signals: slim(s), rawVsRendered: r.page.rawVsRendered },
    sitemap: r.sitemap && { totals: r.sitemap.totals, templates: r.sitemap.templates.slice(0, 10), freshness: r.sitemap.freshness },
    crawl: r.crawl && { depthDistribution: r.crawl.depthDistribution, mostLinked: r.crawl.mostLinked.slice(0, 10) },
  };
}));

server.registerTool('compare_competitors', {
  title: 'Comparar competidores de una keyword',
  description: 'Compara 2-10 URLs que compiten por la misma keyword y calcula la mediana (benchmark) de palabras, H2, preguntas, schema, enlaces y LCP.',
  inputSchema: { urls: z.array(z.string().url()).min(2).max(10), keyword: z.string().optional(), render: z.boolean().optional() },
}, wrap(({ urls, keyword, render = true }) => compareUrls(urls, { keyword, render })));

const transport = new StdioServerTransport();
await server.connect(transport);
const shutdown = async () => { await closeBrowser(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
