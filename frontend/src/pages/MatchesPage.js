import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { MessagesSquare } from "lucide-react";

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
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="font-display text-3xl mb-4">Matches</h1>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}</div>
          ) : matches.length === 0 ? (
            <div className="rounded-md border bg-card p-8 text-center">
              <div className="font-display text-xl">No matches yet</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Like someone you’re interested in; when they like you back, a chat unlocks here.</div>
              <Link to="/" className="mt-3 inline-block underline text-[hsl(var(--accent))]">Start discovering</Link>
            </div>
          ) : (
            <div className="space-y-2" data-testid="matches-list">
              {matches.map((m) => {
                const primary = (m.user.photos || []).find((p) => p.is_primary) || (m.user.photos || [])[0];
                return (
                  <Link key={m.id} to={`/chat/${m.id}`} className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-[hsl(var(--secondary))] transition-colors" data-testid={`match-row-${m.id}`}>
                    <div className="h-14 w-14 rounded-full overflow-hidden bg-[hsl(var(--muted))]">
                      {primary ? <img src={primary.data} alt="" className={`h-full w-full object-cover ${primary.nsfw_score >= 0.75 ? "blur-md" : ""}`} /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-display text-lg truncate">{m.user.display_name}</div>
                        {m.user.is_online && <span className="online-dot" />}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.user.age} · {m.user.pronouns || ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.unread_count > 0 && <Badge variant="secondary">{m.unread_count}</Badge>}
                      <MessagesSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
