import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  ShieldCheck, Users, Sparkles, Heart, Lock, Zap, Globe2, Star, Compass, BookOpen,
} from "lucide-react";

/** Map of icon names accepted by the admin editor → Lucide components.
 *  Unknown names degrade to Sparkles so the page never renders an empty box.
 */
const ICONS = {
  Shield: ShieldCheck, ShieldCheck, Users, Sparkles, Heart, Lock, Zap,
  Globe: Globe2, Globe2, Star, Compass, Book: BookOpen, BookOpen,
};

/**
 * LandingPage — public, admin-editable marketing page for unauthenticated
 * visitors. Authenticated users are redirected to /discover so they never
 * see this page (matches /api/landing being a public endpoint).
 */
export default function LandingPage() {
  // AuthContext exposes `{ user, loading }`; `ready` is derived (= !loading).
  const { user, loading: authLoading } = useAuth();
  const ready = !authLoading;
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && user) {
      navigate("/discover", { replace: true });
    }
  }, [ready, user, navigate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/landing");
        if (alive) setData(data);
      } catch {
        // Silently fall back to the locally-bundled defaults below.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!ready || (ready && user)) return null;
  const landing = data?.landing || {};
  const hero = landing.hero || {};
  const sections = landing.sections || [];
  const teaser = data?.blog_teaser || [];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" data-testid="landing-page">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2 font-semibold text-lg" data-testid="landing-brand">
          <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
          {hero.eyebrow || "Eros"}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/blog" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hidden sm:inline-flex" data-testid="landing-nav-blog">Blog</Link>
          <Link to="/login"><Button variant="ghost" size="sm" data-testid="landing-nav-login">Anmelden</Button></Link>
          <Link to={hero.cta_primary?.href || "/register"}>
            <Button size="sm" data-testid="landing-nav-register">Registrieren</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto text-center" data-testid="landing-hero">
        {hero.eyebrow && (
          <Badge variant="outline" className="mb-4 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/40">
            {hero.eyebrow}
          </Badge>
        )}
        <h1 className="text-4xl sm:text-6xl font-display font-semibold leading-tight mb-4" data-testid="landing-hero-headline">
          {hero.headline || "Verbinde dich mit Menschen, die dich wirklich sehen."}
        </h1>
        {hero.subheadline && (
          <p className="text-base sm:text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-8" data-testid="landing-hero-sub">
            {hero.subheadline}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {hero.cta_primary?.label && (
            <Link to={hero.cta_primary.href || "/register"}>
              <Button size="lg" className="w-full sm:w-auto" data-testid="landing-cta-primary">
                {hero.cta_primary.label}
              </Button>
            </Link>
          )}
          {hero.cta_secondary?.label && (
            <Link to={hero.cta_secondary.href || "/login"}>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="landing-cta-secondary">
                {hero.cta_secondary.label}
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Sections */}
      {sections.length > 0 && (
        <section className="px-4 sm:px-8 py-12 max-w-6xl mx-auto" data-testid="landing-sections">
          {sections.map((sec) => (
            <div key={sec.id} className="mb-14" data-testid={`landing-section-${sec.id}`}>
              <h2 className="text-2xl sm:text-3xl font-display font-medium mb-6 text-center">{sec.title}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(sec.items || []).map((item, idx) => {
                  const Icon = ICONS[item.icon] || Sparkles;
                  return (
                    <Card key={idx} className="bg-[hsl(var(--card))]/50 border-[hsl(var(--border))]" data-testid={`landing-item-${sec.id}-${idx}`}>
                      <CardContent className="pt-6">
                        <Icon className="h-7 w-7 text-[hsl(var(--accent))] mb-3" />
                        {item.title && <h3 className="font-medium mb-1">{item.title}</h3>}
                        {item.body && <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{item.body}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Blog teaser */}
      {teaser.length > 0 && (
        <section className="px-4 sm:px-8 py-12 max-w-5xl mx-auto" data-testid="landing-blog-teaser">
          <h2 className="text-2xl font-display font-medium mb-6 text-center">Aus dem Blog</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teaser.map((post) => (
              <Link key={post.id || post.slug} to={`/blog/${post.slug}`}
                className="block transition-transform hover:-translate-y-0.5"
                data-testid={`landing-blog-${post.slug}`}>
                <Card className="h-full bg-[hsl(var(--card))]/50 border-[hsl(var(--border))]">
                  <CardContent className="pt-6">
                    <h3 className="font-medium mb-2 line-clamp-2">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-3">{post.excerpt}</p>
                    )}
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString("de-DE") : ""}
                      {post.reading_minutes ? ` · ${post.reading_minutes} Min.` : ""}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link to="/blog"><Button variant="outline" data-testid="landing-blog-all">Alle Beiträge</Button></Link>
          </div>
        </section>
      )}

      <footer className="px-4 sm:px-8 py-8 border-t border-[hsl(var(--border))] text-center text-xs text-[hsl(var(--muted-foreground))]" data-testid="landing-footer">
        <div className="flex justify-center gap-4 mb-2">
          <Link to="/legal/terms">Nutzungsbedingungen</Link>
          <Link to="/legal/privacy">Datenschutz</Link>
          <Link to="/legal/imprint">Impressum</Link>
        </div>
        <div>{landing.footer_note || "© Eros."}</div>
      </footer>
      {loading && (
        <div className="fixed inset-0 grid place-items-center bg-[hsl(var(--background))]/30 backdrop-blur-sm pointer-events-none">
          <div className="text-xs text-[hsl(var(--muted-foreground))]">…</div>
        </div>
      )}
    </div>
  );
}
