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
**Ziel (erfüllt):**
- Neu registrierte Partner-Profile können als **ein Konto** bestehen, aber **beide Personen erkennbar** darstellen.

**Umsetzung (Delivered):**
- Backend:
  - `RegisterRequest`: `account_type: single|duo` + `persona_b`.
  - Register-Flow speichert `account_type` + sanitizte `persona_b`.
  - Serializer: `public_user_from_doc` gibt `account_type` + `persona_b` (public) zurück.
  - Endpoint: `PATCH /api/me/persona-b`.
- Frontend:
  - RegisterPage: Toggle **Einzelperson / Paar** + Person-B Subformular (MVP Felder).
  - ProfileCard: zeigt „A & B“ + Paar-Badge + optional Secondary Avatar.
  - ProfileViewPage: zeigt Person A + Persona B als getrennte Panels.

**Status:** Abgeschlossen.

### Phase 7.2 — Linked Couple (Two-Login Paarprofil mit Bestätigung)
**Ziel (erfüllt):**
- Zwei Accounts werden über **gegenseitige Bestätigung** verknüpft, jeder behält seine Login-Daten.

**Umsetzung (Delivered):**
- Backend:
  - Collections: `couples`, `couple_invites`.
  - Endpoints:
    - `POST /api/couples/invite` (E-Mail **oder** user_id)
    - `GET /api/couples/invites`
    - `POST /api/couples/invites/{id}/accept`
    - `POST /api/couples/invites/{id}/decline`
    - `DELETE /api/couples/invites/{id}` (revoke)
    - `POST /api/couples/unlink` (unilateral)
    - `GET /api/couples/me`
  - Schutzregeln: Duo-Accounts können nicht zusätzlich verknüpfen.
  - Discover: Partner-Snapshot wird angehängt + Couple-De-Dupe (nur 1 Eintrag pro couple_id).
  - ProfileView: `/api/users/{id}` liefert optional `partner` Snapshot.
- Frontend:
  - AccountPage: `CoupleSection` (Einladen/Annehmen/Ablehnen/Zurückziehen/Unlink).
  - ProfileCard + ProfileView: Paar-Badge + Darstellung beider Personen.

**Status:** Abgeschlossen.

### Phase 7.3 — Chat: Sender-Identität pro Nachricht (Couple-aware Chats)
**Ziel (erfüllt):**
- Wenn Person A schreibt, wird Name/Avatar von Person A gezeigt (und analog für Person B).
- Beide Partner sehen denselben Thread (shared inbox) über ihre zwei Logins.

**Umsetzung (Delivered):**
- Backend:
  - `_match_or_403` erlaubt Zugriff auch über `partner_user_id`.
  - `/api/matches`: inkludiert Partner-Matches; unread count berücksichtigt beide IDs.
  - `/api/matches/{id}/messages`: liefert `senders` Lookup + `couple_meta` (für Header) und markiert read_by couple-aware.
  - `POST /api/messages`: broadcastet WS-Event mit `sender` Snapshot + `for_users` inkl. beider Partnerseiten.
- Frontend:
  - ChatPage: nutzt `senders`/`couple_meta`, Header zeigt „A & B“.
  - ChatBubble: optionaler Sender-Label + Sender-Avatar (für nicht-Ich Nachrichten), couple-aware `isMe`.

**Status:** Abgeschlossen.

### Phase 7.4 — Persona-B Editor (Duo Account) (P2)
**Ziel (erfüllt):**
- Duo-Accounts können Person B vollständig pflegen (Fotos/Körper/Lifestyle/Kinks/Interessen etc.).

**Umsetzung (Delivered):**
- Frontend:
  - Neue Komponente `PersonaBEditor` (Fotos: add/remove/primary; Basisangaben; Körper & Lifestyle; Kinks; Save).
  - `MyProfilePage` zeigt Person-B-Bereich konditional (`user.account_type === 'duo'`) + Jump-Link.
- Backend:
  - Nutzung des bereits vorhandenen `PATCH /api/me/persona-b` Endpoints; Foto-Array wird als Teil von `persona_b` persistiert.

**Status:** Abgeschlossen.

---

## Phase 8 — Produktion/Deployment, Legal Pages, Payments (PayPal/Klarna) & Mobile Iteration 2
Diese Phase bündelt die zuletzt umgesetzten produktionsnahen Arbeiten (Docker/Synology, Auto-Updater, Legal, Payment UI) und den Mobile-Paritätsschritt.

### Phase 8.1 — Robuster Docker-Compose Prod-Setup (Synology)
**Ziel (erfüllt):**
- Deployment muss in restriktiven Umgebungen (Synology NAS) zuverlässig builden und laufen.

**Umsetzung (Delivered):**
- `docker-compose.yml` mit `dockerfile_inline` und `alpine/git` Fetcher-Stages.
- `$$`-Escapes für compose-variable Shell-Auswertung.
- `eros-updater` Sidecar mit automatischem GitHub-Pull/Build.
- Persistent `JWT_SECRET` Auto-Generation + Volume-Backing.
- Dokumentation: `DOCKER.md`, `bootstrap.sh`.

**Status:** Abgeschlossen.

### Phase 8.2 — Legal Pages: Default-Inhalte, Seeding, UI-Verifikation
**Ziel (erfüllt):**
- Realistische deutsche Texte für: Nutzungsbedingungen, Datenschutz, Impressum, Community, Cookies, Widerruf.
- Robust gegen bereits bestehende Platzhalter in DB.

**Umsetzung (Delivered):**
- Korrektur typografischer Anführungszeichen, die einen `SyntaxError` verursachten.
- `_ensure_default_legal_pages` erweitert:
  - Insert bei fehlendem Eintrag.
  - **Auto-Refresh** nur für nicht-edited Einträge (`updated_by is None`) wenn DB-Content kürzer als Default (Placeholder-Erkennung).
- Impressum-Stub zurückgesetzt, sodass Default wieder ausgespielt wird.
- UI-Screenshot-Verifikation: `/legal/terms` rendert korrekt.

**Status:** Abgeschlossen.

### Phase 8.3 — Payments: PayPal/Klarna Frontend-Integration + Klarna Finalisierung
**Ziel (erfüllt):**
- Nutzer:innen können im Konto-Bereich den Checkout Provider auswählen.
- PayPal redirect + capture Return Flow.
- Klarna Checkout Page mit Widget + Place-Order Finalisierung.

**Umsetzung (Delivered):**
- Backend:
  - Neues Model `KlarnaPlaceOrderRequest`.
  - Neuer Endpoint `POST /api/payments/klarna/place-order`.
- Frontend:
  - Neue Komponente `PaymentProviderDialog` (Stripe/PayPal/Klarna Auswahl, Allowlist-Redirect-Safety).
  - Neue Seiten:
    - `/payments/paypal/return` (Capture)
    - `/payments/klarna/checkout` (Widget)
- UI-Verifikation per Screenshot: Dialog erscheint, Provider-Status wird aus `providers_live` abgeleitet.

**Status:** Abgeschlossen (funktional). Hinweis: echte PayPal/Klarna Zahlungen hängen von Admin-Credentials ab.

### Phase 8.4 — Mobile: Feature-Parität erweitern (Iteration 2 — Additive Screens)
**Ziel (erfüllt):**
- Mobile App bekommt zentrale Web-Features als read-only / light-interaction Parität, ohne Upload-/Editor-Komplexität.

**Umsetzung (Delivered):**
- Neue Screens in `/app/mobile/src/screens`:
  - `AlbumsScreen` + `AlbumDetailScreen` (inkl. Unlock-Request via `POST /albums/unlock-request`)
  - `EventsScreen` + `EventDetailScreen` (RSVP via `POST /events/{id}/rsvp` mit Status `going|interested|not_going`)
  - `BlogScreen` + `BlogPostScreen` (Markdown als Plaintext; Web bleibt rich)
  - `VisitorsScreen` (Premium-aware, berücksichtigt `blurred_visitors` und flaches Response-Shape)
  - `MenuScreen` (Hub für Navigation)
- Navigation:
  - Tabs erweitert: Discover, Matches, Events, Mehr, Konto
  - Stack-Routes ergänzt: Albums, AlbumDetail, EventDetail, Blog, BlogPost, Visitors

**Status:** Abgeschlossen.

---

## Phase 9 — UX-Fixes + Conditional Filters + Mobile Parität (NSFW / Gay Position)
Diese Phase bündelt drei zusammenhängende Produktpunkte:
1) **UX-Bugfix** für Range-Slider (fehlender zweiter Griff).
2) **Kontextabhängige Filterfelder** nach Zielgruppe/Orientierung (z. B. Cup-Size bei Gay-/Männer-only-Searching ausblenden).
3) **Mobile Parität**: neue Profilfelder (NSFW-Präferenz & Gay Position) und passende Discover-Filter im React Native Client.

### Phase 9.1 — Web: Slider-Bugfix (Range-Thumb)
**Umsetzung (Delivered):**
- Fix in `/app/frontend/src/components/ui/slider.jsx`:
  - Rendert jetzt dynamisch **N** `SliderPrimitive.Thumb` basierend auf `value.length` (oder `defaultValue.length`).
  - Fallback: 1 Thumb.
  - Zusätzliche `data-testid="slider-thumb-{i}"` für UI-Checks.

**Verifikation:**
- `/me` (Einstellungen) → Altersspanne zeigt **zwei Handles**.
- Discover FilterDrawer → Altersspanne zeigt **zwei Handles**.

**Status:** Abgeschlossen.

### Phase 9.2 — Web: Conditional Filterfelder nach Seeking/Orientierung
**Umsetzung (Delivered):**
- Anpassung `/app/frontend/src/components/FilterDrawer.js`:
  - Helpers `seeksWomen(seeking_genders)` / `seeksMen(seeking_genders)`:
    - Wenn keine `seeking_genders` gesetzt sind → beide sichtbar (Onboarding/Erstnutzerfreundlich).
    - Neutral/NB/Other zählt zu beiden (so bleibt die UI inklusiv).
  - Cup-Filter (`CUP_SIZES`) nur wenn `seeksWomen(...)` true (`data-testid="filter-cup-sizes"`).
  - Penis-Filter (`PENIS_CATEGORIES`) nur wenn `seeksMen(...)` true (`data-testid="filter-penis-categories"`).

**Verifikation:**
- Nur „Mann“ gewählt → Cup ausgeblendet, Penis sichtbar.
- Nur „Frau“ gewählt → Cup sichtbar, Penis ausgeblendet.

**Status:** Abgeschlossen.

### Phase 9.3 — Web: NSFW Hide-Toggle + Gay-Position Filter
**Umsetzung (Delivered):**
- `/app/frontend/src/components/FilterDrawer.js`:
  - Neuer Switch: `hide_nsfw_profiles` ("NSFW-Profile ausblenden").
  - Neuer Multi-Select: `gay_positions` (Chips) in der Body-Sektion.
  - Anzeige-Gate für `gay_positions`:
    - Nur für Viewer, die `isGayMaleLike({gender_identity, orientation})` erfüllen **und** Männer suchen.
  - `reset()` + `activeCount` um `hide_nsfw_profiles` und `gay_positions` erweitert.

**Status:** Abgeschlossen.

### Phase 9.4 — Mobile: Shared Demographic Helper + Profilbearbeitung
**Umsetzung (Delivered):**
- Neue Datei `/app/mobile/src/demographics.js`:
  - `isGayMaleLike(user)` (konform zu `/app/backend/helpers.py`).
  - `GAY_POSITIONS` + `NSFW_OPTIONS`.
  - `nsfwToValue()` / `valueToNsfw()`.
- Update `/app/mobile/src/screens/EditProfileScreen.js`:
  - Lädt `accept_nsfw` und `gay_position` aus `/me`.
  - Neue UI-Sektion „Präferenzen & Sichtbarkeit“:
    - NSFW (Chips: Keine Angabe / Offen / Nur SFW) — immer sichtbar.
    - Gay Position — **nur** für `isGayMaleLike(user)`.
  - Save sendet `accept_nsfw` immer; `gay_position` nur konditional.

**Status:** Abgeschlossen.

### Phase 9.5 — Mobile: DiscoverFilterDrawer + DiscoverScreen
**Umsetzung (Delivered):**
- Update `/app/mobile/src/components/DiscoverFilterDrawer.js`:
  - Neue Prefs: `hide_nsfw_profiles`, `gay_positions`.
  - Toggle „NSFW-Profile ausblenden“.
  - Position-Chips nur für gay-male-like Viewer der Männer sucht.
  - Mapping der mobilen Seeking-Gender Keys → Backend Keys (z. B. `male→man`, `trans_male→trans_man`) für das Gate.
  - Neuer Prop: `viewer`.
- Update `/app/mobile/src/screens/DiscoverScreen.js`:
  - Übergibt `viewer={user}` via `useAuth()`.

**Status:** Abgeschlossen.

### Phase 9.6 — Testing / Abnahme
**Ergebnisse:**
- Web: Screenshot-Verifikation zeigt zwei Handles am Alters-Slider (Bug behoben).
- Web: Conditional Cup/Penis Filter verifiziert (über DOM Counts + Screenshot).
- Mobile: `esbuild` Syntax-/Bundle-Check für:
  - `EditProfileScreen.js`
  - `DiscoverFilterDrawer.js`
  - `DiscoverScreen.js`
  - `demographics.js`
  → erfolgreich.

**Status:** Abgeschlossen.

---

## Offene Issues / Risiken
### Issue 1: Session persistence UX issue (Recurring)
- Status: behoben/abgemildert.

### Issue 2: Backend Test-Report Flakes (niedrige Priorität)
- Status: funktional; Provider abhängig von Credentials.

### Issue 3: Blockliste nicht im `/api/me` Response sichtbar (niedrige Priorität)
- Empfehlung: `/api/me` Serializer um `blocked_user_ids` erweitern oder `GET /api/me/blocks`.

### Issue 4: server.py Monolith (~6000+ Zeilen)
- Risiko: Wartbarkeit.
- Empfehlung: Router-Split (`routers/auth.py`, `routers/payments.py`, `routers/legal.py`, `routers/admin.py`, `routers/blog.py` …).

### Issue 5: Range-Slider Handle fehlt (Web)
- Ursache: Slider-UI rendert nur 1 `Thumb` (Radix Range benötigt 2).
- Status: **Behoben** in Phase 9.1.

---

## Nächste Schritte (Upcoming Tasks)
### Task 1 (P1): Mobile: Report-Flows
**Ziel:** Nutzer:innen können Profil/Foto/Nachricht aus der Mobile App melden.

**Status:** Offen.

### Task 2 (P1): Payments – Admin-Konfig & Production Hardening
**Ziel:** Payment Provider Credentials & Webhooks sauber produktionsreif betreiben.

**ToDos:**
- Admin UI: Klarna/PayPal Felder validieren, Sandbox/Live Toggle sichtbar.
- Webhook/Return Härtung: Retry/Idempotenz auf Transaktionen.
- Klarna: Echte Confirmation/Return URLs (konfiguriertes `EROS_PUBLIC_URL`) und ggf. Order-Management.

**Status:** Offen.

### Task 3 (P2): Mobile Voll-Parität (Option C) — Re-sync `/app/mobile`
**Ziel:** Vollständige Feature- und UX-Parität mit Web.

**Leitplanken:**
- Iterativ, API bleibt identisch, Mobile implementiert Clients/Views.
- Paare/Couples sind First-Class (Linked Couples + Duo Account) inkl. Chat-Identität pro Nachricht.

**Iterationen (aktualisiert):**
1. **Iteration 1 — Core Client + Couples Foundations (DONE)**
   - Auth: Login + **Register inkl. Duo-Option**
   - Navigation: Bottom Tabs (Discover/Matches/Account) + Stack (Profile/Chat)
   - Discover: Grid, NSFW blur, City/Distance, Couple Badge + Partner-Avatar Overlay
   - Profile: Couple-aware Header + PersonDetails (Körper & Lifestyle + Kinks immer sichtbar)
   - Matches: Liste mit Couple Anzeige
   - Chat: Couple-aware Sender-Labels + Sender-Avatare; Header über `couple_meta`
   - Account: Premium-Quota, Promo Redeem, Couple Invites (invite/accept/decline/revoke/unlink), Logout

   **Status:** Abgeschlossen.

2. **Iteration 2 — Content + Utility Screens (DONE)**
   - Events (List/Detail/RSVP)
   - Albums (List/Detail + Unlock Request)
   - Blog (List/Post)
   - Visitors (Premium-aware, blurred visitor handling)
   - Mehr/Hub Navigation

   **Status:** Abgeschlossen.

3. **Iteration 3 — Filters + Media Uploads + Profile Editing (IN PROGRESS)**
   - Filter UI (Drawer) + Premium-gated advanced filters
   - Foto-Upload (inkl. Moderation/Blur Handling) + Profilbearbeitung
   - Persona-B Editing (mobile) für Duo Accounts
   - Stealth Toggle, Visitors/Views parity (inkl. Incognito)
   - Video Upload UI (Premium gate: max 4, 60s, 1080p)

   **Status:** Teilumfang geliefert durch **Phase 9** (NSFW/Gay-Position + Conditional Filter). Rest offen.

4. **Iteration 4 — Broadcast Inbox + Notifications + Settings (OPEN)**
   - Broadcast-Historie im Konto + mobile parity
   - Settings (Privacy, Screenshot-Deterrence handling, Language)

   **Status:** Offen.

5. **Iteration 5 — Reports (User Side) + Moderation Entry Points (OPEN)**
   - Report flows aus Mobile
   - Minimal moderation surfaces (optional)

   **Status:** Offen.

6. **Iteration 6 — Optional: Admin Panel auf Mobile (Optional)**

**Status:** In Umsetzung (Iteration 1–2 fertig; Iteration 3 teilweise; weitere Iterationen offen).

---

## Status / Zusammenfassung
- Phase 1–4: **fertig**.
- Phase 5.0–5.6: **fertig (Backend + Frontend)** inkl. Broadcast-System.
- Phase 6.0–6.4: **fertig** (City, RoleBadge Tooltips, Bulk Actions, Premium/Promos, Blog).
- Phase 7.0–7.4: **fertig** (Always-visible Körper/Kinks, Couples in 2 Modi, Couple-aware Chat, Persona-B Editor im Web).
- Phase 8.1–8.4: **fertig** (Prod Deployment Hardening, Legal Pages Seeding/Verifikation, PayPal/Klarna Flows, Mobile additive Screens).
- Phase 9: **fertig** (Slider-Fix, Conditional Filter nach Zielgruppe, Web Filter: NSFW + Position, Mobile Parität inkl. Shared Helper).

### Final delivery (aktualisiert)
- Voll funktionsfähige Web-App mit:
  - Mutual Discovery, AI Moderation, Events, Premium/Boost, Chat, i18n, erweiterte Profile, Screenshot Guard.
  - Broadcasts (signed) als read-only Chats, segmentierte Broadcasts inkl. Live-Preview.
  - Promo-Codes, Auto-Register-Kampagnen, Visitors, Stealth, Super-Like, Free-Like-Limit.
  - Blog mit TipTap Editor.
  - **Couples / Partner-Profile**:
    - Linked (2 Konten, 2 Logins) mit Invite/Accept/Unlink.
    - Duo (1 Konto) mit `persona_b`.
    - Discover/Profile zeigt beide Personen; Chat zeigt Sender pro Nachricht.
    - Web: Voller Person-B Editor (Fotos/Körper/Kinks).
  - **Payments**:
    - Stripe Checkout (bestehend)
    - PayPal Redirect + Capture Return
    - Klarna Widget Checkout + Place-Order Endpoint
    - Provider-Auswahl im Konto via Dialog.
  - **Legal Pages**:
    - Vollständige deutsche Standardtexte + robustes Seeding/Placeholder-Refresh.
  - **Deployment**:
    - Synology-tauglicher Compose, Auto-Updater Sidecar, persistenter JWT Secret.

- Mobile App (`/app/mobile`):
  - **Iteration 1–2 abgeschlossen**: Core (Auth/Discover/Profile/Matches/Chat/Account) + Content Screens (Events/Albums/Blog/Visitors) + Mehr-Hub.
  - **Iteration 3 teilweise abgeschlossen**: Filter/Profilbearbeitung erweitert (Phase 9: NSFW + Gay Position + Discover Filter).
  - Nächster großer Block: Reports (P1) + Upload/Persona-B Editing/Stealth/Video-Upload.

**Status:** COMPLETED (Web). Mobile Voll-Parität: IN PROGRESS (Iteration 1–2 DONE; Iteration 3 teilweise durch Phase 9 erweitert).