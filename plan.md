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
| NudeNet/DeepFace | Gemini Vision via Emergent LLM Key (provider-agnostisch via Admin konfigurierbar) |
| Argon2id | bcrypt |

## Key Differentiators (MUST HAVE)
1. **Bidirektionales Matching/Filtern (Alice-Werner-Prinzip):** Alice sieht Werner nur, wenn (a) Werners Alter ∈ Alices Range UND Alices Alter ∈ Werners Range, und (b) gegenseitige Gender/Seeking-Kriterien passen.
2. **Gallery Discovery** — Grid, **kein** Swipe.
3. **AI Bildmoderation** — NSFW-Score + Face-Detection → Auto-Blur >0.75 mit 18+ Override; Face-Only Filter möglich.
4. **Gerundete Distanz** — keine exakten GPS-Daten (5km Buckets).
5. **Chat nur nach Match** (mit Premium-Option „First Message“).
6. **Alben** mit selektivem Sharing + Unlock Requests.
7. **Admin/Moderation** Panel mit Reports Queue.
8. **Privacy Controls:** Read Receipts, Online-Status, Hidden Mode.
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
- Photos: Base64 Upload → Moderation → `nsfw_score`, `has_face`, Kategorien.
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
  - `/` (**Gast-Landing**) — siehe Phase 14
  - `/discover` (Discover Grid)
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
- Premium Tier (legacy, intern): Upgrade/Status/Cancel.
  - Premium unlocks (legacy): Likes received, First Message, Boost.
- Events: Create/List/Detail/RSVP.
- Admin Rollen: `admin`, `content_reviewer`, `support` + Rollenverwaltung.
- Account Page zeigt Features + Premium Badge.
- i18n Setup (Deutsch primär).

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
2) **Kontextabhängige Filterfelder** nach Zielgruppe/Orientierung.
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
Diese Phase schließt die noch offenen Punkte aus „Iteration 3“ ab.

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

### Phase 11.1 — Refactor Schritt 1 (Delivered): Legal + Blog + Couples
**Status:** Abgeschlossen.

### Phase 11.2 — Refactor Schritt 2 (Delivered): Payments + Webhooks + Admin
**Umsetzung (Delivered):**
- Neue Router:
  - `/app/backend/routers/payments.py`
  - `/app/backend/routers/webhooks.py`
  - `/app/backend/routers/admin.py`
- Regression: `iteration_11.json` **100% pass**.

**Status:** Abgeschlossen.

### Phase 11.3 — Refactor Schritt 3 (Delivered): High-Frequency Core (Me + Discover + Chat)
**Umsetzung (Delivered):**
- Neue Router:
  - `/app/backend/routers/me.py`
  - `/app/backend/routers/discover.py` (Boost-Fix bleibt erhalten)
  - `/app/backend/routers/matches_chat.py`
- Regression: `iteration_12.json` **31/32 pass** (ein 403 war erwartetes RBAC-Verhalten, keine Regression).

**Messbarer Fortschritt:**
- `server.py` reduziert von **6432** → **3336** LOC (**-48%**).

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

> **Update 2026-05-06:** Rest-Cleanup in `frontend/src/App.js` (Import/Call von `installScreenshotDeterrents`) wurde entfernt. Screenshot-Schutz ist damit vollständig entfernt.

### Phase 12.2 — Profil-Erstellungsdatum öffentlich + „Neu“-Badge (7 Tage)
**Umsetzung (Delivered):**
- Backend: `public_user_from_doc` liefert `created_at` + `is_new` (computed, 7 Tage).
- Web: ProfileViewPage + Discover ProfileCard zeigen Neu-Badge.

**Status:** Abgeschlossen.

### Phase 12.3 — ID-Verifikation: Dokument-Zerstörung nach Review
**Ziel:** Nach `approved/rejected` werden Selfie + Dokumentdaten umgehend zerstört.

**Umsetzung (Delivered):**
- Admin Review Endpoint setzt:
  - `selfie_data_url=None`, `document_data_url=None`
  - `document_destroyed_at`, `document_destroyed_by`

**Status:** Abgeschlossen.

---

## Phase 13 — Honey-Pot Profiles + Shadow-Bans (Anti-Bot)
Ziel: Bot-/Scraper-Aktivitäten aktiv abfangen, ohne echte User zu beeinträchtigen.

### Phase 13.1 — Honey-Pot Subsystem (Backend)
**Umsetzung (Delivered):**
- Neues Modul: `/app/backend/honeypot.py`
- Discover nutzt Honey-Pot Filter.
- Trigger-Hooks (View/Like/Message) shadow-bannen den Viewer bei Honey-Pot Interaktion.

**Status:** Abgeschlossen.

### Phase 13.2 — Admin API (Backend)
**Umsetzung (Delivered):**
- `/admin/honeypots` (GET/POST/DELETE)
- `/admin/shadow-banned` + manual shadow ban/unban

**Status:** Abgeschlossen.

### Phase 13.3 — Admin UI (Web)
**Umsetzung (Delivered):**
- `AdminNav` + `AdminHoneypotsTab` (Fallen/Geblockte Bots; create/delete/unban).

**Status:** Abgeschlossen.

---

## Phase 14 — Continuation (P1): Landing + Routing, Pic4Pic Frontend (Web+Mobile), Payments Hardening, Performance-Sweep
Diese Phase bildet die direkte Fortsetzung aus den letzten Iterationen. Reihenfolge war **sequenziell** gemäß Auswahl **Option D**.

### Phase 14.0 — Meta: Reihenfolge & Qualitätsgate
**Reihenfolge:**
1) Routing Fix + LandingPage finalisieren
2) Pic4Pic Web Frontend
3) Pic4Pic Mobile Frontend
4) Payments Production Hardening Reststücke
5) Performance-Sweep

**Qualitätsgate pro Schritt:**
- Smoke-Test (Web/Mobile wo relevant)
- Keine Regression im Login/Discover/Chat
- Audit/Moderation/Honeypot-Logik bleibt unangetastet

**Status:** Abgeschlossen.

### Phase 14.1 — Routing Fix: Gast-Landing korrekt anbinden + Screenshot-Deterrents endgültig entfernen (Web)
**Status:** Abgeschlossen.

### Phase 14.2 — LandingPage finalisieren (Feature #6)
**Status:** Abgeschlossen.

### Phase 14.3 — Pic4Pic Web Frontend (Feature #1, Web)
**Status:** Abgeschlossen.

### Phase 14.3.1 — Pic4Pic Backend: Moderation-Key & Fail-Open Robustheit
**Status:** Abgeschlossen.

### Phase 14.4 — Pic4Pic Mobile Frontend (Feature #1, Mobile)
**Status:** Abgeschlossen.

### Phase 14.5 — Payments Production Hardening (Reststücke)
**Status:** Abgeschlossen.

### Phase 14.6 — Performance-Sweep (Feature #8)
**Status:** Abgeschlossen.

---

## Phase 14.7 — UX Polish (Desktop) + Mood-System Cleanup
Diese Phase adressiert zwei konkrete UX-Feedback-Punkte aus der Desktop-Version.

### Phase 14.7.1 — Desktop: Name im Profil-Header nicht umbrechen
**Ziel:** Kein ungewollter Zeilenumbruch im Namen (z. B. „Rouv\nen“).

**Umsetzung (Delivered):**
- `frontend/src/pages/ProfileViewPage.js`:
  - `break-words` entfernt.
  - Header-Flex auf `sm:flex-wrap` umgestellt (Badges dürfen umbrechen statt Name).
  - Name-Container auf `flex-1`.
  - Alter/Partner-Alter `whitespace-nowrap`.

**Status:** Abgeschlossen.

### Phase 14.7.2 — Mood-Option „Online“ entfernen (redundant)
**Ziel:** Der auswählbare Status „Online“ soll wegfallen, weil ein generischer Online-Indikator bereits existiert.

**Umsetzung (Delivered):**
- Frontend: `frontend/src/lib/moods.js` entfernt `online` aus `MOOD_KEYS` + `MOODS`.
- Backend: `backend/models.py` entfernt `online` aus Mood Literal.
- Migration: `backend/server.py` One-Time Migration `migration_drop_online_mood_v1` setzt `current_mood="online"` → `None`.

**Status:** Abgeschlossen.

---

## Phase 15 — Freemium & Premium — Monetarisierung (Rework nach Kapitel 15)
Diese Phase überarbeitet das gesamte Premium/Freemium-Konzept gemäß Kapitel 15.

**Wichtige Abweichungen (User Decision):**
- **Filter bleiben für alle User frei** (Free + Premium). Kapitel-15-Punkt „Erweiterte Filter = Premium“ wird **nicht** umgesetzt.
- **Studenten-Verifikation** zunächst **manuell über Admin** (kein SheerID; optional später).

### Phase 15.0 — Leitplanken (Anti-Dark-Pattern) & Definition of Done
**Leitplanken (MUST):**
- Keine Like-Limits.
- Keine Like-Bait Notifications ohne Inhalt.
- Keine Countdown-Timer ohne echte Expiry.
- Kündigung verliert Benefits erst am Periodenende (`subscription_active_until`).
- Keine OS-abhängigen Preise.
- Abo pausierbar (bis 3 Monate).

**Definition of Done:**
- Datenmodell + Migration abgeschlossen.
- Free/Premium Limits serverseitig enforced.
- Sparks-Ledger append-only.
- Premium ist **ein** Tier (VERBINDEN).
- Upgrade/Downgrade/Cancel/Pause flows getestet.

### Phase 15.1 — Datenmodell: Subscriptions + Sparks Ledger (Backend)
**Ziele:**
- Einführung der in Kapitel 15 beschriebenen Kerntabellen (Mongo-Äquivalent):
  - `subscriptions`
  - `sparks_ledger` (append-only)
  - `boosts`
- Migration von Legacy-Feldern (`premium_expires_at`, bestehende payment txns) auf neues Modell.

**Umsetzungsschritte:**
1. Mongo Collections + Indexe:
   - `subscriptions`: `user_id`, `external_subscription_id`, `current_period_end`, `subscription_active_until`, `tier`.
   - `sparks_ledger`: `user_id`, `created_at`, `transaction_type`, `balance_after`.
   - `boosts`: `user_id`, `started_at`, `ends_at`, `source`, `sparks_ledger_id`.
2. Serverseitige Entitlements:
   - `is_premium(user)` wird auf Subscription-Modell umgestellt (Fallback auf legacy während Migration).
3. Migrations:
   - bestehende Premium-Nutzer → `subscriptions.tier=premium` + `subscription_active_until` aus `premium_expires_at`.
   - `current_mood` etc. bleibt unberührt.
4. Admin Controls:
   - Admin Endpoint: Sparks admin_adjustment (audit-logged).

**Status:** Geplant.

### Phase 15.2 — Freemium/Premium Limits + Sparks Earning (Backend)
**Wichtig:** Filter bleiben **frei**.

**Ziele (aus Kapitel 15, angepasst):**
- Free-Limits:
  - Fotos bis 8, Alben bis 2, Medien/Album bis 20, Suchradius bis 50km.
  - Album-Unlock Anfragen: 5/Monat.
  - Werbung: dezent (nur Galerie; nicht Chat) — sofern Ads-System existiert.
- Premium-Limits:
  - Fotos bis 30, Alben bis 15, Medien/Album bis 100, Suchradius bis 300km + Reisemodus.
  - Album-Unlock Anfragen: unbegrenzt.
- Sparks verdienen:
  - Daily login, profile complete, verifications, first match, streaks, confirmed report, quiz, premium monthly bonus.

**Umsetzungsschritte:**
1. Limits in die existierenden Endpoints einziehen:
   - Foto-Upload Limit anheben/abstufen.
   - Album create/add media limits.
   - Unlock Request Quotas (per month) + sparks-overflow Option erst in 15.3.
2. Sparks earning pipeline:
   - `POST /api/me/daily-login` oder serverseitig beim `/api/me` Refresh einmal täglich.
   - Ledger Buchungen + Balance After.
3. Monatlicher Premium-Bonus (+50 Sparks):
   - Cron/Background Task oder bei Periodenwechsel.

**Status:** Geplant.

### Phase 15.3 — Sparks Spending + Premium Features (Backend + UI Hooks)
**Ziele:**
- Sparks ausgeben:
  - Boost (30), Sehr-interessiert-Signal (10), Rewind (5), Album-Unlock-extra (8), Chat-Starter (3), Highlight 24h (15), Premium-Testwoche schenken (80).
- Premium Features:
  - Wer hat mich geliked: Profile sichtbar + sortierbar.
  - Profilbesucher: alle + Zeitstempel.
  - Inkognito-Modus + unsichtbar browsen.
  - 90 Tage Stats.
  - Werbefrei.

**Wichtig:**
- **Erweiterte Filter werden NICHT Premium**.

**Status:** Geplant.

### Phase 15.4 — Pricing + Payment Cycles + Pause (Stripe/Web) + Student Manual Verify
**Ziele:**
- Billing Cycles:
  - monatlich 9,99, halbjährlich 47,94, jährlich 71,88.
  - Studenten (jährlich) via **Admin manual verify**.
  - Duo-Abo (2 Accounts) — Modell/Regeln definieren.
  - Geschenk-Abo (Code/Link) — Einlösungsflow.
- Pause bis 3 Monate.
- Fairness:
  - Reminder Email 7 Tage vorher (wenn Notification/E-Mail infra existiert).
  - Preisgarantie 12 Monate (serverseitig).
  - Prorata-Refund als Sparks bei Ausfall (ops-only initially).

**Status:** Geplant.

### Phase 15.5 — Frontend: Premium Page Rework + Sparks UI + Transparenzseite
**Ziele:**
- Eine Premium-Stufe: **VERBINDEN**.
- Premium Preview/Account UI neu:
  - Vergleichstabelle Free vs Premium (ohne Filter-Paywall).
  - Pause/Resume.
  - Sparks Balance + Ledger Page.
  - Boost UI + Boost Stats.
- Öffentliche `/transparent` Seite.

**Status:** Geplant.

### Phase 15.6 — Anti-Dark-Pattern technische Locks + Tests
**Ziele:**
- Hard-coded Verbote (no like-bait notifications, timer nur bei real expiry, max upsell-notification etc.)
- Unit/Regression Tests für Monetarisierungsregeln.

**Status:** Geplant.

---

## Offene Issues / Risiken
### Issue 1: Session persistence UX issue (Recurring)
- Status: behoben/abgemildert.

### Issue 2: Backend Test-Report Flakes (niedrige Priorität)
- Status: funktional; Provider abhängig von Credentials.

### Issue 3: Blockliste nicht im `/api/me` Response sichtbar (niedrige Priorität)
- Empfehlung: `/api/me` Serializer um `blocked_user_ids` erweitern oder `GET /api/me/blocks`.

### Issue 4: Webhook Strict-Mode
- Status: **Warnung implementiert**, Konfiguration bleibt Betreiberentscheidung.
- Empfehlung: Vor Launch `strict_webhook_verification=true` setzen.

---

## Nächste Schritte (Upcoming Tasks)
### Task 1 (P1): Phase 15.1 starten (Subscriptions + Sparks Ledger + Migration)
**Status:** Offen.

### Task 2 (P1): Phase 15.2 (Limits + Sparks Earning)
**Status:** Offen.

### Task 3 (P1): Phase 15.3 (Sparks Spending + Premium Features)
**Status:** Offen.

### Task 4 (P1): Phase 15.4 (Pricing + Payment Cycles + Pause + Student manual verify)
**Status:** Offen.

### Task 5 (P1): Phase 15.5/15.6 (Frontend Rework + Transparenzseite + Anti-Dark-Pattern Locks)
**Status:** Offen.

---

## Status / Zusammenfassung
- Phase 1–4: **fertig**.
- Phase 5.0–5.6: **fertig (Backend + Frontend)**.
- Phase 6.0–6.4: **fertig**.
- Phase 7.0–7.4: **fertig**.
- Phase 8.1–8.4: **fertig**.
- Phase 9: **fertig**.
- Phase 10: **fertig**.
- Phase 11.1–11.3: **fertig** (Router-Split).
- Phase 12.1–12.3: **fertig** (Screenshot-Schutz entfernt, Neu-Badge, ID-Doc hard delete).
- Phase 13.1–13.3: **fertig** (Honey-Pots + Shadow-Bans + Admin UI).
- Phase 14.1–14.6: **fertig** (Landing/Routing → Pic4Pic → Payments hardening → Performance).
- Phase 14.7: **fertig** (Desktop Name Wrap Fix + Mood „Online“ entfernt).

**Aktueller Fokus:** **Phase 15** — vollständige Premium/Freemium-Überarbeitung gemäß Konzept-Kapitel 15 (mit Filter-Ausnahme).