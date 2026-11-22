# REA-SEO

**Ingeniería inversa de posicionamiento SEO para Claude Code.**
Inspirado en la filosofía *Reverse Engineer Anything*: dale al agente un entorno real de exploración (navegador headless, red, DOM, sitemaps) y un flujo fijo: **explorar → extraer → analizar → informe accionable**.

Responde una pregunta: **¿por qué esta página está en el Top 3 de Google y cómo la supero?**

## Qué mide

| Capa | Señales |
|---|---|
| Técnica | HTTP, redirecciones, indexabilidad, canonical, meta robots, X-Robots-Tag, CDN, stack (Next.js, WordPress, Shopify…) |
| Renderizado | HTML crudo vs DOM renderizado en Chromium móvil: % de texto y enlaces sin JS, schema inyectado, APIs fetch/xhr, TTFB/FCP/LCP |
| Semántica | Title, meta, esqueleto H1-H6, 1/2/3-gramas, densidad, entidades candidatas, encabezados tipo pregunta |
| Datos estructurados | JSON-LD (tipos anidados incluidos), microdata, errores de parseo |
| Arquitectura | robots.txt, sitemaps (índices y .gz), plantillas de URL, **detección de SEO programático**, profundidad de clics, páginas más enlazadas y sus anchors |
| Frescura y alcance | lastmod por mes, URLs actualizadas en 7/30/90 días, acceso de 10 bots (Googlebot, GPTBot, ClaudeBot, PerplexityBot…) |
| Keyword | Puntuación on-page 0-100: keyword en title, H1, meta, URL y H2 |
| Comparativa | Mediana (benchmark) de N competidores de la misma keyword |

## Instalación

```bash
git clone https://github.com/aespower/rea-seo.git
cd rea-seo
npm install
npm run browsers   # descarga Chromium para Playwright
claude             # abre Claude Code en la carpeta
```

¿No se puede descargar Chromium? Usa tu Chrome instalado:

```bash
export REA_SEO_CHROME_CHANNEL=chrome
# o bien
export REA_SEO_CHROME_PATH="/ruta/a/chrome"
```

## Uso con Claude Code (recomendado)

El proyecto trae `CLAUDE.md` con las reglas del agente y tres comandos:

```text
/rea-analizar https://competidor.com/pagina remedios caseros para el cabello
/rea-comparar "remedios caseros para el cabello" https://top1.com/a https://top2.com/b https://misitio.com/c
/rea-arquitectura competidor.com
```

Claude ejecuta las herramientas, lee el informe y escribe la sección **"La fórmula"**: por qué rankea, patrones replicables, debilidades y un plan priorizado para superarla.

## Uso por terminal

```bash
node src/cli.js analyze https://competidor.com/pagina --keyword "mi keyword"
node src/cli.js compare https://a.com/x https://b.com/y --keyword "mi keyword"
node src/cli.js inspect https://a.com/x --no-render    # JSON a stdout
node src/cli.js crawl https://a.com --max-pages 50
node src/cli.js sitemap a.com
```

Salida: `reports/<dominio>-<fecha>/report.md` + `data.json`.

Opciones de `analyze`: `--no-render`, `--no-crawl`, `--no-sitemaps`, `--max-pages 40`, `--max-depth 3`.

## Servidor MCP

Herramientas expuestas por stdio:

| Herramienta | Qué hace |
|---|---|
| `inspect_seo_architecture(url, maxPages?)` | Señales on-page + rastreo BFS corto |
| `compare_raw_vs_rendered(url)` | Diff SSR/CSR, schema inyectado, APIs, tiempos |
| `extract_programmatic_patterns(domain)` | robots + sitemaps + plantillas + frescura |
| `reverse_engineer_serp_winner(url, target_keyword)` | Análisis completo y guarda el informe |
| `compare_competitors(urls[], keyword?)` | Benchmark de la SERP |

**Claude Code:** el repo incluye `.mcp.json`. Al abrir `claude` en la carpeta, acepta el servidor `rea-seo`.
O regístralo a mano:

```bash
claude mcp add rea-seo -- node /ruta/absoluta/rea-seo/src/mcp/server.js
```

**Claude Desktop / Cursor** (`claude_desktop_config.json` o `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "rea-seo": {
      "command": "node",
      "args": ["/ruta/absoluta/rea-seo/src/mcp/server.js"],
      "env": { "REA_SEO_DELAY_MS": "1000" }
    }
  }
}
```

## Configuración

| Variable | Por defecto | Uso |
|---|---|---|
| `REA_SEO_DELAY_MS` | `1000` | Pausa entre peticiones al mismo host |
| `REA_SEO_TIMEOUT_MS` | `20000` | Timeout por petición |
| `REA_SEO_UA` | `REA-SEO/0.1 (+repo)` | User-agent (honesto, no suplantes a Googlebot) |
| `REA_SEO_CHROME_PATH` | — | Ruta a un Chrome/Chromium existente |
| `REA_SEO_CHROME_CHANNEL` | — | `chrome` o `msedge` para usar el navegador del sistema |

## Rastreo ético

- Respeta `robots.txt` y limita la velocidad por host.
- No evade protecciones anti-bot ni suplanta a Googlebot.
- Si un sitio bloquea (403/429), el análisis se detiene en esa parte y lo informa.

## Límites

- **No mide backlinks ni autoridad de dominio.** Para eso cruza con Ahrefs, Semrush, DataForSEO o Search Console.
- Las métricas de velocidad son de laboratorio (una carga), no datos reales de Chrome (CrUX).
- Las entidades son heurísticas (palabras capitalizadas), no NLP.

## Hoja de ruta

- [ ] Conector de SERP real (Serper.dev / DataForSEO) para obtener el Top 10 de una keyword automáticamente.
- [ ] Google Search Console para comparar con tus propias páginas.
- [ ] Extracción de "People Also Ask" y snippets destacados.
- [ ] Datos CrUX (Core Web Vitals reales).

## Desarrollo

```bash
npm test                                   # tests con un sitio local de prueba
REA_SEO_TEST_RENDER=1 npm test             # incluye el test de Playwright
```

## Licencia

MIT
