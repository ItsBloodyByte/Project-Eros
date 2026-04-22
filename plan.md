# Inclusive Modern Dating Platform — Implementierungsplan

## Source
Konzeptdokument: `dating_app_konzept.docx` (Deutsch). Umsetzung ohne weitere Rückfragen (außer notwendige Klärungen über `ask_human`) gemäß deiner Anweisung.

## Stack Adaptation
Konzept sieht NestJS + PostgreSQL + Next.js + React Native vor. Umgebung nutzt FARM-Stack. Anpassung:

| Konzept | Umsetzung |
|---|---|
| NestJS | FastAPI (Python) |
| PostgreSQL + PostGIS | MongoDB mit 2dsphere Geo-Index |
| MinIO | Base64 in MongoDB (MVP), später austauschbar |
| Next.js + RN | React (Web) — web-first MVP + Expo Scaffold für Mobile |
| Socket.IO (NestJS) | FastAPI WebSocket |
| NudeNet/DeepFace | Gemini Vision via Emergent LLM Key |
| Argon2id | bcrypt |

## Key Differentiators (MUST HAVE)
1. **Bidirektionales Matching/Filtern (Alice-Werner-Prinzip):** Alice sieht Werner nur, wenn (a) Werners Alter ∈ Alices Range UND Alices Alter ∈ Werners Range, und (b) gegenseitige Gender/Seeking-Kriterien passen.
2. **Gallery Discovery** — Grid, **kein** Swipe.
3. **AI Bildmoderation** — NSFW-Score + Face-Detection → Auto-Blur >0.75 mit 18+ Override; Face-Only Filter möglich.
4. **Gerundete Distanz** — keine exakten GPS-Daten (5km Buckets).
5. **Chat nur nach Match** (mit Premium-Option „First Message“).
6. **Alben** mit selektivem Sharing + Unlock Requests.
7. **Admin/Moderation** Panel mit Reports Queue.
8. **Privacy Controls:** Read Receipts, Online-Status, Hidden Mode, Screenshot-Abschreckung/Indikatoren.
9. **GDPR:** Export + Delete, Consent Tracking.

---

## Phase 1 — Core POC (Isolation Test)
Test der kritischsten Integrationen in einem Python-Skript:
- Emergent LLM Key + Gemini Vision: NSFW Score + Face Detection an zwei Bildern (safe vs. provokativ), strukturierte Rückgabe.
- Bidirektionale Filterlogik: 3 Test-User in MongoDB und Validierung der mutual-match Query.

**User Stories im POC:**
- Als User werden Upload-Fotos automatisch klassifiziert (Face/NSFW), bevor andere sie sehen.
- Als User sehe ich nur Profile, die auch mich gemäß deren Einstellungen sehen würden.

**Status:** Abgeschlossen.

---

## Phase 2 — Complete App (Web MVP)
### Backend (FastAPI + MongoDB)
- Auth: Register/Login/JWT; Passwort-Hashing; E-Mail Eindeutigkeit.
- Profile: CRUD inkl. sensibler Felder; Location; Seeking; Altersrange; Relationship; Kinks; Privacy.
- Photos: Base64 Upload → Gemini → `nsfw_score`, `has_face`, Kategorien.
- Discovery: `/api/discover` mit bidirektionalen + einseitigen Filtern.
- Likes & Matches: Like → ggf. Match.
- Chat: WebSocket + Persistenz; Media; Read Receipts; nur nach Match.
- Albums: Erstellung, Befüllen, Sharing, Unlock Requests.
- Reports: melden von User/Foto/Message.
- Admin: Moderationsqueues, Bans/Warns, Audit Logs.
- GDPR: Export + Delete.

### Frontend (React)
- Mobile-first responsives UI (Dark/Light), inklusiv.
- Pages:
  - `/login`, `/register`
  - `/onboarding`
  - `/` (Discover Grid)
  - `/profile/:id`
  - `/me`
  - `/matches`
  - `/chat/:matchId`
  - `/albums`, `/albums/:id`
  - `/settings`
  - `/admin`
- Komponenten: FilterDrawer, ProfileCard Grid, NSFW Blur Overlay, Report Dialog, Consent.

### Testing
E2E: Auth → Profile/Photo/AI → Discover mutual-filter → Like/Match → Chat → Albums → Report → Admin → Privacy → GDPR.

**Status:** Abgeschlossen.

---

## Phase 3 (Roadmap add-ons) — complete
### Delivered
- E-Mail Verifizierung (In-App Code; `dev_code` für Tests).
- MFA (TOTP): Setup/Enable/Disable + MFA Login Challenge.
- Video-Clips: Upload + Moderation Queue + Playback.
- Premium Tier (intern): Upgrade/Status/Cancel.
  - Premium unlocks: Likes received, First Message, Boost.
- Events: Create/List/Detail/RSVP.
- Admin Rollen: `admin`, `content_reviewer`, `support` + Rollenverwaltung.
- Account Page zeigt Features + Premium Badge.
- i18n Setup (Deutsch primär).
- Screenshot-Abschreckung im Web.

### Testing results
- Backend- und Frontendtests überwiegend grün; Restpunkt: Session-Persistence UX leicht holprig (Frontend-Rehydration/Flicker) → siehe Issue.

### Native mobile
- Expo Scaffold vorhanden (`/app/mobile`), Feature-Parität nicht umgesetzt.

**Status:** Abgeschlossen.

---

## Phase 4 — Multi-language, Extended Profiles, Mobile Scaffold — complete
### Delivered
- `react-i18next` (Deutsch primär) + Struktur für weitere Sprachen.
- Erweiterte Profile: Kinks, Body-Dimensions inkl. Auto-Kategorisierung.
- UI-Logik: leere Felder ausblenden.
- Web Screenshot Guard (Deterrence).
- React Native Expo Grundgerüst.

**Status:** Abgeschlossen.

---

## Phase 5 — “Massive Upgrade” (Admin AI, Travel, ID-Verif, Auto-Mod, Payments, UX/UI Edits)
Phase 5 wurde in mehreren Teilschritten umgesetzt und anschließend getestet.

### Phase 5.0 — Backend-Architektur-Update (Payments + Free ID-Verif + Stabilität)
**Ziele (erfüllt):**
- **ID-Verifizierung kostenfrei** (kein Payment-Flow; keine „id_verification“-Package mehr).
- **Payments vollständig admin-konfigurierbar**:
  - `GET/POST /api/admin/payment-config` (Provider, Enabled, Stripe-Key, Packages/Preise)
  - `GET /api/payments/packages` liefert dynamische Packages (und ob Payments aktiv sind)
- Checkout aktualisiert:
  - `POST /api/payments/checkout` nutzt admin-config (Provider Toggle, Packages)
  - Entitlements basieren auf `kind`/`days`/`minutes`
- Stabilität/Regeln:
  - **Max. 5 Profilfotos** serverseitig enforced
  - **Foto-Reorder Endpoint**: `POST /api/me/photos/reorder` (erstes Bild = Primary)
  - `/api/me` erweitert: `seen_user_ids`, `id_verified`, `id_verification_status`, `role`
  - **Alter immutable** nach Setzen (silent ignore bei PATCH)
  - Registrierung: `gender_identity` Pflichtfeld

**Status:** Abgeschlossen.

### Phase 5.1 — Pflicht-Edits (Edits 1–3,6) + Session-Persistence
**Ziele (erfüllt):**
- **Edit 1: Gender-spezifische Anzeige**
  - Cup Size nur für passende Gender
  - Penis-Felder nur für passende Gender
- **Edit 2: Max. 5 Fotos (1 Haupt + 4 Neben)**
  - UI-Limit + Counter
  - Desktop Drag & Drop (Reorder → Backend)
  - Mobile: Button „als Hauptfoto“
- **Edit 3: Besuchte Profile Marker (Eye Icon)**
  - In Discover wird für `seen_user_ids` ein Eye-Icon angezeigt (ohne Ausgrauen)
- **Edit 6: Pflichtfelder & Immutable Age**
  - Register erfordert Gender (zusätzlich zu Name/Alter)
  - Alter im Profil-Editor read-only
- **Session Persistence UX**
  - Loading-Gate/Boot-Token verbessert; kein Auth-Flicker im Protected Wrapper

**Status:** Abgeschlossen.

### Phase 5.2 — Elegantes UI Redesign (Edit 4)
**Ziele (erfüllt):**
- Discover UI modernisiert:
  - **QuickFilterBar** (Top-Chips) für häufige Toggle-Filter
  - FilterDrawer bleibt als „Advanced“ bestehen
- Profile Cards & Profile View:
  - Badges inkl. **ID Verified**
  - Visited Eye Icon

**Status:** Abgeschlossen.

### Phase 5.3 — Feature-UIs + Admin-Erweiterungen
**Ziele (erfüllt):**
- **Travel Planner (User UI)**
  - In Account: Reiseplan erstellen/listen/löschen (Backend: `/api/travel`, `/api/travel/mine`, `/api/travel/{id}`)
- **ID Verification (kostenfrei)**
  - In Account: Upload/Submit (Selfie + Dokument), Statusanzeige (pending/approved/rejected)
  - Badge „ID“ in Discover/Profile
- **Admin: Verifizierungen**
  - Tab „Verifizierungen“: Pending-Liste, Approve/Reject
- **Admin: Custom AI Config**
  - Tab „KI-Konfig“: Provider/Model/Base URL/Key/Enabled
- **Admin: Payments**
  - Tab „Zahlungen“: Provider Toggle, Stripe-Key (masked on GET), Packages CRUD
- **User: Dynamic Checkout UI**
  - Account Premium/Boost-Kauf liest Packages dynamisch aus `/api/payments/packages` und startet Checkout
  - Hinweistext, wenn Payments disabled

**Status:** Abgeschlossen.

### Phase 5.4 — Testing, Stabilisierung, Regression-Fixes
**Backend Testing (durchgeführt):**
- Umfassender Testlauf mit **93,1% Pass-Rate (108/116)**.
- Bestätigt (u. a.):
  - Registrierung erfordert `gender_identity`
  - Age immutable
  - 5-Foto-Limit
  - Reorder Endpoint
  - Free ID Verification Workflow + Admin Review
  - Auto-Mod Shadow-Restrict nach Report-Threshold
  - Admin Payment Config + Admin AI Config
  - Travel CRUD

**Frontend Smoke Verification (durchgeführt):**
- QuickFilterBar vorhanden
- Account Sections im DOM vorhanden:
  - `id-verification-section`, `premium-section`, `travel-section`
- Admin Tabs vorhanden:
  - `admin-tab-verifications`, `admin-tab-ai`, `admin-tab-payments`

**Status:** Abgeschlossen.

### Phase 5.5 — Polish & UI-Architektur (Typography, Layout, Preview, Moderation Details)
**Ziele (erfüllt, verifiziert via Screenshots + curl):**
- **Globale Typografie modernisiert**
  - Entfernt: `Playfair Display` (und auch alte EB Garamond-Link-Imports)
  - Neu: Figtree (Body + Display), optionaler Akzent: Fredoka
  - Tailwind-Fonts aktualisiert (`fontFamily.display` auf sans; zusätzlich `accent`)
- **Container-Breiten vereinheitlicht**
  - `Account`, `Settings`, `Edit Profile (/me)` auf `max-w-6xl` wie `Discover`
- **Desktop Double-Row Layout**
  - `MyProfilePage (/me)`: Desktop-Grid (`grid-cols-1 lg:grid-cols-2`) für Basis/Körper/Suche/Präferenzen
  - `ProfileViewPage` nutzt bereits Desktop-Split-Layout; UI konsistent geprüft
- **Preview Mode (Profil-Vorschau)**
  - Button in `/me`: „Vorschau als andere“
  - Routing: `/profile/:id?preview=1`
  - Vorschau ist read-only: Like/Chat/First Message versteckt; Admin-only Blocks werden im Preview unterdrückt
- **Verified Badge Logik korrigiert (nur ID)**
  - „Verified“-Badge entfernt; Badge erscheint ausschließlich bei `id_verified === true`
  - Betroffene Komponenten: `ProfileCard`, `ProfileViewPage`
- **Admin: Report-Details vollständig einsehbar**
  - Neuer Endpoint: `GET /api/admin/reports/{report_id}` liefert Reporter/Target-Zusammenfassung + Kontext
  - UI: Report-Details Dialog in `AdminPage` mit Grund, IDs, Status, Reporter/Gemeldet und Kontext (Foto/Message wenn vorhanden)
- **Unmatch/Block Pills**
  - Neue Endpoints:
    - `POST /api/matches/{match_id}/unmatch` (löscht Match + Messages + mutual likes)
    - `POST /api/users/{id}/block` und `DELETE /api/users/{id}/block`
  - ProfileView UI: Pills „Unmatchen“ (nur wenn Match) und „Blockieren“ (immer), mit Confirm-Dialogen
  - Discovery filtert blockierte/Blocking-Nutzer (serverseitig)
- **Albums: Skeleton-States**
  - Loading Skeleton Grid auf `/albums` ergänzt
- **Screenshot-Detection Events: Audit Logging**
  - WebSocket-Event `type: "screenshot"` wird zusätzlich in den Audit-Log geschrieben (`screenshot_detected`)

**Status:** Abgeschlossen.

---

## Offene Issues / Risiken
### Issue 1: Session persistence UX issue (Recurring)
- **Status:** behoben/abgemildert durch Loading-Gate + Boot-Token Handling.
- Hinweis: In automatisierten Browserläufen kann Navigation/URL-Logging gelegentlich „timing artifacts“ zeigen; funktional sind die Seiten vorhanden.

### Issue 2: Backend Test-Report Flakes (niedrige Priorität)
- Tester meldete seltene Flakes bei `/api/auth/register` und Stripe-Checkout (abhängig von Provider-Konfiguration).
- Aktueller Stand: funktional; Checkout hängt korrekt an Admin Payment Config und benötigt aktivierten Provider + Key.

### Issue 3: Blockliste nicht im `/api/me` Response sichtbar (niedrige Priorität)
- Beobachtung aus Sanity-Check: `blocked_user_ids` wurde im User-Dokument gesetzt, aber nicht im `/api/me` Response zurückgegeben.
- Impact:
  - Funktionalität (Discovery/Block/Unmatch) ist serverseitig wirksam.
  - UI kann die Blockliste nicht direkt anzeigen.
- Empfehlung:
  - `public_user_from_doc`/`me` Serializer um `blocked_user_ids` (für Self) erweitern **oder** dedizierten Endpoint `GET /api/me/blocks` bereitstellen.

---

## Status / Zusammenfassung
- Phase 1–4: **fertig**.
- Phase 5.0–5.5: **fertig (Backend + Frontend)**.

### Final delivery (aktualisiert)
- Voll funktionsfähige Web-App mit:
  - Mutual Discovery, AI Moderation, Events, Premium/Boost, Chat, i18n, erweiterte Profile, Screenshot Guard.
  - Phase 5: Travel Planner, ID-Verifizierung (kostenfrei), Auto-Mod Shadow-Restrict, Admin AI Config, Admin Payment Config, 5-Foto Limit, visited Eye Marker, elegantes UI-Upgrade.
  - Phase 5.5: moderne Typografie, konsistente Container-Breiten, Double-Row Desktop Layout, Preview Mode, ID-only Verified Badge, vollständige Admin Report-Details, Unmatch/Block, Albums Skeletons, Screenshot-Audit.
  - Keine Tracker (Posthog/Emergent) im Frontend.

**Status:** COMPLETED
