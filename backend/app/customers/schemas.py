import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    re.IGNORECASE,
)
PHONE_ALLOWED_PATTERN = re.compile(r"^[+0-9().\-\s]+$")


class GuestCustomerInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(min_length=7, max_length=30)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if isinstance(value, str):
            return " ".join(value.strip().split())
        return value

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("email must be a valid address.")
        return value

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        candidate = value.strip()
        if not PHONE_ALLOWED_PATTERN.fullmatch(candidate):
            raise ValueError("phone contains unsupported characters.")
        digits = "".join(character for character in candidate if character.isdigit())
        if not 7 <= len(digits) <= 15:
            raise ValueError("phone must contain between 7 and 15 digits.")
        return f"+{digits}" if candidate.startswith("+") else digits
