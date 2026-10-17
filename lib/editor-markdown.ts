// Penerjemah antara dokumen editor visual (TipTap/ProseMirror JSON) dan Markdown.
// Artikel tetap disimpan sebagai Markdown, jadi situs publik tidak berubah.
import {
  isSafeUrl,
  parseMarkdown,
  type Block,
  type Inline,
} from "./markdown-parse";

export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
};

/* ----------------------------- Markdown -> dokumen ---------------------------- */

function withContent(node: DocNode, content: DocNode[]): DocNode {
  return content.length > 0 ? { ...node, content } : node;
}

// code tidak boleh digabung dengan format lain (aturan editor).
function fixMarks(marks: DocMark[]): DocMark[] {
  const seen = new Set<string>();
  const unique = marks.filter((m) => {
    if (seen.has(m.type)) return false;
    seen.add(m.type);
    return true;
  });
  if (!seen.has("code") || unique.length === 1) return unique;
  return seen.has("link")
    ? unique.filter((m) => m.type !== "code")
    : unique.filter((m) => m.type === "code");
}

function textNode(text: string, marks: DocMark[]): DocNode {
  const fixed = fixMarks(marks);
  return fixed.length > 0 ? { type: "text", text, marks: fixed } : { type: "text", text };
}

function inlineToNodes(nodes: Inline[], marks: DocMark[]): DocNode[] {
  const out: DocNode[] = [];
  for (const n of nodes) {
    switch (n.t) {
      case "text":
        if (n.v) out.push(textNode(n.v, marks));
        break;
      case "code":
        if (n.v) out.push(textNode(n.v, [...marks, { type: "code" }]));
        break;
      case "bold":
        out.push(...inlineToNodes(n.c, [...marks, { type: "bold" }]));
        break;
      case "em":
        out.push(...inlineToNodes(n.c, [...marks, { type: "italic" }]));
        break;
      case "link":
        if (isSafeUrl(n.href)) {
          out.push(
            ...inlineToNodes(n.c, [
              ...marks,
              { type: "link", attrs: { href: n.href, title: n.title ?? null } },
            ]),
          );
        } else {
          out.push(...inlineToNodes(n.c, marks));
        }
        break;
      case "img":
        if (isSafeUrl(n.src)) {
          out.push({ type: "image", attrs: { src: n.src, alt: n.alt, title: null } });
        }
        break;
    }
  }
  return out;
}

function paragraphOf(inline: Inline[]): DocNode {
  return withContent({ type: "paragraph" }, inlineToNodes(inline, []));
}

function blockToNode(b: Block): DocNode {
  switch (b.t) {
    case "heading":
      return withContent(
        { type: "heading", attrs: { level: b.level } },
        inlineToNodes(b.c, []),
      );
    case "p":
      return paragraphOf(b.c);
    case "ul":
      return {
        type: "bulletList",
        content: b.items.map((i) => ({ type: "listItem", content: [paragraphOf(i)] })),
      };
    case "ol":
      return {
        type: "orderedList",
        attrs: { start: 1 },
        content: b.items.map((i) => ({ type: "listItem", content: [paragraphOf(i)] })),
      };
    case "quote":
      return { type: "blockquote", content: [paragraphOf(b.c)] };
    case "code":
      return b.v
        ? {
            type: "codeBlock",
            attrs: { language: null },
            content: [{ type: "text", text: b.v }],
          }
        : { type: "codeBlock", attrs: { language: null } };
    case "hr":
      return { type: "horizontalRule" };
  }
}

export function markdownToDoc(markdown: string): DocNode {
  const content = parseMarkdown(markdown).map(blockToNode);
  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

/* ----------------------------- dokumen -> Markdown ---------------------------- */

type LinkAttrs = { href: string; title: string | null };

function linkOf(n: DocNode): LinkAttrs | null {
  const m = n.marks?.find((x) => x.type === "link");
  if (!m) return null;
  const href = String(m.attrs?.href ?? "");
  // Hanya http(s) dan alamat relatif yang diizinkan; selain itu dianggap teks biasa.
  if (!href || !isSafeUrl(href)) return null;
  const title = m.attrs?.title;
  return { href, title: typeof title === "string" && title ? title : null };
}

function sameLink(a: LinkAttrs | null, b: LinkAttrs | null): boolean {
  return !!a && !!b && a.href === b.href && a.title === b.title;
}

function stripLink(n: DocNode): DocNode {
  return { ...n, marks: (n.marks ?? []).filter((m) => m.type !== "link") };
}

function markSig(n: DocNode): string {
  return (n.marks ?? [])
    .map((m) => m.type)
    .sort()
    .join(",");
}

function escapeText(s: string): string {
  return s.replace(/([\\`*[\]])/g, "\\$1");
}

function encodeUrl(url: string): string {
  return url.replace(/\s/g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function wrapMarks(text: string, marks: DocMark[]): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const lead = m?.[1] ?? "";
  const core = m?.[2] ?? text;
  const trail = m?.[3] ?? "";
  if (core === "") return text;

  const types = new Set(marks.map((x) => x.type));
  if (types.has("code")) {
    return `${lead}\`${core.replace(/`/g, "'")}\`${trail}`;
  }
  const body = escapeText(core);
  const bold = types.has("bold");
  const italic = types.has("italic");
  const wrapped = bold && italic ? `***${body}***` : bold ? `**${body}**` : italic ? `*${body}*` : body;
  return `${lead}${wrapped}${trail}`;
}

function imageMd(n: DocNode): string {
  const src = String(n.attrs?.src ?? "");
  if (!src || !isSafeUrl(src)) return "";
  const alt = String(n.attrs?.alt ?? "").replace(/[[\]]/g, "");
  return `![${alt}](${encodeUrl(src)})`;
}

function inlineMd(nodes: DocNode[]): string {
  let out = "";
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];

    if (n.type === "image") {
      out += imageMd(n);
      i++;
      continue;
    }
    if (n.type === "hardBreak") {
      out += " ";
      i++;
      continue;
    }
    if (n.type !== "text") {
      out += n.content ? inlineMd(n.content) : "";
      i++;
      continue;
    }

    const link = linkOf(n);
    if (link) {
      const inner: DocNode[] = [];
      let j = i;
      while (j < nodes.length && nodes[j].type === "text" && sameLink(linkOf(nodes[j]), link)) {
        inner.push(stripLink(nodes[j]));
        j++;
      }
      const label = inlineMd(inner) || escapeText(link.href);
      const title = link.title ? ` "${link.title.replace(/"/g, "'")}"` : "";
      out += `[${label}](${encodeUrl(link.href)}${title})`;
      i = j;
      continue;
    }

    const sig = markSig(n);
    let text = "";
    let j = i;
    while (
      j < nodes.length &&
      nodes[j].type === "text" &&
      !linkOf(nodes[j]) &&
      markSig(nodes[j]) === sig
    ) {
      text += nodes[j].text ?? "";
      j++;
    }
    out += wrapMarks(text, n.marks ?? []);
    i = j;
  }
  return out;
}

// Jika baris paragraf kebetulan mirip penanda blok (#, -, 1., >, ---), beri tanda \ agar tetap paragraf.
function guardBlockStart(text: string): string {
  if (/^(#{1,6}\s|[-+]\s|>|```)/.test(text)) return `\\${text}`;
  if (/^([-*_])(\s*\1){2,}\s*$/.test(text)) return `\\${text}`;
  const ol = /^(\d+)([.)])(\s)/.exec(text);
  if (ol) return `${ol[1]}\\${ol[2]}${text.slice(ol[1].length + 1)}`;
  return text;
}

function plainText(n: DocNode): string {
  if (n.type === "text") return n.text ?? "";
  return (n.content ?? []).map(plainText).join("");
}

function listItemLines(list: DocNode, ordered: boolean): string[] {
  const lines: string[] = [];
  const start = Number(list.attrs?.start ?? 1) || 1;
  let n = start;
  const walk = (l: DocNode, ord: boolean) => {
    for (const item of l.content ?? []) {
      const textParts: string[] = [];
      const nested: DocNode[] = [];
      for (const child of item.content ?? []) {
        if (child.type === "bulletList" || child.type === "orderedList") nested.push(child);
        else textParts.push(inlineMd(child.content ?? []));
      }
      const text = textParts.filter(Boolean).join(" ").trim();
      if (text) lines.push(ord ? `${n++}. ${text}` : `- ${text}`);
      // Daftar bersarang diratakan karena Markdown situs mendukung satu tingkat.
      for (const sub of nested) walk(sub, sub.type === "orderedList");
    }
  };
  walk(list, ordered);
  return lines;
}

function blockMd(node: DocNode): string {
  switch (node.type) {
    case "paragraph": {
      const text = inlineMd(node.content ?? []).trim();
      return text ? guardBlockStart(text) : "";
    }
    case "heading": {
      const text = inlineMd(node.content ?? []).trim();
      if (!text) return "";
      const level = Number(node.attrs?.level ?? 2);
      return `${"#".repeat(level <= 2 ? 2 : level === 3 ? 3 : 4)} ${text}`;
    }
    case "bulletList":
      return listItemLines(node, false).join("\n");
    case "orderedList":
      return listItemLines(node, true).join("\n");
    case "blockquote": {
      const text = (node.content ?? [])
        .map((c) => inlineMd(c.content ?? []).trim())
        .filter(Boolean)
        .join(" ");
      return text ? `> ${text}` : "";
    }
    case "codeBlock": {
      const code = plainText(node);
      return code ? `\`\`\`\n${code}\n\`\`\`` : "";
    }
    case "horizontalRule":
      return "---";
    case "image":
      return imageMd(node);
    default: {
      const text = plainText(node).trim();
      return text ? guardBlockStart(escapeText(text)) : "";
    }
  }
}

export function docToMarkdown(doc: DocNode): string {
  return (doc.content ?? [])
    .map(blockMd)
    .filter((s) => s !== "")
    .join("\n\n");
}
