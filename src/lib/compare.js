// Compara HTML crudo (lo que ve un bot sin JS) contra DOM renderizado (lo que ve Chrome).

const pct = (a, b) => (b ? Math.round((a / b) * 100) : a ? 100 : 0);

export function compareRawRendered(raw, rendered) {
  if (!rendered) return { available: false };
  const diff = {
    available: true,
    title: { raw: raw.head.title, rendered: rendered.head.title, changed: raw.head.title !== rendered.head.title },
    metaDescriptionChanged: raw.head.metaDescription !== rendered.head.metaDescription,
    canonical: { raw: raw.head.canonical, rendered: rendered.head.canonical, changed: raw.head.canonical !== rendered.head.canonical },
    metaRobotsChanged: raw.head.metaRobots !== rendered.head.metaRobots,
    h1: { raw: raw.headingCounts.h1, rendered: rendered.headingCounts.h1 },
    headings: { raw: raw.headings.length, rendered: rendered.headings.length },
    words: { raw: raw.content.wordCount, rendered: rendered.content.wordCount, rawShare: pct(raw.content.wordCount, rendered.content.wordCount) },
    internalLinks: { raw: raw.links.internalUnique, rendered: rendered.links.internalUnique, rawShare: pct(raw.links.internalUnique, rendered.links.internalUnique) },
    schema: {
      raw: raw.structuredData.schemaTypes,
      rendered: rendered.structuredData.schemaTypes,
      injectedByJs: rendered.structuredData.schemaTypes.filter((t) => !raw.structuredData.schemaTypes.includes(t)),
    },
    headingsOnlyInRendered: rendered.headings
      .filter((h) => !raw.headings.some((r) => r.text === h.text))
      .slice(0, 15),
  };

  const share = diff.words.rawShare;
  diff.renderingMode =
    share >= 90 ? 'SSR/SSG (contenido completo en HTML inicial)' :
    share >= 50 ? 'Híbrido (SSR parcial + contenido inyectado por JS)' :
    'CSR (la mayor parte del contenido depende de JavaScript)';

  diff.risks = [];
  if (share < 90) diff.risks.push(`Solo ${share}% del texto está en el HTML inicial. Bots sin JS (y muchos crawlers de IA) ven menos contenido.`);
  if (diff.internalLinks.rawShare < 80) diff.risks.push(`Solo ${diff.internalLinks.rawShare}% de los enlaces internos existen sin JS. Puede frenar el descubrimiento de URLs.`);
  if (diff.title.changed) diff.risks.push('El <title> cambia tras ejecutar JS.');
  if (diff.canonical.changed) diff.risks.push('El canonical cambia tras ejecutar JS. Señal contradictoria para Google.');
  if (diff.metaRobotsChanged) diff.risks.push('La meta robots cambia tras ejecutar JS.');
  if (diff.schema.injectedByJs.length) diff.risks.push(`Schema inyectado por JS: ${diff.schema.injectedByJs.join(', ')}.`);
  if (raw.headingCounts.h1 === 0 && rendered.headingCounts.h1 > 0) diff.risks.push('El H1 solo aparece tras renderizar.');
  return diff;
}
