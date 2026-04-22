import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NsfwBlurOverlay } from "./NsfwBlurOverlay";
import { Star, Trash2, ImagePlus, ArrowUp, GripVertical } from "lucide-react";

const MAX_PHOTOS = 5;

/**
 * Reusable profile-photo manager (upload, delete, set-primary, reorder).
 * Reads `user.photos` from AuthContext and calls `/api/me/photos` endpoints.
 */
export function ProfilePhotosPanel({ title = null, compact = false }) {
  const { user, refresh } = useAuth();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  if (!user) return null;
  const photos = user.photos || [];

  const fileToDataUrl = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const uploadPhoto = async (file) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data } = await api.post("/me/photos", {
        data_url: dataUrl,
        is_primary: photos.length === 0,
      });
      toast.success(
        t("profile.photo_analyzed", {
          nsfw: (data.nsfw_score * 100).toFixed(0),
          face: data.has_face ? "✓" : "✗",
        })
      );
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (pid) => {
    try {
      await api.delete(`/me/photos/${pid}`);
      await refresh();
    } catch (e) {
      if (e.response?.status === 423) {
        toast.error(e.response.data?.detail || "Aktive Meldung — Foto-Löschung gesperrt.");
      } else {
        toast.error(e.response?.data?.detail || "Löschen fehlgeschlagen");
      }
    }
  };

  const makePrimary = async (pid) => {
    try {
      await api.post(`/me/photos/${pid}/primary`);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Primärfoto konnte nicht gesetzt werden");
    }
  };

  const reorderPhotos = async (order) => {
    try {
      await api.post("/me/photos/reorder", { order });
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reihenfolge konnte nicht gespeichert werden");
    }
  };

  return (
    <section
      className={`rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 shadow-[var(--shadow-sm)] no-capture ${compact ? "p-4" : "p-6"}`}
      data-testid="profile-photos-panel"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="font-display text-lg">{title || t("profile.photos")}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]" data-testid="profile-photos-counter">
          {photos.length} / {MAX_PHOTOS}
        </div>
      </div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-3 hidden sm:block">
        {t("profile.photo_reorder_hint", "Ziehe Fotos, um die Reihenfolge zu ändern. Das erste Foto ist dein Primärfoto.")}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {photos.map((p, idx) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/photo-id", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const srcId = e.dataTransfer.getData("text/photo-id");
              if (!srcId || srcId === p.id) return;
              const ids = photos.map((x) => x.id);
              const without = ids.filter((x) => x !== srcId);
              const targetIdx = without.indexOf(p.id);
              const newOrder = [
                ...without.slice(0, targetIdx),
                srcId,
                ...without.slice(targetIdx),
              ];
              reorderPhotos(newOrder);
            }}
            className="relative aspect-[3/4] overflow-hidden rounded-md border bg-[hsl(var(--muted))] group"
            data-testid={`profile-photo-tile-${idx}`}
          >
            <NsfwBlurOverlay
              active={p.nsfw_score >= 0.75}
              revealed={true}
              onReveal={() => {}}
              className="h-full w-full"
            >
              <img src={p.data} alt="" className="h-full w-full object-cover" />
            </NsfwBlurOverlay>
            {p.is_primary && (
              <div className="absolute left-1 top-1 rounded-full bg-black/55 text-white text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
                <Star className="h-3 w-3" /> {t("profile.primary", "Primär")}
              </div>
            )}
            <div className="pointer-events-none absolute right-1 top-1 hidden sm:inline-grid place-items-center h-6 w-6 rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 text-white text-[11px] px-2 py-1">
              <span>
                {p.has_face ? "face" : "no face"} · NSFW {(p.nsfw_score * 100).toFixed(0)}%
              </span>
              <div className="flex items-center gap-2">
                {!p.is_primary && (
                  <>
                    <button
                      onClick={() => makePrimary(p.id)}
                      className="sm:hidden inline-flex items-center gap-1 underline"
                      data-testid={`profile-photo-set-primary-${idx}`}
                      title={t("profile.set_primary", "Als Primär")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => makePrimary(p.id)}
                      className="hidden sm:inline underline"
                    >
                      {t("profile.set_primary", "Als Primär")}
                    </button>
                  </>
                )}
                <button
                  onClick={() => deletePhoto(p.id)}
                  className="underline"
                  data-testid={`profile-photo-delete-${idx}`}
                  aria-label="Foto löschen"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label
            className="aspect-[3/4] grid place-items-center rounded-md border border-dashed hover:bg-[hsl(var(--secondary))] cursor-pointer text-sm text-[hsl(var(--muted-foreground))]"
            data-testid="profile-photo-upload"
          >
            <div className="flex flex-col items-center gap-1">
              <ImagePlus className="h-5 w-5" />
              <span>
                {uploading
                  ? t("profile.analyzing", "Analysiert …")
                  : t("profile.add_photo", "Foto hinzufügen")}
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              data-testid="profile-photo-input"
            />
          </label>
        )}
      </div>
    </section>
  );
}
