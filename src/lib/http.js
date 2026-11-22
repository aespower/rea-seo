// Cliente HTTP "educado": user-agent honesto, timeout, límite de velocidad y caché de robots.txt.
import { gunzipSync } from 'node:zlib';

export const USER_AGENT =
  process.env.REA_SEO_UA ||
  'REA-SEO/0.1 (+https://github.com/aespower/rea-seo; analisis SEO)';

const DELAY_MS = Number(process.env.REA_SEO_DELAY_MS ?? 1000);
const TIMEOUT_MS = Number(process.env.REA_SEO_TIMEOUT_MS ?? 20000);

const lastHit = new Map(); // host -> timestamp

async function politeWait(url) {
  const host = new URL(url).host;
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + DELAY_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

/**
 * Descarga una URL. Devuelve { ok, status, url, headers, body, ms, redirected }.
 * Descomprime .gz si hace falta. Nunca lanza por códigos HTTP.
 */
export async function fetchText(url, { accept = '*/*' } = {}) {
  await politeWait(url);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    let buf = Buffer.from(await res.arrayBuffer());
    if (url.endsWith('.gz') || buf[0] === 0x1f && buf[1] === 0x8b) {
      try { buf = gunzipSync(buf); } catch { /* no era gzip */ }
    }
    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      headers: Object.fromEntries(res.headers.entries()),
      body: buf.toString('utf8'),
      ms: Date.now() - t0,
    };
  } catch (err) {
    return { ok: false, status: 0, url, headers: {}, body: '', ms: Date.now() - t0, error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}
