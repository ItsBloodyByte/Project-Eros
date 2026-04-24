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
import { Input } from "./ui/input";
import { SlidersHorizontal, Info } from "lucide-react";
import {
  GENDERS, RELATIONSHIP_TYPES, SEEKING_ROLES, COMMON_KINKS,
  BODY_TYPES, SMOKING_VALUES, DRINKING_VALUES, DIET_VALUES, STI_VALUES,
  CUP_SIZES, PENIS_CATEGORIES, PENIS_RANGES, COMMON_LANGUAGES, COMMON_ETHNICITIES,
} from "../lib/constants";
import { MOOD_LIST } from "../lib/moods";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/AuthContext";
import { isGayMaleLike, GAY_POSITIONS } from "../pages/MyProfilePage";

/** Seeking-audience helpers: determine whether a filter's body metric is
 * relevant given the genders the viewer is looking for. When no seeking
 * genders are set we keep both visible, so first-time users still see all
 * options. */
const FEMININE_GENDERS = new Set(["woman", "trans_woman"]);
const MASCULINE_GENDERS = new Set(["man", "trans_man"]);
const NEUTRAL_GENDERS = new Set(["nonbinary", "genderqueer", "agender", "other"]);

function seeksWomen(seekingGenders) {
  if (!Array.isArray(seekingGenders) || seekingGenders.length === 0) return true;
  return seekingGenders.some((g) => FEMININE_GENDERS.has(g) || NEUTRAL_GENDERS.has(g));
}
function seeksMen(seekingGenders) {
  if (!Array.isArray(seekingGenders) || seekingGenders.length === 0) return true;
  return seekingGenders.some((g) => MASCULINE_GENDERS.has(g) || NEUTRAL_GENDERS.has(g));
}

function Chip({ on, onClick, children, testid }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent" : "hover:bg-[hsl(var(--secondary))]"}`}>
      {children}
    </button>
  );
}

export function FilterDrawer({ prefs, onChange, onApply }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(prefs);

  const viewerSeekingGenders = local.seeking_genders || [];
  const showCup = seeksWomen(viewerSeekingGenders);
  const showPenis = seeksMen(viewerSeekingGenders);
  // Gay-male-like viewers looking for men get the position filter; everyone
  // else never sees the control (mirrors the backend gate in /api/discover).
  const viewerIsGayMale = isGayMaleLike({
    gender_identity: user?.gender_identity,
    orientation: user?.orientation,
  });
  const showGayPosition = viewerIsGayMale && viewerSeekingGenders.some((g) => MASCULINE_GENDERS.has(g));

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
      hide_seen: false, online_only: false, hide_nsfw_profiles: false,
      body_types: [], min_height_cm: null, max_height_cm: null,
      smoking: [], drinking: [], diet: [], sti_status: [],
      cup_sizes: [], penis_categories: [], gay_positions: [],
      languages: [], ethnicities: [], moods: [],
    };
    setLocal(fresh);
    onChange(fresh);
  };
  const activeCount =
    (local.seeking_genders?.length || 0) +
    (local.relationship_types?.length || 0) +
    (local.seeking_roles?.length || 0) +
    (local.kinks?.length || 0) +
    (local.body_types?.length || 0) +
    (local.smoking?.length || 0) +
    (local.drinking?.length || 0) +
    (local.diet?.length || 0) +
    (local.sti_status?.length || 0) +
    (local.cup_sizes?.length || 0) +
    (local.penis_categories?.length || 0) +
    (local.gay_positions?.length || 0) +
    (local.languages?.length || 0) +
    (local.ethnicities?.length || 0) +
    (local.moods?.length || 0) +
    (local.only_face_photo ? 1 : 0) +
    (local.only_verified ? 1 : 0) +
    (local.online_only ? 1 : 0) +
    (local.hide_nsfw_profiles ? 1 : 0) +
    (local.min_height_cm ? 1 : 0) +
    (local.max_height_cm ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" data-testid="filters-open-button" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {t("filters.open")}
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="font-display text-2xl">{t("filters.title")}</SheetTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <Info className="h-3 w-3" /> {t("filters.mutual_hint")}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("filters.mutual_tooltip")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            <section>
              <Label className="font-display text-base">{t("filters.age_range")}</Label>
              <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                {local.age_min} – {local.age_max}
              </div>
              <div className="mt-2">
                <Slider data-testid="filters-age-slider" min={18} max={99} step={1}
                  value={[local.age_min, local.age_max]}
                  onValueChange={([a, b]) => update({ age_min: a, age_max: b })} />
              </div>
            </section>

            <section>
              <Label className="font-display text-base">{t("filters.distance")}</Label>
              <div className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{local.radius_km} km</div>
              <Slider data-testid="filters-distance-slider" min={1} max={500} step={1}
                value={[local.radius_km]}
                onValueChange={([v]) => update({ radius_km: v })} />
            </section>

            <Accordion type="multiple" defaultValue={["identity", "safety"]}>
              <AccordionItem value="identity">
                <AccordionTrigger className="font-display text-base">{t("filters.identity")}</AccordionTrigger>
                <AccordionContent>
                  <Label className="text-sm">{t("filters.seeking_genders")}</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GENDERS.map((g) => (
                      <Chip key={g} on={local.seeking_genders?.includes(g)}
                        onClick={() => toggleArr("seeking_genders", g)}
                        testid={`filter-gender-${g}`}>
                        {t(`genders.${g}`)}
                      </Chip>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mood">
                <AccordionTrigger className="font-display text-base" data-testid="filter-mood-trigger">Status</AccordionTrigger>
                <AccordionContent>
                  <Label className="text-sm">Was suchst du gerade?</Label>
                  <div className="mt-2 flex flex-wrap gap-2" data-testid="filter-mood-chips">
                    {MOOD_LIST.map((m) => (
                      <Chip
                        key={m.key}
                        on={local.moods?.includes(m.key)}
                        onClick={() => toggleArr("moods", m.key)}
                        testid={`filter-mood-${m.key}`}
                      >
                        {m.label}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                    Nur Profile mit dem gewählten Status erscheinen in Entdecken.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="relationship">
                <AccordionTrigger className="font-display text-base">{t("filters.relationship")}</AccordionTrigger>
                <AccordionContent>
                  <Label className="text-sm">{t("filters.relationship_types")}</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {RELATIONSHIP_TYPES.map((r) => (
                      <Chip key={r} on={local.relationship_types?.includes(r)} onClick={() => toggleArr("relationship_types", r)}>{t(`relationships.${r}`)}</Chip>
                    ))}
                  </div>
                  <Label className="mt-4 block text-sm">{t("filters.seeking_roles")}</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEEKING_ROLES.map((r) => (
                      <Chip key={r} on={local.seeking_roles?.includes(r)} onClick={() => toggleArr("seeking_roles", r)}>{t(`roles.${r}`)}</Chip>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="body">
                <AccordionTrigger className="font-display text-base">{t("filters.body")}</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Label className="text-sm">{t("filters.body_types")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {BODY_TYPES.map((b) => (
                      <Chip key={b} on={local.body_types?.includes(b)} onClick={() => toggleArr("body_types", b)}>{t(`body_types.${b}`)}</Chip>
                    ))}
                  </div>
                  <Label className="text-sm">{t("filters.height")}</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="100" max="250" placeholder={t("filters.min_height")}
                      value={local.min_height_cm ?? ""} onChange={(e) => update({ min_height_cm: e.target.value ? Number(e.target.value) : null })} />
                    <Input type="number" min="100" max="250" placeholder={t("filters.max_height")}
                      value={local.max_height_cm ?? ""} onChange={(e) => update({ max_height_cm: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <Label className="text-sm">{t("filters.smoking")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {SMOKING_VALUES.map((v) => (
                      <Chip key={v} on={local.smoking?.includes(v)} onClick={() => toggleArr("smoking", v)}>{t(`lifestyle.smoking.${v}`)}</Chip>
                    ))}
                  </div>
                  <Label className="text-sm">{t("filters.drinking")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {DRINKING_VALUES.map((v) => (
                      <Chip key={v} on={local.drinking?.includes(v)} onClick={() => toggleArr("drinking", v)}>{t(`lifestyle.drinking.${v}`)}</Chip>
                    ))}
                  </div>
                  <Label className="text-sm">{t("filters.diet")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIET_VALUES.map((v) => (
                      <Chip key={v} on={local.diet?.includes(v)} onClick={() => toggleArr("diet", v)}>{t(`lifestyle.diet.${v}`)}</Chip>
                    ))}
                  </div>
                  <Label className="text-sm">{t("filters.sti_status")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {STI_VALUES.map((v) => (
                      <Chip key={v} on={local.sti_status?.includes(v)} onClick={() => toggleArr("sti_status", v)}>{t(`lifestyle.sti.${v}`)}</Chip>
                    ))}
                  </div>
                  {showCup && (
                    <>
                      <Label className="text-sm">{t("filters.cup_sizes")}</Label>
                      <div className="flex flex-wrap gap-2" data-testid="filter-cup-sizes">
                        {CUP_SIZES.map((c) => (
                          <Chip key={c} on={local.cup_sizes?.includes(c)} onClick={() => toggleArr("cup_sizes", c)}>{c}</Chip>
                        ))}
                      </div>
                    </>
                  )}
                  {showPenis && (
                    <>
                      <Label className="text-sm">{t("filters.penis_categories")}</Label>
                      <div className="flex flex-wrap gap-2" data-testid="filter-penis-categories">
                        {PENIS_CATEGORIES.map((p) => (
                          <Chip key={p} on={local.penis_categories?.includes(p)} onClick={() => toggleArr("penis_categories", p)}>
                            {p} <span className="opacity-70">({PENIS_RANGES[p]})</span>
                          </Chip>
                        ))}
                      </div>
                    </>
                  )}
                  {showGayPosition && (
                    <>
                      <Label className="text-sm" data-testid="filter-gay-positions-label">Position (Top/Bottom/…)</Label>
                      <div className="flex flex-wrap gap-2" data-testid="filter-gay-positions">
                        {GAY_POSITIONS.filter((p) => p.value !== "prefer_not_say").map((p) => (
                          <Chip
                            key={p.value}
                            on={local.gay_positions?.includes(p.value)}
                            onClick={() => toggleArr("gay_positions", p.value)}
                            testid={`filter-gay-position-${p.value}`}
                          >
                            {p.label}
                          </Chip>
                        ))}
                      </div>
                    </>
                  )}
                  <Label className="text-sm">{t("filters.languages")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_LANGUAGES.map((l) => (
                      <Chip key={l} on={local.languages?.includes(l)} onClick={() => toggleArr("languages", l)}>{l}</Chip>
                    ))}
                  </div>
                  <Label className="text-sm">{t("filters.ethnicities")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ETHNICITIES.map((e) => (
                      <Chip key={e} on={local.ethnicities?.includes(e)} onClick={() => toggleArr("ethnicities", e)}>{e}</Chip>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="safety">
                <AccordionTrigger className="font-display text-base">{t("filters.safety")}</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Row title={t("filters.only_with_photos")} desc={t("filters.only_with_photos_desc")}
                    checked={!!local.only_with_photos} onCheckedChange={(v) => update({ only_with_photos: v })} />
                  <Row title={t("filters.only_face_photo")} desc={t("filters.only_face_photo_desc")}
                    checked={!!local.only_face_photo} onCheckedChange={(v) => update({ only_face_photo: v })} />
                  <Row title={t("filters.only_verified")} desc={t("filters.only_verified_desc")}
                    checked={!!local.only_verified} onCheckedChange={(v) => update({ only_verified: v })}
                    testid="filters-only-verified-switch" />
                  <Row title={t("filters.hide_seen")} desc={t("filters.hide_seen_desc")}
                    checked={!!local.hide_seen} onCheckedChange={(v) => update({ hide_seen: v })} />
                  <Row title={t("filters.online_only")} desc={t("filters.online_only_desc")}
                    checked={!!local.online_only} onCheckedChange={(v) => update({ online_only: v })} />
                  <Row title="NSFW-Profile ausblenden"
                    desc="Verbirgt Profile, die ausdrücklich NSFW-Inhalte kennzeichnen."
                    checked={!!local.hide_nsfw_profiles}
                    onCheckedChange={(v) => update({ hide_nsfw_profiles: v })}
                    testid="filters-hide-nsfw-switch" />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="nsfw" data-testid="filters-nsfw-section">
                <AccordionTrigger className="font-display text-base">{t("filters.kinks")}</AccordionTrigger>
                <AccordionContent>
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{t("filters.kinks_hint")}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_KINKS.map((k) => (
                      <label key={k} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={local.kinks?.includes(k)} onCheckedChange={() => toggleArr("kinks", k)} />
                        {k}
                      </label>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        <div className="sticky bottom-0 border-t bg-card/95 backdrop-blur px-5 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={reset} data-testid="filters-reset-button">{t("filters.reset")}</Button>
          <Button onClick={apply} data-testid="filters-apply-button" className="min-w-[120px]">{t("filters.apply")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ title, desc, checked, onCheckedChange, testid }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm">{title}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} data-testid={testid} />
    </div>
  );
}
