import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { MessagesSquare, ShieldCheck } from "lucide-react";

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/matches");
        setMatches(data.matches);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <header className="pb-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Nachrichten</div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">Deine Matches</h1>
          </header>

          {loading ? (
            <div className="space-y-2 mt-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[78px] w-full rounded-[var(--radius-lg)]" />)}
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-10 text-center shadow-[var(--shadow-sm)]">
              <div className="font-display text-2xl tracking-tight">Noch keine Matches</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-md mx-auto">
                Like jemanden, der dich interessiert. Wenn die Person dich zurück-liked, erscheint hier euer Chat.
              </div>
              <Link to="/" className="mt-4 inline-block rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1.5 text-sm font-medium hover:bg-[hsl(var(--secondary))] transition-colors" data-testid="matches-start-discover">
                Jetzt entdecken
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]/60 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 shadow-[var(--shadow-sm)] overflow-hidden" data-testid="matches-list">
              {matches.map((m) => {
                const primary = (m.user.photos || []).find((p) => p.is_primary) || (m.user.photos || [])[0];
                const isNsfw = primary && primary.nsfw_score >= 0.75;
                return (
                  <li key={m.id}>
                    <Link
                      to={`/chat/${m.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-[hsl(var(--secondary))]/50 transition-colors duration-[var(--dur-2)] ease-[var(--ease-out)]"
                      data-testid={`match-row-${m.id}`}
                    >
                      <div className="relative shrink-0">
                        <div className="h-14 w-14 rounded-full overflow-hidden bg-[hsl(var(--muted))] ring-1 ring-[hsl(var(--border))]/70">
                          {primary && <img src={primary.data} alt="" className={`h-full w-full object-cover ${isNsfw ? "blur-md" : ""}`} />}
                        </div>
                        {m.user.is_online && <span className="online-dot absolute -right-0.5 -bottom-0.5 ring-2 ring-[hsl(var(--card))]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-display text-lg tracking-tight truncate">{m.user.display_name}</div>
                          {m.user.id_verified && (
                            <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--verified))]" aria-label="verifiziert" />
                          )}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                          {m.user.age}{m.user.pronouns ? ` · ${m.user.pronouns}` : ""}
                          {m.last_message_preview && <span className="ml-1.5 italic">· {m.last_message_preview.slice(0, 60)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.unread_count > 0 && (
                          <Badge className="rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent px-2">{m.unread_count}</Badge>
                        )}
                        <MessagesSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
