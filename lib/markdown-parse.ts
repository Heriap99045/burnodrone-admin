// Parser Markdown kecil tanpa dependensi. Dipakai di admin (pratinjau) dan di situs publik.
// Sengaja tidak mendukung HTML mentah supaya aman (tidak ada dangerouslySetInnerHTML).

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "bold"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; title?: string; c: Inline[] }
  | { t: "img"; src: string; alt: string };

export type Block =
  | { t: "heading"; level: 2 | 3 | 4; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "hr" };

type InlineKind = "esc" | "code" | "img" | "link" | "bolditalic" | "bold" | "em";

const INLINE_PATTERNS: { kind: InlineKind; re: RegExp }[] = [
  // Tanda \ di depan karakter khusus membuat karakter itu tampil apa adanya (dipakai editor visual).
  { kind: "esc", re: /\\([\\`*[\]#+>.)!_-])/ },
  { kind: "code", re: /`([^`]+)`/ },
  { kind: "img", re: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/ },
  { kind: "link", re: /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/ },
  { kind: "bolditalic", re: /\*\*\*(.+?)\*\*\*/ },
  { kind: "bold", re: /\*\*(.+?)\*\*/ },
  { kind: "em", re: /\*([^*\s][^*]*?)\*/ },
];

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest.length > 0) {
    let best: { kind: InlineKind; m: RegExpExecArray } | null = null;
    for (const p of INLINE_PATTERNS) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) {
        best = { kind: p.kind, m };
      }
    }

    if (best === null) {
      out.push({ t: "text", v: rest });
      break;
    }

    const { kind, m } = best;
    if (m.index > 0) out.push({ t: "text", v: rest.slice(0, m.index) });

    if (kind === "esc") out.push({ t: "text", v: m[1] });
    else if (kind === "code") out.push({ t: "code", v: m[1] });
    else if (kind === "bolditalic") {
      out.push({ t: "bold", c: [{ t: "em", c: parseInline(m[1]) }] });
    }
    else if (kind === "img") out.push({ t: "img", alt: m[1], src: m[2] });
    else if (kind === "link") {
      out.push({ t: "link", href: m[2], title: m[3], c: parseInline(m[1]) });
    } else if (kind === "bold") out.push({ t: "bold", c: parseInline(m[1]) });
    else out.push({ t: "em", c: parseInline(m[1]) });

    rest = rest.slice(m.index + m[0].length);
  }

  return out;
}

const RE_HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const RE_HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const RE_UL = /^\s*[-*+]\s+(.*)$/;
const RE_OL = /^\s*\d+[.)]\s+(.*)$/;
const RE_QUOTE = /^\s*>\s?(.*)$/;

function startsBlock(line: string): boolean {
  return (
    line.trimStart().startsWith("```") ||
    RE_HEADING.test(line) ||
    RE_HR.test(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line) ||
    RE_QUOTE.test(line)
  );
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // lewati penutup ```
      blocks.push({ t: "code", v: buf.join("\n") });
      continue;
    }

    const h = RE_HEADING.exec(line);
    if (h) {
      const n = h[1].length;
      const level = n <= 2 ? 2 : n === 3 ? 3 : 4;
      blocks.push({ t: "heading", level, c: parseInline(h[2]) });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }

    if (RE_UL.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = RE_UL.exec(lines[i]);
        if (!m || RE_HR.test(lines[i])) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ t: "ul", items });
      continue;
    }

    if (RE_OL.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = RE_OL.exec(lines[i]);
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ t: "ol", items });
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const m = RE_QUOTE.exec(lines[i]);
        if (!m) break;
        buf.push(m[1]);
        i++;
      }
      blocks.push({ t: "quote", c: parseInline(buf.join(" ").trim()) });
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    if (buf.length === 0) {
      // jaga-jaga agar tidak loop selamanya
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ t: "p", c: parseInline(buf.join(" ")) });
  }

  return blocks;
}

// Hanya http(s) dan path relatif ("/...") yang dianggap aman.
export function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

const AFFILIATE_HOSTS =
  /(^|\.)(shopee\.co\.id|shp\.ee|shope\.ee|tokopedia\.com|tokopedia\.link|tiktok\.com|tiktokshop\.id)$/i;

// Link dianggap afiliasi jika diberi judul "affiliate" atau menuju marketplace yang dikenal.
export function isAffiliateLink(href: string, title?: string): boolean {
  if (title && title.trim().toLowerCase() === "affiliate") return true;
  try {
    return AFFILIATE_HOSTS.test(new URL(href).hostname);
  } catch {
    return false;
  }
}

function inlineHasAffiliate(nodes: Inline[]): boolean {
  return nodes.some((n) => {
    if (n.t === "link") return isAffiliateLink(n.href, n.title) || inlineHasAffiliate(n.c);
    if (n.t === "bold" || n.t === "em") return inlineHasAffiliate(n.c);
    return false;
  });
}

export function hasAffiliateLinks(src: string): boolean {
  return parseMarkdown(src).some((b) => {
    if (b.t === "p" || b.t === "quote" || b.t === "heading") return inlineHasAffiliate(b.c);
    if (b.t === "ul" || b.t === "ol") return b.items.some(inlineHasAffiliate);
    return false;
  });
}

export function estimateReadTime(src: string): string {
  const words = src.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min baca`;
}
