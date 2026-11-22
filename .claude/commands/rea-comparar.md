---
description: Compara el Top de Google para una keyword y calcula las brechas
argument-hint: <keyword entre comillas> <url1> <url2> [url3...] [mi-url]
---

Compara competidores SEO: $ARGUMENTS
(El primer argumento entre comillas es la keyword. El resto son URLs. Si el usuario marca una como "mía", trátala como la página a mejorar.)

1. Ejecuta `node src/cli.js compare <urls...> --keyword "<keyword>"`.
2. Lee el `report.md` de la comparativa.
3. Para la URL #1 ejecuta además `node src/cli.js analyze <url1> --keyword "<keyword>" --max-pages 20`.
4. Completa la sección `## Brechas y plan` con:
   - El **benchmark mínimo** para competir (mediana de palabras, H2, preguntas, schema, enlaces internos, LCP).
   - Términos y subtemas que comparten los ganadores y que faltan en mi página.
   - Tabla de acciones priorizadas: acción, capa, impacto, esfuerzo.
   - Qué no se pudo medir (backlinks, autoridad, CTR).
5. Usa solo cifras del informe. Marca las suposiciones como **[hipótesis]**.
