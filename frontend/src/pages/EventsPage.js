import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { CalendarClock, MapPin, Plus, Users } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", starts_at: "", location_name: "", is_nsfw: false,
  });

  const load = async () => {
    const { data } = await api.get("/events");
    setEvents(data.events);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.starts_at) { toast.error("Titel und Zeitpunkt erforderlich"); return; }
    try {
      await api.post("/events", {
        title: form.title,
        description: form.description || null,
        starts_at: new Date(form.starts_at).toISOString(),
        location_name: form.location_name || null,
        is_nsfw: form.is_nsfw,
      });
      setOpen(false);
      setForm({ title: "", description: "", starts_at: "", location_name: "", is_nsfw: false });
      await load();
      toast.success("Event erstellt");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erstellen fehlgeschlagen");
    }
  };

  const rsvp = async (id, status) => {
    await api.post(`/events/${id}/rsvp`, { status });
    await load();
  };

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Community</div>
              <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-none">Events</h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] max-w-prose">Treffen in echter Umgebung — moderiert, respektvoll, freiwillig.</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="events-create-button" className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Event erstellen</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Neues Event</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="event-title-input" /></div>
                  <div><Label>Beginn</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} data-testid="event-starts-input" /></div>
                  <div><Label>Ort</Label><Input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="Veranstaltungsort / Stadt" /></div>
                  <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.is_nsfw} onCheckedChange={(v) => setForm({ ...form, is_nsfw: v })} />
                    18+ Event
                  </label>
                </div>
                <DialogFooter><Button onClick={create} data-testid="event-create-submit">Erstellen</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {events.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 p-12 text-center shadow-[var(--shadow-sm)]">
              <CalendarClock className="h-7 w-7 mx-auto text-[hsl(var(--muted-foreground))]" />
              <div className="font-display text-2xl tracking-tight mt-3">Noch keine Events geplant</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Sei die erste Person, die ein Event erstellt.</div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5" data-testid="events-list">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]/60 overflow-hidden shadow-[var(--shadow-sm)] card-hover">
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-display text-xl tracking-tight leading-snug truncate">{ev.title}</div>
                        <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mt-1">von {ev.owner_name}</div>
                      </div>
                      {ev.is_nsfw && <Badge variant="destructive" className="shrink-0">18+</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      <CalendarClock className="h-3.5 w-3.5" /> {new Date(ev.starts_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                    {ev.location_name && (
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]"><MapPin className="h-3.5 w-3.5" /> {ev.location_name}</div>
                    )}
                    {ev.description && <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]/90">{ev.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] pt-1">
                      <Users className="h-3 w-3" /> {ev.going_count} dabei · {ev.interested_count} interessiert
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <Button size="sm" variant={ev.my_rsvp === "going" ? "default" : "outline"}
                        onClick={() => rsvp(ev.id, "going")} data-testid={`event-rsvp-going-${ev.id}`} className="rounded-full">Dabei</Button>
                      <Button size="sm" variant={ev.my_rsvp === "interested" ? "default" : "outline"}
                        onClick={() => rsvp(ev.id, "interested")} className="rounded-full">Interessiert</Button>
                      <Button size="sm" variant="ghost" onClick={() => rsvp(ev.id, "not_going")} className="rounded-full">Nein</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
