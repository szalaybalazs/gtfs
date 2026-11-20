/**
 * Search helpers: accent-insensitive, word-aware, typo-tolerant.
 * "szell kalman" finds "Széll Kálmán tér"; "deak" finds "Deák Ferenc tér";
 * "szel kalman" (missing letter) still matches by subsequence.
 */
export function normalise(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every character of `needle` appears in order in `hay`. */
function subsequence(needle: string, hay: string) {
  let i = 0;
  for (const c of hay) if (c === needle[i]) i++;
  return i === needle.length;
}

/** 0 = no match; higher is better. */
export function score(query: string, text: string): number {
  const q = normalise(query);
  const t = normalise(text);
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const words = t.split(" ");
  const tokens = q.split(" ");
  if (tokens.every((tok) => words.some((w) => w.startsWith(tok)))) return 60;
  if (t.includes(q)) return 40;
  if (tokens.every((tok) => t.includes(tok))) return 30;
  if (q.replace(/ /g, "").length >= 3 && subsequence(q.replace(/ /g, ""), t.replace(/ /g, ""))) return 10;
  return 0;
}
