// Análisis de texto: conteo de palabras, keywords (1-3 gramas) y entidades candidatas.

const STOP_ES = `a al algo algunas algunos ante antes como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue fueron ha han hasta hay la las le les lo los mas más me mi mis muy no nos o os otra otras otro otros para pero poco por porque que qué se sea ser si sí sin sobre su sus también tan te tiene tu tus un una uno unos y ya yo son está están puede pueden cada todo todos toda todas así sus nuestro nuestra usted ustedes`.split(/\s+/);
const STOP_EN = `a an and are as at be but by for from has have i in is it its of on or that the this to was were will with you your we our they their not can all more about how what when which who why`.split(/\s+/);
export const STOP = new Set([...STOP_ES, ...STOP_EN]);

export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 1);
}

export function wordCount(text) {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

/** Top n-gramas sin stopwords en los extremos. Devuelve [{term, count, density}] */
export function topNgrams(text, { n = 1, limit = 15 } = {}) {
  const toks = tokenize(text);
  const counts = new Map();
  for (let i = 0; i + n <= toks.length; i++) {
    const gram = toks.slice(i, i + n);
    if (STOP.has(gram[0]) || STOP.has(gram[n - 1])) continue;
    if (gram.every((w) => /^\d+$/.test(w))) continue;
    const k = gram.join(' ');
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const total = Math.max(toks.length, 1);
  return [...counts.entries()]
    .filter(([, c]) => n === 1 || c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count, density: +((count * n * 100) / total).toFixed(2) }));
}

/**
 * Entidades candidatas: secuencias de palabras Capitalizadas que no inician oración.
 * Heurística simple, sin modelo de NLP. Útil como pista, no como verdad.
 */
export function candidateEntities(text, limit = 20) {
  const counts = new Map();
  const sentences = text.split(/[.!?¡¿\n]+/);
  for (const s of sentences) {
    const words = s.trim().split(/\s+/);
    let run = [];
    const flush = () => {
      if (run.length) {
        const k = run.join(' ');
        if (!STOP.has(k.toLowerCase()) && k.length > 2) counts.set(k, (counts.get(k) || 0) + 1);
      }
      run = [];
    };
    words.forEach((w, i) => {
      const clean = w.replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu, '');
      if (i > 0 && /^\p{Lu}[\p{L}\p{N}-]+$/u.test(clean)) {
        run.push(clean);
        if (/[,;:)]$/.test(w)) flush(); // la coma corta la entidad
      } else flush();
    });
    flush();
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
