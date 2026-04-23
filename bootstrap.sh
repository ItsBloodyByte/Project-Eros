#!/usr/bin/env bash
# =====================================================================
#  Eros – Docker Bootstrap
#  Legt im aktuellen Ordner docker-compose.yml und .env an
#  (mit automatisch generierten Secrets) und startet die Stacks.
#
#  Verwendung:
#      bash <(curl -fsSL https://raw.githubusercontent.com/itsbloodybyte/project-eros/main/bootstrap.sh)
# =====================================================================
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/itsbloodybyte/project-eros/main"

say() { printf "\033[1;32m[eros]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

# 1. Vorbedingungen prüfen
command -v docker >/dev/null 2>&1 || die "Docker ist nicht installiert. Bitte zuerst Docker Engine >= 23.0 installieren."
docker compose version >/dev/null 2>&1 || die "Docker Compose Plugin fehlt. Bitte 'docker-compose-plugin' installieren."
command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || die "python3 wird zum Secret-Erzeugen benötigt."
command -v curl >/dev/null 2>&1 || die "curl wird benötigt."

PY=$(command -v python3 || command -v python)

# 2. docker-compose.yml ziehen, falls nicht vorhanden
if [[ ! -f docker-compose.yml ]]; then
  say "Lade docker-compose.yml aus dem Repo ..."
  curl -fsSL -o docker-compose.yml "${REPO_RAW}/docker-compose.yml"
else
  say "docker-compose.yml existiert bereits – wird nicht überschrieben."
fi

# 3. .env anlegen, falls nicht vorhanden
if [[ ! -f .env ]]; then
  say "Lade .env.example und erzeuge .env mit generierten Secrets ..."
  curl -fsSL -o .env.example "${REPO_RAW}/.env.example"
  cp .env.example .env

  JWT=$("$PY" -c 'import secrets;print(secrets.token_urlsafe(64))')
  MPW=$("$PY" -c 'import secrets;print(secrets.token_urlsafe(32))')

  # GNU/BSD sed kompatibel (temp file)
  tmpf=$(mktemp)
  awk -v jwt="$JWT" -v mpw="$MPW" '
    /^JWT_SECRET=/            { print "JWT_SECRET=" jwt; next }
    /^MONGO_INITDB_ROOT_PASSWORD=/ { print "MONGO_INITDB_ROOT_PASSWORD=" mpw; next }
    { print }
  ' .env > "$tmpf" && mv "$tmpf" .env
  chmod 600 .env
  say ".env erzeugt mit zufälligem JWT_SECRET (64B) und Mongo-Passwort (32B)."
  warn "Optionale Keys (EMERGENT_LLM_KEY, STRIPE_API_KEY) bei Bedarf in .env ergänzen."
else
  say ".env existiert bereits – wird nicht überschrieben."
fi

# 4. Build & up
say "Starte docker compose up --build -d ..."
docker compose up --build -d

say "Fertig. App erreichbar unter: http://localhost:$(grep -E '^FRONTEND_HOST_PORT=' .env | cut -d= -f2 2>/dev/null || echo 8585)"
say "Logs live verfolgen:  docker compose logs -f backend"
