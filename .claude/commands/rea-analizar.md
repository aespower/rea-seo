---
description: Ingeniería inversa SEO completa de una URL que rankea para una keyword
argument-hint: <url> <keyword>
---

Ejecuta ingeniería inversa SEO completa sobre: $ARGUMENTS
(El primer argumento es la URL. El resto es la keyword objetivo.)

Sigue `CLAUDE.md` al pie de la letra:

1. Ejecuta `node src/cli.js analyze <url> --keyword "<keyword>"`. Si falla el navegador, repite con `--no-render` y anótalo.
2. Lee el `report.md` generado completo.
3. Analiza las 6 capas: técnica, renderizado, semántica, datos estructurados, arquitectura y frescura.
4. Responde estas preguntas con datos del informe:
   - ¿Usa SEO programático? ¿Con qué plantilla y modificadores?
   - ¿Cómo organiza sus clusters y su enlazado interno? ¿Qué páginas empuja?
   - ¿Qué cambia entre HTML crudo y DOM renderizado? ¿Qué riesgo implica?
   - ¿Qué schema usa y qué patrones de title/H1 e intención de búsqueda sigue?
5. Escribe la sección `## 5. La fórmula` en ese mismo `report.md` con el formato de `CLAUDE.md`. Incluye un JSON-LD de ejemplo listo para copiar.
6. Termina con un resumen de 5 líneas y la ruta del informe.
