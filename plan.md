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

## Phase 1 — Core POC (Isolation Test)
Test der kritischsten Integrationen in einem Python-Skript:
- Emergent LLM Key + Gemini Vision: NSFW Score + Face Detection an zwei Bildern (safe vs. provokativ), strukturierte Rückgabe.
- Bidirektionale Filterlogik: 3 Test-User in MongoDB und Validierung der mutual-match Query.

**User Stories im POC:**
- Als User werden Upload-Fotos automatisch klassifiziert (Face/NSFW), bevor andere sie sehen.
- Als User sehe ich nur Profile, die auch mich gemäß deren Einstellungen sehen würden.

**Status:** Abgeschlossen.

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
Phase 5 wird in **4 Teilschritten** umgesetzt.

### Phase 5.0 — Aktueller Stand (Ist-Zustand)
**Backend:** weitgehend implementiert und lauffähig (Travel, ID-Verifizierung, Admin AI Config, Reports, Auto-Mod Shadow-Restrict, Stripe Checkout/Webhook vorhanden).

**Wichtige Anpassung aus der letzten Abstimmung:**
- **ID-Verifizierung muss kostenfrei sein** → Payment-Flow hierfür entfernen/deaktivieren.
- **Payment-Anbieter/Keys/Preise müssen über Admin konfigurierbar** sein (dynamisch, ohne hardcodierte Preise/Keys).

**Frontend:** Phase-5-UI größtenteils **nicht** umgesetzt (Edits 1–6 + Feature-UIs fehlen), UI-Redesign offen.

### Phase 5.1 — Pflicht-Edits (schnelle Wins, UX-Konsistenz)
Ziel: Frontend/Onboarding konsistent und gemäß Edits 1–3,6.

**Edit 1: Gender-spezifische Feldvalidierung & Anzeige**
- Cup Size nur bei passenden Gender/Profilkonstellationen anzeigen.
- Penis Size nur bei passenden Gender/Profilkonstellationen anzeigen.
- Backend-Validation/Frontend-Form-Validation konsistent.

**Edit 2: Max. 5 Profilbilder (1 Haupt + 4 Neben)**
- Upload/UI-Limit hart auf 5.
- **Desktop:** Drag & Drop Reorder; erstes Bild = Hauptfoto.
- **Mobile:** Button „Als Hauptfoto setzen“ + optional „Nach oben“.
- Backend muss serverseitig limitieren (falls noch nicht strikt) und konsistente Sortierung speichern.

**Edit 3: Besuchte Profile Marker (Eye Icon)**
- Nur Eye Icon anzeigen (kein Ausgrauen).
- Speicherung/Markierung „visited“ (Client- oder Server-basiert; bevorzugt serverseitig über `seen_user_ids` oder separaten Visit-Log).

**Edit 6: Pflichtfelder & Immutable Age**
- Onboarding: Name, Alter, Gender mandatory.
- Settings: Alter nicht mehr änderbar (UI disabled + backend reject/ignore changes).

**Zwischen-Test (Frontend):**
- Hard refresh / Session Rehydration ohne Flicker prüfen (Issue 1).

### Phase 5.2 — Elegantes UI Redesign (Edit 4)
Ziel: Filter/Discover/ProfileView „elegant & innovativ“ neu strukturieren.

- Filter UX: Lösung wählen, die am besten zu Layout/Responsiveness passt:
  - Desktop: Sticky Sidebar *oder* Hybrid (Sidebar + Mobile Drawer)
  - Mobile: Drawer oder Top-Chips mit Sheet
- ProfileView: bessere Informations-Hierarchie, Fotogalerie, Chips/Badges (Premium/Verified/ID-Verified), Actions (Like/Report/Album Request) klarer.
- Design-Konsistenz: Komponenten vereinheitlichen, Spacing/Typo/States.

**Zwischen-Test (Frontend):**
- Discover → Filter → Profile öffnen → zurück → visited Eye sichtbar.

### Phase 5.3 — Feature-UIs + Admin Erweiterungen
Ziel: Die bereits vorhandenen Backend-Funktionen sichtbar/bedienbar machen.

**Travel Planner (User UI)**
- Seite/Abschnitt zum Erstellen/Listen/Löschen eigener Travel-Pläne.
- Optional: Travel-Signal im Profil/Discover (Badge).

**ID Verification (kostenfrei)**
- UI zum Einreichen von ID-Verifizierung (Upload/Submit) → Status (pending/approved/rejected).
- Badge „ID verified“ in Profil/Discover.
- **Kein Payment** für ID-Verifizierung.

**Auto-Mod (Shadow-Restrict nach Reports)**
- Admin UI: Reports Übersicht + Status Update.
- Optional: Anzeige Shadow-Restricted Status im Admin User Management.

**Admin: Custom AI Config**
- Admin UI: Provider/Model/Policy/Prompts konfigurieren.
- Hinweis: Keine Tracker-Skripte; keine externen Analytics.

**Payments (dynamisch über Admin konfigurierbar)**
- Admin UI für Payment Provider Konfiguration:
  - Anbieter aktivieren/deaktivieren (z. B. Stripe)
  - Keys/Secrets im Backend speichern (sicher/verschlüsselt sofern möglich) oder via Env-Var referenzieren.
  - Produkte/Preise (Premium, Boost) dynamisch definieren.
- User UI: Premium/Boost Checkout anhand Admin-Konfig.

### Phase 5.4 — Testing, Stabilisierung, Regression-Fixes
**Ziele:** Stabilität, Security, UX.

- Backend Tests:
  - Reports + Auto-Mod Threshold (10 unique reporter IPs) → shadow restrict.
  - Travel CRUD.
  - ID Verification submit + admin review.
  - Payment Konfig lesen/setzen (admin-only).
  - Checkout nur für bezahlte Produkte (Premium/Boost), nicht für ID-Verif.
- Frontend Tests:
  - Session Persistence UX (Issue 1): Auth Context Rehydration ohne „Logout Flicker“.
  - 5-Foto Limit (Desktop DnD + Mobile Button).
  - Eye visited marker.
  - Admin Screens: AI Config, Payment Config, Reports, Verifications.

---

## Offene Issues / Risiken
### Issue 1: Session persistence UX issue (Recurring)
- Symptom: leichtes Flackern/kurzer unauth Zustand bei Hard Refresh.
- Debug Checklist:
  - `frontend/src/lib/api.js` Token Load + Axios Interceptor.
  - Auth Context Initial State/Loading Gate.
  - Routing Guards.
- Ziel: Kein Random Logout, keine gebrochenen States.

## Status / Zusammenfassung
- Phase 1–4: **fertig**.
- Phase 5 Backend: **weitgehend fertig**, aber anzupassen auf:
  - **ID-Verifizierung kostenfrei**
  - **Payments vollständig admin-konfigurierbar (Keys + Preise + Provider Toggle)**
- Phase 5 Frontend: **ausstehend**, Umsetzung in 4 Teilschritten wie oben.

### Final delivery (aktualisiert)
- Voll funktionsfähige Web-App mit:
  - Mutual Discovery, AI Moderation, Events, Premium/Boost, Chat, i18n, erweiterte Profile, Screenshot Guard.
  - Phase 5: Travel Planner, ID-Verifizierung (kostenfrei), Auto-Mod Shadow-Restrict, Admin AI Config, Admin Payment Config, 5-Foto Limit, visited Eye Marker, elegantes UI Redesign.
  - Keine Tracker (Posthog/Emergent) im Frontend.