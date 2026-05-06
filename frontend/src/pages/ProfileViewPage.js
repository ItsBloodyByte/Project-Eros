import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { NsfwBlurOverlay } from "../components/NsfwBlurOverlay";
import { ReportDialog } from "../components/ReportDialog";
import { MatchBanner } from "../components/MatchBanner";
import { Heart, MapPin, Lock, Send, EyeOff, ShieldAlert, ShieldCheck, UserX, Ban, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../lib/AuthContext";
import { PENIS_RANGES } from "../lib/constants";
import { useTranslation } from "react-i18next";
import { RoleBadge } from "../components/RoleBadge";
import { PersonDetails } from "../components/PersonDetails";
import { MoodBadge } from "../components/MoodBadge";
import { getRelationshipStatusMeta } from "../components/RelationshipStatusBadge";
import { AcquaintancesSection } from "../components/AcquaintancesSection";
import { CoupleInviteSection } from "../components/CoupleInviteSection";

function Row({ label, value }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-sm">{Array.isArray(value) ? value.join(" · ") : value}</span>
    </div>
  );
}

function AdminField({ label, value, mono = false }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className={"text-[12.5px] text-[hsl(var(--foreground))] break-all " + (mono ? "font-mono" : "")}>{String(value)}</span>
    </div>
  );
}

export default function ProfileViewPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isPreviewParam = searchParams.get("preview") === "1";
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

  const isSelf = me && me.id === id;
  const previewMode = isSelf || isPreviewParam;

  useEffect(() => {
    (async () => {
      try {
        if (!isSelf) {
          await api.post(`/seen/${id}`);
        }
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
  }, [id, nav, isSelf]);

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
      toast.error(e.response?.data?.detail || "Failed to like");
    } finally {
      setLiking(false);
    }
  };
  const superLike = async () => {
    setLiking(true);
    try {
      const { data } = await api.post("/likes/super", { target_user_id: id });
      if (data.matched) {
        toast.success("Super-Like · Match! ✨");
        setProfile((p) => ({ ...p, i_liked: true, they_liked: true, match_id: data.match_id, i_super_liked: true }));
      } else {
        toast.success("Super-Like gesendet ✨");
        setProfile((p) => ({ ...p, i_liked: true, i_super_liked: true }));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Super-Like fehlgeschlagen");
    } finally {
      setLiking(false);
    }
  };
  const unlike = async () => {
    await api.delete(`/likes/${id}`);
    setProfile((p) => ({ ...p, i_liked: false, match_id: null }));
  };
  const unmatch = async () => {
    if (!profile?.match_id) return;
    try {
      await api.post(`/matches/${profile.match_id}/unmatch`);
      toast.success("Match aufgelöst");
      setProfile((p) => ({ ...p, match_id: null, i_liked: false, they_liked: false }));
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };
  const block = async () => {
    try {
      await api.post(`/users/${id}/block`);
      toast.success("Nutzer blockiert");
      nav("/");
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };

  if (loading || !profile) {
    return (
      <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
        <div className="app-content"><AppHeader /><div className="p-8">Loading...</div></div>
      </div>
    );
  }

  const isAdminViewer = me?.role && me.role !== "user" && !previewMode;

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

              {profile.admin_view && !previewMode && (profile.hidden_mode || profile.banned) && (
                <div className="rounded-[var(--radius-md)] border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-3 text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[hsl(var(--destructive))]" />
                  {profile.banned ? t("profile.banned_profile") : t("profile.hidden_profile")}
                </div>
              )}

              <div className="rounded-[var(--radius-lg)] border bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden">
                {/* ─── Header: name, age, pronouns, badges ─── */}
                <div className="p-6 pb-5 border-b border-[hsl(var(--border))]/60">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 order-2 sm:order-1">
                      <div className="font-display text-3xl leading-tight tracking-tight">
                        <span className="break-keep">{profile.display_name}</span>
                        {profile.partner && <span className="text-[hsl(var(--muted-foreground))]"> &amp; {profile.partner.display_name}</span>}
                        {!profile.partner && profile.account_type === "duo" && profile.persona_b?.display_name && (
                          <span className="text-[hsl(var(--muted-foreground))]"> &amp; {profile.persona_b.display_name}</span>
                        )}
                        <span className="ml-2 text-xl text-[hsl(var(--muted-foreground))] font-sans whitespace-nowrap">
                          {profile.age}
                          {profile.partner?.age && ` / ${profile.partner.age}`}
                          {!profile.partner && profile.account_type === "duo" && profile.persona_b?.age && ` / ${profile.persona_b.age}`}
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                        {[profile.pronouns, profile.orientation ? t(`orientations.${profile.orientation}`) : null, profile.gender_identity ? t(`genders.${profile.gender_identity}`) : null]
                          .filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end order-1 sm:order-2 sm:max-w-full">
                      {profile.current_mood && (
                        <MoodBadge mood={profile.current_mood} size="md" testid="profile-mood-badge" />
                      )}
                      {(profile.partner || (profile.account_type === "duo" && profile.persona_b)) && (
                        <Badge className="gap-1 bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40" data-testid="profile-couple-badge">
                          Paar
                        </Badge>
                      )}
                      {profile.is_new && (
                        <Badge
                          variant="outline"
                          className="gap-1 bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/40 animate-pulse"
                          data-testid="profile-new-badge"
                          title="Dieses Profil ist seit weniger als 7 Tagen aktiv"
                        >
                          ✨ Neu
                        </Badge>
                      )}
                      {profile.id_verified && (
                        <Badge className="gap-1 bg-[hsl(var(--accent))]/90 hover:bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]" data-testid="profile-id-verified-badge">
                          <ShieldCheck className="h-3 w-3" /> ID verifiziert
                        </Badge>
                      )}
                      {profile.accept_nsfw === true && (
                        <Badge
                          variant="outline"
                          className="gap-1 bg-[hsl(345_60%_45%)]/10 text-[hsl(345_60%_45%)] border-[hsl(345_60%_45%)]/40"
                          data-testid="profile-accept-nsfw-badge"
                          title="Dieses Profil signalisiert Offenheit für NSFW-Inhalte"
                        >
                          18+ NSFW offen
                        </Badge>
                      )}
                      {profile.accept_nsfw === false && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[hsl(var(--muted-foreground))]"
                          data-testid="profile-nsfw-off-badge"
                          title="Dieses Profil möchte keine NSFW-Inhalte"
                        >
                          Nur SFW
                        </Badge>
                      )}
                      {profile.role && profile.role !== "user" && (
                        <RoleBadge role={profile.role} />
                      )}
                      {isAdminViewer && <Badge variant="outline" className="gap-1"><EyeOff className="h-3 w-3" /> {t("profile.admin_only")}</Badge>}
                    </div>
                  </div>

                  {/* Location / distance / online — one consistent meta strip */}
                  <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 text-sm text-[hsl(var(--muted-foreground))] flex-wrap">
                    {profile.city && (
                      <span className="inline-flex items-center gap-1" data-testid="profile-city">
                        <MapPin className="h-4 w-4" /> {profile.city}
                      </span>
                    )}
                    {typeof profile.distance_km === "number" && (
                      <span className="inline-flex items-center gap-1" data-testid="profile-distance">
                        {!profile.city && <MapPin className="h-4 w-4" />}
                        ~{profile.distance_km} km
                      </span>
                    )}
                    {profile.relationship_status && profile.relationship_status !== "not_specified" && (() => {
                      const meta = getRelationshipStatusMeta(profile.relationship_status);
                      const Icon = meta.icon;
                      return (
                        <span
                          className="inline-flex items-center gap-1"
                          data-testid={`profile-relationship-status-${meta.value}`}
                        >
                          <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
                          <span className="text-[hsl(var(--foreground))]">{meta.label}</span>
                        </span>
                      );
                    })()}
                    {profile.is_online && <span className="inline-flex items-center gap-1"><span className="online-dot" /> {t("profile.online")}</span>}
                    {profile.created_at && (
                      <span
                        className="inline-flex items-center gap-1"
                        data-testid="profile-created-at"
                        title={`Mitglied seit ${new Date(profile.created_at).toLocaleDateString("de-DE")}`}
                      >
                        <Sparkles className="h-4 w-4" />
                        Mitglied seit {new Date(profile.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* ─── Bio block ─── */}
                {profile.bio && (
                  <div className="px-6 py-5 border-b border-[hsl(var(--border))]/60">
                    <p className="text-[15px] leading-relaxed text-[hsl(var(--foreground))] whitespace-pre-line">
                      {profile.bio}
                    </p>
                  </div>
                )}

                {/* ─── Details: body / lifestyle / kinks / relationship / roles ─── */}
                <div className="px-6 py-5 space-y-4">
                  <PersonDetails person={profile} title={profile.partner || (profile.account_type === "duo" && profile.persona_b) ? profile.display_name : null} compact />
                  {profile.partner && (
                    <PersonDetails person={profile.partner} title={profile.partner.display_name} compact />
                  )}
                  {!profile.partner && profile.account_type === "duo" && profile.persona_b && (
                    <PersonDetails person={profile.persona_b} title={profile.persona_b.display_name || "Person B"} compact />
                  )}
                </div>

                {/* ─── Admin-only inspection panel ─── */}
                {profile.admin_view && !previewMode && (
                  <details className="group border-t border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/30">
                    <summary className="flex items-center gap-2 cursor-pointer select-none px-6 py-3 text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                      <ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                      Admin-Ansicht
                      <span className="ml-auto text-[10px] opacity-60 group-open:rotate-180 transition-transform inline-block">▾</span>
                    </summary>
                    <div className="px-6 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <AdminField label="E-Mail" value={profile.email} mono />
                      <AdminField label="Rolle" value={profile.role_of_target || "user"} />
                      <AdminField label="Versteckt" value={profile.hidden_mode ? "ja" : "nein"} />
                      <AdminField label="Gesperrt" value={profile.banned ? "ja" : "nein"} />
                      {profile.ban_reason && <AdminField label="Sperrgrund" value={profile.ban_reason} />}
                      {profile.last_active && <AdminField label="Zuletzt aktiv" value={new Date(profile.last_active).toLocaleString("de-DE")} />}
                    </div>
                  </details>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {previewMode ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] px-3 py-1 text-xs font-medium" data-testid="preview-mode-banner">
                      <EyeOff className="h-3.5 w-3.5" /> Vorschau — so sehen andere dein Profil
                    </div>
                    <Button asChild variant="outline" className="rounded-full gap-1" data-testid="preview-edit-button">
                      <Link to="/me"><Pencil className="h-4 w-4" /> Profil bearbeiten</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    {profile.match_id ? (
                      <Button onClick={() => nav(`/chat/${profile.match_id}`)} data-testid="open-chat-button">{t("profile.open_chat")}</Button>
                    ) : profile.i_liked ? (
                      <Button variant="outline" onClick={unlike} data-testid="unlike-button">{t("profile.undo_like")}</Button>
                    ) : (
                      <Button onClick={like} disabled={liking} data-testid="like-button" className="gap-1">
                        <Heart className="h-4 w-4" /> {t("profile.like")}
                      </Button>
                    )}
                    {me?.is_premium && !profile.match_id && !profile.i_liked && (
                      <Button
                        onClick={superLike}
                        disabled={liking}
                        variant="secondary"
                        className="gap-1 bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/25 ring-1 ring-[hsl(var(--accent))]/40"
                        data-testid="super-like-button"
                        title="Super-Like hebt dich in der Inbox der Empfänger:in hervor"
                      >
                        <Sparkles className="h-4 w-4" /> Super-Like
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
                    {profile.match_id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-colors" data-testid="unmatch-pill">
                            <UserX className="h-3.5 w-3.5" /> Unmatchen
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Match wirklich auflösen?</AlertDialogTitle>
                            <AlertDialogDescription>Die Verbindung und alle Nachrichten werden unwiderruflich entfernt.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={unmatch} data-testid="unmatch-confirm">Unmatchen</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--destructive))]/40 text-[hsl(var(--destructive))] px-3 py-1 text-xs hover:bg-[hsl(var(--destructive))]/10 transition-colors" data-testid="block-pill">
                          <Ban className="h-3.5 w-3.5" /> Blockieren
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Nutzer blockieren?</AlertDialogTitle>
                          <AlertDialogDescription>Du siehst das Profil nicht mehr und umgekehrt. Bestehende Matches und Chats werden entfernt.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={block} data-testid="block-confirm">Blockieren</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
              {!profile.match_id && profile.i_liked && (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Lock className="h-3 w-3" /> {t("profile.chat_locked")}
                </div>
              )}
            </div>

            <AcquaintancesSection
              userId={profile.id}
              viewerId={me?.id}
              isOwnProfile={previewMode || profile.id === me?.id}
              targetDisplayName={profile.display_name}
              disableRequest={previewMode}
            />

            <CoupleInviteSection
              profile={profile}
              me={me}
              previewMode={previewMode}
            />
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
