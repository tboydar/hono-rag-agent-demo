// CJK-aware tokenizer: latin/number words + Chinese unigrams & bigrams.
// Bigrams give precision, unigrams keep recall for short terms.

const TOKEN_RE = /[a-z0-9_./#-]+|[㐀-䶿一-鿿豈-﫿〇]+/g;
const CJK_RE = /^[㐀-䶿一-鿿豈-﫿〇]/;

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const re = new RegExp(TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  const lower = text.toLowerCase();
  while ((m = re.exec(lower))) {
    const s = m[0];
    if (s.length === 0) continue;
    if (CJK_RE.test(s)) {
      for (let i = 0; i < s.length; i++) {
        tokens.push(s[i]);
        if (i + 1 < s.length) tokens.push(s.slice(i, i + 2));
      }
    } else {
      tokens.push(s);
    }
  }
  return tokens;
}
