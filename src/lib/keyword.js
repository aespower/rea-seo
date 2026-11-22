// Mide cómo una página trabaja una keyword objetivo (on-page).
import { tokenize, STOP } from './text.js';

const fold = (s = '') => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function keywordFit(signals, keyword, url) {
  const kw = fold(keyword).trim();
  const kwTokens = tokenize(kw).filter((w) => !STOP.has(w));
  const has = (s) => !!s && fold(s).includes(kw);
  const partial = (s) => {
    if (!s) return 0;
    const t = new Set(tokenize(fold(s)));
    return Math.round((kwTokens.filter((w) => t.has(w)).length / Math.max(kwTokens.length, 1)) * 100);
  };
  const h1 = signals.headings.filter((h) => h.level === 1).map((h) => h.text).join(' ');
  const h2s = signals.headings.filter((h) => h.level === 2);
  const slug = decodeURIComponent(new URL(url).pathname).replace(/[-_/]+/g, ' ');
  const allKw = signals.content.topKeywords.map((k) => k.term);

  const checks = {
    exactInTitle: has(signals.head.title),
    titleCoverage: partial(signals.head.title),
    titleStartsWithKw: fold(signals.head.title || '').startsWith(kw),
    exactInH1: has(h1),
    h1Coverage: partial(h1),
    inMetaDescription: has(signals.head.metaDescription),
    urlCoverage: partial(slug),
    h2WithKw: h2s.filter((h) => partial(h.text) >= 50).length,
    h2Total: h2s.length,
    kwTokensInTopKeywords: kwTokens.filter((w) => allKw.includes(w)),
  };
  const score =
    (checks.exactInTitle ? 25 : checks.titleCoverage * 0.15) +
    (checks.exactInH1 ? 20 : checks.h1Coverage * 0.1) +
    (checks.inMetaDescription ? 10 : 0) +
    checks.urlCoverage * 0.15 +
    Math.min(checks.h2WithKw, 3) * 5 +
    checks.kwTokensInTopKeywords.length / Math.max(kwTokens.length, 1) * 15;
  return { keyword, score: Math.round(Math.min(score, 100)), checks };
}
