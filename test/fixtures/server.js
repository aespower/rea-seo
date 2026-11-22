// Sitio de prueba local: SSR + contenido inyectado por JS + API + sitemaps + robots.
import http from 'node:http';

const cities = ['madrid', 'barcelona', 'valencia', 'sevilla', 'bilbao', 'malaga'];

const home = (base) => `<!doctype html><html lang="es"><head>
<title>Remedios caseros naturales para el cabello | Guía 2026</title>
<meta name="description" content="Aprende remedios caseros naturales para el cabello con ingredientes de cocina.">
<link rel="canonical" href="${base}/">
<meta property="og:title" content="Remedios caseros">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Remedios","author":{"@type":"Person","name":"Ana"}}</script>
</head><body>
<header><nav><a href="/">Inicio</a> <a href="/blog/romero-para-el-cabello">Romero</a> <a href="/servicios/peluqueria-en-madrid">Madrid</a></nav></header>
<main>
<h1>Remedios caseros naturales para el cabello</h1>
<p>Los remedios caseros naturales para el cabello usan Romero, Aloe Vera y aceite de coco. El romero estimula el cuero cabelludo.</p>
<h2>¿Funciona el romero para el cabello?</h2><p>El romero para el cabello es el remedio casero más buscado.</p>
<h2>Aceite de coco</h2><p>El aceite de coco hidrata el cabello seco.</p>
<img src="/a.webp" alt="romero" loading="lazy"><img src="/b.jpg">
<div id="dyn"></div>
</main>
<footer><a href="/blog/aloe-vera">Aloe</a> <a href="https://example.org/estudio">Estudio</a></footer>
<script>
fetch('/api/extra').then(r=>r.json()).then(d=>{
  document.getElementById('dyn').innerHTML='<h2>'+d.h2+'</h2><p>'+d.text+'</p><a href="/blog/js-only">Solo JS</a>';
  const s=document.createElement('script');s.type='application/ld+json';s.textContent=JSON.stringify({"@context":"https://schema.org","@type":"FAQPage"});document.head.appendChild(s);
});
</script>
</body></html>`;

const page = (title, links = '') => `<!doctype html><html lang="es"><head><title>${title}</title></head><body><main><h1>${title}</h1><p>Contenido de ${title} sobre cabello y remedios.</p>${links}</main></body></html>`;

export function startFixture() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const base = `http://${req.headers.host}`;
      const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
      const u = req.url;
      if (u === '/robots.txt') return send(200, 'text/plain', `User-agent: *\nDisallow: /privado/\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${base}/sitemap_index.xml\n`);
      if (u === '/sitemap_index.xml') return send(200, 'application/xml', `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${base}/sitemap-blog.xml</loc></sitemap><sitemap><loc>${base}/sitemap-servicios.xml</loc></sitemap></sitemapindex>`);
      if (u === '/sitemap-blog.xml') return send(200, 'application/xml', `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['romero-para-el-cabello', 'aloe-vera', 'aceite-de-coco', 'js-only'].map((s, i) => `<url><loc>${base}/blog/${s}</loc><lastmod>2026-1${i % 2}-0${i + 1}</lastmod></url>`).join('')}</urlset>`);
      if (u === '/sitemap-servicios.xml') {
        const urls = [];
        for (const svc of ['peluqueria', 'barberia', 'spa', 'manicura', 'masajes', 'tintes', 'keratina', 'depilacion', 'maquillaje'])
          for (const c of cities) urls.push(`<url><loc>${base}/servicios/${svc}-en-${c}</loc></url>`);
        return send(200, 'application/xml', `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
      }
      if (u === '/api/extra') return send(200, 'application/json', JSON.stringify({ h2: 'Mascarilla de aguacate', text: 'Texto inyectado por JavaScript con muchas palabras extra para el análisis de renderizado del contenido dinámico.' }));
      if (u === '/') return send(200, 'text/html; charset=utf-8', home(base));
      if (u.startsWith('/privado')) return send(200, 'text/html', page('Privado'));
      if (u.startsWith('/blog/') || u.startsWith('/servicios/')) return send(200, 'text/html', page(u.split('/').pop(), '<a href="/">Inicio</a> <a href="/privado/x">P</a> <a href="/blog/aceite-de-coco">Coco</a>'));
      send(404, 'text/html', page('404'));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}
