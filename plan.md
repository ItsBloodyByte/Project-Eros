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
**Ziel (erfüllt):** Erste, relativ isolierte Module extrahieren, ohne zentrale Auth-/Discover-/Payment-Teile anzufassen.

**Umsetzung (Delivered):**
- Neue Dateien:
  - `/app/backend/routers/__init__.py` (Dokumentation des Patterns)
  - `/app/backend/routers/legal.py`
  - `/app/backend/routers/blog.py`
  - `/app/backend/routers/couples.py`
- `server.py`:
  - Entfernt: alle Handler für `/legal`, `/blog`, `/couples`, `PATCH /me/persona-b`.
  - Behalten: alle Helpers und Start-up Seeding (`_ensure_default_legal_pages`, Blog Helpers, Persona-B Helpers, Chat/Couple Helpers, etc.).
  - Added: late imports am Ende:
    - `from routers import legal as _legal_routes`
    - `from routers import blog as _blog_routes`
    - `from routers import couples as _couples_routes`

**Messbarer Fortschritt:**
- `server.py` reduziert von **6432** auf **6011** Zeilen (**-421 LOC**, ~6.5%).

**Testing / Abnahme:**
- `testing_agent` Report: `/app/test_reports/iteration_10.json`
  - **20/21 Kern-Tests bestanden**, **keine Regressionen**.
  - Einziges Flaky: `/auth/login` gelegentlich 429 bei sehr schnellen Test-Requests (Test-Umgebung / Rate-Limit; kein Product-Bug).

**Status:** Abgeschlossen.

### Phase 11.2 — Refactor Schritt 2 (Next): Mid-Risk Module (Payments + Admin)
**Ziel:** Große, aber klar abgegrenzte Bereiche extrahieren, ohne Discover/Me-Core anzufassen.

**Vorgehen (geplant):**
- Neue Router:
  - `/app/backend/routers/payments.py` (Checkout, Provider config endpoints)
  - `/app/backend/routers/webhooks.py` (Stripe/PayPal/Klarna Webhooks; Idempotenz)
  - `/app/backend/routers/admin.py` (Moderation, User-Management, Payment-Transactions Viewer)
- Testen:
  - Regression-Tests (ähnlich iteration_10), Fokus: Webhooks Idempotenz, Admin Auth/RBAC, Provider UI endpoints.

**Status:** Offen (Next).

### Phase 11.3 — Refactor Schritt 3 (Later): High-Frequency Core (Me + Discover + Chat)
**Ziel:** Die am häufigsten genutzten und fehleranfälligsten Routen entkoppeln, nachdem Schritt 2 stabil ist.

**Vorgehen (geplant):**
- Neue Router:
  - `/app/backend/routers/me.py` (Profilupdates, Preferences, Privacy, Photos, Videos)
  - `/app/backend/routers/discover.py` (Sortierung inkl. Boost-Fix, bidirektionale Filter)
  - `/app/backend/routers/matches_chat.py` (Matches, Messages, WS)
- Testen:
  - Extra Augenmerk: Boost-Sortierung (Boosted zuerst, separater Query), Geo `$near` + Pagination.
  - E2E: Login → /me → /discover → Like/Match → Chat.

**Status:** Offen.

---

## Offene Issues / Risiken
### Issue 1: Session persistence UX issue (Recurring)
- Status: behoben/abgemildert.

### Issue 2: Backend Test-Report Flakes (niedrige Priorität)
- Status: funktional; Provider abhängig von Credentials.

### Issue 3: Blockliste nicht im `/api/me` Response sichtbar (niedrige Priorität)
- Empfehlung: `/api/me` Serializer um `blocked_user_ids` erweitern oder `GET /api/me/blocks`.

### Issue 4: `server.py` Monolith (historisch ~6400+ Zeilen)
- Status: **In Arbeit** → siehe Phase 11 (Schritt 1 abgeschlossen).

### Issue 5: Range-Slider Handle fehlt (Web)
- Status: **Behoben** in Phase 9.1.

---

## Nächste Schritte (Upcoming Tasks)
### Task 1 (P1): Mobile: Report-Flows
**Ziel:** Nutzer:innen können Profil/Foto/Nachricht aus der Mobile App melden.

**Status:** Offen.

### Task 2 (P1): Payments – Admin-Konfig & Production Hardening
**Ziel:** Payment Provider Credentials & Webhooks sauber produktionsreif betreiben.

**Status:** Offen.

### Task 3 (P1/P2): Backend Refactoring — `server.py` in Router splitten
**Ziel:** Wartbarkeit massiv verbessern ohne Feature-Regressions.

**Status:** In Arbeit (Phase 11.1 fertig; Phase 11.2/11.3 offen).

### Task 4 (P2): Mobile Voll-Parität — Restliche Iterationen
- Iteration 4: Broadcast Inbox + Notifications + Settings Parität
- Iteration 5: Reports (User Side) + Moderation Entry Points
- Iteration 6: Optional Admin Panel Mobile

---

## Status / Zusammenfassung
- Phase 1–4: **fertig**.
- Phase 5.0–5.6: **fertig (Backend + Frontend)** inkl. Broadcast-System.
- Phase 6.0–6.4: **fertig**.
- Phase 7.0–7.4: **fertig**.
- Phase 8.1–8.4: **fertig**.
- Phase 9: **fertig**.
- Phase 10: **fertig**.
- Phase 11.1: **fertig** (Legal/Blog/Couples Router-Split; iteration_10 Regression ok).

### Final delivery (aktualisiert)
- Web-App: produktionsnah, modern, inklusiv, Payments (Stripe/PayPal/Klarna), Couples (Linked + Duo), Boost, Admin/Moderation, Blog/Events/Albums, GDPR.
- Mobile App:
  - Iteration 1–3: **abgeschlossen**.
  - Nächster Block: Reports (P1) + Broadcast Inbox/Notifications.
- Backend Refactor:
  - Schritt 1 (Legal/Blog/Couples): **abgeschlossen**.
  - Schritt 2 (Payments/Admin): **als nächstes**.
  - Schritt 3 (Me/Discover/Chat): **später**.

**Gesamtstatus:** Web **COMPLETED**. Mobile: Iteration 1–3 **COMPLETED**. Backend Refactor: **IN PROGRESS** (Step 1 done).