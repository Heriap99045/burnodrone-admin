/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  isAffiliateLink,
  isSafeUrl,
  parseMarkdown,
  type Block,
  type Inline,
} from "./markdown-parse";

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i): ReactNode => {
    switch (n.t) {
      case "text":
        return n.v;
      case "code":
        return (
          <code
            key={i}
            className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.85em] text-emerald-300"
          >
            {n.v}
          </code>
        );
      case "bold":
        return (
          <strong key={i} className="font-semibold text-slate-100">
            {renderInline(n.c)}
          </strong>
        );
      case "em":
        return <em key={i}>{renderInline(n.c)}</em>;
      case "img":
        if (!isSafeUrl(n.src)) return null;
        return (
          <img
            key={i}
            src={n.src}
            alt={n.alt}
            loading="lazy"
            className="my-2 max-w-full rounded-xl"
          />
        );
      case "link": {
        if (!isSafeUrl(n.href)) return <span key={i}>{renderInline(n.c)}</span>;
        const linkClass = "text-blue-400 underline hover:text-blue-300";
        if (!/^https?:\/\//i.test(n.href)) {
          return (
            <Link key={i} href={n.href} className={linkClass}>
              {renderInline(n.c)}
            </Link>
          );
        }
        const rel = isAffiliateLink(n.href, n.title)
          ? "sponsored nofollow noopener noreferrer"
          : "noopener noreferrer";
        return (
          <a key={i} href={n.href} target="_blank" rel={rel} className={linkClass}>
            {renderInline(n.c)}
          </a>
        );
      }
    }
  });
}

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.t) {
    case "heading":
      if (b.level === 2) {
        return (
          <h2 key={i} className="mt-10 text-2xl font-bold text-white">
            {renderInline(b.c)}
          </h2>
        );
      }
      if (b.level === 3) {
        return (
          <h3 key={i} className="mt-8 text-xl font-bold text-white">
            {renderInline(b.c)}
          </h3>
        );
      }
      return (
        <h4 key={i} className="mt-6 text-lg font-semibold text-white">
          {renderInline(b.c)}
        </h4>
      );
    case "p":
      return <p key={i}>{renderInline(b.c)}</p>;
    case "ul":
      return (
        <ul key={i} className="list-disc space-y-1 pl-6">
          {b.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="list-decimal space-y-1 pl-6">
          {b.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote
          key={i}
          className="border-l-4 border-blue-500/60 pl-4 italic text-slate-400"
        >
          {renderInline(b.c)}
        </blockquote>
      );
    case "code":
      return (
        <pre
          key={i}
          className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-emerald-300"
        >
          <code>{b.v}</code>
        </pre>
      );
    case "hr":
      return <hr key={i} className="border-slate-800" />;
  }
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-300 md:text-base">
      {parseMarkdown(source).map(renderBlock)}
    </div>
  );
}
