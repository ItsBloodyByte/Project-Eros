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
    "",
}
_JWT_SECRET_ENV = os.environ.get("JWT_SECRET", "").strip()

if _JWT_SECRET_ENV and _JWT_SECRET_ENV not in _INSECURE_DEFAULT_SECRETS:
    JWT_SECRET = _JWT_SECRET_ENV
else:
    # No secure secret configured – generate a strong ephemeral one so the
    # server still boots in dev, but refuse to persist an insecure default.
    # IMPORTANT: set JWT_SECRET in .env in production to a stable value,
    # otherwise every restart invalidates existing tokens.
    JWT_SECRET = secrets.token_urlsafe(64)
    import logging as _logging
    _logging.getLogger("uvicorn.error").warning(
        "JWT_SECRET is unset or uses an insecure default. Generated an "
        "ephemeral 64-byte secret for this process. Set JWT_SECRET in .env "
        "to a strong stable value in production."
    )

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
