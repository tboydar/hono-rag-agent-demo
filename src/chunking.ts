// Markdown chunker: split on headings, keep a breadcrumb path,
// merge small sections and split oversized ones by paragraphs.

export interface DocChunk {
  heading: string;
  text: string;
}

const MAX_CHARS = 520;
const MIN_CHARS = 80;

interface Section {
  heading: string;
  body: string;
}

function splitSections(markdown: string): { title: string; sections: Section[] } {
  const lines = markdown.split(/\r?\n/);
  let title = "";
  const sections: Section[] = [];
  let heading = "";
  let buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    if (heading || body) sections.push({ heading, body });
    buf = [];
  };

  for (const line of lines) {
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1 && !title) {
        title = text;
        heading = "";
      } else {
        heading = text;
      }
    } else {
      buf.push(line);
    }
  }
  flush();
  return { title, sections };
}

function splitLong(heading: string, body: string): DocChunk[] {
  const chunks: DocChunk[] = [];
  const paras = body.split(/\n{2,}/);
  let buf = "";
  for (const p of paras) {
    if (buf && buf.length + p.length + 2 > MAX_CHARS) {
      chunks.push({ heading, text: buf.trim() });
      // small overlap keeps context across the boundary
      const tail = buf.trim().slice(-60);
      buf = tail + "\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) chunks.push({ heading, text: buf.trim() });
  return chunks;
}

export function chunkMarkdown(markdown: string): { title: string; chunks: DocChunk[] } {
  const { title, sections } = splitSections(markdown);
  const raw: DocChunk[] = [];
  for (const s of sections) {
    const text = s.body.trim();
    if (!text && !s.heading) continue;
    if (text.length > MAX_CHARS) raw.push(...splitLong(s.heading, text));
    else raw.push({ heading: s.heading, text });
  }

  // merge tiny chunks into the previous one
  const merged: DocChunk[] = [];
  for (const c of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.text.length + c.text.length + 2 <= MAX_CHARS && (c.text.length < MIN_CHARS || prev.text.length < MIN_CHARS)) {
      prev.text = prev.heading === c.heading ? `${prev.text}\n${c.text}` : `${prev.text}\n\n## ${c.heading}\n${c.text}`;
    } else {
      merged.push({ ...c });
    }
  }
  return { title, chunks: merged };
}
