import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { ReportDialog } from "../components/ReportDialog";
import { MatchBanner } from "../components/MatchBanner";
import { BadgeCheck, Heart, MapPin, Lock, Send, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../lib/AuthContext";
import { PENIS_RANGES } from "../lib/constants";
import { useTranslation } from "react-i18next";

function Row({ label, value }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-sm">{Array.isArray(value) ? value.join(" · ") : value}</span>
    </div>
  );
}

export default function ProfileViewPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [videos, setVideos] = useState([]);
  const [revealedPhotos, setRevealedPhotos] = useState({});
  const [firstOpen, setFirstOpen] = useState(false);
  const [firstText, setFirstText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await api.post(`/seen/${id}`);
        const { data } = await api.get(`/users/${id}`);
        setProfile(data);
        try {
          const vr = await api.get(`/users/${id}/videos`);
          setVideos(vr.data.videos || []);
        } catch {}
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
        toast.success("Match!");
        setProfile((p) => ({ ...p, i_liked: true, they_liked: true, match_id: data.match_id }));
      } else {
        toast.success(t("profile.like"));
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

  const isAdminViewer = me?.role && me.role !== "user";

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-6 lg:gap-10">
            <div className="space-y-3 no-capture">
              {(profile.photos || []).length > 0 ? (
                <div className="space-y-3">
                  {/* Editorial hero: primary photo full-bleed, 21/9 desktop */}
                  {(() => {
                    const primary = profile.photos.find((p) => p.is_primary) || profile.photos[0];
                    const rest = profile.photos.filter((p) => p.id !== primary.id);
                    const isNsfw = primary.nsfw_score >= 0.75;
                    return (
                      <>
                        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[hsl(var(--muted))] aspect-[4/5] sm:aspect-[16/10] shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
                          <NsfwBlurOverlay active={isNsfw} revealed={!!revealedPhotos[primary.id]}
                            onReveal={() => setRevealedPhotos((r) => ({ ...r, [primary.id]: true }))}
                            className="h-full w-full">
                            <img src={primary.data} alt="" className="h-full w-full object-cover" />
                          </NsfwBlurOverlay>
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                        </div>
                        {rest.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {rest.map((p) => {
                              const nsfw = p.nsfw_score >= 0.75;
                              return (
                                <div key={p.id} className="relative overflow-hidden rounded-[var(--radius-md)] bg-[hsl(var(--muted))] aspect-[3/4] ring-1 ring-[hsl(var(--border))]/60">
                                  <NsfwBlurOverlay active={nsfw} revealed={!!revealedPhotos[p.id]}
                                    onReveal={() => setRevealedPhotos((r) => ({ ...r, [p.id]: true }))}
                                    className="h-full w-full">
                                    <img src={p.data} alt="" className="h-full w-full object-cover" />
                                  </NsfwBlurOverlay>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] border bg-[hsl(var(--card))] p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  {t("profile.no_photo")}
                </div>
              )}
              {videos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {videos.map((v) => (
                    <div key={v.id} className="aspect-video rounded-[var(--radius-md)] overflow-hidden border bg-black">
                      <video src={v.data} controls className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {profile.match_id && (
                <MatchBanner name={profile.display_name} onOpen={() => nav(`/chat/${profile.match_id}`)} />
              )}

              {profile.admin_view && (profile.hidden_mode || profile.banned) && (
                <div className="rounded-[var(--radius-md)] border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-3 text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[hsl(var(--destructive))]" />
                  {profile.banned ? t("profile.banned_profile") : t("profile.hidden_profile")}
                </div>
              )}

              <div className="rounded-[var(--radius-lg)] border bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-3xl leading-tight">
                      {profile.display_name}
                      <span className="ml-2 text-xl text-[hsl(var(--muted-foreground))]">{profile.age}</span>
                    </div>
                    <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      {[profile.pronouns, profile.orientation ? t(`orientations.${profile.orientation}`) : null, profile.gender_identity ? t(`genders.${profile.gender_identity}`) : null]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.id_verified && (
                      <Badge className="gap-1 bg-[hsl(var(--accent))]/90 hover:bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]" data-testid="profile-id-verified-badge">
                        <ShieldCheck className="h-3 w-3" /> ID
                      </Badge>
                    )}
                    {profile.verified && !profile.id_verified && <Badge className="gap-1"><BadgeCheck className="h-3 w-3" /> {t("profile.verified")}</Badge>}
                    {isAdminViewer && <Badge variant="outline" className="gap-1"><EyeOff className="h-3 w-3" /> {t("profile.admin_only")}</Badge>}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {typeof profile.distance_km === "number" && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> ~{profile.distance_km} km</span>
                  )}
                  {profile.is_online && <span className="inline-flex items-center gap-1"><span className="online-dot" /> {t("profile.online")}</span>}
                </div>
                {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Row label={t("profile.height")} value={profile.height_cm ? `${profile.height_cm} cm` : null} />
                  <Row label={t("profile.body_type")} value={profile.body_type ? t(`body_types.${profile.body_type}`) : null} />
                  <Row label={t("profile.ethnicity")} value={profile.ethnicity} />
                  <Row label={t("profile.smoking")} value={profile.smoking ? t(`lifestyle.smoking.${profile.smoking}`) : null} />
                  <Row label={t("profile.drinking")} value={profile.drinking ? t(`lifestyle.drinking.${profile.drinking}`) : null} />
                  <Row label={t("profile.diet")} value={profile.diet ? t(`lifestyle.diet.${profile.diet}`) : null} />
                  <Row label={t("profile.sti_status")} value={profile.sti_status ? t(`lifestyle.sti.${profile.sti_status}`) : null} />
                  <Row label={t("profile.sti_tested_on")} value={profile.sti_tested_on} />
                  <Row label={t("profile.cup_size")} value={profile.cup_size} />
                  <Row label={t("profile.penis_category")}
                    value={profile.penis_category ? `${profile.penis_category} (${PENIS_RANGES[profile.penis_category]})` : null} />
                  <Row label={t("profile.languages")} value={profile.languages} />
                </div>

                {(profile.relationship_types?.length > 0) && (
                  <div className="mt-3">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{t("profile.looking_for")}</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.relationship_types.map((r) => <Badge key={r} variant="secondary">{t(`relationships.${r}`)}</Badge>)}
                    </div>
                  </div>
                )}
                {(profile.seeking_roles?.length > 0) && (
                  <div className="mt-2">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{t("filters.seeking_roles")}</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.seeking_roles.map((r) => <Badge key={r} variant="outline">{t(`roles.${r}`)}</Badge>)}
                    </div>
                  </div>
                )}
                {(profile.kinks?.length > 0) && (
                  <div className="mt-2">
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{t("profile.kinks")}</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.kinks.map((k) => <Badge key={k} variant="outline">{k}</Badge>)}
                    </div>
                  </div>
                )}

                {profile.admin_view && (
                  <div className="mt-3 border-t pt-3 text-xs font-mono">
                    <div>email: {profile.email}</div>
                    <div>role: {profile.role_of_target}</div>
                    <div>hidden: {String(!!profile.hidden_mode)} · banned: {String(!!profile.banned)}</div>
                    {profile.ban_reason && <div>ban reason: {profile.ban_reason}</div>}
                    {profile.last_active && <div>last_active: {profile.last_active}</div>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {profile.match_id ? (
                  <Button onClick={() => nav(`/chat/${profile.match_id}`)} data-testid="open-chat-button">{t("profile.open_chat")}</Button>
                ) : profile.i_liked ? (
                  <Button variant="outline" onClick={unlike} data-testid="unlike-button">{t("profile.undo_like")}</Button>
                ) : (
                  <Button onClick={like} disabled={liking} data-testid="like-button" className="gap-1">
                    <Heart className="h-4 w-4" /> {t("profile.like")}
                  </Button>
                )}
                {me?.is_premium && !profile.match_id && (
                  <Dialog open={firstOpen} onOpenChange={setFirstOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="gap-1" data-testid="message-first-button"><Send className="h-4 w-4" /> {t("profile.message_first")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{t("profile.message_first")}</DialogTitle></DialogHeader>
                      <Textarea rows={4} value={firstText} onChange={(e) => setFirstText(e.target.value)} maxLength={500} data-testid="message-first-input" />
                      <DialogFooter>
                        <Button onClick={async () => {
                          if (!firstText.trim()) { toast.error(t("events.missing")); return; }
                          try {
                            const { data } = await api.post("/messages/first", { target_user_id: profile.id, text: firstText.trim() });
                            setFirstOpen(false); setFirstText("");
                            nav(`/chat/${data.match_id}`);
                          } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
                        }} data-testid="message-first-submit">{t("chat.send")}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                <ReportDialog targetType="user" targetId={profile.id} />
              </div>
              {!profile.match_id && profile.i_liked && (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Lock className="h-3 w-3" /> {t("profile.chat_locked")}
                </div>
              )}
            </div>
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
