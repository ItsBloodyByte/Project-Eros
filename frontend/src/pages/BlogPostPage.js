import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function BlogPostPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/blog/posts/${slug}`);
        setPost(data);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Beitrag nicht gefunden");
        nav("/blog");
      } finally { setLoading(false); }
    })();
  }, [slug, nav]);

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pb-20">
          <div className="pt-6">
            <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
              <Link to="/blog"><ArrowLeft className="h-4 w-4" /> Zum Blog</Link>
            </Button>
          </div>

          {loading || !post ? (
            <div className="pt-8 space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="aspect-[16/9] w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <article className="pt-6" data-testid={`blog-article-${post.slug}`}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {post.tags?.slice(0, 4).map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
                ))}
                {post.status !== "published" && (
                  <Badge variant="outline" className="text-[10px]">Vorschau: {post.status}</Badge>
                )}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]" data-testid="blog-post-title">
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="mt-3 text-lg text-[hsl(var(--muted-foreground))] leading-relaxed">{post.excerpt}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                {post.author_name && <span>von {post.author_name}</span>}
                {post.published_at && (
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(post.published_at).toLocaleDateString()}</span>
                )}
                {post.reading_minutes && (
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.reading_minutes} Min. Lesezeit</span>
                )}
              </div>
              {post.cover_image && (
                <img
                  src={post.cover_image}
                  alt={post.title}
                  className="mt-6 w-full aspect-[16/9] object-cover rounded-[var(--radius-lg)] ring-1 ring-[hsl(var(--border))]/60"
                />
              )}
              <div
                className="prose prose-lg dark:prose-invert max-w-none mt-8 prose-headings:font-display prose-headings:tracking-tight prose-a:text-[hsl(var(--accent))] prose-a:no-underline hover:prose-a:underline"
                dangerouslySetInnerHTML={{ __html: post.content_html || "" }}
                data-testid="blog-post-content"
              />
            </article>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
