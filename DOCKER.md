# Eros – Docker Quickstart

Ein einziger Befehl startet MongoDB, das FastAPI-Backend und das
Nginx-gehostete React-Frontend. Der Quellcode wird dabei **direkt aus
dem GitHub-Repository** [`itsbloodybyte/project-eros`](https://github.com/itsbloodybyte/project-eros)
gezogen – ein lokales `git clone` ist **nicht** nötig.

## 0. Absolute Minimalvariante (ohne .env)

In einem leeren Ordner genügt jetzt ein einziger Befehl:

```bash
curl -O https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/docker-compose.yml
docker compose up --build -d
```

Das Backend erzeugt beim ersten Start automatisch ein starkes `JWT_SECRET`
und persistiert es im Docker-Volume `backend_data` unter
`/data/jwt_secret.key` – Sessions überleben damit Restarts. Mongo läuft
mit den Default-Credentials aus der YAML. Danach direkt
`http://localhost:8080` aufrufen.

> Für Produktion solltest du trotzdem `.env` mit eigenen Secrets anlegen
> (siehe Abschnitt 2). Die Default-Credentials sind **nur für lokales
> Testen** gedacht.

## 0b. One-Liner (empfohlen, mit automatischer .env)

In einem leeren Ordner – legt `docker-compose.yml` + `.env` mit
generiertem `JWT_SECRET` und Mongo-Passwort an und startet die Stacks:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/bootstrap.sh)
```

Danach direkt `http://localhost:8080` aufrufen. Wer lieber manuell
vorgeht, nutzt die Schritte unten.

## 1. docker-compose.yml und .env.example laden

In einem leeren Ordner:

```bash
curl -O https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/.env.example
cp .env.example .env
```

> Alternativ: Das Repo klonen und aus `/app` starten – beide Varianten
> funktionieren, weil der Build-Kontext per Git-URL definiert ist und
> nicht vom lokalen Ordner abhängt.

## 2. Secrets konfigurieren

```bash
# JWT-Secret erzeugen und in die .env schreiben:
JWT=$(python3 -c 'import secrets;print(secrets.token_urlsafe(64))')
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
# Danach .env öffnen und Mongo-Passwort, optional Keys eintragen:
$EDITOR .env
```

Pflicht-Variablen (nur für Produktion nötig – bei lokalem Testen werden sie automatisch ersetzt):

| Variable | Zweck | Default |
|---|---|---|
| `JWT_SECRET` | Signiert Session-Tokens. Wenn leer, erzeugt das Backend automatisch ein starkes Secret im Volume `backend_data`. | auto-generiert |
| `MONGO_INITDB_ROOT_USERNAME` | Mongo Root-User | `eros` |
| `MONGO_INITDB_ROOT_PASSWORD` | Mongo Root-Passwort | `eros-mongo-change-me` |
| `MONGO_DB_NAME` | App-Datenbank | `eros` |
| `CORS_ORIGINS` | Browser-Origins, die die API aufrufen dürfen | `http://localhost:8080` |
| `FRONTEND_HOST_PORT` | Port auf dem Host | `8080` |

Git-Quelle (optional überschreibbar):

| Variable | Zweck | Default |
|---|---|---|
| `EROS_REPO` | Git-Repo-URL | `https://github.com/itsbloodybyte/project-eros.git` |
| `EROS_REF` | Branch, Tag oder Commit-SHA | `main` |

Optional (für volle Feature-Parität):

| Variable | Zweck |
|---|---|
| `EMERGENT_LLM_KEY` | Gemini-Bildmoderation, KI-Features |
| `STRIPE_API_KEY` | Premium-Abos, Boost-Checkout |

## 3. Bauen & Starten

```bash
docker compose up --build -d
```

Beim ersten Start:

* Docker BuildKit klont den Repo-Subpfad (`backend/` bzw. `frontend/`) von GitHub in einen Build-Kontext.
* Mongo legt das `mongo_data` Volume an.
* Backend installiert Python-Abhängigkeiten, startet uvicorn auf `:8001`.
* Backend `on_event('startup')` sorgt für alle Mongo-Indizes.
* Frontend produziert ein statisches CRA-Bundle, nginx serviert es auf `:80`.

Aufrufen: **http://localhost:8080** – neuen Account registrieren, fertig.

## 4. Updates aus dem Repo ziehen

Weil der Build-Kontext eine Git-URL ist, zieht Docker bei jedem Build
den aktuellen Stand des Branches. Updates holen:

```bash
docker compose build --no-cache backend frontend
docker compose up -d
```

Einen bestimmten Tag/Branch festnageln – in der `.env` setzen:

```env
EROS_REF=v1.2.0          # oder ein Branch-Name, oder eine Commit-SHA
```

## 5. Admin-Account anlegen

Einen registrierten User zum Superadmin promovieren:

```bash
docker compose exec mongo mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --eval 'db.getSiblingDB("'"$MONGO_DB_NAME"'").users.updateOne({email:"you@example.com"}, {$set:{role:"superadmin"}})'
```

## 6. Logs / Health / Restart

```bash
docker compose logs -f backend        # Backend-Logs live
docker compose ps                     # Status aller Services
docker compose restart backend        # Einzelnen Service neu starten
docker compose down                   # Stoppen (Daten bleiben in Volumes)
docker compose down -v                # Stoppen + Mongo-Daten wipen
```

Healthchecks pro Service sind konfiguriert – `docker compose ps` zeigt
`healthy` / `starting` / `unhealthy`.

## 7. Horizontales Skalieren

* Das Backend läuft standardmäßig mit **einem** uvicorn-Worker. Rate-Limiter und WebSocket-Broadcast-Register leben im Prozessspeicher. Horizontales Skalieren erfordert einen Redis-backed Limiter + Sticky Ingress.
* Nginx liefert statische Assets bereits komprimiert; Backend liefert JSON über GZip-Middleware aus.

## 8. Produktions-Tipps

* TLS-terminierenden Reverse-Proxy (Caddy, Traefik) vor den `frontend`-Service stellen.
* `CORS_ORIGINS` auf die echte HTTPS-Origin setzen.
* `JWT_SECRET` und Mongo-Credentials in Produktion regelmäßig rotieren.
* `mongo_data` auf persistenten Storage mit regelmäßigen Snapshots mounten.
* `EROS_REF` auf einen versionierten Tag pinnen, statt auf `main`, um reproduzierbare Deployments zu erhalten.

## 9. Troubleshooting

### `No matching distribution found for emergentintegrations`

Das Paket `emergentintegrations` ist **nicht auf pypi.org**, sondern
auf einem öffentlichen Extra-Index
(`https://d33sy5i8bnduwe.cloudfront.net/simple/`). Die aktuelle YAML
übergibt diesen Index bereits an `pip install` – solltest du eine
veraltete YAML verwenden, lade die neueste Version:

```bash
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/docker-compose.yml
docker compose build --no-cache backend
```

### `failed to load cache key … "git": executable file not found in $PATH`

Tritt auf **Synology Container-Manager** und einigen anderen stripped-down
Docker-Distributionen auf, deren BuildKit kein eingebautes `git` mitbringt.

**Aktuelle YAML ist bereits darauf ausgelegt** – das Klonen läuft in
einem separaten Alpine-Container mit eigenem `git` (über
`dockerfile_inline` + Fetcher-Stage). Du brauchst also **kein Git auf
dem Host**.

Sollte der Fehler doch noch erscheinen, stelle sicher, dass du die
aktuellste Version der `docker-compose.yml` aus dem Repo heruntergeladen
hast:

```bash
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/docker-compose.yml
docker compose build --no-cache
docker compose up -d
```

### `JWT_SECRET must be set`

Veraltete YAML – lade die neue Version (siehe oben). Die aktuelle
Compose-Datei macht `JWT_SECRET` optional und persistiert ein
generiertes Secret im Volume `backend_data`.

### Ports bereits belegt

`FRONTEND_HOST_PORT` in `.env` oder als Umgebungsvariable überschreiben:

```bash
FRONTEND_HOST_PORT=9090 docker compose up -d
```

### Synology Container-Manager spezifisch

* Unter DSM 7.2+ den "Container Manager" verwenden (nicht die alte
  Docker-App).
* Im Container-Manager-Projekt legt Synology die `docker-compose.yml`
  üblicherweise unter `/volume1/docker/<projekt>/` an – `.env` muss
  daneben liegen, sonst findet Compose sie nicht.
* Nach Update der YAML den Stack komplett neu bauen:
  `docker compose down && docker compose up --build -d`.
