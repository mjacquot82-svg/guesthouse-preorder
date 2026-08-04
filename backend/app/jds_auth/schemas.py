from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from uuid import UUID


class AuthSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(AuthSchema):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=1024)


class CustomerLoginRequest(LoginRequest):
    keep_signed_in: bool = False


class CustomerRegistrationRequest(LoginRequest):
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=15, max_length=1024)

    @field_validator("display_name")
    @classmethod
    def normalize_registration_name(cls, value: str) -> str:
        return " ".join(value.strip().split())


class EmailVerificationRequest(AuthSchema):
    token_hash: str = Field(min_length=20, max_length=2048)


class PasswordResetRequest(AuthSchema):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PasswordCompletionRequest(AuthSchema):
    token_hash: str = Field(min_length=20, max_length=2048)
    password: str = Field(min_length=15, max_length=1024)


class CustomerPasswordCompletionRequest(AuthSchema):
    token_hash: str | None = Field(default=None, min_length=20, max_length=2048)
    access_token: str | None = Field(default=None, min_length=20, max_length=4096)
    password: str = Field(min_length=15, max_length=1024)

    @model_validator(mode="after")
    def require_one_recovery_credential(self) -> "CustomerPasswordCompletionRequest":
        if bool(self.token_hash) == bool(self.access_token):
            raise ValueError("Exactly one recovery credential is required.")
        return self


class InvitationAcceptRequest(PasswordCompletionRequest):
    invitation_id: UUID
    invitation_secret: str = Field(min_length=32, max_length=1024)
    display_name: str = Field(min_length=1, max_length=200)

    @field_validator("display_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class InvitationCreateRequest(AuthSchema):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: str = Field(pattern="^(owner|manager|staff)$")


class SessionResponse(AuthSchema):
    authenticated: bool = True
    user_id: str
    email: str
    display_name: str
    organization_id: str
    role: str
    permissions: list[str]
    csrf_token: str


class MessageResponse(AuthSchema):
    message: str
