import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { AppFooter } from "../components/AppFooter";
import { Skeleton } from "../components/ui/skeleton";

const KNOWN = [
  { key: "terms",        label: "Nutzungsbedingungen" },
  { key: "privacy",      label: "Datenschutz" },
  { key: "imprint",      label: "Impressum" },
  { key: "community",    label: "Community" },
  { key: "cookies",      label: "Cookies" },
  { key: "cancellation", label: "Widerruf" },
];

export default function LegalPage() {
  const { key = "terms" } = useParams();
  const [page, setPage] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    setPage(null); setErr(null);
    api
      .get(`/legal/${key}`)
      .then((r) => !cancel && setPage(r.data))
      .catch((e) => !cancel && setErr(e?.response?.data?.detail || "Seite nicht gefunden"));
    return () => { cancel = true; };
  }, [key]);

  return (
    <div className="min-h-screen flex flex-col app-shell-bg-light dark:app-shell-bg">
      <div className="flex-1">
        {/* Header strip */}
        <div className="border-b border-[hsl(var(--border))]/70 glass-surface sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <Link to="/" className="font-display text-2xl tracking-tight" data-testid="legal-home-link">Eros</Link>
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {KNOWN.map((k) => {
                const active = k.key === key;
                return (
                  <Link
                    key={k.key}
                    to={`/legal/${k.key}`}
                    data-testid={`legal-nav-${k.key}`}
                    className={[
                      "shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-[var(--dur-2)]",
                      active
                        ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-sm)]"
                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]",
                    ].join(" ")}
                  >
                    {k.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {err && (
            <div className="rounded-[var(--radius-md)] border bg-[hsl(var(--card))] p-8 text-center">
              <div className="font-display text-2xl mb-2">Nicht gefunden</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">{err}</div>
              <Link to="/legal/terms" className="mt-4 inline-block text-sm underline decoration-[hsl(var(--accent))]/60 underline-offset-4">Zu den Bedingungen</Link>
            </div>
          )}

          {!err && !page && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3 rounded-[var(--radius-sm)]" />
              <Skeleton className="h-4 w-1/3 rounded-[var(--radius-sm)]" />
              <div className="space-y-2 mt-6">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-4 w-full rounded-[var(--radius-sm)]" />)}
              </div>
            </div>
          )}

          {!err && page && (
            <article data-testid={`legal-article-${key}`}>
              <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-3">{KNOWN.find((k) => k.key === key)?.label}</div>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05] mb-2">{page.title}</h1>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-8" data-testid="legal-updated-at">
                Stand: {(page.updated_at || "").slice(0, 10) || "—"}
              </div>
              <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] leading-[1.75]">
                <ReactMarkdown>{page.content_markdown || ""}</ReactMarkdown>
              </div>
            </article>
          )}
        </main>
      </div>
      <AppFooter />
    </div>
  );
}
