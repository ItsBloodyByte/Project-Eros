# Eros – Docker Quickstart

One command spins up MongoDB, the FastAPI backend and the Nginx-served
React frontend.

## 1. Configure secrets

```bash
cp .env.example .env
# Generate a strong JWT secret:
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(64))" >> .env.tmp
# Then edit .env and paste the generated value (remove the duplicate line).
$EDITOR .env
```

Required variables:

| Variable | Why | Default |
|---|---|---|
| `JWT_SECRET` | Signs session tokens. Must be unique and long. | refuses to boot |
| `MONGO_INITDB_ROOT_USERNAME` | Mongo root user | `eros` |
| `MONGO_INITDB_ROOT_PASSWORD` | Mongo root password | change-me |
| `MONGO_DB_NAME` | App database | `eros` |
| `CORS_ORIGINS` | Browsers allowed to call the API | `http://localhost:8080` |
| `FRONTEND_HOST_PORT` | Port on the host | `8080` |

Optional (for full feature parity):

| Variable | Purpose |
|---|---|
| `EMERGENT_LLM_KEY` | Gemini image moderation, AI features |
| `STRIPE_API_KEY` | Premium subscriptions, boost checkout |

## 2. Build and start

```bash
docker compose up --build -d
```

On first start:

* Mongo creates `mongo_data` volume.
* Backend installs Python deps, starts uvicorn on `:8001`.
* Backend `on_event('startup')` ensures all indexes.
* Frontend build produces a static CRA bundle and nginx starts.

Visit **http://localhost:8080** – register a new account and you're in.

## 3. Create an admin user

Any registered user can be promoted via Mongo:

```bash
docker compose exec mongo mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --eval 'db.getSiblingDB("'"$MONGO_DB_NAME"'").users.updateOne({email:"you@example.com"}, {$set:{role:"superadmin"}})'
```

## 4. Logs / health / restart

```bash
docker compose logs -f backend        # tail backend
docker compose ps                     # status
docker compose restart backend        # restart single service
docker compose down                   # stop (data persists in volumes)
docker compose down -v                # stop + wipe Mongo data
```

Health checks are configured on each service – `docker compose ps` shows
`healthy` / `starting` / `unhealthy` states.

## 5. Horizontal scale notes

* Backend currently runs **one** uvicorn worker. The in-process rate
  limiter and WebSocket broadcast registry live in memory, so scaling
  horizontally needs a Redis-backed limiter + sticky ingress (plumb in
  your own).
* Nginx already serves compressed static assets; backend ships JSON
  via GZip middleware.

## 6. Production tips

* Put a TLS-terminating reverse proxy (Caddy, Traefik) in front of
  the `frontend` service.
* Set `CORS_ORIGINS` to your real HTTPS origin.
* Rotate `JWT_SECRET` and Mongo credentials for production.
* Mount `mongo_data` onto durable storage with regular snapshots.
