import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { SystemUpdatesPanel } from "../components/SystemUpdatesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Bell, ShieldAlert, BadgeCheck, ExternalLink } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import { RoleBadge } from "../components/RoleBadge";
import { AdminPromosTab } from "../components/AdminPromosTab";
import { AdminBlogTab } from "../components/AdminBlogTab";
import { AdminHoneypotsTab } from "../components/AdminHoneypotsTab";
import { AdminShell } from "../admin/shell/AdminShell";
import { OverviewSection } from "../admin/components/OverviewSection";
import { useLocation, useNavigate } from "react-router-dom";

const ADMIN_TAB_LABELS = {
  reports: "Reports",
  users: "User:innen",
  photos: "Foto-Queue",
  verifications: "Verifizierungen",
  ai: "KI-Konfiguration",
  payments: "Zahlungen",
  legal: "Rechtliche Seiten",
  broadcasts: "Broadcasts",
  promos: "Promos & Konfiguration",
  blog: "Blog",
  "team-channels": "Team-Kanäle",
  audit: "Audit-Log",
  system: "System-Status",
};
function activeTabLabel(id) {
  return ADMIN_TAB_LABELS[id] || "Übersicht";
}

export default function AdminPage() {
  const { user } = useAuth();
  // Section state is mirrored into the URL (?section=...) so deep links
  // and browser back/forward work like in any modern admin console.
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get("section") || "overview";
    } catch { return "overview"; }
  })();
  const [activeTab, _setActiveTab] = useState(initial);
  const setActiveTab = (id) => {
    _setActiveTab(id);
    try {
      const sp = new URLSearchParams(location.search);
      sp.set("section", id);
      navigate({ pathname: location.pathname, search: `?${sp.toString()}` }, { replace: true });
    } catch {}
  };
  // Sync state back when the URL changes externally (e.g. browser back).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const s = sp.get("section");
      if (s && s !== activeTab) _setActiveTab(s);
    } catch {}
    // eslint-disable-next-line
  }, [location.search]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [verifs, setVerifs] = useState([]);
  const [search, setSearch] = useState("");
  const [aiCfg, setAiCfg] = useState({ provider: "gemini", model: "gemini-2.5-flash", base_url: "", enabled: true, api_key: "", api_key_masked: "" });
  const [legalKey, setLegalKey] = useState("terms");
  const [legal, setLegal] = useState({ title: "", content_markdown: "", updated_at: "" });
  const [payCfg, setPayCfg] = useState({
    provider: "disabled",
    enabled: false,
    stripe_api_key: "",
    stripe_api_key_masked: "",
    packages: [],
    provider_keys: {},          // editable values (empty = keep stored)
    provider_keys_masked: {},   // shown next to each field
    supported_providers: ["stripe"],
    known_providers: ["stripe","paypal","mollie","klarna","paddle","custom"],
  });
  const [reportDetail, setReportDetail] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [editUser, setEditUser] = useState(null); // full user doc
  const [editForm, setEditForm] = useState(null); // edited fields
  const [editSaving, setEditSaving] = useState(false);

  const openEditUser = async (uid) => {
    try {
      const { data } = await api.get(`/admin/users/${uid}`);
      setEditUser(data.user);
      setEditForm({
        display_name: data.user.display_name || "",
        email: data.user.email || "",
        age: data.user.age || 18,
        gender_identity: data.user.gender_identity || "",
        pronouns: data.user.pronouns || "",
        orientation: data.user.orientation || "",
        bio: data.user.bio || "",
        height_cm: data.user.height_cm || "",
        body_type: data.user.body_type || "",
        ethnicity: data.user.ethnicity || "",
        smoking: data.user.smoking || "",
        drinking: data.user.drinking || "",
        diet: data.user.diet || "",
        sti_status: data.user.sti_status || "",
        cup_size: data.user.cup_size || "",
        penis_length_cm: data.user.penis_length_cm || "",
        penis_girth_cm: data.user.penis_girth_cm || "",
        id_verified: !!data.user.id_verified,
        id_verification_status: data.user.id_verification_status || "",
        email_verified: !!data.user.email_verified,
        shadow_restricted: !!data.user.shadow_restricted,
        banned: !!data.user.banned,
        ban_reason: data.user.ban_reason || "",
        role: data.user.role || "user",
        premium_days: 0,
        boost_minutes: 0,
      });
    } catch (e) { toast.error(e.response?.data?.detail || "Konnte Nutzer nicht laden"); }
  };

  const saveEditUser = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const payload = { ...editForm };
      delete payload.premium_days; delete payload.boost_minutes;
      // Numeric conversions
      if (payload.age !== "" && payload.age !== null) payload.age = Number(payload.age);
      if (payload.height_cm !== "" && payload.height_cm !== null) payload.height_cm = Number(payload.height_cm) || null;
      if (payload.penis_length_cm !== "") payload.penis_length_cm = Number(payload.penis_length_cm) || null;
      if (payload.penis_girth_cm !== "") payload.penis_girth_cm = Number(payload.penis_girth_cm) || null;
      // Remove empty-string fields that should remain untouched (would set to empty)
      const clean = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v === "" && typeof editUser[k] !== "string") continue;
        clean[k] = v;
      }
      await api.patch(`/admin/users/${editUser.id}`, clean);
      // Role change via dedicated endpoint to allow superadmin check
      if (editForm.role && editForm.role !== editUser.role) {
        await api.post(`/admin/users/${editUser.id}/role`, { role: editForm.role });
      }
      toast.success("Profil gespeichert");
      await loadAll();
      setEditUser(null); setEditForm(null);
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
    finally { setEditSaving(false); }
  };

  const grantPremium = async (action) => {
    if (!editUser) return;
    try {
      const body = { action };
      if (action !== "revoke") {
        body.days = Number(editForm.premium_days || 0);
        body.boost_minutes = Number(editForm.boost_minutes || 0);
      }
      const { data } = await api.post(`/admin/users/${editUser.id}/premium`, body);
      setEditUser((u) => ({ ...u, premium_expires_at: data.premium_expires_at, boost_expires_at: data.boost_expires_at }));
      toast.success(action === "revoke" ? "Premium entzogen" : "Premium aktualisiert");
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };

  const deleteUserPhoto = async (pid) => {
    if (!editUser) return;
    try {
      await api.delete(`/admin/users/${editUser.id}/photos/${pid}`);
      setEditUser((u) => ({ ...u, photos: (u.photos || []).filter((p) => p.id !== pid) }));
      toast.success("Foto entfernt");
    } catch (e) { toast.error("Fehlgeschlagen"); }
  };

  const openReport = async (id) => {
    setReportLoading(true);
    setReportDetail({ loading: true, report: { id } });
    try {
      const { data } = await api.get(`/admin/reports/${id}`);
      setReportDetail(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Konnte Report nicht laden");
      setReportDetail(null);
    } finally {
      setReportLoading(false);
    }
  };

  const loadAll = async () => {
    try {
      const [r, u, a, p] = await Promise.all([
        api.get("/admin/reports"),
        api.get("/admin/users"),
        api.get("/admin/audit"),
        api.get("/admin/moderation/photos", { params: { threshold: 0.5 } }),
      ]);
      setReports(r.data.reports); setUsers(u.data.users); setAudit(a.data.events); setPhotos(p.data.photos);
    } catch (e) {
      toast.error("Admin-Zugriff verweigert oder Ladefehler");
    }
    if (user?.role === "admin" || user?.role === "superadmin") {
      try { const v = await api.get("/admin/verifications", { params: { status: "pending" } }); setVerifs(v.data.verifications || []); } catch {}
      try {
        const ai = await api.get("/admin/ai-config");
        setAiCfg({ provider: ai.data.provider || "gemini", model: ai.data.model || "gemini-2.5-flash",
          base_url: ai.data.base_url || "", enabled: ai.data.enabled !== false,
          api_key: "", api_key_masked: ai.data.api_key_masked || "" });
      } catch {}
      try {
        const pc = await api.get("/admin/payment-config");
        setPayCfg({
          provider: pc.data.provider || "disabled",
          enabled: !!pc.data.enabled,
          stripe_api_key: "",
          stripe_api_key_masked: pc.data.stripe_api_key_masked || "",
          packages: pc.data.packages || [],
          provider_keys: {},
          provider_keys_masked: pc.data.provider_keys_masked || {},
          supported_providers: pc.data.supported_providers || ["stripe"],
          known_providers: pc.data.known_providers || ["stripe","paypal","mollie","klarna","paddle","custom"],
        });
      } catch {}
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user?.role]);

  // Realtime admin moderation notifications (WebSocket)
  const [liveEvents, setLiveEvents] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [channelsSig, setChannelsSig] = useState("*");
  useEffect(() => {
    if (!user || !["admin", "moderator", "superadmin", "content_reviewer"].includes(user.role)) return;
    // Load recent persisted notifications first
    (async () => {
      try {
        const { data } = await api.get("/admin/notifications", { params: { limit: 50 } });
        setLiveEvents((data.notifications || []).map((n) => ({ ...(n.data || {}), notification_id: n.id, persisted_at: n.created_at, _replay: true })));
      } catch {}
    })();
    // Connect WebSocket
    const token = localStorage.getItem("eros_token");
    if (!token) return;
    const wsUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/^http/, "ws");
    if (!wsUrl) return;
    let ws;
    let closed = false;
    let reconnectTimer;
    const connect = () => {
      try {
        const qs = new URLSearchParams({ token });
        if (channelsSig && channelsSig !== "*") qs.set("channels", channelsSig);
        ws = new WebSocket(`${wsUrl}/api/ws/admin?${qs.toString()}`);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            setLiveEvents((prev) => {
              const exists = prev.some((e) => e.notification_id === msg.notification_id);
              if (exists) return prev;
              return [{ ...msg }, ...prev].slice(0, 100);
            });
            if (!msg._replay) {
              const title = (() => {
                switch (msg.type) {
                  case "new_report": return `Neue Meldung: ${msg.reason || ""}`;
                  case "minor_registration_attempt": return "Minderjährige Registrierung blockiert";
                  case "flagged_registration": return "Registrierung von geflaggter IP";
                  case "id_verification_submitted": return "Neue ID-Verifizierung eingereicht";
                  case "auto_shadow_restrict": return "Auto-Mod: Shadow-Restrict";
                  case "photo_retention_set": return "Foto-Aufbewahrung gesetzt";
                  default: return `Event: ${msg.type}`;
                }
              })();
              toast.info(title, { description: msg.email || msg.user_id || msg.target_id || "" });
            }
          } catch {}
        };
        ws.onclose = () => {
          if (!closed) reconnectTimer = setTimeout(connect, 3000);
        };
      } catch { reconnectTimer = setTimeout(connect, 3000); }
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }, [user?.role, user?.id, channelsSig]);

  const unreadCount = liveEvents.filter((e) => !e._ack).length;
  const ackAllNotifications = async () => {
    try {
      await api.post("/admin/notifications/ack_all");
      setLiveEvents((prev) => prev.map((e) => ({ ...e, _ack: true })));
    } catch {}
  };

  // Per-moderator subscription channels
  const [channelsState, setChannelsState] = useState({ channels: [], all_subscribed: true, available_channels: [] });
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [channelsSaving, setChannelsSaving] = useState(false);

  useEffect(() => {
    setChannelsSig(
      channelsState.all_subscribed ? "*" : (channelsState.channels || []).slice().sort().join(",")
    );
  }, [channelsState.all_subscribed, channelsState.channels]);

  useEffect(() => {
    if (!user || !["admin", "moderator", "superadmin", "content_reviewer"].includes(user.role)) return;
    (async () => {
      try {
        const { data } = await api.get("/admin/notifications/channels");
        setChannelsState(data);
      } catch {}
    })();
  }, [user?.role, user?.id]);

  const toggleChannel = (c) => {
    setChannelsState((prev) => {
      const allChannels = prev.available_channels || [];
      const current = prev.all_subscribed ? [...allChannels] : [...(prev.channels || [])];
      const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
      return { ...prev, channels: next, all_subscribed: false };
    });
  };

  const saveChannels = async () => {
    setChannelsSaving(true);
    try {
      const { data } = await api.post("/admin/notifications/channels", {
        channels: channelsState.channels,
        all_subscribed: false,
      });
      setChannelsState(data);
      toast.success("Benachrichtigungs-Kanäle gespeichert");
      setChannelsOpen(false);
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
    finally { setChannelsSaving(false); }
  };

  const enableAllChannels = async () => {
    setChannelsSaving(true);
    try {
      const { data } = await api.post("/admin/notifications/channels", { all_subscribed: true });
      setChannelsState(data);
      toast.success("Alle Kanäle aktiviert");
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
    finally { setChannelsSaving(false); }
  };

  const CHANNEL_LABELS = {
    new_report: "Neue Meldungen",
    minor_registration_attempt: "Minderjährige Registrierung blockiert",
    flagged_registration: "Registrierung von geflaggter IP",
    id_verification_submitted: "ID-Verifizierung eingereicht",
    auto_shadow_restrict: "Auto-Mod Shadow-Restrict",
    photo_retention_set: "Foto-Aufbewahrung gesetzt",
  };
  const isChannelActive = (c) => channelsState.all_subscribed || (channelsState.channels || []).includes(c);

  // Team role-channel matrix (superadmin)
  const [roleChannels, setRoleChannels] = useState(null);
  const loadRoleChannels = async () => {
    try {
      const { data } = await api.get("/admin/role-channels");
      setRoleChannels(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Konnte Team-Kanäle nicht laden"); }
  };
  const toggleRoleChannel = (role, c) => {
    setRoleChannels((prev) => {
      if (!prev) return prev;
      const cur = prev.roles[role];
      const current = [...(cur.channels || [])];
      const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
      return { ...prev, roles: { ...prev.roles, [role]: { ...cur, channels: next, overridden: true } } };
    });
  };
  const saveRoleChannels = async (role) => {
    try {
      const channels = roleChannels.roles[role].channels;
      await api.post(`/admin/role-channels/${role}`, { channels });
      toast.success(`Kanäle für Rolle „${role}" gespeichert`);
      await loadRoleChannels();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };
  const resetRoleChannels = async (role) => {
    try {
      await api.post(`/admin/role-channels/${role}`, { reset: true });
      toast.success(`Rolle „${role}" auf Standard zurückgesetzt`);
      await loadRoleChannels();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };

  // Broadcasts composer
  const [broadcasts, setBroadcasts] = useState([]);
  const [bcForm, setBcForm] = useState({
    title: "", body: "", severity: "info", audience: "all", pinned: false,
    cities: [], interests: [], genders: [], age_min: "", age_max: "",
  });
  const [bcSegOpts, setBcSegOpts] = useState({ cities: [], interests: [], genders: [] });
  const [bcBusy, setBcBusy] = useState(false);
  const [bcPreview, setBcPreview] = useState(null);
  const [bcPreviewTotal, setBcPreviewTotal] = useState(null);
  const loadBroadcasts = async () => {
    try {
      const { data } = await api.get("/admin/broadcasts");
      setBroadcasts(data.broadcasts || []);
      const opts = await api.get("/admin/broadcasts/segments/options");
      setBcSegOpts(opts.data || { cities: [], interests: [], genders: [] });
    } catch {}
  };
  const toggleInArray = (arr, val) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  const submitBroadcast = async () => {
    if (!bcForm.title.trim() || !bcForm.body.trim()) { toast.error("Titel und Inhalt sind Pflicht"); return; }
    if (bcForm.audience === "segment") {
      const hasAny = bcForm.cities.length || bcForm.interests.length || bcForm.genders.length || bcForm.age_min || bcForm.age_max;
      if (!hasAny) { toast.error("Segment-Broadcast benötigt mindestens ein Filterkriterium"); return; }
    }
    setBcBusy(true);
    try {
      const payload = { ...bcForm };
      if (payload.audience !== "segment") { delete payload.cities; delete payload.interests; delete payload.genders; delete payload.age_min; delete payload.age_max; }
      else {
        if (payload.age_min === "") delete payload.age_min; else payload.age_min = Number(payload.age_min);
        if (payload.age_max === "") delete payload.age_max; else payload.age_max = Number(payload.age_max);
      }
      await api.post("/admin/broadcasts", payload);
      toast.success("Broadcast veröffentlicht & authentisch signiert");
      setBcForm({ title: "", body: "", severity: "info", audience: "all", pinned: false, cities: [], interests: [], genders: [], age_min: "", age_max: "" });
      await loadBroadcasts();
    } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
    finally { setBcBusy(false); }
  };
  const deleteBroadcast = async (id) => {
    if (!confirm("Broadcast wirklich löschen?")) return;
    try { await api.delete(`/admin/broadcasts/${id}`); toast.success("Gelöscht"); await loadBroadcasts(); }
    catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };

  // Live audience size preview (debounced) — recalculates when audience / segment filters change
  useEffect(() => {
    if (!user || !["admin", "superadmin"].includes(user.role)) return;
    const handle = setTimeout(async () => {
      try {
        const payload = { audience: bcForm.audience };
        if (bcForm.audience === "segment") {
          if (bcForm.cities.length) payload.cities = bcForm.cities;
          if (bcForm.interests.length) payload.interests = bcForm.interests;
          if (bcForm.genders.length) payload.genders = bcForm.genders;
          if (bcForm.age_min !== "") payload.age_min = Number(bcForm.age_min);
          if (bcForm.age_max !== "") payload.age_max = Number(bcForm.age_max);
        }
        const { data } = await api.post("/admin/broadcasts/segments/preview", payload);
        setBcPreview(typeof data?.count === "number" ? data.count : null);
        setBcPreviewTotal(typeof data?.total === "number" ? data.total : null);
      } catch {
        setBcPreview(null);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [
    user?.role,
    bcForm.audience,
    bcForm.cities.join("|"),
    bcForm.interests.join("|"),
    bcForm.genders.join("|"),
    bcForm.age_min,
    bcForm.age_max,
  ]);

  const updateStatus = async (id, status) => {
    await api.post(`/admin/reports/${id}/status`, { status });
    await loadAll();
  };
  const ban = async (uid, reason = "Policy violation") => { await api.post("/admin/ban", { user_id: uid, reason }); await loadAll(); };
  const unban = async (uid) => { await api.post(`/admin/unban/${uid}`); await loadAll(); };
  const reviewVerif = async (user_id, decision) => {
    try { await api.post("/admin/verifications/review", { user_id, decision }); toast.success("Entscheidung gespeichert"); await loadAll(); }
    catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
  };
  const loadLegal = async (key) => {
    try {
      const { data } = await api.get(`/legal/${key}`);
      setLegalKey(key);
      setLegal({ title: data.title || "", content_markdown: data.content_markdown || "", updated_at: data.updated_at || "" });
    } catch (e) { toast.error("Konnte Seite nicht laden"); }
  };
  const saveLegal = async () => {
    try {
      await api.put(`/admin/legal/${legalKey}`, { title: legal.title, content_markdown: legal.content_markdown });
      toast.success("Rechtliche Seite gespeichert");
      await loadLegal(legalKey);
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const saveAi = async () => {
    try {
      const payload = { provider: aiCfg.provider, model: aiCfg.model, base_url: aiCfg.base_url || null, enabled: aiCfg.enabled };
      if (aiCfg.api_key?.trim()) payload.api_key = aiCfg.api_key.trim();
      await api.post("/admin/ai-config", payload);
      toast.success("KI-Konfiguration gespeichert");
      setAiCfg((c) => ({ ...c, api_key: "" }));
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const savePay = async () => {
    try {
      const payload = {
        provider: payCfg.provider,
        enabled: payCfg.enabled,
        packages: payCfg.packages,
        provider_keys: payCfg.provider_keys, // only non-empty values overwrite
      };
      if (payCfg.stripe_api_key?.trim()) payload.stripe_api_key = payCfg.stripe_api_key.trim();
      await api.post("/admin/payment-config", payload);
      toast.success("Zahlungs-Konfiguration gespeichert");
      setPayCfg((c) => ({ ...c, stripe_api_key: "", provider_keys: {} }));
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Speichern fehlgeschlagen"); }
  };
  const setProviderKey = (pid, field, value) => {
    setPayCfg((c) => ({
      ...c,
      provider_keys: {
        ...(c.provider_keys || {}),
        [pid]: { ...((c.provider_keys || {})[pid] || {}), [field]: value },
      },
    }));
  };
  const updatePkg = (idx, patch) => {
    setPayCfg((c) => ({ ...c, packages: c.packages.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  };
  const addPkg = () => {
    setPayCfg((c) => ({
      ...c,
      packages: [...c.packages, { id: `pkg_${Date.now()}`, amount: 4.99, currency: "eur", desc: "Neues Paket", enabled: true, kind: "premium", days: 30 }],
    }));
  };
  const removePkg = (idx) => setPayCfg((c) => ({ ...c, packages: c.packages.filter((_, i) => i !== idx) }));

  if (!user || user.role === "user") {
    return (
      <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
        <div className="app-content flex flex-col min-h-screen"><AppHeader />
          <div className="flex-1 grid place-items-center px-4">
            <div className="max-w-md text-center rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-8 shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--border))]/60">
              <div className="font-display text-3xl tracking-tight mb-1">Nur für Admins</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">Dein Konto hat keine Moderations-Rolle.</div>
            </div>
          </div>
          <AppFooter />
        </div>
      </div>
    );
  }

  const isSuper = user.role === "admin" || user.role === "superadmin";

  // The bell + notification channels dialog is moved into the topbar slot
  // so it lives in the new AdminShell rather than the legacy app header.
  const topbarBell = (
    <DropdownMenu open={bellOpen} onOpenChange={setBellOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center h-8 w-8 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/40"
          aria-label="Benachrichtigungen"
          data-testid="admin-bell-button"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[hsl(var(--destructive))] text-white text-[9px] font-semibold grid place-items-center ring-2 ring-[hsl(var(--card))]"
              data-testid="admin-bell-unread"
            >{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] max-h-[480px] overflow-y-auto">
        <div className="px-3 py-2 flex items-center justify-between border-b gap-2">
          <div className="font-medium text-sm">Moderations-Events</div>
          <div className="flex items-center gap-2">
            <button
              className="text-xs underline text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              onClick={() => { setChannelsOpen(true); setBellOpen(false); }}
              data-testid="admin-bell-channels"
            >Kanäle</button>
            <button className="text-xs underline text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={ackAllNotifications} data-testid="admin-bell-ack-all">Alle markieren</button>
          </div>
        </div>
        {!channelsState.all_subscribed && (
          <div className="px-3 py-1.5 bg-[hsl(var(--secondary))]/40 text-[11px] text-[hsl(var(--muted-foreground))] border-b">
            Abonniert: {(channelsState.channels || []).length}/{channelsState.available_channels?.length || 0} Kanäle
          </div>
        )}
        {liveEvents.length === 0 && <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Noch keine Benachrichtigungen.</div>}
        <ul className="divide-y divide-[hsl(var(--border))]/60">
          {liveEvents.slice(0, 50).map((e, i) => (
            <li key={e.notification_id || i} className="px-3 py-2 text-xs space-y-0.5 hover:bg-[hsl(var(--secondary))]/50" data-testid={`admin-bell-item-${i}`}>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${e._ack ? "bg-[hsl(var(--muted-foreground))]/40" : "bg-[hsl(var(--destructive))]"}`} />
                <span className="font-medium capitalize">{(e.type || "").replace(/_/g, " ")}</span>
                <span className="ml-auto font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{(e.at || e.persisted_at || "").slice(11,19)}</span>
              </div>
              <div className="text-[hsl(var(--muted-foreground))] pl-3.5">
                {e.type === "new_report" && <>Grund: <b>{e.reason}</b> · {e.target_type} · {e.target_email || (e.target_id || "").slice(0,8)}</>}
                {e.type === "minor_registration_attempt" && <>{e.email} · Alter {e.age} · IP {e.ip}</>}
                {e.type === "flagged_registration" && <>{e.email} · IP {e.ip} — ID-Verifizierung erforderlich</>}
                {e.type === "id_verification_submitted" && <>{e.user_name} ({e.email}) · {e.document_type}</>}
                {e.type === "auto_shadow_restrict" && <>User {e.user_id?.slice(0,8)} · {e.unique_reports} Reports</>}
                {e.type === "photo_retention_set" && <>User {e.target_user_id?.slice(0,8)} · bis {(e.until || "").slice(0,10)}</>}
              </div>
              {e.type === "new_report" && e.report_id && (
                <button
                  className="ml-3.5 underline text-[11px] text-[hsl(var(--accent))]"
                  onClick={() => { setBellOpen(false); openReport(e.report_id); }}
                >Report öffnen</button>
              )}
              {(e.type === "flagged_registration" || e.type === "minor_registration_attempt" || e.type === "id_verification_submitted") && e.user_id && (
                <button
                  className="ml-3.5 underline text-[11px] text-[hsl(var(--accent))]"
                  onClick={() => { setBellOpen(false); openEditUser(e.user_id); }}
                >Nutzer öffnen</button>
              )}
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AdminShell
      value={activeTab}
      onChange={(id) => {
        setActiveTab(id);
        // Preserve the legacy lazy-loading hooks for tabs that fetched on demand.
        if (id === "legal") loadLegal(legalKey);
        if (id === "broadcasts") loadBroadcasts();
        if (id === "team-channels" && isSuper) loadRoleChannels();
      }}
      isSuper={isSuper}
      counts={{ reports: (reports || []).length, photos: (photos || []).length, verifications: (verifs || []).length }}
      user={user}
      topbarRight={topbarBell}
    >
      {/* Notification Channels Dialog (kept as before; just reparented). */}
      <Dialog open={channelsOpen} onOpenChange={setChannelsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Benachrichtigungs-Kanäle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-[hsl(var(--muted-foreground))] text-xs">
              Wähle, welche Moderations-Events dich erreichen sollen. Die Glocke oben rechts zeigt dann nur ausgewählte Kanäle — andere Teammitglieder können sich um den Rest kümmern.
            </p>
            <div className="rounded-md border divide-y divide-[hsl(var(--border))]/60">
              {(channelsState.available_channels || []).map((c) => (
                <label key={c} className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-[hsl(var(--secondary))]/40" data-testid={`channel-${c}`}>
                  <div>
                    <div className="font-medium">{CHANNEL_LABELS[c] || c}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">{c}</div>
                  </div>
                  <Switch
                    checked={isChannelActive(c)}
                    onCheckedChange={() => toggleChannel(c)}
                    data-testid={`channel-toggle-${c}`}
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                className="text-xs underline text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                onClick={enableAllChannels}
                disabled={channelsSaving}
                data-testid="channels-all-on"
              >Alle aktivieren</button>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Änderungen greifen nach Speichern und Neuaufbau der Verbindung.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChannelsOpen(false)}>Abbrechen</Button>
            <Button onClick={saveChannels} disabled={channelsSaving} data-testid="channels-save">
              {channelsSaving ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The new Overview dashboard. Shown when section == "overview". */}
      {activeTab === "overview" && (
        <OverviewSection onJumpTo={setActiveTab} isSuper={isSuper} />
      )}

      <div className="min-w-0" data-testid="admin-layout">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Legacy TabsList — kept as accessibility fallback (sr-only, drives
              Radix active state when external nav calls onValueChange). */}
          <TabsList className="sr-only">
            <TabsTrigger value="overview">Dashboard</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="photos">Foto-Queue</TabsTrigger>
                  <TabsTrigger value="verifications">Verifizierungen</TabsTrigger>
                  {isSuper && <TabsTrigger value="ai">KI-Konfig</TabsTrigger>}
                  {isSuper && <TabsTrigger value="payments">Zahlungen</TabsTrigger>}
                  {isSuper && <TabsTrigger value="legal">Rechtliches</TabsTrigger>}
                  <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
                  {isSuper && <TabsTrigger value="promos">Promos &amp; Konfig</TabsTrigger>}
                  <TabsTrigger value="blog">Blog</TabsTrigger>
                  {isSuper && <TabsTrigger value="team-channels">Team-Kanäle</TabsTrigger>}
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                  {isSuper && <TabsTrigger value="system">System</TabsTrigger>}
                </TabsList>

            <TabsContent value="reports" className="mt-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ID</TableHead><TableHead>Ziel</TableHead><TableHead>Grund</TableHead><TableHead>Status</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-[hsl(var(--secondary))]/50" data-testid={`admin-report-row-${r.id}`}>
                        <TableCell className="font-mono text-xs" onClick={() => openReport(r.id)}>{r.id.slice(0,8)}</TableCell>
                        <TableCell onClick={() => openReport(r.id)}>
                          {r.target_type === "user" ? (
                            <Link to={`/profile/${r.target_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline hover:text-[hsl(var(--accent))]" onClick={(e) => e.stopPropagation()} data-testid={`report-target-profile-${r.id}`}>
                              user · <span className="font-mono text-xs">{r.target_id.slice(0,8)}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <>{r.target_type} · <span className="font-mono text-xs">{r.target_id.slice(0,8)}</span></>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] sm:max-w-[320px] truncate" onClick={() => openReport(r.id)}>{r.reason}</TableCell>
                        <TableCell><Badge variant={r.status==="resolved"?"secondary":"outline"}>{r.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => openReport(r.id)} data-testid={`admin-report-open-${r.id}`}>Details</Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "reviewing")}>Prüfen</Button>
                            <Button size="sm" onClick={() => updateStatus(r.id, "resolved")} data-testid={`admin-resolve-${r.id}`}>Erledigt</Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "rejected")}>Verwerfen</Button>
                            {r.target_type === "user" && <Button size="sm" variant="destructive" onClick={() => ban(r.target_id, r.reason)}>Bannen</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {reports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine Meldungen.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="mt-4 space-y-3">
              <Input placeholder="Suche E-Mail / Name" value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={async (e) => { if (e.key === "Enter") { const { data } = await api.get("/admin/users", { params: { q: search } }); setUsers(data.users); } }} />
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Alter</TableHead><TableHead>Rolle</TableHead><TableHead>Status</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} data-testid={`admin-user-row-${u.id}`}>
                        <TableCell>
                          <Link
                            to={`/profile/${u.id}`}
                            className="font-medium hover:underline flex items-center gap-1"
                            data-testid={`admin-user-profile-link-${u.id}`}
                          >
                            {u.display_name}
                            <ExternalLink className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.email}</TableCell>
                        <TableCell>{u.age}</TableCell>
                        <TableCell>
                          {u.role && u.role !== "user" ? (
                            <RoleBadge role={u.role} />
                          ) : (
                            <Badge variant="outline">user</Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-x-1">
                          {u.banned && <Badge variant="destructive">banned</Badge>}
                          {u.shadow_restricted && <Badge variant="secondary">shadow</Badge>}
                          {u.id_verified && <Badge>ID</Badge>}
                          {u.privacy?.hidden_mode && <Badge variant="outline">versteckt</Badge>}
                          {!u.banned && !u.shadow_restricted && !u.privacy?.hidden_mode && <Badge variant="secondary">aktiv</Badge>}
                        </TableCell>
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="ghost" asChild data-testid={`admin-user-view-${u.id}`}>
                            <Link to={`/profile/${u.id}`}>Ansehen</Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditUser(u.id)} data-testid={`admin-edit-user-${u.id}`}>Bearbeiten</Button>
                          {u.banned
                            ? <Button size="sm" onClick={() => unban(u.id)}>Entbannen</Button>
                            : <Button size="sm" variant="destructive" onClick={() => ban(u.id)}>Bannen</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map((p) => (
                  <div key={p.photo.id} className="relative aspect-square rounded-md overflow-hidden border bg-[hsl(var(--muted))]">
                    <img src={p.photo.data} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[11px] px-2 py-1">
                      <div>{p.display_name} · NSFW {(p.photo.nsfw_score*100).toFixed(0)}%</div>
                      <div className="flex gap-2 mt-1">
                        <button className="underline" onClick={() => ban(p.user_id, "NSFW violation")}>Owner bannen</button>
                      </div>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && <div className="col-span-full text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine markierten Fotos.</div>}
              </div>
            </TabsContent>

            <TabsContent value="verifications" className="mt-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>User</TableHead><TableHead>Dokument-Typ</TableHead><TableHead>Selfie</TableHead><TableHead>Dokument</TableHead><TableHead>Eingereicht</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {verifs.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.user_id?.slice(0,8)}</TableCell>
                        <TableCell>{v.document_type}</TableCell>
                        <TableCell>{v.selfie_data_url ? <img src={v.selfie_data_url} alt="selfie" className="h-16 w-16 object-cover rounded" /> : "-"}</TableCell>
                        <TableCell>{v.document_data_url ? <img src={v.document_data_url} alt="doc" className="h-16 w-24 object-cover rounded" /> : "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{v.submitted_at}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" onClick={() => reviewVerif(v.user_id, "approved")} data-testid={`verif-approve-${v.user_id}`}>Genehmigen</Button>
                          <Button size="sm" variant="destructive" onClick={() => reviewVerif(v.user_id, "rejected")}>Ablehnen</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {verifs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine offenen Verifizierungen.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="honeypots" className="mt-4">
              <AdminHoneypotsTab isSuper={isSuper} />
            </TabsContent>

            {isSuper && (
              <TabsContent value="ai" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4 max-w-2xl">
                  <div className="font-display text-lg">KI-Moderationsanbieter</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Provider</Label>
                      <Select value={aiCfg.provider} onValueChange={(v) => setAiCfg({ ...aiCfg, provider: v })}>
                        <SelectTrigger data-testid="ai-provider-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="ollama">Ollama (self-hosted)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Modell</Label>
                      <Input value={aiCfg.model} onChange={(e) => setAiCfg({ ...aiCfg, model: e.target.value })} data-testid="ai-model-input" />
                    </div>
                    <div className="col-span-2">
                      <Label>Base URL (optional, Ollama etc.)</Label>
                      <Input value={aiCfg.base_url} onChange={(e) => setAiCfg({ ...aiCfg, base_url: e.target.value })} placeholder="http://localhost:11434" />
                    </div>
                    <div className="col-span-2">
                      <Label>API-Key {aiCfg.api_key_masked && <span className="text-xs text-[hsl(var(--muted-foreground))]">({aiCfg.api_key_masked} gespeichert)</span>}</Label>
                      <Input type="password" value={aiCfg.api_key} onChange={(e) => setAiCfg({ ...aiCfg, api_key: e.target.value })} placeholder="Leer lassen um gespeicherten Key zu behalten" data-testid="ai-apikey-input" />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <div>
                        <Label>KI-Moderation aktiv</Label>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">Fotos werden beim Upload automatisch geprüft.</div>
                      </div>
                      <Switch checked={aiCfg.enabled} onCheckedChange={(v) => setAiCfg({ ...aiCfg, enabled: v })} data-testid="ai-enabled-switch" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveAi} data-testid="ai-save-button">Speichern</Button>
                  </div>
                </div>
              </TabsContent>
            )}

            {isSuper && (
              <TabsContent value="payments" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-display text-lg">Zahlungsanbieter & Preise</div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Aktiv</Label>
                      <Switch checked={payCfg.enabled} onCheckedChange={(v) => setPayCfg({ ...payCfg, enabled: v })} data-testid="pay-enabled-switch" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Aktiver Anbieter</Label>
                      <Select value={payCfg.provider} onValueChange={(v) => setPayCfg({ ...payCfg, provider: v })}>
                        <SelectTrigger data-testid="pay-provider-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disabled">Deaktiviert</SelectItem>
                          {(payCfg.known_providers || []).map((p) => (
                            <SelectItem key={p} value={p}>
                              {p === "stripe" ? "Stripe" : p === "paypal" ? "PayPal" : p === "mollie" ? "Mollie" : p === "klarna" ? "Klarna" : p === "paddle" ? "Paddle" : "Benutzerdefiniert"}
                              {(payCfg.supported_providers || []).includes(p) ? " ✓" : " (Platzhalter)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                        ✓ = live integriert. Andere Anbieter können Keys speichern, benötigen aber noch eine Integration.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-display text-base">Anbieter-Schlüssel</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Stripe */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-stripe">
                        <div className="font-medium flex items-center justify-between">
                          <span>Stripe <span className="text-xs text-[hsl(var(--accent))]">live</span></span>
                        </div>
                        <Label className="text-xs">Secret Key {payCfg.provider_keys_masked?.stripe?.secret_key && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.stripe.secret_key} gespeichert)</span>}</Label>
                        <Input type="password" placeholder="sk_live_..." onChange={(e) => setProviderKey("stripe", "secret_key", e.target.value)} data-testid="pay-stripe-secret-input" />
                      </div>
                      {/* PayPal */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-paypal">
                        <div className="font-medium">PayPal <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Client ID {payCfg.provider_keys_masked?.paypal?.client_id && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.paypal.client_id} gespeichert)</span>}</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paypal", "client_id", e.target.value)} data-testid="pay-paypal-client-input" />
                        <Label className="text-xs">Secret {payCfg.provider_keys_masked?.paypal?.secret && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.paypal.secret} gespeichert)</span>}</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paypal", "secret", e.target.value)} data-testid="pay-paypal-secret-input" />
                      </div>
                      {/* Mollie */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-mollie">
                        <div className="font-medium">Mollie <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">API Key {payCfg.provider_keys_masked?.mollie?.api_key && <span className="text-[hsl(var(--muted-foreground))]">({payCfg.provider_keys_masked.mollie.api_key} gespeichert)</span>}</Label>
                        <Input type="password" onChange={(e) => setProviderKey("mollie", "api_key", e.target.value)} data-testid="pay-mollie-key-input" />
                      </div>
                      {/* Klarna */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-klarna">
                        <div className="font-medium">Klarna <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Username</Label>
                        <Input type="password" onChange={(e) => setProviderKey("klarna", "username", e.target.value)} data-testid="pay-klarna-user-input" />
                        <Label className="text-xs">Password</Label>
                        <Input type="password" onChange={(e) => setProviderKey("klarna", "password", e.target.value)} data-testid="pay-klarna-pass-input" />
                      </div>
                      {/* Paddle */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-paddle">
                        <div className="font-medium">Paddle <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Vendor ID</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paddle", "vendor_id", e.target.value)} />
                        <Label className="text-xs">API Key</Label>
                        <Input type="password" onChange={(e) => setProviderKey("paddle", "api_key", e.target.value)} />
                      </div>
                      {/* Custom */}
                      <div className="rounded-md border p-3 space-y-2" data-testid="provider-card-custom">
                        <div className="font-medium">Benutzerdefiniert <span className="text-xs text-[hsl(var(--muted-foreground))]">(Platzhalter)</span></div>
                        <Label className="text-xs">Endpoint</Label>
                        <Input onChange={(e) => setProviderKey("custom", "endpoint", e.target.value)} placeholder="https://..." />
                        <Label className="text-xs">Token</Label>
                        <Input type="password" onChange={(e) => setProviderKey("custom", "token", e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="font-display text-base">Pakete</Label>
                      <Button size="sm" variant="outline" onClick={addPkg} data-testid="pay-add-package">+ Paket</Button>
                    </div>
                    <div className="space-y-3">
                      {payCfg.packages.map((p, idx) => (
                        <div key={p.id} className="rounded-md border p-3 grid grid-cols-2 md:grid-cols-6 gap-2" data-testid={`pay-package-${idx}`}>
                          <div className="col-span-2"><Label className="text-xs">ID</Label><Input value={p.id} onChange={(e) => updatePkg(idx, { id: e.target.value })} /></div>
                          <div><Label className="text-xs">Betrag</Label><Input type="number" step="0.01" value={p.amount} onChange={(e) => updatePkg(idx, { amount: Number(e.target.value) })} /></div>
                          <div><Label className="text-xs">Währung</Label><Input value={p.currency} onChange={(e) => updatePkg(idx, { currency: e.target.value })} /></div>
                          <div>
                            <Label className="text-xs">Art</Label>
                            <Select value={p.kind} onValueChange={(v) => updatePkg(idx, { kind: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="boost">Boost</SelectItem>
                                <SelectItem value="other">Sonstiges</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            {p.kind === "premium" ? (
                              <><Label className="text-xs">Tage</Label><Input type="number" value={p.days || ""} onChange={(e) => updatePkg(idx, { days: Number(e.target.value) || null })} /></>
                            ) : p.kind === "boost" ? (
                              <><Label className="text-xs">Minuten</Label><Input type="number" value={p.minutes || ""} onChange={(e) => updatePkg(idx, { minutes: Number(e.target.value) || null })} /></>
                            ) : null}
                          </div>
                          <div className="col-span-2 md:col-span-4"><Label className="text-xs">Beschreibung</Label><Input value={p.desc} onChange={(e) => updatePkg(idx, { desc: e.target.value })} /></div>
                          <div className="flex items-end gap-2 col-span-2">
                            <label className="inline-flex items-center gap-2 text-sm"><Switch checked={p.enabled !== false} onCheckedChange={(v) => updatePkg(idx, { enabled: v })} /> aktiv</label>
                            <Button size="sm" variant="destructive" onClick={() => removePkg(idx)}>Entfernen</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={savePay} data-testid="pay-save-button">Speichern</Button>
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Hinweis: ID-Verifizierung ist generell kostenlos und wird hier nicht als Paket verwaltet. Nur „Stripe" führt aktuell einen echten Checkout durch.</div>
                </div>
              </TabsContent>
            )}

            {isSuper && (
              <TabsContent value="legal" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-display text-lg">Rechtliche Seiten</div>
                    <Select value={legalKey} onValueChange={(v) => loadLegal(v)}>
                      <SelectTrigger className="w-[260px]" data-testid="legal-page-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="terms">Nutzungsbedingungen</SelectItem>
                        <SelectItem value="privacy">Datenschutzerklärung</SelectItem>
                        <SelectItem value="imprint">Impressum</SelectItem>
                        <SelectItem value="community">Community-Richtlinien</SelectItem>
                        <SelectItem value="cookies">Cookie-Hinweis</SelectItem>
                        <SelectItem value="cancellation">Widerrufsbelehrung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Titel</Label>
                    <Input value={legal.title} onChange={(e) => setLegal({ ...legal, title: e.target.value })} data-testid="legal-title-input" />
                  </div>
                  <div>
                    <Label>Inhalt (Markdown)</Label>
                    <textarea
                      value={legal.content_markdown}
                      onChange={(e) => setLegal({ ...legal, content_markdown: e.target.value })}
                      className="w-full min-h-[320px] rounded-md border bg-background p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]"
                      data-testid="legal-content-textarea"
                    />
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Markdown unterstützt: # Überschriften, **fett**, _kursiv_, Listen, Links.
                      Zuletzt geändert: {(legal.updated_at || "").slice(0,10) || "—"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a href={`/legal/${legalKey}`} target="_blank" rel="noreferrer" className="text-sm underline text-[hsl(var(--muted-foreground))]" data-testid="legal-preview-link">Vorschau öffnen ↗</a>
                    <Button onClick={saveLegal} data-testid="legal-save-button">Speichern</Button>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="broadcasts" className="mt-4 space-y-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-display text-lg">Broadcast verfassen</div>
                  <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> HMAC-SHA256 signiert</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <Label>Titel</Label>
                    <Input value={bcForm.title} onChange={(e) => setBcForm({ ...bcForm, title: e.target.value })} maxLength={160} data-testid="bc-title" placeholder="Kurze, prägnante Überschrift" />
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select value={bcForm.severity} onValueChange={(v) => setBcForm({ ...bcForm, severity: v })}>
                      <SelectTrigger data-testid="bc-severity"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warnung</SelectItem>
                        <SelectItem value="urgent">Dringend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 mt-6">
                    <Switch checked={bcForm.pinned} onCheckedChange={(v) => setBcForm({ ...bcForm, pinned: v })} data-testid="bc-pinned" /> Anheften
                  </label>
                  <div className="md:col-span-3">
                    <Label className="flex items-center justify-between">
                      <span>Zielgruppe</span>
                      {bcPreview !== null && (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]" data-testid="bc-preview-count">
                          ≈ <strong className="text-[hsl(var(--foreground))]">{bcPreview}</strong>
                          {bcPreviewTotal !== null ? ` / ${bcPreviewTotal}` : ""} Empfänger:innen
                        </span>
                      )}
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-1" role="radiogroup">
                      {[
                        { v: "all", label: "Alle Nutzer" },
                        { v: "premium", label: "Nur Premium" },
                        { v: "verified", label: "ID-verifiziert" },
                        { v: "staff", label: "Team (Staff)" },
                        { v: "segment", label: "Segment" },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => setBcForm({ ...bcForm, audience: opt.v })}
                          className={[
                            "rounded-full px-3 py-1 text-xs border transition-colors",
                            bcForm.audience === opt.v
                              ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]"
                              : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                          ].join(" ")}
                          data-testid={`bc-audience-${opt.v}`}
                          aria-pressed={bcForm.audience === opt.v}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <Label>Inhalt</Label>
                    <textarea className="w-full min-h-[140px] rounded-md border bg-background p-3 text-sm" maxLength={5000} value={bcForm.body} onChange={(e) => setBcForm({ ...bcForm, body: e.target.value })} data-testid="bc-body" placeholder="Offizielle Mitteilung an deine Zielgruppe …" />
                    <div className="text-[11px] text-right text-[hsl(var(--muted-foreground))]">{bcForm.body.length}/5000</div>
                  </div>
                  {bcForm.audience === "segment" && (
                    <div className="md:col-span-3 space-y-3 rounded-md border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 p-3" data-testid="bc-segment">
                      <div className="font-display text-sm">Segment-Filter</div>
                      {bcSegOpts.cities.length > 0 && (
                        <div>
                          <Label className="text-xs">Städte ({bcForm.cities.length})</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {bcSegOpts.cities.map((c) => (
                              <button
                                type="button"
                                key={c}
                                onClick={() => setBcForm({ ...bcForm, cities: toggleInArray(bcForm.cities, c) })}
                                className={[
                                  "rounded-full px-2.5 py-0.5 text-xs border",
                                  bcForm.cities.includes(c)
                                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]"
                                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                                ].join(" ")}
                                data-testid={`bc-city-${c}`}
                              >{c}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {bcSegOpts.interests.length > 0 && (
                        <div>
                          <Label className="text-xs">Interessen ({bcForm.interests.length})</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {bcSegOpts.interests.map((i) => (
                              <button
                                type="button"
                                key={i}
                                onClick={() => setBcForm({ ...bcForm, interests: toggleInArray(bcForm.interests, i) })}
                                className={[
                                  "rounded-full px-2.5 py-0.5 text-xs border",
                                  bcForm.interests.includes(i)
                                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]"
                                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                                ].join(" ")}
                                data-testid={`bc-interest-${i}`}
                              >{i}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {bcSegOpts.genders.length > 0 && (
                        <div>
                          <Label className="text-xs">Geschlechtsidentitäten ({bcForm.genders.length})</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {bcSegOpts.genders.map((g) => (
                              <button
                                type="button"
                                key={g}
                                onClick={() => setBcForm({ ...bcForm, genders: toggleInArray(bcForm.genders, g) })}
                                className={[
                                  "rounded-full px-2.5 py-0.5 text-xs border",
                                  bcForm.genders.includes(g)
                                    ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]"
                                    : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                                ].join(" ")}
                              >{g}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 max-w-sm">
                        <div>
                          <Label className="text-xs">Alter min</Label>
                          <Input type="number" min="18" max="120" value={bcForm.age_min} onChange={(e) => setBcForm({ ...bcForm, age_min: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Alter max</Label>
                          <Input type="number" min="18" max="120" value={bcForm.age_max} onChange={(e) => setBcForm({ ...bcForm, age_max: e.target.value })} />
                        </div>
                      </div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        Mehrere Filter innerhalb einer Kategorie = ODER; Kategorien untereinander = UND.
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button onClick={submitBroadcast} disabled={bcBusy} data-testid="bc-submit">{bcBusy ? "Sende…" : "Authentisch signieren & senden"}</Button>
                </div>
              </div>

              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Titel</TableHead><TableHead>Severity</TableHead><TableHead>Zielgruppe</TableHead><TableHead>Siegel</TableHead><TableHead>Erstellt</TableHead><TableHead>Aktionen</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {broadcasts.map((b) => (
                      <TableRow key={b.id} data-testid={`bc-row-${b.id}`}>
                        <TableCell className="max-w-[280px] truncate">
                          <div className="font-medium">{b.pinned && "📌 "}{b.title}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{b.body}</div>
                        </TableCell>
                        <TableCell><Badge variant={b.severity === "urgent" ? "destructive" : b.severity === "warning" ? "outline" : "secondary"}>{b.severity}</Badge></TableCell>
                        <TableCell>{b.audience}</TableCell>
                        <TableCell>
                          {b.authentic
                            ? <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--accent))]"><BadgeCheck className="h-3 w-3" /> verifiziert</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--destructive))]">ungültig</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{(b.created_at || "").slice(0,19).replace("T", " ")}</TableCell>
                        <TableCell><Button size="sm" variant="destructive" onClick={() => deleteBroadcast(b.id)} data-testid={`bc-delete-${b.id}`}>Löschen</Button></TableCell>
                      </TableRow>
                    ))}
                    {broadcasts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-[hsl(var(--muted-foreground))] py-6">Keine Broadcasts.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {isSuper && (
              <TabsContent value="promos" className="mt-4">
                <AdminPromosTab />
              </TabsContent>
            )}

            <TabsContent value="blog" className="mt-4">
              <AdminBlogTab />
            </TabsContent>

            {isSuper && (
              <TabsContent value="team-channels" className="mt-4">
                <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-display text-lg">Team-Kanal-Zuweisung</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Legt Standard-Benachrichtigungen pro Rolle fest. Individuelle User-Einstellungen überschreiben diese Defaults.</div>
                    </div>
                  </div>
                  {!roleChannels && <div className="text-sm text-[hsl(var(--muted-foreground))]">Lädt…</div>}
                  {roleChannels && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-2 pr-3">Rolle</th>
                            {roleChannels.available_channels.map((c) => (
                              <th key={c} className="py-2 px-2 text-[11px] font-mono text-[hsl(var(--muted-foreground))]">{c}</th>
                            ))}
                            <th className="py-2 px-2 text-right">Aktion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(roleChannels.roles).map(([role, info]) => (
                            <tr key={role} className="border-b" data-testid={`role-row-${role}`}>
                              <td className="py-2 pr-3 font-medium capitalize">
                                {role} {info.overridden && <Badge variant="outline" className="ml-1 text-[10px]">angepasst</Badge>}
                              </td>
                              {roleChannels.available_channels.map((c) => (
                                <td key={c} className="py-2 px-2 text-center">
                                  <Switch
                                    checked={info.channels.includes(c)}
                                    onCheckedChange={() => toggleRoleChannel(role, c)}
                                    data-testid={`role-toggle-${role}-${c}`}
                                  />
                                </td>
                              ))}
                              <td className="py-2 px-2 text-right space-x-1">
                                <Button size="sm" onClick={() => saveRoleChannels(role)} data-testid={`role-save-${role}`}>Speichern</Button>
                                {info.overridden && <Button size="sm" variant="ghost" onClick={() => resetRoleChannels(role)}>Zurücksetzen</Button>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="audit" className="mt-4">
              <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-x-auto shadow-[var(--shadow-sm)]">
                <div className="px-5 py-3 flex items-center justify-between border-b border-[hsl(var(--border))]/60">
                  <div className="font-display text-lg tracking-tight">Audit-Log</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{audit.length} Ereignisse</div>
                </div>
                {audit.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Noch keine Ereignisse protokolliert.</div>
                ) : (
                  <ul className="divide-y divide-[hsl(var(--border))]/60">
                    {audit.map((ev) => (
                      <li key={ev.id} className="px-5 py-3 flex items-start gap-4 hover:bg-[hsl(var(--secondary))]/50 transition-colors">
                        <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] w-40 shrink-0">
                          {(ev.created_at || "").replace("T"," ").slice(0,19)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="rounded-full font-mono text-[10.5px]">{(ev.actor_id || "system").slice(0,8)}</Badge>
                            <span className="font-medium text-sm">{ev.action}</span>
                            {ev.target && <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">→ {ev.target.slice(0,8)}</span>}
                          </div>
                          {ev.meta && Object.keys(ev.meta || {}).length > 0 && (
                            <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-1 font-mono truncate">
                              {Object.entries(ev.meta).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · ")}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
            <TabsContent value="system" className="mt-4">
              <SystemUpdatesPanel />
            </TabsContent>
          </Tabs>
            </div>
          {/* End of Tabs wrapper for the new AdminShell */}

          {/* Admin Edit User Dialog */}
          <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) { setEditUser(null); setEditForm(null); } }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Nutzer bearbeiten {editUser && <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">· {editUser.display_name}</span>}</DialogTitle>
              </DialogHeader>
              {editForm && editUser && (
                <div className="space-y-5 text-sm">
                  {/* Premium & Boost */}
                  <div className="rounded-md border p-4 space-y-3 bg-[hsl(var(--secondary))]/30">
                    <div className="font-display text-base flex items-center justify-between">
                      <span>Premium & Boost</span>
                      <div className="flex items-center gap-1.5 text-xs">
                        {editUser.premium_expires_at && new Date(editUser.premium_expires_at) > new Date()
                          ? <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">Premium aktiv bis {editUser.premium_expires_at.slice(0,10)}</Badge>
                          : <Badge variant="outline">Kein Premium</Badge>}
                        {editUser.boost_expires_at && new Date(editUser.boost_expires_at) > new Date()
                          && <Badge className="bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">Boost bis {editUser.boost_expires_at.slice(11,16)} UTC</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Premium Tage</Label>
                        <Input type="number" min="0" max="3650" value={editForm.premium_days}
                               onChange={(e) => setEditForm({ ...editForm, premium_days: e.target.value })}
                               data-testid="admin-edit-premium-days" />
                      </div>
                      <div>
                        <Label className="text-xs">Boost Minuten</Label>
                        <Input type="number" min="0" max="10080" value={editForm.boost_minutes}
                               onChange={(e) => setEditForm({ ...editForm, boost_minutes: e.target.value })}
                               data-testid="admin-edit-boost-minutes" />
                      </div>
                      <div className="flex gap-2 md:col-span-2">
                        <Button size="sm" onClick={() => grantPremium("grant")} data-testid="admin-premium-grant">Neu setzen</Button>
                        <Button size="sm" variant="secondary" onClick={() => grantPremium("extend")} data-testid="admin-premium-extend">Verlängern</Button>
                        <Button size="sm" variant="destructive" onClick={() => grantPremium("revoke")} data-testid="admin-premium-revoke">Entziehen</Button>
                      </div>
                    </div>
                  </div>

                  {/* Account & Role */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Anzeigename</Label>
                      <Input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} data-testid="admin-edit-name" />
                    </div>
                    <div>
                      <Label>E-Mail</Label>
                      <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="admin-edit-email" />
                    </div>
                    <div>
                      <Label>Alter</Label>
                      <Input type="number" min="18" max="120" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} data-testid="admin-edit-age" />
                    </div>
                    <div>
                      <Label>Rolle</Label>
                      <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                        <SelectTrigger data-testid="admin-edit-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="content_reviewer">Content Reviewer</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {user?.role === "superadmin" && <SelectItem value="superadmin">Superadmin</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Geschlechtsidentität</Label>
                      <Input value={editForm.gender_identity} onChange={(e) => setEditForm({ ...editForm, gender_identity: e.target.value })} placeholder="woman / man / non_binary / …" />
                    </div>
                    <div>
                      <Label>Pronomen</Label>
                      <Input value={editForm.pronouns} onChange={(e) => setEditForm({ ...editForm, pronouns: e.target.value })} />
                    </div>
                    <div>
                      <Label>Orientierung</Label>
                      <Input value={editForm.orientation} onChange={(e) => setEditForm({ ...editForm, orientation: e.target.value })} placeholder="straight / gay / bi / …" />
                    </div>
                  </div>

                  <div>
                    <Label>Bio</Label>
                    <textarea className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} data-testid="admin-edit-bio" />
                  </div>

                  {/* Body & Lifestyle */}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="font-display text-base">Körper & Lifestyle</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div><Label className="text-xs">Größe (cm)</Label><Input type="number" value={editForm.height_cm} onChange={(e) => setEditForm({ ...editForm, height_cm: e.target.value })} /></div>
                      <div><Label className="text-xs">Körpertyp</Label><Input value={editForm.body_type} onChange={(e) => setEditForm({ ...editForm, body_type: e.target.value })} /></div>
                      <div><Label className="text-xs">Ethnizität</Label><Input value={editForm.ethnicity} onChange={(e) => setEditForm({ ...editForm, ethnicity: e.target.value })} /></div>
                      <div><Label className="text-xs">Rauchen</Label><Input value={editForm.smoking} onChange={(e) => setEditForm({ ...editForm, smoking: e.target.value })} /></div>
                      <div><Label className="text-xs">Alkohol</Label><Input value={editForm.drinking} onChange={(e) => setEditForm({ ...editForm, drinking: e.target.value })} /></div>
                      <div><Label className="text-xs">Ernährung</Label><Input value={editForm.diet} onChange={(e) => setEditForm({ ...editForm, diet: e.target.value })} /></div>
                      <div><Label className="text-xs">STI-Status</Label><Input value={editForm.sti_status} onChange={(e) => setEditForm({ ...editForm, sti_status: e.target.value })} /></div>
                      <div><Label className="text-xs">Cup Size</Label><Input value={editForm.cup_size} onChange={(e) => setEditForm({ ...editForm, cup_size: e.target.value })} /></div>
                      <div><Label className="text-xs">Penis Länge (cm)</Label><Input type="number" step="0.1" value={editForm.penis_length_cm} onChange={(e) => setEditForm({ ...editForm, penis_length_cm: e.target.value })} /></div>
                      <div><Label className="text-xs">Penis Umfang (cm)</Label><Input type="number" step="0.1" value={editForm.penis_girth_cm} onChange={(e) => setEditForm({ ...editForm, penis_girth_cm: e.target.value })} /></div>
                    </div>
                  </div>

                  {/* Status toggles */}
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="font-display text-base">Status & Flags</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.id_verified} onCheckedChange={(v) => setEditForm({ ...editForm, id_verified: v, id_verification_status: v ? "approved" : editForm.id_verification_status })} data-testid="admin-toggle-idverified" /> ID verifiziert</label>
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.email_verified} onCheckedChange={(v) => setEditForm({ ...editForm, email_verified: v })} /> E-Mail verifiziert</label>
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.shadow_restricted} onCheckedChange={(v) => setEditForm({ ...editForm, shadow_restricted: v })} /> Shadow restricted</label>
                      <label className="flex items-center gap-2"><Switch checked={!!editForm.banned} onCheckedChange={(v) => setEditForm({ ...editForm, banned: v })} /> Gebannt</label>
                    </div>
                    {editForm.banned && (
                      <div>
                        <Label className="text-xs">Bann-Grund</Label>
                        <Input value={editForm.ban_reason} onChange={(e) => setEditForm({ ...editForm, ban_reason: e.target.value })} />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">ID Verifizierungs-Status</Label>
                      <Select value={editForm.id_verification_status || "none"} onValueChange={(v) => setEditForm({ ...editForm, id_verification_status: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— nicht gesetzt —</SelectItem>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Photos management */}
                  {(editUser.photos || []).length > 0 && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="font-display text-base">Fotos ({(editUser.photos || []).length})</div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {(editUser.photos || []).map((p) => (
                          <div key={p.id} className="relative aspect-[3/4] rounded-md overflow-hidden border bg-[hsl(var(--muted))]">
                            <img src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score >= 0.75 ? "blur-md" : ""}`} />
                            <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] px-1.5 py-0.5 flex items-center justify-between">
                              <span>NSFW {((p.nsfw_score || 0) * 100).toFixed(0)}%</span>
                              <button onClick={() => deleteUserPhoto(p.id)} className="underline" data-testid={`admin-delete-photo-${p.id}`}>löschen</button>
                            </div>
                            {p.is_primary && <div className="absolute left-1 top-1 rounded-full bg-black/55 text-white text-[9px] px-1.5 py-0.5">Haupt</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="ghost" onClick={() => { setEditUser(null); setEditForm(null); }}>Abbrechen</Button>
                <Button onClick={saveEditUser} disabled={editSaving} data-testid="admin-edit-save">{editSaving ? "Speichern…" : "Speichern"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Report Detail Dialog */}
          <Dialog open={!!reportDetail} onOpenChange={(v) => { if (!v) setReportDetail(null); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Report-Details</DialogTitle>
              </DialogHeader>
              {reportLoading || reportDetail?.loading ? (
                <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Lädt…</div>
              ) : reportDetail?.report ? (
                <div className="space-y-4 text-sm">
                  {/* Core report meta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <InfoCell label="Grund" value={<Badge className="rounded-full">{reportDetail.report.reason}</Badge>} />
                    <InfoCell label="Status" value={<Badge variant={reportDetail.report.status==="resolved"?"secondary":"outline"}>{reportDetail.report.status}</Badge>} />
                    <InfoCell label="Ziel-Typ" value={reportDetail.report.target_type} />
                    <InfoCell label="Erstellt" value={<span className="font-mono text-xs">{(reportDetail.report.created_at || "").replace("T"," ").slice(0,19)}</span>} />
                  </div>

                  {/* Reporter-provided detail (context) */}
                  <div className="rounded-md border p-3 bg-[hsl(var(--secondary))]/40" data-testid="report-detail-text">
                    <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">Beschreibung des Reporters</div>
                    {reportDetail.report.detail ? (
                      <div className="whitespace-pre-wrap break-words">{reportDetail.report.detail}</div>
                    ) : (
                      <div className="text-[hsl(var(--muted-foreground))] italic">Keine zusätzliche Beschreibung angegeben — bitte unten Kontext prüfen.</div>
                    )}
                  </div>

                  {/* Quick stats bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <InfoCell label="Reports durch Reporter" value={`${reportDetail.reporter_history_count ?? 0}`} />
                    <InfoCell label="Meldungen gegen Ziel" value={`${reportDetail.target_report_count ?? 0}`} />
                    <InfoCell label="Offen ggü. Ziel" value={`${reportDetail.reported_stats?.open ?? 0}`} />
                    <InfoCell label="Erledigt ggü. Ziel" value={`${reportDetail.reported_stats?.resolved ?? 0}`} />
                  </div>

                  {/* People involved */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <UserMiniCard title="Reporter" u={reportDetail.reporter} />
                    <UserMiniCard title="Gemeldet" u={reportDetail.reported} />
                  </div>

                  {/* Media of reported user (always visible for moderation) */}
                  {reportDetail.reported_media && (reportDetail.reported_media.photos?.length > 0 || reportDetail.reported_media.videos?.length > 0) && (
                    <div className="rounded-md border p-3 space-y-3" data-testid="report-reported-media">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
                          Fotos &amp; Videos des Gemeldeten ({(reportDetail.reported_media.photos || []).length} Fotos, {(reportDetail.reported_media.videos || []).length} Videos)
                        </div>
                        <Badge variant="outline" className="text-[10px]">Löschsperre: aktiv solange Report offen</Badge>
                      </div>
                      {(reportDetail.reported_media.photos || []).length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {reportDetail.reported_media.photos.map((p) => {
                            const isTargetPhoto = reportDetail.report.target_type === "photo" && reportDetail.report.target_id === p.id;
                            return (
                              <div
                                key={p.id}
                                className={[
                                  "relative aspect-[3/4] rounded-md overflow-hidden border bg-[hsl(var(--muted))] group",
                                  isTargetPhoto ? "ring-2 ring-[hsl(var(--destructive))]" : ""
                                ].join(" ")}
                                data-testid={`report-reported-photo-${p.id}`}
                              >
                                <img src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score >= 0.75 ? "blur-md" : ""}`} />
                                {p.is_primary && <div className="absolute left-1 top-1 rounded-full bg-black/60 text-white text-[9px] px-1.5 py-0.5">Haupt</div>}
                                {isTargetPhoto && <div className="absolute right-1 top-1 rounded-full bg-[hsl(var(--destructive))] text-white text-[9px] px-1.5 py-0.5">gemeldet</div>}
                                {p.retention_until && (
                                  <div className="absolute inset-x-1 top-1 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[9px] px-1.5 py-0.5 flex items-center gap-1 justify-center">
                                    <ShieldAlert className="h-3 w-3" />
                                    bis {p.retention_until.slice(0,10)}
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 flex items-center justify-between">
                                  <span>NSFW {((p.nsfw_score || 0) * 100).toFixed(0)}%</span>
                                  <span>{p.has_face ? "face" : "no face"}</span>
                                </div>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors grid place-items-end pointer-events-none">
                                  <div className="w-full p-1 flex gap-1 opacity-0 group-hover:opacity-100 pointer-events-auto">
                                    <button
                                      className="flex-1 rounded bg-white/95 text-[10px] text-black px-1.5 py-1 font-medium hover:bg-white"
                                      onClick={async () => {
                                        const days = prompt("Aufbewahrung wie viele Tage? (0 = entfernen)", p.retention_until ? "0" : "30");
                                        if (days === null) return;
                                        const n = Number(days);
                                        if (Number.isNaN(n) || n < 0 || n > 3650) { toast.error("Ungültige Anzahl Tage"); return; }
                                        let reason = "";
                                        if (n > 0) { reason = prompt("Grund der Aufbewahrung?", "Beweismittel — aktive Meldung") || ""; }
                                        try {
                                          const { data } = await api.post(`/admin/users/${reportDetail.reported.id}/photos/${p.id}/retention`, { days: n, reason });
                                          toast.success(n === 0 ? "Aufbewahrung entfernt" : `Aufbewahrung bis ${(data.retention_until || "").slice(0,10)}`);
                                          // Refresh the dialog data
                                          await openReport(reportDetail.report.id);
                                        } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
                                      }}
                                      data-testid={`photo-retention-${p.id}`}
                                    >{p.retention_until ? "Aufbew. bearbeiten" : "30 Tage aufbew."}</button>
                                    <button
                                      className="rounded bg-[hsl(var(--destructive))]/95 text-white text-[10px] px-1.5 py-1 font-medium hover:bg-[hsl(var(--destructive))]"
                                      onClick={async () => {
                                        if (!confirm("Foto wirklich löschen?")) return;
                                        try {
                                          await api.delete(`/admin/users/${reportDetail.reported.id}/photos/${p.id}`);
                                          toast.success("Foto gelöscht");
                                          await openReport(reportDetail.report.id);
                                        } catch (e) { toast.error(e.response?.data?.detail || "Fehlgeschlagen"); }
                                      }}
                                    >Löschen</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(reportDetail.reported_media.videos || []).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {reportDetail.reported_media.videos.map((v) => (
                            <div key={v.id} className="relative aspect-video rounded-md overflow-hidden border bg-black">
                              <video src={v.data} controls className="h-full w-full object-cover" />
                              <div className="absolute left-1 top-1 rounded-full bg-black/60 text-white text-[9px] px-1.5 py-0.5">
                                {v.moderation_status || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reporter media (collapsed preview for context) */}
                  {reportDetail.reporter_media && (reportDetail.reporter_media.photos?.length > 0) && (
                    <details className="rounded-md border p-3" data-testid="report-reporter-media">
                      <summary className="cursor-pointer text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
                        Fotos des Reporters ({reportDetail.reporter_media.photos.length}) — zum Kontext anzeigen
                      </summary>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mt-2">
                        {reportDetail.reporter_media.photos.map((p) => (
                          <div key={p.id} className="aspect-[3/4] rounded overflow-hidden border bg-[hsl(var(--muted))]">
                            <img src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score >= 0.75 ? "blur-md" : ""}`} />
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Target context: Photo */}
                  {reportDetail.target_context?.photo && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Gemeldetes Foto</div>
                      <img src={reportDetail.target_context.photo.data} alt="gemeldet" className="max-h-64 object-contain rounded" />
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        NSFW: {((reportDetail.target_context.photo.nsfw_score || 0) * 100).toFixed(0)}% · Gesicht: {reportDetail.target_context.photo.has_face ? "ja" : "nein"}
                      </div>
                    </div>
                  )}

                  {/* Target context: Album */}
                  {reportDetail.target_context?.album && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Gemeldetes Album</div>
                      <div className="font-medium">{reportDetail.target_context.album.title} {reportDetail.target_context.album.is_nsfw && <Badge variant="outline" className="ml-1">18+</Badge>}</div>
                      {reportDetail.target_context.album.description && <div className="text-xs text-[hsl(var(--muted-foreground))]">{reportDetail.target_context.album.description}</div>}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-1.5">
                        {(reportDetail.target_context.album.photos || []).map((p) => (
                          <div key={p.id} className="aspect-square rounded overflow-hidden border bg-[hsl(var(--muted))]">
                            <img src={p.data} alt="" className={`h-full w-full object-cover ${p.nsfw_score >= 0.75 ? "blur-md" : ""}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target context: Single message (highlighted in chat thread below) */}
                  {reportDetail.target_context?.message && (
                    <div className="rounded-md border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 p-3">
                      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">Gemeldete Nachricht</div>
                      <div className="whitespace-pre-wrap break-words">{reportDetail.target_context.message.text || "(kein Text)"}</div>
                      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 font-mono">{reportDetail.target_context.message.created_at}</div>
                    </div>
                  )}

                  {/* Chat thread (if match exists) */}
                  {reportDetail.chat_thread && (
                    <div className="rounded-md border overflow-hidden" data-testid="report-chat-thread">
                      <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--secondary))]/40 border-b">
                        <div className="flex items-center gap-2">
                          <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Gesamter Chat-Verlauf</div>
                          <Badge variant="outline">{reportDetail.chat_thread.message_count} Nachrichten</Badge>
                        </div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">
                          Match seit {(reportDetail.chat_thread.match.created_at || "").slice(0,10)}
                        </div>
                      </div>
                      <div className="max-h-[360px] overflow-y-auto p-3 space-y-2 bg-[hsl(var(--background))]">
                        {(reportDetail.chat_thread.messages || []).length === 0 && (
                          <div className="text-center text-xs text-[hsl(var(--muted-foreground))] py-6">Dieser Match enthält noch keine Nachrichten.</div>
                        )}
                        {(reportDetail.chat_thread.messages || []).map((m) => {
                          const p = reportDetail.chat_thread.participants[m.sender_id] || {};
                          const isReporter = m.sender_id === reportDetail.report.reporter_id;
                          return (
                            <div
                              key={m.id}
                              className={[
                                "rounded-md border px-3 py-2 text-sm",
                                m.highlighted
                                  ? "border-[hsl(var(--destructive))]/60 bg-[hsl(var(--destructive))]/10 ring-2 ring-[hsl(var(--destructive))]/40"
                                  : isReporter
                                    ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                                    : "border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5",
                              ].join(" ")}
                              data-testid={`report-chat-msg-${m.id}`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-medium truncate">{p.display_name || m.sender_id.slice(0,8)}</span>
                                  <Badge variant="outline" className="text-[10px]">{isReporter ? "Reporter" : "Gemeldet"}</Badge>
                                  {m.highlighted && <Badge className="text-[10px] bg-[hsl(var(--destructive))] text-white">gemeldete Nachricht</Badge>}
                                </div>
                                <span className="font-mono text-[10.5px] text-[hsl(var(--muted-foreground))] shrink-0">{(m.created_at || "").replace("T"," ").slice(0,19)}</span>
                              </div>
                              {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                              {m.media_url && (
                                <img src={m.media_url} alt="media" className="mt-1.5 max-h-40 rounded" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No match context for user-report */}
                  {reportDetail.report.target_type === "user" && !reportDetail.chat_thread && (
                    <div className="rounded-md border p-3 bg-[hsl(var(--secondary))]/30 text-xs text-[hsl(var(--muted-foreground))]">
                      Kein aktiver Match zwischen Reporter und Ziel vorhanden. Es kann sein, dass der Match vor der Meldung aufgelöst wurde.
                    </div>
                  )}

                  {/* Other reports against target */}
                  {(reportDetail.recent_reports_against_target || []).length > 0 && (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Weitere Meldungen gegen dieses Ziel ({reportDetail.recent_reports_against_target.length})</div>
                      <ul className="divide-y divide-[hsl(var(--border))]/60 text-xs">
                        {reportDetail.recent_reports_against_target.map((r) => (
                          <li key={r.id} className="py-1.5 flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className="text-[10px]">{r.reason}</Badge>
                              <Badge variant={r.status==="resolved"?"secondary":"outline"} className="text-[10px]">{r.status}</Badge>
                              <span className="truncate">{r.detail || <span className="italic text-[hsl(var(--muted-foreground))]">(keine Beschreibung)</span>}</span>
                            </div>
                            <button
                              className="text-[11px] underline text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0"
                              onClick={() => openReport(r.id)}
                              data-testid={`report-link-${r.id}`}
                            >öffnen</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
              <DialogFooter className="flex-wrap gap-2">
                {reportDetail?.report && (
                  <>
                    <Button variant="outline" onClick={() => updateStatus(reportDetail.report.id, "reviewing")} data-testid="report-detail-reviewing">Prüfen</Button>
                    <Button onClick={async () => { await updateStatus(reportDetail.report.id, "resolved"); setReportDetail(null); }} data-testid="report-detail-resolve">Erledigt</Button>
                    <Button variant="ghost" onClick={async () => { await updateStatus(reportDetail.report.id, "rejected"); setReportDetail(null); }}>Verwerfen</Button>
                    {reportDetail.reported?.id && (
                      <Button variant="outline" onClick={() => { setReportDetail(null); openEditUser(reportDetail.reported.id); }} data-testid="report-detail-edit-reported">
                        Gemeldeten bearbeiten
                      </Button>
                    )}
                    {reportDetail.report.target_type === "user" && reportDetail.reported?.id && (
                      <Button variant="destructive" onClick={async () => { await ban(reportDetail.reported.id, reportDetail.report.reason || "Policy violation"); setReportDetail(null); }} data-testid="report-detail-ban">
                        User bannen
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </AdminShell>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function UserMiniCard({ title, u }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))] mb-1">{title}</div>
      {u ? (
        <div className="space-y-1">
          <div className="font-medium">{u.display_name || "—"} <span className="text-xs text-[hsl(var(--muted-foreground))]">({u.age || "?"})</span></div>
          <div className="text-xs font-mono break-all">{u.email}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline">{u.role || "user"}</Badge>
            {u.banned && <Badge variant="destructive">banned</Badge>}
            {u.shadow_restricted && <Badge variant="secondary">shadow</Badge>}
            {u.id_verified && <Badge>ID verifiziert</Badge>}
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            <Link to={`/profile/${u.id}`} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
              Profil öffnen <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : <div className="text-sm text-[hsl(var(--muted-foreground))]">Nicht verfügbar</div>}
    </div>
  );
}
