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
| Next.js + RN | React (Web) — web-first MVP + Expo/React-Native für Mobile |
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
10. **Partner-Profile (Couples):**
   - **Linked Couple (2 Logins):** Zwei Accounts werden nach gegenseitiger Bestätigung als Paar-Identität angezeigt; jeder behält seine Login-Daten.
   - **Duo Account (1 Login):** Registrierung als Paar-Profil mit Person A + Person B (`persona_b`) im selben Konto.
   - **Chat Identität pro Nachricht:** Wenn A schreibt, erscheint A; wenn B schreibt, erscheint B (shared inbox).

> **Update 2026-05:** Screenshot-Schutz wurde bewusst entfernt (siehe Phase 12.1). Privacy Controls umfassen weiterhin Hidden/Stealth, Online-Status, Read-Receipts etc.

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

## Phase 3 (Roadmap add-ons)
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
- Expo Scaffold vorhanden (`/app/mobile`).

**Status:** Abgeschlossen.

---

## Phase 4 — Multi-language, Extended Profiles, Mobile Scaffold
### Delivered
- `react-i18next` (Deutsch primär) + Struktur für weitere Sprachen.
- Erweiterte Profile: Kinks, Body-Dimensions inkl. Auto-Kategorisierung.
- UI-Logik: leere Felder ausblenden (bis Phase 7.0 für bestimmte Sektionen angepasst).
- Web Screenshot Guard (Deterrence).
- React Native Expo Grundgerüst.

**Status:** Abgeschlossen.

---

## Phase 5 — “Massive Upgrade” (Admin AI, Travel, ID-Verif, Auto-Mod, Payments, UX/UI Edits)
Phase 5 wurde in mehreren Teilschritten umgesetzt und anschließend getestet.

### Phase 5.0 — Backend-Architektur-Update (Payments + Free ID-Verif + Stabilität)
**Ziele (erfüllt):**
- **ID-Verifizierung kostenfrei** (kein Payment-Flow; keine „id_verification“-Package mehr).
- **Payments vollständig admin-konfigurierbar** (Payment-Config Endpoints + dynamische Packages).
- Stabilität/Regeln: max 5 Profilfotos enforced, Reorder Endpoint, `/api/me` erweitert, Alter immutable, Registrierung: gender_identity Pflicht.

**Status:** Abgeschlossen.

### Phase 5.1 — Pflicht-Edits (Edits 1–3,6) + Session-Persistence
**Ziele (erfüllt):**
- Gender-spezifische Anzeige für Cup/Penis.
- Max. 5 Fotos + Reorder UI.
- Visited Marker.
- Pflichtfelder & Immutable Age.
- Session Persistence UX verbessert.

**Status:** Abgeschlossen.

### Phase 5.2 — Elegantes UI Redesign (Edit 4)
**Ziele (erfüllt):**
- QuickFilterBar + modernes Discover.
- Profile Cards/View modernisiert.

**Status:** Abgeschlossen.

### Phase 5.3 — Feature-UIs + Admin-Erweiterungen
**Ziele (erfüllt):**
- Travel Planner, ID Verification UI + Admin Review, Admin AI Config, Admin Payments.

**Status:** Abgeschlossen.

### Phase 5.4 — Testing, Stabilisierung, Regression-Fixes
**Ziele (erfüllt):**
- 93.1% Passrate im Backend-Testlauf, Frontend Smoke Verifikation.

**Status:** Abgeschlossen.

### Phase 5.5 — Polish & UI-Architektur (Typography, Layout, Preview, Moderation Details)
**Ziele (erfüllt):**
- Typografie (Figtree), max-w-6xl, Desktop-Grid, Preview Mode, ID-only Verified Badge.
- Admin Report Details Dialog + Kontext.
- Unmatch/Block.
- Screenshot-Audit.

**Status:** Abgeschlossen.

### Phase 5.6 — Moderations- & Broadcast-System (Broadcasts, Segmente, Admin Notifications)
**Ziele (erfüllt):**
- Admin WS Notifications.
- Report Kontext/Locks/Retention.
- Minor Block + IP flagging.
- Signed Broadcasts als read-only Chats + segmentierte Broadcasts inkl. Live-Preview UI.

**Status:** Abgeschlossen.

---

## Phase 6 — Moderation UX Add-ons, City Display, Team Badge Tooltips, Bulk Actions, Premium/Promos, Blog
Diese Phase bündelt die nach Phase 5.6 gewünschten Erweiterungen.

### Phase 6.0 — Profil: Stadt anzeigen
**Status:** Abgeschlossen.

### Phase 6.1 — Team-Badges mit Tooltip-Erklärung
**Status:** Abgeschlossen.

### Phase 6.2 — Bulk-User-Actions im Admin-Discover-Grid (Task 2 / P2)
**Status:** Abgeschlossen.

### Phase 6.3 — Promo-System + Premium-Erweiterungen
**Status:** Abgeschlossen.

### Phase 6.4 — Blog (TipTap) mit Admin-Editor
**Status:** Abgeschlossen.

---

## Phase 7 — Partner-Profile (Couples) + Always-Visible Sections
Diese Phase implementiert Paar-Profile in zwei Modi sowie konsistente Profilsektionen.

### Phase 7.0 — „Körper & Life-Style“ + „Kinks“ immer sichtbar
**Ziel (erfüllt):**
- Die Kategorien **„Körper & Life-Style“** und **„Kinks“** sollen **immer** sichtbar sein, auch wenn keine Filter gesetzt sind oder keine Angaben vorliegen.

**Umsetzung (Delivered):**
- Frontend: neue `PersonDetails` Komponente rendert beide Sektionen immer; Fallback-Text **„Keine Angaben“**.
- ProfileViewPage: ersetzt die bisherige „nur wenn vorhanden“-Logik.

**Status:** Abgeschlossen.

### Phase 7.1 — Duo Account (Single-Login Paarprofil)
**Status:** Abgeschlossen.

### Phase 7.2 — Linked Couple (Two-Login Paarprofil mit Bestätigung)
**Status:** Abgeschlossen.

### Phase 7.3 — Chat: Sender-Identität pro Nachricht (Couple-aware Chats)
**Status:** Abgeschlossen.

### Phase 7.4 — Persona-B Editor (Duo Account) (P2)
**Status:** Abgeschlossen.

---

## Phase 8 — Produktion/Deployment, Legal Pages, Payments (PayPal/Klarna) & Mobile Iteration 2
Diese Phase bündelt die zuletzt umgesetzten produktionsnahen Arbeiten (Docker/Synology, Auto-Updater, Legal, Payment UI) und den Mobile-Paritätsschritt.

### Phase 8.1 — Robuster Docker-Compose Prod-Setup (Synology)
**Status:** Abgeschlossen.

### Phase 8.2 — Legal Pages: Default-Inhalte, Seeding, UI-Verifikation
**Status:** Abgeschlossen.

### Phase 8.3 — Payments: PayPal/Klarna Frontend-Integration + Klarna Finalisierung
**Status:** Abgeschlossen (funktional).

### Phase 8.4 — Mobile: Feature-Parität erweitern (Iteration 2 — Additive Screens)
**Status:** Abgeschlossen.

---

## Phase 9 — UX-Fixes + Conditional Filters + Mobile Parität (NSFW / Gay Position)
Diese Phase bündelt drei zusammenhängende Produktpunkte:
1) **UX-Bugfix** für Range-Slider (fehlender zweiter Griff).
2) **Kontextabhängige Filterfelder** nach Zielgruppe/Orientierung (z. B. Cup-Size bei Gay-/Männer-only-Searching ausblenden).
3) **Mobile Parität**: neue Profilfelder (NSFW-Präferenz & Gay Position) und passende Discover-Filter im React Native Client.

### Phase 9.1 — Web: Slider-Bugfix (Range-Thumb)
**Status:** Abgeschlossen.

### Phase 9.2 — Web: Conditional Filterfelder nach Seeking/Orientierung
**Status:** Abgeschlossen.

### Phase 9.3 — Web: NSFW Hide-Toggle + Gay-Position Filter
**Status:** Abgeschlossen.

### Phase 9.4 — Mobile: Shared Demographic Helper + Profilbearbeitung
**Status:** Abgeschlossen.

### Phase 9.5 — Mobile: DiscoverFilterDrawer + DiscoverScreen
**Status:** Abgeschlossen.

### Phase 9.6 — Testing / Abnahme
**Status:** Abgeschlossen.

---

## Phase 10 — Mobile Iteration 3 Abschluss: Foto-Upload UX + Persona‑B Parität + Stealth + Video Upload
Diese Phase schließt die noch offenen Punkte aus „Iteration 3“ ab. Ein Scope-Check hat gezeigt, dass Teile bereits existierten; fehlende Parität wurde nachgezogen.

### Phase 10.1 — Stealth Toggle (Mobile)
**Status:** Bereits vorhanden.

### Phase 10.2 — Video Upload (Mobile)
**Status:** Bereits vorhanden.

### Phase 10.3 — Foto-Upload (Mobile) — Moderation Feedback + Thumbnails
**Status:** Abgeschlossen.

### Phase 10.4 — Persona‑B Editing (Mobile) — Feature-Parität zum Web
**Status:** Abgeschlossen.

### Phase 10.5 — Testing / Abnahme
**Status:** Abgeschlossen.

---

## Phase 11 — Backend Refactoring: `server.py` Monolith → Router-Split (Stepwise)
**Problem:** `server.py` war/ist ein Monolith (vor Refactor ~6432 LOC). Das erhöht Wartungsaufwand und macht Änderungen riskanter.

**Refactor-Prinzip (Low-Risk):**
- **Late-Binding-Pattern:**
  - Router-Module in `/app/backend/routers/*.py` importieren `api_router` + benötigte Helpers/Deps aus `server.py` und registrieren ihre Routen via `@api_router.<verb>`.
  - `server.py` importiert diese Module **ganz am Ende** (unmittelbar vor `app.include_router(api_router)`), nachdem alle Helpers deklariert sind.
- Dadurch: **kein API-Contract-Change**, minimaler Bewegungsradius, schnelle Regressionstests möglich.

### Phase 11.1 — Refactor Schritt 1 (Delivered): Legal + Blog + Couples
**Status:** Abgeschlossen.

### Phase 11.2 — Refactor Schritt 2 (Delivered): Payments + Webhooks + Admin
**Umsetzung (Delivered):**
- Neue Router:
  - `/app/backend/routers/payments.py` (Checkout + Provider-Flows)
  - `/app/backend/routers/webhooks.py` (Stripe/PayPal/Klarna Webhooks, weiterhin auf root `app` gemountet)
  - `/app/backend/routers/admin.py` (52 Admin-Endpunkte)
- Regression: `iteration_11.json` **100% pass**.

**Status:** Abgeschlossen.

### Phase 11.3 — Refactor Schritt 3 (Delivered): High-Frequency Core (Me + Discover + Chat)
**Umsetzung (Delivered):**
- Neue Router:
  - `/app/backend/routers/me.py`
  - `/app/backend/routers/discover.py` (Boost-Fix bleibt erhalten: separate boosted query vor `$near`)
  - `/app/backend/routers/matches_chat.py`
- Regression: `iteration_12.json` **31/32 pass** (ein 403 war erwartetes RBAC-Verhalten, keine Regression).

**Messbarer Fortschritt:**
- `server.py` reduziert von **6432** → **3336** LOC (**-48%**).
- Router-Module gesamt: 9 (`legal`, `blog`, `couples`, `payments`, `webhooks`, `admin`, `me`, `discover`, `matches_chat`).

**Status:** Abgeschlossen.

---

## Phase 12 — Quick-Wins / Policy Updates (Security/UX)
Diese Phase bündelt kleinere, aber produktrelevante Änderungen.

### Phase 12.1 — Screenshot-Schutz entfernen
**Entscheidung:** Screenshot-Abschreckung/Indikatoren entfernen.

**Umsetzung (Delivered):**
- Web:
  - `frontend/src/lib/screenshotGuard.js` → No-op
  - `frontend/src/index.css` → `.no-capture` no-op + Print-Block entfernt
  - `SettingsPage` Screenshot-Option entfernt
  - `ChatPage` Screenshot-WS Toast entfernt
- Mobile:
  - Screenshot-Option aus `SettingsScreen` entfernt
- Backend:
  - WS Event `type="screenshot"` wird akzeptiert und gedroppt (legacy clients) statt broadcast/audit.

**Status:** Abgeschlossen.

### Phase 12.2 — Profil-Erstellungsdatum öffentlich + „Neu“-Badge (7 Tage)
**Umsetzung (Delivered):**
- Backend:
  - `helpers.public_user_from_doc` liefert jetzt `created_at` + `is_new` (computed, 7 Tage).
- Web:
  - `ProfileViewPage` zeigt „Mitglied seit <Monat Jahr>“ + Neu-Badge.
  - `ProfileCard` im Discover zeigt Neu-Badge.

**Status:** Abgeschlossen.

### Phase 12.3 — ID-Verifikation: Dokument-Zerstörung nach Review
**Ziel:** Sobald ein Reviewer eine Verifikation (approved/rejected) entscheidet, müssen Selfie + Dokumentdaten umgehend zerstört werden.

**Umsetzung (Delivered):**
- Admin Review Endpoint setzt bei `approved` **und** `rejected`:
  - `selfie_data_url=None`, `document_data_url=None`
  - `document_destroyed_at`, `document_destroyed_by`
- Admin Listing filtert defensiv: wenn `document_destroyed_at` gesetzt, werden Bildfelder nie wieder ausgeliefert.

**Status:** Abgeschlossen.

---

## Phase 13 — Honey-Pot Profiles + Shadow-Bans (Anti-Bot)
Ziel: Bot-/Scraper-Aktivitäten aktiv abfangen, ohne echte User zu beeinträchtigen.

### Phase 13.1 — Honey-Pot Subsystem (Backend)
**Umsetzung (Delivered):**
- Neues Modul: `/app/backend/honeypot.py`:
  - `visibility_filter_for(viewer)` → Mongo query fragment (versteckt honeypots + shadow-banned)
  - `trigger_honeypot(db, viewer, target, action, meta)` → idempotenter Shadow-Ban
  - `record_honeypot_flag` → `moderation_flags` Eintrag `kind="honeypot_trigger"`
- Discover:
  - `/discover` nutzt `_hp_filter(user)` → Honey-Pots (und Shadow-Banned) für Non-Staff unsichtbar.
- Trigger-Hooks:
  - `GET /users/{id}`: View eines Honey-Pots shadow-banned den Viewer (ohne UX-Feedback).
  - `POST /likes`: Like auf Honey-Pot → shadow-ban + Return success (no-op).
  - `POST /messages`: Message an Honey-Pot (Match-Gegenstück) → shadow-ban + synthetische success response (keine Zustellung).

**Status:** Abgeschlossen.

### Phase 13.2 — Admin API (Backend)
**Umsetzung (Delivered):**
- `/admin/honeypots`:
  - `GET` list
  - `POST` create
  - `DELETE /{hp_id}`
- `/admin/shadow-banned`:
  - `GET` list (filterable by reason)
  - `POST /admin/shadow-ban/{user_id}` manual shadow ban
  - `POST /admin/shadow-unban/{user_id}` lift

**Status:** Abgeschlossen.

### Phase 13.3 — Admin UI (Web)
**Umsetzung (Delivered):**
- `AdminNav` neuer Eintrag **Honey-Pots**.
- Neue Komponente: `frontend/src/components/AdminHoneypotsTab.js`:
  - Tabs: Fallen / Geblockte Bots
  - Create/Delete Trap (superadmin)
  - Unban + optional Hard-Ban (superadmin)

**E2E-Verifikation:**
- Admin erstellt Honeypot → normaler User view triggert Shadow-Ban → Admin sieht Trigger-Trail → Honeypot taucht nicht in Discover auf → Cleanup erfolgreich.

**Status:** Abgeschlossen.

---

## Offene Issues / Risiken
### Issue 1: Session persistence UX issue (Recurring)
- Status: behoben/abgemildert.

### Issue 2: Backend Test-Report Flakes (niedrige Priorität)
- Status: funktional; Provider abhängig von Credentials.

### Issue 3: Blockliste nicht im `/api/me` Response sichtbar (niedrige Priorität)
- Empfehlung: `/api/me` Serializer um `blocked_user_ids` erweitern oder `GET /api/me/blocks`.

### Issue 4: Payments Production Hardening (P1)
- Status: **in Arbeit / teilweise pausiert** (Refactor und Feature-Backlog hatten Priorität).
- Hinweis: Hardening-Änderungen (Rate-Limits, Audit, Anti-Tampering) wurden teilweise begonnen, aber nicht vollständig abgeschlossen.

---

## Nächste Schritte (Upcoming Tasks)
### Task 1 (P1): Mobile: Report-Flows
**Ziel:** Nutzer:innen können Profil/Foto/Nachricht aus der Mobile App melden.

**Status:** Offen.

### Task 2 (P1): Payments – Admin-Konfig & Production Hardening
**Ziel:** Payment Provider Credentials & Webhooks sauber produktionsreif betreiben.

**Empfohlene Restarbeiten:**
- Webhook Rate-Limits + Strict-Mode Warnings in Admin UI
- Stale-Transaction Cleanup (`initiated` → `expired`) + Admin Job/Endpoint
- Mehr Provider-Key Slots + Rotation-Prozess

**Status:** Offen / in Bearbeitung.

### Task 3 (P1): Album mutual-Freigabe (neu)
**Ziel:** Album wird nur freigegeben, wenn beide Chat-Partner freigeben; Freigabe endet automatisch, wenn eine Seite stoppt.

**Status:** Offen.

### Task 4 (P1): Pic4Pic (neu)
**Ziel:** Sicherer Bildtausch: A sendet Pic; erst wenn B ein gültiges Pic sendet, werden beide Bilder ausgetauscht. Ungültige/fehlende Antwort → kein Austausch.

**Status:** Offen.

### Task 5 (P1/P2): AI optional + Multi-Provider + optionale Reviews (neu)
**Ziel:** Admin kann KI komplett deaktivieren; mehrere Provider-Keys verwalten; Reviews optional über Moderation laufen.

**Status:** Offen.

### Task 6 (P1/P2): Custom Landing Page für Gäste (neu)
**Ziel:** Für nicht eingeloggte User eine admin-konfigurierbare Landingpage (Blogposts, Hero, CTAs, Sections).

**Status:** Offen.

### Task 7 (P2): Performance Sweep
**Ziel:** UX „live“: Interaktionen ohne spürbare Verzögerung, geringe Ladezeiten.

**Status:** Offen.

### Task 8 (P2): Mobile Voll-Parität — Restliche Iterationen
- Iteration 4: Broadcast Inbox + Notifications + Settings Parität
- Iteration 5: Reports (User Side) + Moderation Entry Points
- Iteration 6: Optional Admin Panel Mobile

**Status:** Offen.

---

## Status / Zusammenfassung
- Phase 1–4: **fertig**.
- Phase 5.0–5.6: **fertig (Backend + Frontend)** inkl. Broadcast-System.
- Phase 6.0–6.4: **fertig**.
- Phase 7.0–7.4: **fertig**.
- Phase 8.1–8.4: **fertig**.
- Phase 9: **fertig**.
- Phase 10: **fertig**.
- Phase 11.1–11.3: **fertig** (Monolith-Router-Split; server.py 6432→3336 LOC).
- Phase 12.1–12.3: **fertig** (Screenshot-Schutz entfernt, Neu-Badge, ID-Doc hard-delete).
- Phase 13.1–13.3: **fertig** (Honey-Pots + Shadow-Bans + Admin UI).

**Gesamtstatus:** Web **COMPLETED** (mit neuem Anti-Bot System). Mobile: Iteration 1–3 **COMPLETED**. Backend Refactor: **COMPLETED** (Router-Split). 

**Aktuelle Priorität (gemäß Roadmap):** #4 AI optional → #2 Album mutual → #1 Pic4Pic → #6 Landing → #8 Performance, plus **Task 2 Payments Production Hardening** abschließen.
