// Parser simple de robots.txt (grupos por user-agent, Allow/Disallow con * y $, Sitemap).
import { fetchText } from './http.js';

export function parseRobots(text = '') {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') sitemaps.push(value);
    else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push({ type: key, path: value });
    } else if (key === 'crawl-delay' && current) {
      current.crawlDelay = Number(value);
    }
  }
  return { groups, sitemaps };
}

function ruleToRegex(path) {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .replace(/[.+?^{}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

function groupFor(parsed, agent) {
  const a = agent.toLowerCase();
  return (
    parsed.groups.find((g) => g.agents.some((x) => x !== '*' && a.includes(x))) ||
    parsed.groups.find((g) => g.agents.includes('*'))
  );
}

/** true si el agente puede rastrear la ruta (regla más larga gana; Allow gana empates). */
export function isAllowed(parsed, agent, pathname) {
  const g = groupFor(parsed, agent);
  if (!g) return true;
  let best = null;
  for (const r of g.rules) {
    if (r.type === 'disallow' && r.path === '') continue;
    if (ruleToRegex(r.path).test(pathname)) {
      if (!best || r.path.length > best.path.length ||
          (r.path.length === best.path.length && r.type === 'allow')) best = r;
    }
  }
  return !best || best.type === 'allow';
}

const cache = new Map();

/** Descarga y cachea robots.txt de un origen. */
export async function getRobots(origin) {
  if (cache.has(origin)) return cache.get(origin);
  const res = await fetchText(new URL('/robots.txt', origin).href, { accept: 'text/plain' });
  const parsed = res.ok ? parseRobots(res.body) : { groups: [], sitemaps: [] };
  const out = { status: res.status, raw: res.ok ? res.body : '', ...parsed };
  cache.set(origin, out);
  return out;
}

/** Bots que importan para SEO clásico y para visibilidad en IA. */
export const BOTS = [
  'Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'CCBot',
];
