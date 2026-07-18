import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Download } from "lucide-react";

/**
 * Renders the Korean Android release guide (public/ANDROID_GUIDE_KO.md) as a
 * lightweight styled page. Uses a minimal markdown → HTML pass instead of
 * pulling in react-markdown to keep the bundle small.
 */
const renderMarkdown = (md: string): string => {
  // escape HTML first
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let inList = false;
  let inTable = false;
  let tableHeader = false;

  const flushList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const flushTable = () => {
    if (inTable) {
      out.push("</tbody></table></div>");
      inTable = false;
      tableHeader = false;
    }
  };

  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code class="rounded bg-muted/60 px-1 py-0.5 text-[12px]">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener" class="text-accent underline">$1</a>',
      );

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("```")) {
      if (inCode) {
        out.push(
          `<pre class="my-3 overflow-x-auto rounded-lg bg-muted/50 p-3 text-[12px] leading-relaxed"><code>${esc(codeBuf.join("\n"))}</code></pre>`,
        );
        codeBuf = [];
        inCode = false;
      } else {
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushList();
      flushTable();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      flushTable();
      out.push(`<h3 class="mt-6 mb-2 text-[15px] font-semibold text-foreground">${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      flushTable();
      out.push(`<h2 class="mt-8 mb-3 text-[18px] font-bold text-foreground">${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      flushTable();
      out.push(`<h1 class="mt-4 mb-4 text-[22px] font-bold text-foreground">${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      flushTable();
      out.push(
        `<blockquote class="my-3 border-l-2 border-accent/60 bg-accent/5 px-3 py-2 text-[13px] text-foreground/80">${inline(line.slice(2))}</blockquote>`,
      );
      continue;
    }
    if (line.startsWith("---")) {
      flushList();
      flushTable();
      out.push('<hr class="my-6 border-border/40" />');
      continue;
    }
    if (/^\|/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        // separator — switch to body
        if (inTable) {
          out.push("</thead><tbody>");
          tableHeader = false;
        }
        continue;
      }
      if (!inTable) {
        out.push('<div class="my-3 overflow-x-auto"><table class="w-full text-left text-[12.5px]"><thead>');
        inTable = true;
        tableHeader = true;
      }
      const tag = tableHeader ? "th" : "td";
      const cls = tableHeader
        ? "border-b border-border/40 px-2 py-1.5 font-semibold text-foreground"
        : "border-b border-border/20 px-2 py-1.5 align-top text-foreground/80";
      out.push(
        `<tr>${cells.map((c) => `<${tag} class="${cls}">${inline(c)}</${tag}>`).join("")}</tr>`,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushTable();
      if (!inList) {
        out.push('<ul class="my-2 ml-5 list-disc space-y-1 text-[13px] text-foreground/80">');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushTable();
      if (!inList) {
        out.push('<ol class="my-2 ml-5 list-decimal space-y-1 text-[13px] text-foreground/80">');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      continue;
    }
    flushList();
    flushTable();
    out.push(`<p class="my-2 text-[13px] leading-relaxed text-foreground/80">${inline(line)}</p>`);
  }
  flushList();
  flushTable();
  return out.join("\n");
};

const AndroidGuidePage = () => {
  const navigate = useNavigate();
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch("/ANDROID_GUIDE_KO.md")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((md) => setHtml(renderMarkdown(md)))
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/30 bg-background/95 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground/70 transition hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="font-display text-[11px] font-semibold tracking-[0.35em] text-foreground/70">
          ANDROID GUIDE
        </span>
        <a
          href="/ANDROID_GUIDE_KO.md"
          download
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground/70 transition hover:bg-muted"
          aria-label="Download markdown"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-4">
        {error ? (
          <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">
            가이드를 불러오지 못했습니다: {error}
          </p>
        ) : !html ? (
          <p className="mt-6 text-center text-[12px] text-foreground/50">불러오는 중…</p>
        ) : (
          <article dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
};

export default AndroidGuidePage;
