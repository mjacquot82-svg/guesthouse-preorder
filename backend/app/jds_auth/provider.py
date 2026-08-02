from dataclasses import dataclass
from typing import Protocol

import httpx

from app.jds_auth.config import AuthSettings


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
    def authenticate_password(self, email: str, password: str) -> ProviderAuthentication: ...
    def request_password_reset(self, email: str, redirect_url: str) -> None: ...
    def verify_email_token(self, token_hash: str, token_type: str) -> ProviderAuthentication: ...
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
        raise IdentityProviderError("Identity provider request failed.")
