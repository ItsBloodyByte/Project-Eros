import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
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
  const nav = useNavigate();
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", starts_at: "", location_name: "", is_nsfw: false
  });

  const load = async () => {
    const { data } = await api.get("/events");
    setEvents(data.events);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.starts_at) { toast.error("Title and date/time required"); return; }
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
      toast.success("Event created");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Create failed");
    }
  };

  const rsvp = async (id, status) => {
    await api.post(`/events/${id}/rsvp`, { status });
    await load();
  };

  return (
    <div className="app-wrap dark:app-shell-bg app-shell-bg-light">
      <div className="app-content">
        <AppHeader />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-3xl">Events</h1>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="events-create-button" className="gap-1"><Plus className="h-4 w-4" /> Host event</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="event-title-input" /></div>
                  <div><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} data-testid="event-starts-input" /></div>
                  <div><Label>Location</Label><Input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="Venue / city" /></div>
                  <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={form.is_nsfw} onCheckedChange={(v) => setForm({ ...form, is_nsfw: v })} />
                    18+ event
                  </label>
                </div>
                <DialogFooter><Button onClick={create} data-testid="event-create-submit">Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {events.length === 0 ? (
            <div className="rounded-md border bg-card p-8 text-center">
              <CalendarClock className="h-6 w-6 mx-auto text-[hsl(var(--muted-foreground))]" />
              <div className="font-display text-xl mt-2">No upcoming events</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">Be the first to host one.</div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="events-list">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-[var(--radius-md)] border bg-card overflow-hidden shadow-[var(--shadow-sm)]">
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-xl leading-tight">{ev.title}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">by {ev.owner_name}</div>
                      </div>
                      {ev.is_nsfw && <Badge variant="destructive">18+</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                      <CalendarClock className="h-4 w-4" /> {new Date(ev.starts_at).toLocaleString()}
                    </div>
                    {ev.location_name && (
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]"><MapPin className="h-4 w-4" /> {ev.location_name}</div>
                    )}
                    {ev.description && <p className="text-sm">{ev.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <Users className="h-3 w-3" /> {ev.going_count} going · {ev.interested_count} interested
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant={ev.my_rsvp === "going" ? "default" : "outline"}
                        onClick={() => rsvp(ev.id, "going")} data-testid={`event-rsvp-going-${ev.id}`}>Going</Button>
                      <Button size="sm" variant={ev.my_rsvp === "interested" ? "default" : "outline"}
                        onClick={() => rsvp(ev.id, "interested")}>Interested</Button>
                      <Button size="sm" variant="ghost" onClick={() => rsvp(ev.id, "not_going")}>Pass</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
