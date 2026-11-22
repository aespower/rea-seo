#!/usr/bin/env node
// CLI de REA-SEO.
import { parseArgs } from 'node:util';
import { fullAnalysis, compareUrls } from './analyze.js';
import { inspectPage, crawlSite } from './crawler.js';
import { analyzeSitemaps } from './sitemap-analyzer.js';
import { closeBrowser } from './lib/render.js';

const HELP = `REA-SEO — ingeniería inversa de posicionamiento SEO

Uso:
  rea-seo analyze <url> [--keyword "kw"] [--no-render] [--no-crawl] [--no-sitemaps] [--max-pages 40] [--max-depth 3]
  rea-seo compare <url1> <url2> [...] [--keyword "kw"] [--no-render]
  rea-seo inspect <url> [--no-render]          Solo la página (JSON a stdout)
  rea-seo crawl <url> [--max-pages 50] [--max-depth 3]   (JSON a stdout)
  rea-seo sitemap <dominio>                     (JSON a stdout)

Variables: REA_SEO_DELAY_MS (1000), REA_SEO_TIMEOUT_MS (20000), REA_SEO_UA`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    keyword: { type: 'string', short: 'k' },
    'no-render': { type: 'boolean' },
    'no-crawl': { type: 'boolean' },
    'no-sitemaps': { type: 'boolean' },
    'max-pages': { type: 'string' },
    'max-depth': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [cmd, ...args] = positionals;
const render = !values['no-render'];
const maxPages = Number(values['max-pages'] ?? 40);
const maxDepth = Number(values['max-depth'] ?? 3);
const print = (o) => console.log(JSON.stringify(o, null, 2));

async function main() {
  if (!cmd || values.help) return console.log(HELP);
  if (!args[0]) throw new Error('Falta la URL o dominio.');
  switch (cmd) {
    case 'analyze': {
      const r = await fullAnalysis(args[0], {
        keyword: values.keyword, render, maxPages, maxDepth,
        crawl: !values['no-crawl'], sitemaps: !values['no-sitemaps'],
      });
      console.error(`✔ Informe: ${r.saved.reportPath}\n✔ Datos:   ${r.saved.dataPath}`);
      break;
    }
    case 'compare': {
      const r = await compareUrls(args, { keyword: values.keyword, render });
      console.error(`✔ Comparativa: ${r.saved.reportPath}`);
      break;
    }
    case 'inspect': print(await inspectPage(args[0], { render })); break;
    case 'crawl': print(await crawlSite(args[0], { maxPages, maxDepth })); break;
    case 'sitemap': print(await analyzeSitemaps(args[0])); break;
    default: console.log(HELP); process.exitCode = 1;
  }
}

main()
  .catch((e) => { console.error('✖', e.message); process.exitCode = 1; })
  .finally(closeBrowser);
