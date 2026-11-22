// Genera el informe Markdown de ingeniería inversa a partir de los datos recolectados.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const yes = (b) => (b ? '✅' : '❌');
const na = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const esc = (s = '') => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function sectionPage(p) {
  const s = p.rendered || p.raw;
  const d = p.rawVsRendered;
  const L = [];
  L.push(`## 1. Página objetivo`);
  L.push(`- URL: ${p.url}`);
  L.push(`- Estado HTTP: ${p.http.status}${p.http.redirected ? ` (redirige a ${p.http.finalUrl})` : ''} · respuesta ${p.http.responseMs} ms`);
  L.push(`- Indexable: ${yes(p.indexability.indexable)} (noindex: ${p.indexability.noindex ? 'sí' : 'no'}, canonical propio: ${na(p.indexability.canonicalSelf)})`);
  L.push(`- Stack detectado: ${s.tech.frameworks.join(', ') || 'no identificado'} · CDN: ${na(p.http.cdn)} · servidor: ${na(p.http.server)}`);
  L.push('');
  L.push(`### Head`);
  L.push(`| Señal | Valor |`, `|---|---|`);
  L.push(`| Title (${s.head.titleLength} car.) | ${esc(na(s.head.title))} |`);
  L.push(`| Meta description (${s.head.metaDescriptionLength} car.) | ${esc(na(s.head.metaDescription))} |`);
  L.push(`| Canonical | ${na(s.head.canonical)} |`);
  L.push(`| Meta robots / X-Robots-Tag | ${na(s.head.metaRobots)} / ${na(p.http.xRobotsTag)} |`);
  L.push(`| Idioma | ${na(s.head.lang)} |`);
  L.push(`| Hreflang | ${s.head.hreflang.length ? s.head.hreflang.map((h) => h.lang).join(', ') : '—'} |`);
  L.push(`| Open Graph | ${Object.keys(s.head.openGraph).length} etiquetas |`);
  L.push('');
  L.push(`### Datos estructurados`);
  L.push(`- Bloques JSON-LD: ${s.structuredData.jsonLdCount} · Tipos: ${s.structuredData.schemaTypes.join(', ') || 'ninguno'}`);
  if (s.structuredData.microdataTypes.length) L.push(`- Microdata: ${s.structuredData.microdataTypes.join(', ')}`);
  if (s.structuredData.jsonLdErrors.length) L.push(`- ⚠️ JSON-LD inválido: ${s.structuredData.jsonLdErrors.length} bloque(s)`);
  L.push('');
  L.push(`### Estructura de contenido`);
  L.push(`- Palabras totales: ${s.content.wordCount} · en contenedor principal (\`${s.content.mainContainer}\`): ${s.content.mainWordCount}`);
  L.push(`- Encabezados: ${Object.entries(s.headingCounts).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  L.push(`- Párrafos ${s.content.paragraphs} · listas ${s.content.lists} · tablas ${s.content.tables} · encabezados tipo pregunta ${s.content.faqLike}`);
  L.push(`- Imágenes: ${s.images.total} (sin alt: ${s.images.withoutAlt}, lazy: ${s.images.lazy}, webp/avif: ${s.images.modernFormats})`);
  L.push('');
  L.push(`**Esqueleto de encabezados**`);
  L.push('```');
  s.headings.slice(0, 40).forEach((h) => L.push(`${'  '.repeat(h.level - 1)}H${h.level} ${h.text.slice(0, 110)}`));
  if (s.headings.length > 40) L.push(`... (${s.headings.length - 40} más)`);
  L.push('```');
  L.push('');
  L.push(`**Términos dominantes (contenido principal)**`);
  L.push(`- 1-grama: ${s.content.topKeywords.map((k) => `${k.term} (${k.density}%)`).join(', ')}`);
  L.push(`- 2-grama: ${s.content.topBigrams.map((k) => `${k.term} (${k.count})`).join(', ') || '—'}`);
  L.push(`- 3-grama: ${s.content.topTrigrams.map((k) => `${k.term} (${k.count})`).join(', ') || '—'}`);
  L.push(`- Entidades candidatas: ${s.content.entities.map((e) => e.name).join(', ') || '—'}`);
  L.push('');
  L.push(`### Enlazado`);
  L.push(`- Internos: ${s.links.internalCount} (${s.links.internalUnique} únicos) · nav ${s.links.byZone.nav} · cuerpo ${s.links.byZone.body} · footer ${s.links.byZone.footer}`);
  L.push(`- Externos: ${s.links.externalCount} · nofollow/ugc/sponsored: ${s.links.nofollowCount}`);
  L.push(`- Anchors internos más usados: ${s.links.topInternalAnchors.slice(0, 10).map((a) => `"${a.anchor}" ×${a.count}`).join(', ') || '—'}`);
  L.push(`- Dominios externos citados: ${s.links.externalDomains.slice(0, 12).join(', ') || '—'}`);
  L.push('');
  L.push(`### HTML crudo vs DOM renderizado`);
  if (!d.available) {
    L.push(`- Render no disponible${p.renderInfo?.error ? `: ${p.renderInfo.error}` : ''}. Ejecuta \`npm run browsers\`.`);
  } else {
    L.push(`- Modo de renderizado: **${d.renderingMode}**`);
    L.push(`| Métrica | Crudo | Renderizado |`, `|---|---|---|`);
    L.push(`| Palabras | ${d.words.raw} | ${d.words.rendered} |`);
    L.push(`| Enlaces internos únicos | ${d.internalLinks.raw} | ${d.internalLinks.rendered} |`);
    L.push(`| H1 | ${d.h1.raw} | ${d.h1.rendered} |`);
    L.push(`| Encabezados | ${d.headings.raw} | ${d.headings.rendered} |`);
    L.push(`| Schema | ${d.schema.raw.join(', ') || '—'} | ${d.schema.rendered.join(', ') || '—'} |`);
    if (d.risks.length) { L.push('', '**Riesgos detectados:**'); d.risks.forEach((r) => L.push(`- ${r}`)); }
    const ri = p.renderInfo;
    if (ri?.timing) L.push('', `- Tiempos (móvil, laboratorio): TTFB ${na(ri.timing.ttfb)} ms · FCP ${na(ri.timing.fcp)} ms · LCP ${na(ri.timing.lcp)} ms · DOMContentLoaded ${na(ri.timing.domContentLoaded)} ms`);
    if (ri?.network) {
      L.push(`- Peticiones: ${ri.network.total} (${Object.entries(ri.network.byType).map(([k, v]) => `${k} ${v}`).join(', ')})`);
      if (ri.network.api.length) {
        L.push(`- APIs que alimentan contenido (fetch/xhr):`);
        ri.network.api.slice(0, 10).forEach((a) => L.push(`  - \`${a.method} ${a.url.slice(0, 140)}\` → ${a.status} ${a.contentType || ''}`));
      }
      L.push(`- Terceros: ${ri.network.thirdPartyHosts.slice(0, 15).join(', ') || '—'}`);
    }
  }
  L.push('');
  L.push(`### Acceso de bots (robots.txt)`);
  L.push(Object.entries(p.botAccess).map(([b, ok]) => `${b} ${yes(ok)}`).join(' · '));
  return L.join('\n');
}

function sectionKeyword(k) {
  if (!k) return '';
  const c = k.checks;
  return [
    `## 2. Ajuste a la keyword "${k.keyword}"`,
    `- Puntuación on-page: **${k.score}/100**`,
    `- Exacta en title: ${yes(c.exactInTitle)} (cobertura ${c.titleCoverage}%, empieza con la keyword: ${c.titleStartsWithKw ? 'sí' : 'no'})`,
    `- Exacta en H1: ${yes(c.exactInH1)} (cobertura ${c.h1Coverage}%)`,
    `- En meta description: ${yes(c.inMetaDescription)} · cobertura en URL: ${c.urlCoverage}%`,
    `- H2 que trabajan la keyword: ${c.h2WithKw} de ${c.h2Total}`,
  ].join('\n');
}

function sectionSitemap(s) {
  if (!s) return '';
  const L = [`## 3. Arquitectura del sitio (robots + sitemaps)`];
  L.push(`- robots.txt: HTTP ${s.robots.status} · sitemaps declarados: ${s.robots.sitemapsDeclared.length}`);
  L.push(`- Sitemaps leídos: ${s.sitemaps.length} · URLs únicas: ${s.totals.urls}${s.totals.truncated ? ' (truncado)' : ''} · duplicadas: ${s.totals.duplicates}`);
  L.push(`- Con imágenes: ${s.totals.withImages} · news: ${s.totals.news} · video: ${s.totals.video}`);
  if (Object.keys(s.languagePrefixes).length) L.push(`- Prefijos de idioma: ${Object.entries(s.languagePrefixes).map(([k, v]) => `${k} (${v})`).join(', ')}`);
  L.push('', `**Secciones principales**`);
  L.push(Object.entries(s.sections).slice(0, 12).map(([k, v]) => `\`/${k}\` ${v}`).join(' · '));
  L.push('', `**Plantillas de URL**`, `| Plantilla | URLs | % | Modificadores | ¿Programático? | Ejemplo |`, `|---|---|---|---|---|---|`);
  s.templates.slice(0, 15).forEach((t) => L.push(`| \`${t.template}\` | ${t.count} | ${t.share}% | ${t.modifiers.map((m) => m.token).join(', ') || '—'} | ${t.programmaticSignal ? '⚠️ sí' : 'no'} | \`${esc(t.examples[0])}\` |`));
  const f = s.freshness;
  L.push('', `**Frescura (lastmod)**`);
  L.push(`- Con lastmod: ${f.withLastmod} · sin lastmod: ${f.withoutLastmod}`);
  L.push(`- Actualizadas: 7 días ${f.last7d} · 30 días ${f.last30d} · 90 días ${f.last90d}`);
  L.push(`- Rango: ${na(f.oldest?.slice(0, 10))} → ${na(f.newest?.slice(0, 10))}${f.suspiciousUniformLastmod ? ' · ⚠️ lastmod uniforme (probablemente automático)' : ''}`);
  if (Object.keys(f.byMonth).length) L.push(`- Por mes: ${Object.entries(f.byMonth).map(([m, c]) => `${m}: ${c}`).join(' · ')}`);
  return L.join('\n');
}

function sectionCrawl(c) {
  if (!c) return '';
  const L = [`## 4. Rastreo interno (BFS, HTML crudo)`];
  L.push(`- Páginas rastreadas: ${c.crawled} · URLs descubiertas: ${c.discovered} · bloqueadas por robots: ${c.blockedByRobots.length}`);
  L.push(`- Profundidad de clics: ${Object.entries(c.depthDistribution).map(([d, n]) => `nivel ${d}: ${n}`).join(' · ')}`);
  L.push('', `**URLs con más enlaces internos entrantes (páginas que el sitio empuja)**`, `| URL | Inlinks | Anchors principales |`, `|---|---|---|`);
  c.mostLinked.slice(0, 12).forEach((m) => L.push(`| ${m.url} | ${m.inlinks} | ${esc(m.topAnchors.join(' / '))} |`));
  return L.join('\n');
}

/** Hallazgos automáticos. El agente los usa como base para escribir la "fórmula". */
export function autoFindings({ page, sitemap, keyword }) {
  const out = [];
  const s = page.rendered || page.raw;
  if (s.structuredData.schemaTypes.length) out.push(`Usa schema ${s.structuredData.schemaTypes.join(', ')}.`);
  else out.push('No usa datos estructurados. Oportunidad directa para superarla.');
  if (s.content.mainWordCount) out.push(`Contenido principal de ~${s.content.mainWordCount} palabras con ${s.headingCounts.h2} H2 y ${s.headingCounts.h3} H3.`);
  if (s.content.faqLike) out.push(`${s.content.faqLike} encabezados en forma de pregunta (captura de "People Also Ask").`);
  if (page.rawVsRendered.available) out.push(`Renderizado: ${page.rawVsRendered.renderingMode}.`);
  if (s.headingCounts.h1 !== 1) out.push(`Tiene ${s.headingCounts.h1} H1 (lo ideal es 1).`);
  if (s.head.titleLength > 60) out.push(`Title largo (${s.head.titleLength} car.). Google puede reescribirlo.`);
  if (s.images.total && s.images.withoutAlt / s.images.total > 0.3) out.push(`${s.images.withoutAlt}/${s.images.total} imágenes sin alt.`);
  if (keyword) out.push(`Ajuste on-page a "${keyword.keyword}": ${keyword.score}/100.`);
  const prog = sitemap?.templates.filter((t) => t.programmaticSignal) || [];
  if (prog.length) out.push(`Señales de SEO programático en: ${prog.map((t) => `\`${t.template}\` (${t.count} URLs)`).join(', ')}.`);
  if (sitemap?.freshness.last30d) out.push(`${sitemap.freshness.last30d} URLs actualizadas en los últimos 30 días.`);
  const aiBlocked = Object.entries(page.botAccess).filter(([b, ok]) => !ok && b !== 'Googlebot').map(([b]) => b);
  if (aiBlocked.length) out.push(`Bloquea a: ${aiBlocked.join(', ')}.`);
  return out;
}

export function buildReport({ page, sitemap, crawl, keyword }) {
  const host = new URL(page.url).host;
  const findings = autoFindings({ page, sitemap, keyword });
  return [
    `# REA-SEO · Ingeniería inversa de ${host}`,
    `> Generado: ${new Date().toISOString()} · Herramienta: REA-SEO v0.1`,
    '',
    `## 0. Hallazgos automáticos`,
    ...findings.map((f) => `- ${f}`),
    '',
    sectionPage(page),
    '',
    sectionKeyword(keyword),
    '',
    sectionSitemap(sitemap),
    '',
    sectionCrawl(crawl),
    '',
    `## 5. La fórmula (análisis del agente)`,
    `<!-- Claude Code completa esta sección siguiendo CLAUDE.md: fórmula, patrones replicables y plan para superarla. -->`,
    '',
  ].join('\n');
}

export function slugFor(url) {
  return new URL(url).host.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '_');
}

/** Guarda data.json + report.md en reports/<dominio>-<fecha>/ */
export async function saveReport(data, { dir = 'reports' } = {}) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const folder = path.join(dir, `${slugFor(data.page.url)}-${stamp}`);
  await mkdir(folder, { recursive: true });
  const md = buildReport(data);
  await writeFile(path.join(folder, 'data.json'), JSON.stringify(data, null, 2));
  await writeFile(path.join(folder, 'report.md'), md);
  return { folder, reportPath: path.join(folder, 'report.md'), dataPath: path.join(folder, 'data.json') };
}
