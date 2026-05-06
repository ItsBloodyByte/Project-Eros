"""Pydantic models."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal, Dict
from datetime import datetime, timezone
import uuid


Gender = Literal[
    "woman", "man", "nonbinary", "trans_woman", "trans_man", "genderqueer", "agender", "other"
]
Orientation = Literal[
    "straight", "gay", "lesbian", "bisexual", "pansexual", "asexual", "queer", "questioning", "other"
]
RelationshipType = Literal["casual", "serious", "friendship", "open", "undecided"]
SeekingRole = Literal["top", "bottom", "versatile", "any"]
GayPosition = Literal["top", "vers_top", "vers", "vers_bottom", "bottom", "side", "prefer_not_say"]
PhotoCategory = Literal["face", "individual", "nsfw"]
BodyType = Literal["slim", "athletic", "average", "muscular", "curvy", "bear", "cub", "chub", "twink", "jock", "dad"]
SmokingStatus = Literal["never", "sometimes", "often", "prefer_not_say"]
DrinkingStatus = Literal["never", "sometimes", "often", "prefer_not_say"]
DietType = Literal["omnivore", "vegetarian", "vegan", "pescetarian", "kosher", "halal", "other"]
StiStatus = Literal["negative", "positive_undetectable", "positive", "on_prep", "prefer_not_say"]
CupSize = Literal["A", "B", "C", "D", "DD", "E", "F", "G", "H", "I"]
PenisCategory = Literal["S", "M", "L", "XL", "XXL"]
Mood = Literal["sex_meet", "dating", "chatting"]
RelationshipStatus = Literal[
    "not_specified", "single", "taken", "married",
    "open_relationship", "complicated", "polyamorous", "divorced", "widowed"
]


def categorize_penis_length(cm: Optional[float]) -> Optional[str]:
    """Typisch: S<=12, M<=15, L<=18, XL<=21, XXL>21 cm Länge."""
    if cm is None:
        return None
    try:
        v = float(cm)
    except (TypeError, ValueError):
        return None
    if v <= 0:
        return None
    if v <= 12:
        return "S"
    if v <= 15:
        return "M"
    if v <= 18:
        return "L"
    if v <= 21:
        return "XL"
    return "XXL"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=40)
    # Either birth_date (preferred) OR age must be provided. `age` kept for backwards compat.
    birth_date: Optional[str] = Field(default=None, description="ISO date YYYY-MM-DD")
    age: Optional[int] = Field(default=None, ge=0, le=120)
    gender_identity: Gender
    consents: "ConsentFlags"
    # Partner-profile ("Paar-Account"): optional second persona stored in the same account
    account_type: Optional[Literal["single", "duo"]] = "single"
    persona_b: Optional[Dict] = None  # shape see PartnerPersona below


class ConsentFlags(BaseModel):
    terms: bool
    privacy: bool
    sensitive_data: bool  # orientation, kinks, location
    nsfw_view: bool = False


RegisterRequest.model_rebuild()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class Location(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float]  # [lng, lat]


class PrivacySettings(BaseModel):
    read_receipts: bool = True
    show_online_status: bool = True
    show_typing: bool = True
    hidden_mode: bool = False
    screenshot_notifications: bool = True
    stealth_mode: bool = False  # Premium: browse without leaving "seen" traces or visitor log
    # Staff can decide whether their role badge is visible on their public profile.
    # Defaults to True so existing staff remain visible until they explicitly hide it.
    role_badge_visible: bool = True
    # Opt-out for partner/couple invites. When False, other users cannot send
    # this account a "link as partner" invitation from a profile page.
    allow_couple_invites: bool = True


class UserPreferences(BaseModel):
    age_min: int = 18
    age_max: int = 99
    seeking_genders: List[Gender] = []
    radius_km: int = 50
    relationship_types: List[RelationshipType] = []
    seeking_roles: List[SeekingRole] = []
    kinks: List[str] = []
    only_with_photos: bool = True
    only_face_photo: bool = False
    only_verified: bool = False
    hide_seen: bool = False
    online_only: bool = False
    # Phase 4 extended
    body_types: List[BodyType] = []
    min_height_cm: Optional[int] = None
    max_height_cm: Optional[int] = None
    smoking: List[SmokingStatus] = []
    drinking: List[DrinkingStatus] = []
    diet: List[DietType] = []
    sti_status: List[StiStatus] = []
    cup_sizes: List[CupSize] = []
    penis_categories: List[PenisCategory] = []
    languages: List[str] = []
    ethnicities: List[str] = []
    moods: List[Mood] = []
    # NSFW/Content-acceptance filter: when True, hide profiles that signal
    # openness to NSFW content from the discover grid.
    hide_nsfw_profiles: bool = False
    # Gay-male-specific filter. Only applied when the searcher is themselves
    # a gay-male-like account AND seeks other men. Backend enforces the gate.
    gay_positions: List[GayPosition] = []


class PhotoMeta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: str  # base64 data URL (data:image/png;base64,...)
    nsfw_score: float = 0.0
    has_face: bool = False
    category: PhotoCategory = "individual"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    labels: List[str] = []
    is_primary: bool = False


class UserPublic(BaseModel):
    id: str
    display_name: str
    age: int
    gender_identity: Optional[Gender] = None
    pronouns: Optional[str] = None
    orientation: Optional[Orientation] = None
    bio: Optional[str] = None
    photos: List[PhotoMeta] = []
    verified: bool = False
    id_verified: bool = False
    distance_km: Optional[int] = None
    is_online: bool = False
    relationship_types: List[RelationshipType] = []
    seeking_roles: List[SeekingRole] = []
    kinks: List[str] = []
    role: str = "user"


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=2, max_length=40)
    age: Optional[int] = Field(default=None, ge=18, le=120)
    gender_identity: Optional[Gender] = None
    pronouns: Optional[str] = None
    orientation: Optional[Orientation] = None
    bio: Optional[str] = None
    location: Optional[Location] = None
    preferences: Optional[UserPreferences] = None
    privacy: Optional[PrivacySettings] = None
    relationship_types: Optional[List[RelationshipType]] = None
    seeking_roles: Optional[List[SeekingRole]] = None
    kinks: Optional[List[str]] = None
    # Phase 4 extended
    height_cm: Optional[int] = Field(default=None, ge=100, le=250)
    body_type: Optional[BodyType] = None
    ethnicity: Optional[str] = None
    languages: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    smoking: Optional[SmokingStatus] = None
    drinking: Optional[DrinkingStatus] = None
    diet: Optional[DietType] = None
    sti_status: Optional[StiStatus] = None
    sti_tested_on: Optional[str] = None  # ISO date string
    cup_size: Optional[CupSize] = None
    penis_length_cm: Optional[float] = Field(default=None, ge=1, le=40)
    penis_girth_cm: Optional[float] = Field(default=None, ge=1, le=40)
    current_mood: Optional[Mood] = None
    relationship_status: Optional[RelationshipStatus] = None
    # Signals whether this profile is open to receiving NSFW content (DMs,
    # explicit photos from albums, etc.). Exposed as a dezent pill on the
    # public profile header.
    accept_nsfw: Optional[bool] = None
    # Queer-male role/position preference. Only relevant for and stored on
    # gay-male-like accounts (man/trans_man + gay/bi/pan/queer/questioning).
    # Rendered + accepted conditionally on both the editor and the API.
    gay_position: Optional[GayPosition] = None


class MoodUpdateRequest(BaseModel):
    current_mood: Optional[Mood] = None


class PhotoUploadRequest(BaseModel):
    data_url: str  # data:image/png;base64,...
    is_primary: bool = False


class LikeRequest(BaseModel):
    target_user_id: str


class LikeResponse(BaseModel):
    liked: bool
    matched: bool
    match_id: Optional[str] = None


class MatchItem(BaseModel):
    id: str
    user: UserPublic
    created_at: datetime
    last_message_at: Optional[datetime] = None
    unread_count: int = 0


class SendMessageRequest(BaseModel):
    match_id: str
    text: Optional[str] = None
    media_data_url: Optional[str] = None
    self_destruct_seconds: Optional[int] = None  # None = persistent


class MessagePublic(BaseModel):
    id: str
    match_id: str
    sender_id: str
    text: Optional[str] = None
    media_data_url: Optional[str] = None
    nsfw_score: Optional[float] = None
    self_destruct_at: Optional[datetime] = None
    read_by: List[str] = []
    created_at: datetime


class AlbumCreate(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    description: Optional[str] = None
    is_nsfw: bool = False


class AlbumPublic(BaseModel):
    id: str
    owner_id: str
    title: str
    description: Optional[str] = None
    is_nsfw: bool = False
    photos: List[PhotoMeta] = []
    shared_with: List[str] = []
    created_at: datetime


class AlbumShareRequest(BaseModel):
    album_id: str
    user_id: str
    expires_at: Optional[datetime] = None
    # When True (default), the share only "activates" once both sides have
    # shared at least one album with each other. Revoking either side cascades
    # the revocation back to the partner. False keeps the legacy one-way
    # behaviour.
    mutual_required: bool = True


class AlbumUnlockRequest(BaseModel):
    album_id: str
    message: Optional[str] = None


class ReportCreate(BaseModel):
    target_type: Literal["user", "photo", "message", "album"]
    target_id: str
    reason: Literal["spam", "harassment", "nudity", "underage", "impersonation", "other"]
    detail: Optional[str] = None


class ReportPublic(BaseModel):
    id: str
    reporter_id: str
    target_type: str
    target_id: str
    reason: str
    detail: Optional[str] = None
    status: Literal["open", "reviewing", "resolved", "rejected"] = "open"
    created_at: datetime


class AdminBanRequest(BaseModel):
    user_id: str
    reason: str


class ChatPrefsUpdate(BaseModel):
    read_receipts: Optional[bool] = None
    show_typing: Optional[bool] = None


# ----- Phase 3 additions -----

class EmailVerifyRequest(BaseModel):
    code: str = Field(min_length=4, max_length=10)


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class MfaEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MfaDisableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class LoginMfaRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: Optional[str] = None


class VideoUploadRequest(BaseModel):
    data_url: str  # data:video/mp4;base64,...
    caption: Optional[str] = None
    duration_seconds: Optional[float] = Field(default=None, ge=0, le=600)
    width: Optional[int] = Field(default=None, ge=0, le=10000)
    height: Optional[int] = Field(default=None, ge=0, le=10000)


class PremiumUpgradeRequest(BaseModel):
    # MVP: self-service toggle (no real payment)
    duration_days: int = 30


class BoostActivateRequest(BaseModel):
    duration_minutes: int = 30


class MessageFirstRequest(BaseModel):
    target_user_id: str
    text: str = Field(min_length=1, max_length=500)


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    description: Optional[str] = None
    starts_at: datetime
    location_name: Optional[str] = None
    location: Optional[Location] = None
    is_nsfw: bool = False
    cover_data_url: Optional[str] = None


class EventRsvpRequest(BaseModel):
    status: Literal["going", "interested", "not_going"]


class AdminSetRoleRequest(BaseModel):
    user_id: str
    role: Literal["user", "support", "content_reviewer", "moderator", "admin", "superadmin"]


# ----- Phase 5 additions -----

class TravelPlanCreate(BaseModel):
    city: str = Field(min_length=2, max_length=80)
    country: Optional[str] = None
    location: Optional[Location] = None
    starts_at: datetime
    ends_at: datetime
    note: Optional[str] = None


class IdVerificationSubmit(BaseModel):
    document_type: Literal["passport", "id_card", "drivers_license"]
    selfie_data_url: str  # data:image/...
    document_data_url: str  # data:image/...


class AdminReviewIdRequest(BaseModel):
    user_id: str
    decision: Literal["approved", "rejected"]
    note: Optional[str] = None


class CheckoutRequest(BaseModel):
    package_id: str  # admin-configured; id_verification is free and not allowed here
    origin_url: str


class PaymentPackage(BaseModel):
    id: str
    amount: float
    currency: str = "eur"
    desc: str
    enabled: bool = True
    kind: Literal["premium", "boost", "other"] = "premium"
    days: Optional[int] = None  # for premium (30 / 365)
    minutes: Optional[int] = None  # for boost (e.g. 30)


class PaymentConfigUpdate(BaseModel):
    provider: Literal["stripe", "paypal", "mollie", "klarna", "paddle", "custom", "disabled"] = "disabled"
    stripe_api_key: Optional[str] = None
    # Per-provider credential map. Only updated fields overwrite stored ones.
    # Example:
    #   {"stripe": {"secret_key": "sk_..."},
    #    "paypal": {"client_id": "...", "secret": "..."},
    #    "mollie": {"api_key": "..."},
    #    "klarna": {"username": "...", "password": "..."},
    #    "paddle": {"vendor_id": "...", "api_key": "..."},
    #    "custom": {"endpoint": "...", "token": "..."}}
    provider_keys: Optional[Dict[str, Dict[str, str]]] = None
    enabled: bool = False
    packages: Optional[List[PaymentPackage]] = None


class AIConfigUpdate(BaseModel):
    provider: Literal["gemini", "openai", "ollama"]
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # for Ollama / custom endpoints
    enabled: bool = True


class AdminUserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    email_verified: Optional[bool] = None
    verified: Optional[bool] = None
    id_verified: Optional[bool] = None
    banned: Optional[bool] = None
    ban_reason: Optional[str] = None
    premium_expires_at: Optional[datetime] = None
    shadow_restricted: Optional[bool] = None
    shadow_reason: Optional[str] = None

class AcquaintanceRequestBody(BaseModel):
    target_user_id: str


class AcquaintanceResponseBody(BaseModel):
    action: Literal["confirm", "reject"]


class LegalPageUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content_markdown: str = Field(default="", max_length=200_000)


class LocationHeartbeatRequest(BaseModel):
    # [lng, lat]
    coordinates: List[float]
    accuracy_m: Optional[float] = None


class PayPalOrderRequest(BaseModel):
    package_id: str
    origin_url: str


class KlarnaSessionRequest(BaseModel):
    package_id: str
    country: str = "DE"


class KlarnaPlaceOrderRequest(BaseModel):
    package_id: str
    authorization_token: str
    country: str = "DE"
