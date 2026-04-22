import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { FileText, Clock, ArrowRight } from "lucide-react";

export default function BlogListPage() {
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);

  const load = async (skipValue = 0, tag = activeTag) => {
    setLoading(true);
    try {
      const params = { limit: 12, skip: skipValue };
      if (tag) params.tag = tag;
      const { data } = await api.get("/blog/posts", { params });
      if (skipValue === 0) setPosts(data.posts || []);
      else setPosts((prev) => [...prev, ...(data.posts || [])]);
      setHasMore(!!data.has_more);
    } catch {
      /* noop */
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/blog/tags"); setTags(data.tags || []); } catch {}
    })();
    load(0);
    // eslint-disable-next-line
  }, []);

  const pickTag = (t) => {
    setActiveTag(t);
    setSkip(0);
    load(0, t);
  };

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-16">
          <section className="pt-10 sm:pt-14 pb-6">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Eros Journal
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] tracking-tight leading-[1.02]" data-testid="blog-heading">
              Blog
            </h1>
            <p className="mt-2 text-sm sm:text-base text-[hsl(var(--muted-foreground))] max-w-prose">
              Gedanken, Geschichten und Updates vom Eros-Team – über modernes Dating, Inklusion und alles dazwischen.
            </p>
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                <button
                  onClick={() => pickTag(null)}
                  className={`rounded-full px-3 py-1 text-xs border transition-colors ${!activeTag ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"}`}
                  data-testid="blog-tag-all"
                >
                  Alle
                </button>
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => pickTag(t)}
                    className={`rounded-full px-3 py-1 text-xs border transition-colors ${activeTag === t ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"}`}
                    data-testid={`blog-tag-${t}`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </section>

          {loading && posts.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] w-full rounded-[var(--radius-lg)]" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="grid place-items-center py-24 text-center">
              <div className="font-display text-3xl tracking-tight">Noch keine Beiträge</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-md">
                Bald findest du hier Geschichten und Updates. Schau bald wieder vorbei.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="blog-grid">
              {posts.map((p) => (
                <Link
                  to={`/blog/${p.slug}`}
                  key={p.id}
                  className="group rounded-[var(--radius-lg)] overflow-hidden bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 hover:shadow-[var(--shadow-md)] transition-shadow"
                  data-testid={`blog-card-${p.slug}`}
                >
                  {p.cover_image && (
                    <div className="aspect-[16/10] bg-[hsl(var(--muted))] overflow-hidden">
                      <img src={p.cover_image} alt={p.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                    </div>
                  )}
                  <div className="p-5 space-y-2">
                    {p.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="font-display text-xl leading-tight tracking-tight group-hover:text-[hsl(var(--accent))] transition-colors">
                      {p.title}
                    </div>
                    {p.excerpt && <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-3">{p.excerpt}</p>}
                    <div className="flex items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))] pt-1">
                      {p.author_name && <span>{p.author_name}</span>}
                      {p.reading_minutes && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_minutes} Min.</span>}
                      {p.published_at && <span>{new Date(p.published_at).toLocaleDateString()}</span>}
                      <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {hasMore && (
            <div className="mt-10 flex justify-center">
              <Button variant="outline" onClick={() => { const next = skip + 12; setSkip(next); load(next); }} className="rounded-full px-6">
                Weitere Beiträge
              </Button>
            </div>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
