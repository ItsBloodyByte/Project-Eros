import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { ReportDialog } from "../components/ReportDialog";
import { MatchBanner } from "../components/MatchBanner";
import { BadgeCheck, Heart, MapPin, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../lib/AuthContext";

export default function ProfileViewPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [revealedPhotos, setRevealedPhotos] = useState({});
  const [firstOpen, setFirstOpen] = useState(false);
  const [firstText, setFirstText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await api.post(`/seen/${id}`);
        const { data } = await api.get(`/users/${id}`);
        setProfile(data);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Profile not found");
        nav("/");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, nav]);

  const like = async () => {
    setLiking(true);
    try {
      const { data } = await api.post("/likes", { target_user_id: id });
      if (data.matched) {
        toast.success("It’s a match!");
        setProfile((p) => ({ ...p, i_liked: true, they_liked: true, match_id: data.match_id }));
      } else {
        toast.success("Liked. They’ll see it in their queue.");
        setProfile((p) => ({ ...p, i_liked: true }));
      }
    } catch (e) {
      toast.error("Failed to like");
    } finally {
      setLiking(false);
    }
  };

  const unlike = async () => {
    await api.delete(`/likes/${id}`);
    setProfile((p) => ({ ...p, i_liked: false, match_id: null }));
  };

  if (loading || !profile) {
    return (
      <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
        <div className="app-content"><AppHeader /><div className="p-8">Loading...</div></div>
      </div>
    );
  }

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
            <div className="space-y-3">
              {(profile.photos || []).length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {profile.photos.map((p) => {
                    const isNsfw = p.nsfw_score >= 0.75;
                    return (
                      <div key={p.id} className="relative overflow-hidden rounded-[var(--radius-md)] border bg-[hsl(var(--muted))] aspect-[3/4]">
                        <NsfwBlurOverlay
                          active={isNsfw}
                          revealed={!!revealedPhotos[p.id]}
                          onReveal={() => setRevealedPhotos((r) => ({ ...r, [p.id]: true }))}
                          className="h-full w-full"
                        >
                          <img src={p.data} alt="" className="h-full w-full object-cover" />
                        </NsfwBlurOverlay>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  This profile has no photos yet.
                </div>
              )}
            </div>

            <div className="space-y-4">
              {profile.match_id && (
                <MatchBanner name={profile.display_name} onOpen={() => nav(`/chat/${profile.match_id}`)} />
              )}

              <div className="rounded-[var(--radius-md)] border bg-card p-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-3xl leading-tight">
                      {profile.display_name}
                      <span className="ml-2 text-xl text-[hsl(var(--muted-foreground))]">{profile.age}</span>
                    </div>
                    <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      {profile.pronouns}{profile.pronouns && profile.orientation ? " · " : ""}{profile.orientation}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.verified && (
                      <Badge className="gap-1"><BadgeCheck className="h-3 w-3" /> verified</Badge>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {typeof profile.distance_km === "number" && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> ~{profile.distance_km} km</span>
                  )}
                  {profile.is_online && <span className="inline-flex items-center gap-1"><span className="online-dot" /> online</span>}
                </div>
                {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}
                {(profile.relationship_types?.length > 0) && (
                  <div className="mt-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Looking for</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.relationship_types.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                    </div>
                  </div>
                )}
                {(profile.seeking_roles?.length > 0) && (
                  <div className="mt-2">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Roles</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.seeking_roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {profile.match_id ? (
                  <Button onClick={() => nav(`/chat/${profile.match_id}`)} data-testid="open-chat-button">Open chat</Button>
                ) : profile.i_liked ? (
                  <Button variant="outline" onClick={unlike} data-testid="unlike-button">Undo like</Button>
                ) : (
                  <Button onClick={like} disabled={liking} data-testid="like-button" className="gap-1">
                    <Heart className="h-4 w-4" /> Like
                  </Button>
                )}
                {me?.is_premium && !profile.match_id && (
                  <Dialog open={firstOpen} onOpenChange={setFirstOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="gap-1" data-testid="message-first-button"><Send className="h-4 w-4" /> Message first</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Send a first message</DialogTitle></DialogHeader>
                      <div className="text-sm text-[hsl(var(--muted-foreground))]">Premium privilege: skip the mutual-like gate and send one opener.</div>
                      <Textarea rows={4} value={firstText} onChange={(e) => setFirstText(e.target.value)} placeholder="Keep it warm and specific" maxLength={500} data-testid="message-first-input" />
                      <DialogFooter>
                        <Button onClick={async () => {
                          if (!firstText.trim()) { toast.error("Please write a message"); return; }
                          try {
                            const { data } = await api.post("/messages/first", { target_user_id: profile.id, text: firstText.trim() });
                            setFirstOpen(false); setFirstText("");
                            nav(`/chat/${data.match_id}`);
                          } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
                        }} data-testid="message-first-submit">Send</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <ReportDialog targetType="user" targetId={profile.id} />
              </div>
              {!profile.match_id && profile.i_liked && (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Lock className="h-3 w-3" /> Chat unlocks after a mutual match.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
