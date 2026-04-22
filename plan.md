# Inclusive Modern Dating Platform — Implementation Plan

## Source
Concept document: `dating_app_konzept.docx` (German). Implementing independently without further user questions per user's explicit direction.

## Stack Adaptation
Concept specifies NestJS + PostgreSQL + Next.js + React Native. Environment provides FARM stack. Adaptation:

| Concept | Implementation |
|---|---|
| NestJS | FastAPI (Python) |
| PostgreSQL + PostGIS | MongoDB with 2dsphere geo-index |
| MinIO | Base64 in MongoDB (MVP), can swap later |
| Next.js + RN | React (web) — web-first MVP |
| Socket.IO (NestJS) | FastAPI WebSocket |
| NudeNet/DeepFace | Gemini Vision via Emergent LLM key |
| Argon2id | bcrypt |

## Key Differentiators (MUST HAVE)
1. **Bidirectional filtering (Alice-Werner principle):** Alice sees Werner only if (a) Werner's age ∈ Alice's range AND Alice's age ∈ Werner's range, AND (b) Alice seeks Werner's gender AND Werner seeks Alice's gender.
2. **Gallery discovery** — grid, NO swipe.
3. **AI image moderation** — NSFW score + face detection → auto-blur >0.75 with 18+ override, face photo filter.
4. **Rounded distance** — never exact GPS (5km buckets).
5. **Chat only after mutual match.**
6. **Albums** with selective sharing + unlock requests.
7. **Admin/moderation** panel with reports queue.
8. **Privacy controls:** read receipts, online status, hidden mode, screenshot notification.
9. **GDPR:** export + delete, consent tracking.

## Phase 1 — Core POC (Isolation Test)
Test core most-failure-prone integration in one Python script:
- Emergent LLM key + Gemini Vision: detect NSFW score + detect faces on two test images (one safe, one provocative). Must return structured data.
- Bidirectional filter logic: create 3 sample users in MongoDB and confirm the mutual-match query returns correct matches.

**User stories covered in POC:**
- As a user, when I upload a photo, the system classifies it (face/NSFW) before showing it to others.
- As a user, my discovery feed only shows people whose age/gender preferences match mine mutually.

## Phase 2 — Complete App (Web MVP)
### Backend (FastAPI + MongoDB)
- Auth: register, login, JWT, logout; email uniqueness; bcrypt.
- Profile: CRUD with display_name, age, gender_identity, pronouns, orientation, bio, location (lat/lng), seeking genders, age range, relationship type, kinks (NSFW-flagged), photos (with AI metadata), hidden mode, privacy settings.
- Photos: upload base64 → Gemini Vision → store `nsfw_score`, `has_face`, `category` → serve with metadata.
- Discovery: `/api/discover` returns filtered gallery with bidirectional matching + all one-way filters (radius, face-only, verified, hide-seen, online, with-photo, relationship, kinks).
- Likes & Matches: POST like → if mutual → create match.
- Chat: WebSocket for realtime; message persistence; media support; read receipts; typing; only after match.
- Albums: create, add photos, share with match, request unlock, expire.
- Reports: submit report on user/photo/message.
- Admin: moderation queue (reports, image review), ban user, warn user, list audit logs.
- GDPR: export my data, delete my account.
- Privacy settings endpoints.

### Frontend (React)
- Premium, inclusive design — modern palette (rich dark theme + light), LGBTQ+ affirming without clichés.
- Pages:
  - `/login`, `/register`
  - `/onboarding` (consent + profile setup + photo upload)
  - `/` (gallery discovery)
  - `/profile/:id` (view profile)
  - `/me` (my profile edit)
  - `/matches` (list of matches)
  - `/chat/:matchId` (real-time chat)
  - `/albums` + `/albums/:id`
  - `/settings` (privacy, GDPR export/delete)
  - `/admin` (moderation dashboard, role-protected)
- Components: FilterDrawer, ProfileCard (grid), NsfwBlurOverlay with reveal, ChatWindow, AlbumShareDialog, ReportDialog, ConsentDialog.

### User Stories
- Register/onboard with consent for sensitive data.
- Set my age range and gender preferences; only see mutually-matching profiles.
- Upload photos; NSFW photos auto-blur; reveal with 18+ consent.
- Apply filters (radius, face-only, relationship type, etc.) and browse gallery.
- Like someone; on mutual like, chat unlocks.
- Chat in realtime; send media; configure read receipts.
- Create album, share with a match, receive unlock requests.
- Report inappropriate content.
- Admin: review reports, ban user.
- Export my data, delete my account.

### Testing
Testing agent runs end-to-end: auth → profile+photo+AI → bidirectional filter correctness → like/match → chat → album → report → admin → privacy → GDPR.

## Phase 3 (Roadmap add-ons) — complete

### Delivered
- Email verification (in-app code; dev_code returned for testing since no SMTP is configured).
- MFA via TOTP (setup / enable / disable + `/auth/login-mfa` challenge).
- Video clips with upload, moderation queue (pending → approved/rejected), playback on MyProfile.
- Premium tier: `/premium/upgrade`, `/premium/status`, `/premium/cancel`.
  - Premium unlocks: `/likes/received` (who liked me), `/messages/first` (skip mutual-like gate), `/me/boost`.
- Boosts: temporary discovery priority sort; ProfileCard shows `boosted` chip.
- Events: create + list + detail + RSVP (going / interested / not_going); `/events` page.
- Extended admin roles: seeded `review@eros.app` (content_reviewer) and `support@eros.app` (support). Admin role-change endpoint. content_reviewer can access moderation queues but cannot ban; support is read-only on admin views.
- Account page (`/account`) exposes all of the above.
- Header updated with Events, Account, and a Premium badge when active.

### Testing results
- Backend: 63/65 Phase 3 tests passed (96.9%). Two minor flakes both fixed:
  - Event detail endpoint now returns `going_count`/`interested_count` aggregates.
  - Discover result for Alice: was filtered out because `seen_user_ids` persisted from prior testing + `hide_seen=true`. Reset seen_user_ids for seeded users so mutual filter test works deterministically.
- Frontend: 90%+; the "JWT session" concern from the tester is addressed by the module-init token load + global 401 interceptor added in Phase 2.

### Native mobile
Not shipped in this environment (requires a separate React Native project / store provisioning). The web UI is mobile-first responsive. Documented on the Account page and in plan.md.


---
Status: Phase 2 complete. App delivered and testable at the preview URL.

### Final delivery
- Core POC (AI image moderation + bidirectional filter) passed.
- Backend 35/35 endpoints pass automated testing (auth, profile, photos with AI, discovery bidirectional+one-way filters, likes/matches, chat, albums + sharing, reports, admin, GDPR export/delete, privacy/hidden mode).
- Frontend: premium editorial dark-first UI implemented per design_agent guidelines. All pages present: Login, Register (with consent gates), 4-step Onboarding, Discover (gallery + FilterDrawer), Profile view (with MatchBanner + NSFW blur + Report), My Profile edit (photos with AI labels), Matches, Chat (WebSocket + read receipts + self-destruct media + privacy dropdown + screenshot notification), Albums (create + share with matches + unlock requests), Settings (privacy toggles + GDPR export + delete), Admin (reports + users + photo queue + audit).
- Theme toggle (dark/light), seeded demo users for immediate testing (see /app/test_credentials.md).
- Fixed post-test: JWT token now auto-attached at module init, plus a global 401 interceptor redirects to /login to prevent stale-token loops.
