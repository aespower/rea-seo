---
description: Mapea la arquitectura y el SEO programático de un dominio desde sus sitemaps
argument-hint: <dominio>
---

Mapea la arquitectura del dominio: $ARGUMENTS

1. Ejecuta `node src/cli.js sitemap $ARGUMENTS > /tmp/sitemap.json`.
2. Ejecuta `node src/cli.js crawl https://$ARGUMENTS --max-pages 40 > /tmp/crawl.json` (quita `https://` si ya viene en el argumento).
3. Lee ambos JSON y escribe `reports/arquitectura-<dominio>.md` con:
   - Secciones y volumen de URLs por sección.
   - Plantillas de URL, modificadores y cuáles son SEO programático.
   - Ritmo de publicación y actualización (lastmod por mes, últimos 30/90 días).
   - Profundidad de clics y páginas más enlazadas (money pages).
   - Política de bots de IA en robots.txt.
   - Cómo replicar la arquitectura: lista de plantillas a crear y orden de prioridad.
