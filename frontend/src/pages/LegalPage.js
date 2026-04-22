import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";

const KNOWN = [
  { key: "terms",        label: "Nutzungsbedingungen" },
  { key: "privacy",      label: "Datenschutz" },
  { key: "imprint",      label: "Impressum" },
  { key: "community",    label: "Community-Richtlinien" },
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
    <div className="min-h-screen app-shell-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Link to="/" className="text-sm underline text-[hsl(var(--muted-foreground))]" data-testid="legal-home-link">← Zur Startseite</Link>
          <div className="flex flex-wrap gap-2">
            {KNOWN.map((k) => (
              <Link
                key={k.key}
                to={`/legal/${k.key}`}
                className={[
                  "rounded-full border px-3 py-1 text-xs",
                  k.key === key
                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent"
                    : "hover:bg-[hsl(var(--secondary))]",
                ].join(" ")}
                data-testid={`legal-nav-${k.key}`}
              >
                {k.label}
              </Link>
            ))}
          </div>
        </div>

        {err && (
          <div className="rounded-md border bg-card p-6 text-center">
            <div className="font-display text-xl mb-2">Nicht gefunden</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{err}</div>
            <Button asChild className="mt-4" variant="outline"><Link to="/legal/terms">Zu den Bedingungen</Link></Button>
          </div>
        )}

        {!err && !page && (
          <div className="rounded-md border bg-card p-6 animate-pulse text-sm text-[hsl(var(--muted-foreground))]">Lädt …</div>
        )}

        {!err && page && (
          <article className="rounded-[var(--radius-md)] border bg-card p-6 sm:p-8 shadow-[var(--shadow-sm)]" data-testid={`legal-article-${key}`}>
            <h1 className="font-display text-3xl mb-1">{page.title}</h1>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-6" data-testid="legal-updated-at">
              Stand: {(page.updated_at || "").slice(0, 10)}
            </div>
            <div className="prose prose-neutral dark:prose-invert max-w-none [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_a]:underline">
              <ReactMarkdown>{page.content_markdown || ""}</ReactMarkdown>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
