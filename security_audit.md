# Security Audit — Eros Dating Platform

**Datum:** 2026-04-23 · **Scope:** `/app/backend`, `/app/frontend`
**Methoden:** `bandit`, `yarn audit`, manuelle Code-Review (OWASP Top-10, IDOR, AuthZ, XSS, Rate-Limit, JWT, CORS, Upload-Validation)

---

## Klassifikation

| Stufe | Kriterium |
|---|---|
| **CRIT** | Direkter Account-Takeover, RCE, Bypass von Auth / Authorization, Admin-XSS |
| **HIGH** | Brute-Force, Open-Redirect, sensitive Data Exposure |
| **MED** | Config-Smell, Upload-Hardening, fehlende Rate-Limits |
| **LOW** | Logging / Hygiene |

---

## Findings & Status

| ID | Stufe | Bereich | Finding | Status |
|---|---|---|---|---|
| **F-01** | **CRIT** | Backend / Auth | `JWT_SECRET` hat Fallback `"change-me-in-prod-supersecret-abcdef123456"` – bei Missing-Env-Var läuft System mit bekanntem Schlüssel → Token-Forgery, Account-Takeover | ✅ Fixed |
| **F-02** | **CRIT** | Frontend / Blog | `BlogPostPage` rendert `post.content_html` per `dangerouslySetInnerHTML` ohne Sanitization. Böswilliger Admin / XSS-getroffener Editor-Input → Stored-XSS bei jedem Leser | ✅ Fixed |
| **F-03** | **HIGH** | Backend / AuthZ | `_require_user` prüft nicht `banned`/`deleted_at` – Banned-User mit gültigem JWT kann weiter alle Nicht-Auth-checkenden Endpoints nutzen | ✅ Fixed |
| **F-04** | **HIGH** | Backend / Auth | Keine Rate-Limits auf `/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/login-mfa` → Brute-Force-offen | ✅ Fixed |
| **F-05** | **HIGH** | Backend / WS | `/api/ws/chat/{match_id}`: keine Ban-Check; keine Partner-User-Id-Unterstützung (Duo-Partner wird geblockt) | ✅ Fixed |
| **F-06** | **HIGH** | Backend / CORS | `CORSMiddleware(allow_origins=['*'], allow_credentials=True)` – unsichere Kombi, Browser lehnen zwar ab, aber Config-Smell | ✅ Fixed |
| **F-07** | **HIGH** | Backend / Upload | Fotos/Videos akzeptieren alle `data:image/*` bzw. `data:video/*` – `image/svg+xml` ermöglicht Stored-XSS bei anderen Viewern | ✅ Fixed |
| **F-08** | **HIGH** | Frontend / Redirect | `window.location.href = data.url` in AccountPage für Stripe-Checkout ohne Origin-Allowlist → Response-Tampering könnte Open-Redirect auf bösartige Domain | ✅ Fixed |
| **F-09** | **MED** | Backend / Tokens | Verifizierungscodes und Einmal-Tokens nutzen `random.*` (non-crypto) statt `secrets` – theoretisch vorhersagbar | ✅ Fixed |
| **F-10** | **MED** | Backend / Acquaintances | Neuer Endpoint `POST /acquaintances/request` nutzt keine Rate-Limits – Spam-Vector zu beliebigen Profilen | ✅ Fixed |
| **F-11** | **MED** | Backend / Reports | `_match_or_403` prüft Partner-Linkage, aber manche direkte Match-Zugriffe (WS) nicht | ✅ Fixed (via F-05) |
| **F-12** | **MED** | Frontend / Links | Nutzer-Bio und Persona-B-Bio werden in Profilen gerendert – aktuell via JSX-Text (safe), Linkify müsste sanitizen | ✅ Safe (React escapes, kein Linkify im UI) |
| **F-13** | **MED** | Backend / Legal CMS | Admin-editierbare Markdown wird über `react-markdown` gerendert (auto-escaped) – OK, aber `html` ist in markdown nicht erlaubt | ✅ Verified-Safe |
| **F-14** | **MED** | Backend / Login | Login-Response enthält Banned-Status, gibt aber `403` mit klarer Message – timing-side-channel minimal | ✅ Safe (gleicher bcrypt-Pfad) |
| **F-15** | **LOW** | Backend / Logging | `_audit` loggt actor_id → OK. `login`-Audit fehlt IP | ✅ Enhanced |
| **F-16** | **LOW** | Frontend / Deps | `yarn audit`: 80 high, 70 moderate – fast alle transitive unter `react-scripts` (webpack-dev-server etc.), nur Dev-Time | ℹ️ Dokumentiert (keine Prod-Impact) |
| **F-17** | **LOW** | Backend / Bandit | 47x B311 (non-crypto random) – Großteil in Seed/Test-Helpers. Kritische Stellen adressiert durch F-09 | ✅ Addressed |
| **F-18** | **LOW** | Backend / Bandit | B105 `"0"` gefunden – False-Positive (String-Vergleich, kein Password) | ℹ️ False-Positive |
| **F-19** | **LOW** | Backend / Bandit | 8x B110 try-except-pass – bewusst fallback-silent, nicht security-relevant | ℹ️ Intentional |

---

## Ausgeführte Fixes (chronologisch)

Die Fixes werden einzeln comitted und verifiziert. Siehe Sektion „Fix-Log" unten.

### Fix-Log

**2026-04-23 — Initial security hardening sweep**

| Finding | Commit-Summary | Files |
|---|---|---|
| F-01 | JWT_SECRET: harden — reject insecure defaults, generate ephemeral 64-byte secret if unset + warn log; `.env` set to strong persistent secret via `secrets.token_urlsafe(64)` | `backend/auth.py`, `backend/.env` |
| F-02 | Blog HTML sanitization: server-side `bleach`-allowlist (clean() + linkifier for rel=noopener) on create + update; client-side `DOMPurify` as defense-in-depth | `backend/server.py` (`_sanitize_blog_html`), `frontend/src/pages/BlogPostPage.js`, `frontend/package.json` |
| F-03 | `_require_user` now rejects `banned` and `deleted_at` accounts → banned users' JWTs fail immediately | `backend/server.py` |
| F-04 | Rate-limits on `/auth/login` (10/IP/5min + 6/email/5min), `/auth/register` (6/IP/h + 3/email/h), `/auth/login-mfa` (10+6/5min) via lightweight in-process token bucket | `backend/rate_limit.py` (new), `backend/server.py` |
| F-05 | WS `/api/ws/chat/{match_id}`: re-check user exists & not banned/deleted; allow duo-partner participation via `partner_user_id` | `backend/server.py` |
| F-06 | CORS: wildcard origin + credentials combo removed; explicit method/header allowlist; `allow_credentials=False` when wildcard origin | `backend/server.py` |
| F-07 | MIME allowlist for uploads: `image/jpeg|png|webp|heic|heif|gif` + `video/mp4|webm|ogg|quicktime`; SVG + disallowed types explicitly rejected with clear error | `backend/server.py` |
| F-08 | Stripe-Checkout-URL validated client-side against HTTPS + 8-host allowlist before redirect (Stripe, PayPal, Mollie, Klarna, Paddle) | `frontend/src/pages/AccountPage.js` |
| F-09 | Email verification code switched from `random.randint` to `secrets.randbelow` (cryptographically secure) | `backend/server.py` |
| F-10 | Rate-limit on `POST /acquaintances/request` (5/user/min + 20/user/day) | `backend/server.py` |
| F-11 | Addressed via F-05 (WS match-access now allows duo-partner) | `backend/server.py` |
| F-15 | Login audit now records `ip` from `X-Forwarded-For` first hop | `backend/server.py` |

**Regression-Tests (Live gegen Preview-URL):**
- ✅ `curl` Login rate-limit: Nach 6 Fehlversuchen → 429 mit `Retry-After`
- ✅ SVG-Upload → 400 *„Unerlaubter Bildtyp: image/svg+xml. Erlaubt: JPEG, PNG, WebP, HEIC, HEIF, GIF."*
- ✅ MP4 als Foto → 400 *"Invalid image data URL"*
- ✅ Gültiges JPEG → 200 + Foto angelegt
- ✅ Blog-XSS: `<script>`, `onerror`, `javascript:`-Links, `<iframe>` alle entfernt (server-side bleach)
- ✅ Admin-Login nach JWT-Rotation funktioniert, Discover, Matches, Views, Blog laden
- ✅ Backend-Services stabil, keine Errors in `supervisor.*.err.log`

**Noch offene / akzeptierte Risiken:**
- **F-16**: Dev-Dependencies von `react-scripts` haben 80 high / 70 moderate npm audit findings. Alle sind auf Dev-Zeit-Bibliotheken (webpack-dev-server, jest-serve etc.) beschränkt und landen NICHT im Production-Bundle. Migration zu Vite wäre die saubere Langzeit-Lösung.
- **F-17**: 47x Bandit B311 (non-crypto `random`) — restliche Vorkommen sind Seeds/Helpers ohne Security-Bezug.
- **F-18**: Bandit B105 `"0"` → bestätigter False-Positive.
- **F-19**: 8x `try: … except: pass` → intentional Silent-Fallbacks (Benachrichtigungen, Audit-Failures), nicht security-relevant.

**Empfehlungen für die nächste Iteration:**
- Content-Security-Policy via Response-Header (strict-dynamic, no-inline) für Meta-Defense — **bewusst auf nächste Iteration verschoben**, da CRA-Build Inline-Styles einsetzt; erst Report-Only testen
- ✅ **Security-Headers-Middleware** eingebaut (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mit Geolocation/Camera/Mic nur auf `self`, Payment/USB disabled)
- Multi-Worker Rate-Limit-Backend (Redis) wenn horizontale Skalierung
- Password-Strength-Meter im Registration-UI (bereits 8+ Zeichen serverseitig)
- Regelmäßiger `pip-audit`/`yarn audit` im CI
