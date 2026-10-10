// Markdown minimo da resposta da IA: paragrafos, listas ("- ", "* ", "1.") e **negrito**. Devolve dados,
// nunca HTML: quem desenha (AssistantLog) usa elementos do React, que escapam o texto sozinhos.
export type Inline = { text: string; bold: boolean };
export type Block = { kind: 'p'; parts: Inline[] } | { kind: 'ul'; items: Inline[][] };

export function inline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(/\*\*(.+?)\*\*/g)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}

export function parseMarkdown(text: string): Block[] {
  const out: Block[] = [];
  let list: Inline[][] | null = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const item = line.match(/^(?:[-*]|\d+[.)])\s+(.*)$/);
    if (item) {
      if (!list) { list = []; out.push({ kind: 'ul', items: list }); }
      list.push(inline(item[1]));
      continue;
    }
    list = null;
    if (line) out.push({ kind: 'p', parts: inline(line.replace(/^#+\s*/, '')) });
  }
  return out;
}
