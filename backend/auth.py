"""JWT auth utilities."""
import os
import secrets
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

_INSECURE_DEFAULT_SECRETS = {
    "change-me-in-prod-supersecret-abcdef123456",
    "changeme",
    "secret",
    "CHANGE_ME_TO_A_64_BYTE_RANDOM_STRING",
    "",
}
_JWT_SECRET_ENV = os.environ.get("JWT_SECRET", "").strip()

# Where to persist an auto-generated secret when JWT_SECRET is not provided.
# Prefers a mounted volume (/data) inside containers; falls back to CWD.
_SECRET_DIRS = [
    os.environ.get("EROS_DATA_DIR", "").strip() or None,
    "/data",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), ".secrets"),
]


def _load_or_create_persistent_secret() -> str:
    import logging as _logging
    log = _logging.getLogger("uvicorn.error")
    for base in _SECRET_DIRS:
        if not base:
            continue
        try:
            os.makedirs(base, exist_ok=True)
            path = os.path.join(base, "jwt_secret.key")
            if os.path.isfile(path):
                with open(path, "r", encoding="utf-8") as fh:
                    val = fh.read().strip()
                if val and val not in _INSECURE_DEFAULT_SECRETS:
                    log.info("JWT_SECRET loaded from persistent file: %s", path)
                    return val
            # create new
            new_val = secrets.token_urlsafe(64)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(new_val)
            try:
                os.chmod(path, 0o600)
            except Exception:
                pass
            log.warning(
                "JWT_SECRET was not set. Generated a fresh 64-byte secret "
                "and persisted it to %s so existing sessions survive restarts. "
                "For multi-instance deployments set JWT_SECRET explicitly in .env.",
                path,
            )
            return new_val
        except Exception as exc:
            log.debug("Could not use secret dir %s: %s", base, exc)
            continue
    # Last-resort: ephemeral (invalidates tokens on restart)
    log.warning(
        "JWT_SECRET is unset and no writable persistent directory was found. "
        "Generated an EPHEMERAL 64-byte secret – every restart will log users out. "
        "Set JWT_SECRET in .env for production."
    )
    return secrets.token_urlsafe(64)


if _JWT_SECRET_ENV and _JWT_SECRET_ENV not in _INSECURE_DEFAULT_SECRETS:
    JWT_SECRET = _JWT_SECRET_ENV
else:
    JWT_SECRET = _load_or_create_persistent_secret()

JWT_ALG = "HS256"
JWT_EXP_DAYS = 30

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str = "user") -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


async def get_current_user_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(credentials.credentials)


async def get_optional_user_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return None
