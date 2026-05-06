import { Sparkles, Eye, Compass, Scale, ShieldCheck } from "lucide-react";
import { Card } from "../components/ui/card";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";

/**
 * Public transparency page (Kapitel 15.5).
 *
 * Reachable at `/transparent` without authentication so visitors and
 * journalists can verify our claims. Anything we promise in marketing
 * (boost weights, sparks math, what affects gallery order) is mirrored
 * here — if a value diverges from the backend, the bug is on this page.
 */
export default function TransparentPage() {
  return (
    <div className="min-h-screen app-shell-bg">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[hsl(var(--accent))]">
            <Scale className="h-3.5 w-3.5" /> Transparenz
          </div>
          <h1 className="font-display text-3xl tracking-tight">So funktionieren wir</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Diese Seite ist die wahre Quelle für unsere Algorithmen. Wenn unsere Marketing- oder
            App-Texte etwas anderes behaupten, gilt das, was hier steht.
          </p>
        </header>

        <Card className="p-5" data-testid="transparent-gallery">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="h-4 w-4 text-[hsl(var(--accent))]" />
            <h2 className="font-display text-lg">Galerie-Reihenfolge</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Welche Profile dir zuerst angezeigt werden, hängt von einem gewichteten Score ab.
            Premium-User kaufen sich keine permanente Top-Position.
          </p>
          <ul className="text-sm divide-y divide-[hsl(var(--border))]">
            {GALLERY_FACTORS.map((f) => (
              <li key={f.key} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{f.label}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{f.desc}</div>
                </div>
                <div className="font-mono text-sm shrink-0">{(f.weight * 100).toFixed(0)}&#8239;%</div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-3 italic">
            Ein geboostetes, inaktives Profil kann von einem aktiven, vollständigen Profil
            ohne Boost überholt werden.
          </p>
        </Card>

        <Card className="p-5" data-testid="transparent-sparks">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[hsl(var(--ring))]" />
            <h2 className="font-display text-lg">Sparks-Berechnung</h2>
          </div>
          <ul className="text-sm space-y-1.5 text-[hsl(var(--muted-foreground))]">
            <li>• Sparks sind primär verdienbar – Kauf ist optional und nie nötig.</li>
            <li>• Das Sparks-Ledger ist append-only. Kein Eintrag wird je verändert oder gelöscht.</li>
            <li>• Der aktuelle Stand ist die Summe aller Buchungen seit Konto-Erstellung.</li>
            <li>• Sparks verfallen nicht – weder bei Kündigung noch bei Inaktivität.</li>
            <li>• Premium-User bekommen monatlich 50 Sparks gutgeschrieben.</li>
          </ul>
        </Card>

        <Card className="p-5" data-testid="transparent-privacy">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4" />
            <h2 className="font-display text-lg">Was beeinflusst Match-Vorschläge?</h2>
          </div>
          <ul className="text-sm space-y-1.5 text-[hsl(var(--muted-foreground))]">
            <li>• Bidirektionales Matching: nur wenn beide Seiten zueinander passen würden.</li>
            <li>• Geo-Distanz: gerundet auf 5-km-Buckets, exakte GPS bleibt privat.</li>
            <li>• Demografische Filter: vom User selbst eingestellt – wir interpretieren keine Daten.</li>
            <li>• Keine ethnische, religiöse oder politische Zielgruppen-Filterung über Drittanbieter.</li>
          </ul>
        </Card>

        <Card className="p-5" data-testid="transparent-anti-dark">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <h2 className="font-display text-lg">Was wir technisch ausschließen</h2>
          </div>
          <ul className="text-sm space-y-1.5 text-[hsl(var(--muted-foreground))]">
            <li>• Keine Like-Limits im Free-Tier.</li>
            <li>• Keine „Jemand hat dich geliked!“ Bait-Notifications ohne Inhalt.</li>
            <li>• Keine Countdown-Timer ohne echte Expiry.</li>
            <li>• Kündigung nimmt Premium nicht sofort weg – läuft bis Periodenende.</li>
            <li>• Gleiche Preise auf jeder Plattform.</li>
            <li>• Maximal eine Premium-Upsell-Notification pro 30 Tage pro User.</li>
          </ul>
        </Card>

        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center pt-4">
          Stand: {new Date().toLocaleDateString("de-DE")}. Diese Werte sind als Konstanten im
          Quellcode hinterlegt und werden nicht zur Laufzeit verändert.
        </p>
      </main>
      <AppFooter />
    </div>
  );
}

const GALLERY_FACTORS = [
  { key: "geo", label: "Geo-Distanz", weight: 0.35, desc: "Nähere Profile werden bevorzugt – nicht durch Zahlung manipulierbar." },
  { key: "act", label: "Profilaktivität (24h)", weight: 0.25, desc: "Kürzlich aktive Profile werden bevorzugt – natürlicher Aktivitätsanreiz." },
  { key: "comp", label: "Profilvollständigkeit", weight: 0.20, desc: "Vollständige Profile (Foto, Bio, Interessen) werden bevorzugt." },
  { key: "boost", label: "Aktiver Boost", weight: 0.15, desc: "Zeitlich begrenzter Sichtbarkeitsbonus (1h/Tag, max. 3×/Monat für Premium)." },
  { key: "new", label: "Neuanmeldung (≤ 7 Tage)", weight: 0.05, desc: "Neue Profile bekommen einen initialen Sichtbarkeitsschub – unabhängig von Premium." },
];
