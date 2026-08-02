from dataclasses import dataclass
import logging
from typing import Protocol

import httpx

from app.jds_auth.config import AuthSettings

logger = logging.getLogger(__name__)

_DIAGNOSTIC_RESPONSE_HEADERS = frozenset(
    {
        "cf-ray",
        "content-type",
        "date",
        "retry-after",
        "sb-gateway-version",
        "x-request-id",
        "x-sb-error-code",
    }
)
_MAX_DIAGNOSTIC_VALUE_LENGTH = 500


class IdentityProviderError(RuntimeError):
    pass


class InvalidCredentialsError(IdentityProviderError):
    pass


@dataclass(frozen=True)
class ProviderIdentity:
    issuer: str
    subject: str
    email: str
    email_verified: bool
    assurance_level: str = "aal1"


@dataclass(frozen=True)
class ProviderAuthentication:
    identity: ProviderIdentity
    access_token: str


class IdentityProvider(Protocol):
    def register_user(self, email: str, password: str, redirect_url: str) -> ProviderIdentity: ...
    def authenticate_password(self, email: str, password: str) -> ProviderAuthentication: ...
    def request_password_reset(self, email: str, redirect_url: str) -> None: ...
    def verify_email_token(self, token_hash: str, token_type: str) -> ProviderAuthentication: ...
    def resend_verification(self, email: str, redirect_url: str) -> None: ...
    def update_password(self, access_token: str, password: str) -> None: ...
    def invite_user(self, email: str, redirect_url: str) -> str: ...


class SupabaseIdentityProvider:
    """Minimal provider adapter; domain services never depend on Supabase shapes."""

    def __init__(
        self,
        settings: AuthSettings,
        *,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._settings = settings
        self._client = http_client or httpx.Client(timeout=10.0)
        self._base_url = f"{settings.supabase_url.rstrip('/')}/auth/v1"

    def authenticate_password(self, email: str, password: str) -> ProviderAuthentication:
        response = self._request(
            "POST",
            "/token?grant_type=password",
            json={"email": email, "password": password},
        )
        if response.status_code in {400, 401}:
            raise InvalidCredentialsError("Authentication failed.")
        return self._authentication(response)

    def register_user(self, email: str, password: str, redirect_url: str) -> ProviderIdentity:
        response = self._request(
            "POST", "/signup", json={"email": email, "password": password},
            params={"redirect_to": redirect_url},
        )
        self._require_success(response)
        payload = response.json()
        user = payload.get("user") or payload
        subject = user.get("id") if isinstance(user, dict) else None
        provider_email = user.get("email") if isinstance(user, dict) else None
        if not all(isinstance(value, str) and value for value in (subject, provider_email)):
            raise IdentityProviderError("Identity provider returned an invalid registration.")
        return ProviderIdentity(
            issuer=f"{self._settings.supabase_url.rstrip('/')}/auth/v1",
            subject=subject,
            email=provider_email.strip().lower(),
            email_verified=bool(user.get("email_confirmed_at") or user.get("confirmed_at")),
        )

    def request_password_reset(self, email: str, redirect_url: str) -> None:
        response = self._request(
            "POST",
            "/recover",
            json={"email": email},
            params={"redirect_to": redirect_url},
        )
        self._require_success(response)

    def verify_email_token(
        self,
        token_hash: str,
        token_type: str,
    ) -> ProviderAuthentication:
        response = self._request(
            "POST",
            "/verify",
            json={"token_hash": token_hash, "type": token_type},
        )
        return self._authentication(response)

    def resend_verification(self, email: str, redirect_url: str) -> None:
        response = self._request(
            "POST",
            "/resend",
            json={"type": "signup", "email": email},
            params={"redirect_to": redirect_url},
        )
        self._require_success(response)

    def update_password(self, access_token: str, password: str) -> None:
        response = self._request(
            "PUT",
            "/user",
            json={"password": password},
            access_token=access_token,
        )
        self._require_success(response)

    def invite_user(self, email: str, redirect_url: str) -> str:
        response = self._request(
            "POST",
            "/invite",
            json={"email": email},
            params={"redirect_to": redirect_url},
            admin=True,
        )
        self._require_success(response)
        payload = response.json()
        subject = payload.get("id") or payload.get("user", {}).get("id")
        if not isinstance(subject, str) or not subject:
            raise IdentityProviderError("Identity provider returned an invalid invitation.")
        return subject

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, object],
        access_token: str | None = None,
        admin: bool = False,
        params: dict[str, str] | None = None,
    ) -> httpx.Response:
        headers = {
            "apikey": (
                self._settings.supabase_secret_key
                if admin
                else self._settings.supabase_publishable_key
            ),
        }
        if admin:
            headers["Authorization"] = f"Bearer {self._settings.supabase_secret_key}"
        elif access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        try:
            return self._client.request(
                method,
                f"{self._base_url}{path}",
                json=json,
                headers=headers,
                params=params,
            )
        except httpx.HTTPError as error:
            logger.exception(
                "supabase_auth_transport_failed operation=%s exception=%s",
                path,
                type(error).__name__,
            )
            raise IdentityProviderError("Identity provider is unavailable.") from error

    def _authentication(self, response: httpx.Response) -> ProviderAuthentication:
        self._require_success(response)
        payload = response.json()
        user = payload.get("user") or payload
        token = payload.get("access_token")
        subject = user.get("id") if isinstance(user, dict) else None
        email = user.get("email") if isinstance(user, dict) else None
        verified = bool(
            isinstance(user, dict)
            and (user.get("email_confirmed_at") or user.get("confirmed_at"))
        )
        if not all(isinstance(value, str) and value for value in (token, subject, email)):
            raise IdentityProviderError("Identity provider returned an invalid response.")
        return ProviderAuthentication(
            identity=ProviderIdentity(
                issuer=f"{self._settings.supabase_url.rstrip('/')}/auth/v1",
                subject=subject,
                email=email.strip().lower(),
                email_verified=verified,
                assurance_level=str(payload.get("aal", "aal1")),
            ),
            access_token=token,
        )

    @staticmethod
    def _require_success(response: httpx.Response) -> None:
        if response.is_success:
            return
        provider_code = "unknown"
        provider_message = "unknown"
        try:
            payload = response.json()
            if isinstance(payload, dict):
                candidate = payload.get("code") or payload.get("error_code")
                if isinstance(candidate, str) and candidate:
                    provider_code = SupabaseIdentityProvider._diagnostic_value(candidate)
                candidate = payload.get("message") or payload.get("msg") or payload.get("error_description")
                if isinstance(candidate, str) and candidate:
                    provider_message = SupabaseIdentityProvider._diagnostic_value(candidate)
        except (ValueError, TypeError):
            pass
        try:
            operation = response.request.url.path
        except RuntimeError:
            operation = "unknown"
        response_headers = {
            name.lower(): SupabaseIdentityProvider._diagnostic_value(value)
            for name, value in response.headers.items()
            if name.lower() in _DIAGNOSTIC_RESPONSE_HEADERS
        }
        retry_after = response.headers.get("Retry-After")
        logger.error(
            "supabase_auth_request_failed operation=%s status=%s code=%s "
            "message=%r retry_after=%r response_headers=%s",
            operation,
            response.status_code,
            provider_code,
            provider_message,
            SupabaseIdentityProvider._diagnostic_value(retry_after) if retry_after else None,
            response_headers,
        )
        raise IdentityProviderError("Identity provider request failed.")

    @staticmethod
    def _diagnostic_value(value: str) -> str:
        """Make provider diagnostics single-line and bounded before logging."""
        sanitized = "".join(character if character.isprintable() else " " for character in value)
        return sanitized[:_MAX_DIAGNOSTIC_VALUE_LENGTH]
