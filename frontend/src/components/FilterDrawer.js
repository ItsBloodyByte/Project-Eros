import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { ScrollArea } from "./ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { SlidersHorizontal, Info } from "lucide-react";
import { GENDERS, RELATIONSHIP_TYPES, SEEKING_ROLES, COMMON_KINKS } from "../lib/constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function FilterDrawer({ prefs, onChange, onApply }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(prefs);

  const update = (patch) => setLocal((p) => ({ ...p, ...patch }));
  const toggleArr = (key, value) => {
    const arr = local[key] || [];
    update({ [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] });
  };
  const apply = () => {
    onChange(local);
    onApply && onApply(local);
    setOpen(false);
  };
  const reset = () => {
    const fresh = {
      age_min: 18, age_max: 99, seeking_genders: [], radius_km: 50,
      relationship_types: [], seeking_roles: [], kinks: [],
      only_with_photos: true, only_face_photo: false, only_verified: false,
      hide_seen: true, online_only: false,
    };
    setLocal(fresh);
    onChange(fresh);
  };
  const activeCount =
    (local.seeking_genders?.length || 0) +
    (local.relationship_types?.length || 0) +
    (local.seeking_roles?.length || 0) +
    (local.kinks?.length || 0) +
    (local.only_face_photo ? 1 : 0) +
    (local.only_verified ? 1 : 0) +
    (local.online_only ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" data-testid="filters-open-button" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="font-display text-2xl">Filters</SheetTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <Info className="h-3 w-3" /> Filters are mutual
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                We only show people whose preferences also match yours.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            <section>
              <Label className="font-display text-base">Age range</Label>
              <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                {local.age_min} – {local.age_max}
              </div>
              <div className="mt-2">
                <Slider
                  data-testid="filters-age-slider"
                  min={18} max={99} step={1}
                  value={[local.age_min, local.age_max]}
                  onValueChange={([a, b]) => update({ age_min: a, age_max: b })}
                />
              </div>
            </section>

            <section>
              <Label className="font-display text-base">Distance (km)</Label>
              <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{local.radius_km} km</div>
              <Slider
                data-testid="filters-distance-slider"
                min={1} max={500} step={1}
                value={[local.radius_km]}
                onValueChange={([v]) => update({ radius_km: v })}
              />
            </section>

            <Accordion type="multiple" defaultValue={["identity", "safety"]}>
              <AccordionItem value="identity">
                <AccordionTrigger className="font-display text-base">Identity</AccordionTrigger>
                <AccordionContent>
                  <Label className="text-sm">Seeking genders</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GENDERS.map((g) => {
                      const on = local.seeking_genders?.includes(g.value);
                      return (
                        <button
                          type="button"
                          key={g.value}
                          onClick={() => toggleArr("seeking_genders", g.value)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}
                          data-testid={`filter-gender-${g.value}`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="relationship">
                <AccordionTrigger className="font-display text-base">Relationship</AccordionTrigger>
                <AccordionContent>
                  <Label className="text-sm">Relationship type</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {RELATIONSHIP_TYPES.map((r) => {
                      const on = local.relationship_types?.includes(r.value);
                      return (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => toggleArr("relationship_types", r.value)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                  <Label className="mt-4 block text-sm">Seeking roles</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEEKING_ROLES.map((r) => {
                      const on = local.seeking_roles?.includes(r.value);
                      return (
                        <button
                          type="button"
                          key={r.value}
                          onClick={() => toggleArr("seeking_roles", r.value)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="safety">
                <AccordionTrigger className="font-display text-base">Safety</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Only with photos</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Hide profiles without any photo</div>
                    </div>
                    <Switch checked={!!local.only_with_photos} onCheckedChange={(v) => update({ only_with_photos: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Only with face photo</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">AI-detected face photo</div>
                    </div>
                    <Switch
                      checked={!!local.only_face_photo}
                      onCheckedChange={(v) => update({ only_face_photo: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Only verified</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Profile has been verified</div>
                    </div>
                    <Switch
                      data-testid="filters-only-verified-switch"
                      checked={!!local.only_verified}
                      onCheckedChange={(v) => update({ only_verified: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Hide already seen</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Skip profiles you’ve viewed</div>
                    </div>
                    <Switch checked={!!local.hide_seen} onCheckedChange={(v) => update({ hide_seen: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm">Online now</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">Only active in the last 5 minutes</div>
                    </div>
                    <Switch checked={!!local.online_only} onCheckedChange={(v) => update({ online_only: v })} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="nsfw" data-testid="filters-nsfw-section">
                <AccordionTrigger className="font-display text-base">Kinks (18+)</AccordionTrigger>
                <AccordionContent>
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                    Optional. Only shown to others if you also list them.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_KINKS.map((k) => {
                      const on = local.kinks?.includes(k);
                      return (
                        <label key={k} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={on} onCheckedChange={() => toggleArr("kinks", k)} />
                          {k}
                        </label>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        <div className="sticky bottom-0 border-t bg-card/95 backdrop-blur px-5 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={reset} data-testid="filters-reset-button">Reset</Button>
          <Button onClick={apply} data-testid="filters-apply-button" className="min-w-[120px]">Apply</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
