import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCheck,
  Inbox,
  Megaphone,
  Pin,
  Search,
  X,
} from "lucide-react";
import { AuthenticSeal } from "./BroadcastBanner";

const SEVERITY_META = {
  info: {
    label: "Info",
    Icon: Megaphone,
    tone: "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent-foreground))] ring-[hsl(var(--accent))]/40",
  },
  warning: {
    label: "Warnung",
    Icon: AlertTriangle,
    tone: "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))] ring-[hsl(var(--destructive))]/40",
  },
  urgent: {
    label: "Dringend",
    Icon: AlertTriangle,
    tone: "bg-[hsl(var(--destructive))]/25 text-[hsl(var(--destructive))] ring-[hsl(var(--destructive))]/60",
  },
};

const PAGE_SIZE = 10;

const DATE_PRESETS = [
  { value: "all", label: "Gesamter Zeitraum" },
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "90", label: "Letzte 90 Tage" },
  { value: "365", label: "Letzte 12 Monate" },
];

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SeverityBadge({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.info;
  const { Icon } = meta;
  return (
    <span
      data-testid={`broadcast-severity-${severity || "info"}`}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        meta.tone,
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export function BroadcastHistorySection() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [severity, setSeverity] = useState("all");
  const [readStatus, setReadStatus] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const [focused, setFocused] = useState(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const buildParams = useCallback(
    (nextSkip) => {
      const params = {
        include_expired: true,
        limit: PAGE_SIZE,
        skip: nextSkip,
      };
      if (severity !== "all") params.severity = severity;
      if (readStatus !== "all") params.read_status = readStatus;
      if (search) params.search = search;
      if (datePreset !== "all") {
        const days = parseInt(datePreset, 10);
        if (!Number.isNaN(days)) {
          const since = new Date(Date.now() - days * 86400_000);
          params.since = since.toISOString();
        }
      }
      return params;
    },
    [severity, readStatus, datePreset, search]
  );

  const load = useCallback(
    async (mode = "reset") => {
      const nextSkip = mode === "more" ? skip + PAGE_SIZE : 0;
      if (mode === "more") setLoadingMore(true);
      else setLoading(true);
      try {
        const { data } = await api.get("/me/broadcasts", { params: buildParams(nextSkip) });
        const fresh = data.broadcasts || [];
        setItems((prev) => (mode === "more" ? [...prev, ...fresh] : fresh));
        setTotal(data.total || 0);
        setSkip(nextSkip);
        setHasMore(!!data.has_more);
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Broadcasts konnten nicht geladen werden.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildParams, skip]
  );

  // Reload whenever a filter changes (not on load-more, which is triggered manually).
  useEffect(() => {
    load("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, readStatus, datePreset, search]);

  const unreadInView = useMemo(() => items.filter((b) => !b.read).length, [items]);

  const markOne = async (b) => {
    try {
      await api.post(`/me/broadcasts/${b.id}/ack`);
      setItems((prev) => prev.map((x) => (x.id === b.id ? { ...x, read: true } : x)));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Konnte nicht als gelesen markiert werden.");
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      const { data } = await api.post("/me/broadcasts/ack-all");
      toast.success(
        data?.marked
          ? `${data.marked} Mitteilung${data.marked === 1 ? "" : "en"} als gelesen markiert.`
          : "Alle Mitteilungen bereits gelesen."
      );
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Aktion fehlgeschlagen.");
    } finally {
      setMarkingAll(false);
    }
  };

  const resetFilters = () => {
    setSeverity("all");
    setReadStatus("all");
    setDatePreset("all");
    setSearchDraft("");
    setSearch("");
  };

  const hasActiveFilters =
    severity !== "all" || readStatus !== "all" || datePreset !== "all" || !!search;

  return (
    <section
      data-testid="broadcast-history-section"
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-4 shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Mitteilungen & Ankündigungen
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Alle offiziellen Broadcasts vom Eros-Team – filterbar nach Typ, Zeitraum und Status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadInView > 0 && (
            <Badge variant="secondary" data-testid="broadcast-unread-count">
              {unreadInView} ungelesen
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={markAll}
            disabled={markingAll || total === 0}
            data-testid="broadcast-ack-all-button"
          >
            <CheckCheck className="h-4 w-4 mr-1" /> Alle gelesen
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="In Titel und Text suchen…"
            className="pl-9 pr-9"
            data-testid="broadcast-search-input"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => setSearchDraft("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              aria-label="Suche leeren"
              data-testid="broadcast-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger data-testid="broadcast-severity-filter">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warnung</SelectItem>
            <SelectItem value="urgent">Dringend</SelectItem>
          </SelectContent>
        </Select>

        <Select value={readStatus} onValueChange={setReadStatus}>
          <SelectTrigger data-testid="broadcast-read-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="unread">Nur ungelesen</SelectItem>
            <SelectItem value="read">Nur gelesen</SelectItem>
          </SelectContent>
        </Select>

        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="md:col-span-2" data-testid="broadcast-date-filter">
            <SelectValue placeholder="Zeitraum" />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="justify-self-start md:col-span-2"
            data-testid="broadcast-reset-filters"
          >
            <X className="h-4 w-4 mr-1" /> Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Result summary */}
      {!loading && (
        <div
          className="text-xs text-[hsl(var(--muted-foreground))]"
          data-testid="broadcast-result-summary"
        >
          {total === 0
            ? hasActiveFilters
              ? "Keine Mitteilungen entsprechen den Filtern."
              : "Bislang keine Mitteilungen erhalten."
            : `Zeige ${items.length} von ${total} Mitteilung${total === 1 ? "" : "en"}.`}
        </div>
      )}

      {/* List */}
      <div className="space-y-3" data-testid="broadcast-list">
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--radius-md)] border border-[hsl(var(--border))]/60 p-4 space-y-2"
              >
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[hsl(var(--border))] py-10 text-center"
            data-testid="broadcast-empty-state"
          >
            <Inbox className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            <div className="font-medium">Keine Mitteilungen</div>
            <div className="text-sm text-[hsl(var(--muted-foreground))] max-w-sm">
              {hasActiveFilters
                ? "Passe die Filter an, um weitere Mitteilungen zu sehen."
                : "Sobald das Eros-Team eine offizielle Mitteilung verschickt, erscheint sie hier."}
            </div>
          </div>
        )}

        {!loading &&
          items.map((b) => {
            const meta = SEVERITY_META[b.severity] || SEVERITY_META.info;
            return (
              <article
                key={b.id}
                data-testid={`broadcast-item-${b.id}`}
                className={[
                  "rounded-[var(--radius-md)] border p-4 space-y-2 transition-[background,box-shadow] duration-200",
                  b.read
                    ? "border-[hsl(var(--border))]/60 bg-[hsl(var(--card))]"
                    : "border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent))]/5 shadow-[var(--shadow-sm)]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start gap-2">
                  <SeverityBadge severity={b.severity} />
                  {b.pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-[11px] font-medium">
                      <Pin className="h-3 w-3" /> Angeheftet
                    </span>
                  )}
                  <AuthenticSeal authentic={!!b.authentic} />
                  {!b.read && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-2 py-0.5 text-[11px] font-medium"
                      data-testid={`broadcast-unread-dot-${b.id}`}
                    >
                      Neu
                    </span>
                  )}
                  <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                    {formatDate(b.created_at)}
                  </span>
                </div>

                <h3 className="font-display text-base leading-tight flex items-center gap-2">
                  <meta.Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  {b.title}
                </h3>

                <p className="text-sm text-[hsl(var(--foreground))]/90 whitespace-pre-wrap">
                  {b.body.length > 240 ? `${b.body.slice(0, 240)}…` : b.body}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {b.body.length > 240 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFocused(b)}
                      data-testid={`broadcast-details-${b.id}`}
                    >
                      Vollständig lesen
                    </Button>
                  )}
                  {!b.read && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => markOne(b)}
                      data-testid={`broadcast-ack-${b.id}`}
                    >
                      <BadgeCheck className="h-4 w-4 mr-1" /> Als gelesen
                    </Button>
                  )}
                  {b.author?.display_name && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      von {b.author.display_name}
                      {b.author.role ? ` · ${b.author.role}` : ""}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => load("more")}
            disabled={loadingMore}
            data-testid="broadcast-load-more"
          >
            {loadingMore ? "Laden…" : "Mehr laden"}
          </Button>
        </div>
      )}

      {/* Full content dialog */}
      <Dialog open={!!focused} onOpenChange={(v) => { if (!v) setFocused(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              {focused && <SeverityBadge severity={focused.severity} />}
              {focused?.title}
            </DialogTitle>
          </DialogHeader>
          {focused && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--secondary))] px-3 py-2">
                <AuthenticSeal authentic={!!focused.authentic} large />
                <div className="text-xs leading-tight">
                  <div className="font-medium">
                    {focused.authentic
                      ? "Verifizierte offizielle Mitteilung"
                      : "⚠ Signatur konnte nicht verifiziert werden"}
                  </div>
                  <div className="text-[hsl(var(--muted-foreground))]">
                    Gesendet von {focused.author?.display_name || "Eros-Team"}
                    {focused.author?.role ? ` · Rolle: ${focused.author.role}` : ""} ·{" "}
                    {formatDate(focused.created_at)}
                  </div>
                </div>
              </div>
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                data-testid="broadcast-history-dialog-body"
              >
                {focused.body}
              </div>
              <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] break-all">
                Signatur: {focused.signature?.slice(0, 32)}…
              </div>
            </div>
          )}
          <DialogFooter>
            {focused && !focused.read && (
              <Button
                onClick={async () => {
                  await markOne(focused);
                  setFocused((f) => (f ? { ...f, read: true } : f));
                }}
                data-testid="broadcast-history-dialog-ack"
              >
                Als gelesen markieren
              </Button>
            )}
            <Button variant="outline" onClick={() => setFocused(null)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
