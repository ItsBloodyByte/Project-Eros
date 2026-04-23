import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Download, GitCommitHorizontal, RefreshCw, ShieldAlert, Timer } from "lucide-react";

function Shorten(sha) {
  return sha ? String(sha).slice(0, 10) : "–";
}

function formatDate(iso) {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function InfoRow({ label, children, testid }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="text-sm text-[hsl(var(--muted-foreground))]">{label}</div>
      <div className="text-sm font-medium text-right" data-testid={testid}>{children}</div>
    </div>
  );
}

export function SystemUpdatesPanel() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/admin/system/updates");
      setState(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Update-Status konnte nicht geladen werden");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const onTrigger = async () => {
    setTriggering(true);
    try {
      const { data } = await api.post("/admin/system/updates/trigger");
      toast.success(data?.message || "Update-Trigger gesetzt");
      // Give the updater ~2s to pick up the trigger, then refresh status
      setTimeout(() => load(true), 2000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Trigger fehlgeschlagen");
    } finally {
      setTriggering(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const enabled = !!state?.enabled;
  const updateAvailable = !!state?.update_available;
  const errored = !!state?.error;

  return (
    <section
      data-testid="admin-system-updates"
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-6 space-y-5 shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg flex items-center gap-2">
            <GitCommitHorizontal className="h-4 w-4" /> System-Updates
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xl">
            Der Updater-Container prüft stündlich das GitHub-Repository auf neue
            Commits und baut Backend + Frontend bei Änderungen automatisch neu.
            Hier siehst du den aktuellen Status und kannst eine sofortige
            Aktualisierung auslösen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing || loading}
            data-testid="admin-system-refresh"
          >
            <RefreshCw className={["h-4 w-4 mr-1", refreshing ? "animate-spin" : ""].join(" ")} />
            Status aktualisieren
          </Button>
          <Button
            onClick={onTrigger}
            disabled={triggering || loading}
            data-testid="admin-system-trigger"
          >
            <Download className="h-4 w-4 mr-1" />
            {updateAvailable ? "Jetzt aktualisieren" : "Rebuild erzwingen"}
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : errored ? (
        <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm" data-testid="system-status-error">
          <ShieldAlert className="h-4 w-4 text-[hsl(var(--destructive))]" />
          <span className="text-[hsl(var(--destructive))]">{state.error}</span>
        </div>
      ) : (
        <div
          data-testid="system-status-banner"
          className={[
            "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
            updateAvailable
              ? "border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent))]/10"
              : "border-[hsl(var(--border))] bg-[hsl(var(--secondary))]",
          ].join(" ")}
        >
          {updateAvailable ? (
            <CircleAlert className="h-4 w-4 text-[hsl(var(--accent-foreground))]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent-foreground))]" />
          )}
          <div className="flex-1">
            <div className="font-medium">
              {updateAvailable
                ? "Aktualisierung verfügbar"
                : enabled
                ? "System ist auf dem neuesten Stand"
                : "Auto-Update deaktiviert"}
            </div>
            {state?.message && (
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{state.message}</div>
            )}
          </div>
          <Badge variant={enabled ? "default" : "outline"} data-testid="system-updater-enabled">
            {enabled ? "Auto-Update an" : "Manuell"}
          </Badge>
        </div>
      )}

      {/* Details */}
      {!loading && !errored && (
        <div className="divide-y divide-[hsl(var(--border))]/60">
          <InfoRow label="Aktuell deployter Commit" testid="system-current-sha">
            <code className="font-mono text-xs">{Shorten(state?.current_sha)}</code>
          </InfoRow>
          <InfoRow label="Neuester Commit auf GitHub" testid="system-latest-sha">
            <code className={["font-mono text-xs", updateAvailable ? "text-[hsl(var(--accent-foreground))] font-bold" : ""].join(" ")}>
              {Shorten(state?.latest_sha)}
            </code>
          </InfoRow>
          <InfoRow label="Letzte Prüfung">{formatDate(state?.last_check)}</InfoRow>
          <InfoRow label="Letztes erfolgreiches Update">{formatDate(state?.last_update)}</InfoRow>
          <InfoRow label="Intervall">
            <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Timer className="h-3 w-3" />
              {state?.interval ? `${Math.round(state.interval / 60)} min` : "–"}
            </span>
          </InfoRow>
        </div>
      )}

      <div className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed border-t border-[hsl(var(--border))]/60 pt-3">
        <strong>Hinweis:</strong> Ein Rebuild kann mehrere Minuten dauern.
        Während des Rebuilds ist das System kurzzeitig offline (beim
        Container-Recreate). Für das Auto-Update muss der Docker-Socket im
        Updater-Container verfügbar sein; auf Synology-Systemen ist das
        standardmäßig der Fall.
      </div>
    </section>
  );
}
