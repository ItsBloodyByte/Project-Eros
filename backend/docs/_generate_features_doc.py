"""Generates /app/backend/docs/eros_features.docx - a structured overview of all features."""
import os
from datetime import datetime, timezone
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

OUT = os.path.join(os.path.dirname(__file__), "eros_features.docx")

SECTIONS = [
    ("1. Authentifizierung & Konto", [
        "Registrierung mit E-Mail, Passwort, Anzeigename, Alter (>= 18, nach Registrierung nicht mehr aenderbar) und Geschlecht (Pflicht)",
        "Login mit JWT-Token + automatische Wiederherstellung der Sitzung bei Seiten-Refresh",
        "E-Mail-Verifizierung mit Dev-Code (Produktion: Mail-Versand vorgesehen)",
        "Zwei-Faktor-Authentifizierung (TOTP) mit eigener Aktivierung/Deaktivierung",
        "Passwort-Mindestanforderung: 8+ Zeichen",
        "Einwilligungen (Nutzungsbedingungen, Datenschutz, sensible Daten, optional NSFW-Ansicht)",
        "Logout, Theme- und Sprach-Persistenz in LocalStorage",
    ]),
    ("2. Profil & Selbstdarstellung", [
        "Editierbares Profil: Anzeigename, Bio, Pronomen, Orientierung, Beziehungstypen, gesuchte Rollen, Kinks",
        "Erweiterte Attribute: Koerpergroesse, Koerpertyp, Ethnie, Sprachen, Interessen, Rauch-/Trink-/Diaet-Verhalten, STI-Status mit Datum",
        "Geschlechts-bedingte Felder: Cup-Size oder Penis-Laenge/-Umfang (mit automatischer S/M/L/XL/XXL-Kategorisierung)",
        "Bis zu 5 Fotos (1 Haupt + 4 Neben), Drag-and-Drop zum Umsortieren auf Desktop, Als-Hauptfoto-Button auf Mobile",
        "NSFW-/Gesichts-Erkennung per Gemini-Vision pro Foto (Score + Flag)",
        "Blur-Overlay bei NSFW-Bildern mit expliziter Freigabe durch den Betrachter",
        "Videos: Upload und Wiedergabe auf dem Profil",
        "Alter ist nach Registrierung immutable (serverseitig silent-ignored)",
    ]),
    ("3. Entdecken (Discover) & Suche", [
        "Poster-artiges Grid mit grossen Profilkarten",
        "Quick-Filter-Chip-Strip: Online, Verifiziert, Mit-Gesicht, Mit-Foto",
        "Erweiterter Filter-Drawer: Alter, Entfernung, Geschlecht, Beziehungstyp, Groesse, Koerpertyp, Sprachen, Kinks, Gewohnheiten, STI-Status, Cup-/Penis-Kategorien",
        "Bidirektionale Filterung (Praeferenzen beider Seiten)",
        "Bereits-angesehen-Markierung per Augen-Icon; Profile bleiben sichtbar",
        "Boost-Sortierung: aktiv geboostete Profile erscheinen oben",
        "Pagination mit Mehr-Laden-Button, Skeleton-Ladezustand und Empty-State",
        "Distanzberechnung per Geo-2dsphere-Index (haversine)",
    ]),
    ("4. Interaktion, Matches & Likes", [
        "Like / Pass (1:1 Like-Tabelle mit Unique-Index)",
        "Match-Erkennung bei gegenseitigem Like",
        "Wer-mich-geliked-hat (Premium-only)",
        "Erst-Nachricht ohne Match (Premium-only)",
        "Unmatch / Block-Funktion",
        "Melde-Funktion mit Gruenden; Zieltypen user oder message",
    ]),
    ("5. Chat & Messaging", [
        "Echtzeit-Chat via WebSocket (Typing, Presence, Screenshot-Events)",
        "Chat-Historie mit Lesebestaetigungen (Single-/Double-Check)",
        "Asymmetrische Nachrichtenblasen (eigener Akzent vs. neutrale Karte)",
        "Medien-Upload im Chat (Bilder) mit NSFW-Blur bei Score >= 0,75",
        "Selbstzerstoerende Nachrichten (60 Sekunden)",
        "Link-Blocker: lehnt URLs, (dot)/[dot]-Obfuskierung, leerzeichen-getrennte Domains (google com) und buchstaben-getrennte Varianten (g o o g l e . c o m) sowie E-Mail-Adressen ab; ohne Falschpositive bei deutschen Texten",
        "Privatsphaere-Toggles im Chat-Menue (Lesebestaetigungen)",
    ]),
    ("6. Premium & Zahlungen", [
        "Premium-Status mit Ablaufdatum (verlaengernd)",
        "Boost-Pakete (Minuten-basiert, sortieren Discover nach oben)",
        "Dynamisch konfigurierbare Pakete (ID, Betrag, Waehrung, Art, Dauer, Beschreibung, aktiv/inaktiv)",
        "Multi-Provider-Konfiguration: Stripe (live-integriert), PayPal, Mollie, Klarna, Paddle, Custom (Platzhalter mit Key-Speicherung)",
        "Admin-UI zur Verwaltung der Anbieter-Schluessel (maskierte Rueckgabe) und Pakete",
        "Stripe-Checkout-Session-Erzeugung, Webhook, Status-Endpoint, idempotente Gutschrift",
        "Premium-Badge im Header bei aktivem Abo",
        "Boost-Badge sichtbar solange aktiv",
    ]),
    ("7. ID-Verifizierung (kostenlos)", [
        "Nutzer-Upload von Selfie + Dokument (Reisepass / Personalausweis / Fuehrerschein)",
        "Status-Flow: pending -> approved / rejected",
        "Admin-Review-Queue mit Thumbnail-Anzeige und Entscheidungs-Aktionen",
        "Verifiziert-Badge (blauer Schild) in Profilkarten und Profilansicht",
    ]),
    ("8. Reisen & Events", [
        "Reiseplanung: Ziel-Stadt/Land, Zeitraum, optionale Geo-Koordinaten",
        "Liste eigener Reisen mit Loesch-Option",
        "Events-System: Auflistung, RSVP, Event-Details",
    ]),
    ("9. Alben (privat / geteilt)", [
        "Private Alben mit Unlock-Mechanik (Freigabe pro Nutzer)",
        "Album-CRUD, Unlock-Anfragen und Genehmigungen",
    ]),
    ("10. Moderation & Anti-Abuse", [
        "KI-gestuetzte Bildpruefung (Gemini Vision) beim Upload",
        "Admin-Foto-Queue mit Threshold-Filter",
        "Auto-Moderation: nach 10 eindeutigen Melde-IPs -> Shadow-Restrict des Zielusers",
        "Duplikat-Schutz bei Meldungen (reporter/target)",
        "Manuelle Aktionen: Ban/Unban, Shadow-Restrict, Warnungen",
        "Audit-Log fuer alle Admin-Aktionen",
    ]),
    ("11. Admin-Panel (Backoffice)", [
        "Tabs: Reports, Users, Foto-Queue, Verifizierungen, KI-Konfig, Zahlungen, Rechtliches (CMS), Audit",
        "Benutzersuche, Status-Badges (banned / shadow / ID / aktiv)",
        "KI-Konfiguration: Provider (Gemini / OpenAI / Ollama), Modell, API-Key, Aktiv-Flag",
        "Zahlungs-Konfiguration mit Anbieter-Cards und Package-Editor",
        "Rechtliches (CMS light): 6 Seiten editierbar als Markdown mit Live-Vorschau",
        "Rollen: user / moderator / admin / superadmin mit Sichtbarkeits-Gating der Tabs",
    ]),
    ("12. Rechtliche Seiten & Transparenz", [
        "Oeffentlich lesbar ohne Login: /legal/terms, /legal/privacy, /legal/imprint, /legal/community, /legal/cookies, /legal/cancellation",
        "Markdown-Rendering mit editorialer Typografie",
        "Footer mit Legal-Links auf Login, Discover, Account und anderen Seiten",
        "Deutsche Default-Inhalte, editierbar durch Admin",
    ]),
    ("13. Datenschutz & DSGVO", [
        "Daten-Export (JSON-Download aller eigenen Daten)",
        "Konto-Loeschung mit Bestaetigungs-Dialog und vollstaendigem Entfernen",
        "Privatsphaere-Schalter: Lesebestaetigungen, Online-Status, Tipp-Indikator, Versteckter Modus, Screenshot-Hinweise",
        "Screenshot-Deterrent: CSS-Hinweise, Druck-Block, Blur bei erkanntem Screenshot-Event",
        "Keine Tracking-Scripts (Posthog / Emergent-Tracker entfernt)",
    ]),
    ("14. Internationalisierung", [
        "Deutsch (primaer) + Englisch via react-i18next",
        "Sprachwechsler im Header mit Persistenz in LocalStorage",
        "Formulare, Filter, Navigation und Fehler-Toasts alle lokalisiert",
    ]),
    ("15. Design-System & UX", [
        "Dark- und Light-Theme gleichwertig, System-Preference-Auto-Detection, manuell umschaltbar",
        "Akzentfarbe Apricot (warm, ruhig) mit Verified-Blau als Sekundaer-Akzent",
        "Typografie: Playfair Display (Editorial) + Figtree (Body) + IBM Plex Mono",
        "Abgerundete Karten (radius-lg), sanfte Schatten, Ring-basierter Rahmen",
        "Sticky Glass-Navigation mit aktiver Pille, Hover/Active-Mikrointeraktionen",
        "Mobile-first-Layout, 44x44 px Touch-Targets, prefers-reduced-motion-Fallback",
        "Skeleton-Loader, Empty-/Error-States, Sonner-Toasts fuer Feedback",
    ]),
    ("16. Sicherheit & Architektur", [
        "FastAPI + MongoDB (motor async) mit UUIDs als IDs",
        "Timezone-aware datetimes (UTC)",
        "JWT mit Secret-Env, Axios-Interceptor bei 401 -> /login",
        "CORS konfigurierbar, WebSocket-Token-Auth",
        "Pydantic-Modelle fuer alle Requests/Responses",
        "Supervisor-managed Services (Frontend / Backend)",
        "Emergent LLM Universal Key fuer Gemini-Vision (keine direkte SDK-Abhaengigkeit)",
    ]),
    ("17. Mobile App (Scaffold)", [
        "React-Native/Expo-Projekt unter /app/mobile, Feature-Parity geplant",
    ]),
]


def add_title(doc, text, level=1):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    if level == 0:
        run.font.size = Pt(28)
        run.font.color.rgb = RGBColor(0x1a, 0x1a, 0x1a)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif level == 1:
        run.font.size = Pt(15)
        run.font.color.rgb = RGBColor(0x2a, 0x2a, 0x2a)
    else:
        run.font.size = Pt(11)


def build():
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.9)
        section.bottom_margin = Inches(0.9)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    add_title(doc, "Eros \u2014 Feature- und Funktionsuebersicht", level=0)
    sub = doc.add_paragraph()
    sub_run = sub.add_run(f"Stand: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    sub_run.italic = True
    sub_run.font.size = Pt(10)
    sub_run.font.color.rgb = RGBColor(0x77, 0x77, 0x77)
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER

    intro = doc.add_paragraph(
        "Dieses Dokument listet alle aktuell implementierten Features und "
        "Funktionen der Eros-Plattform. Gliederung nach Funktionsbereichen. "
        "ID-Verifizierung ist kostenlos. Zahlungen sind multi-provider-faehig, "
        "wobei aktuell nur Stripe live integriert ist."
    )
    for run in intro.runs:
        run.font.size = Pt(10.5)
        run.font.color.rgb = RGBColor(0x44, 0x44, 0x44)

    doc.add_paragraph()

    for heading, items in SECTIONS:
        add_title(doc, heading, level=1)
        for item in items:
            p = doc.add_paragraph(style="List Bullet")
            run = p.add_run(item)
            run.font.size = Pt(10.5)
        doc.add_paragraph()

    footer = doc.add_paragraph()
    fr = footer.add_run(
        "Dieses Dokument wird beim Ausfuehren von backend/docs/_generate_features_doc.py neu erzeugt."
    )
    fr.italic = True
    fr.font.size = Pt(9)
    fr.font.color.rgb = RGBColor(0x88, 0x88, 0x88)

    doc.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
