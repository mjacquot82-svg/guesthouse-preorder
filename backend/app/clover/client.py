from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse

import httpx

from app.clover.config import CloverSettings


class CloverApiError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "clover_api_error",
        upstream_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.upstream_status = upstream_status


@dataclass(frozen=True)
class CloverTokenPair:
    access_token: str
    refresh_token: str
    expires_at: datetime


class CloverClient:
    def __init__(
        self,
        settings: CloverSettings,
        *,
        http_client: httpx.Client | None = None,
    ):
        self.settings = settings
        self.http_client = http_client

    def _post(self, url: str, **kwargs: object) -> httpx.Response:
        try:
            if self.http_client is not None:
                return self.http_client.post(url, **kwargs)
            timeout = httpx.Timeout(15, connect=5)
            with httpx.Client(timeout=timeout) as client:
                return client.post(url, **kwargs)
        except httpx.TimeoutException as error:
            raise CloverApiError(
                "Clover request timed out.", code="clover_timeout"
            ) from error
        except httpx.RequestError as error:
            raise CloverApiError(
                "Unable to reach Clover.", code="clover_unreachable"
            ) from error

    def authorization_url(self, state: str) -> str:
        query = urlencode(
            {
                "client_id": self.settings.app_id,
                "redirect_uri": self.settings.callback_url,
                "response_type": "code",
                "state": state,
            }
        )
        return f"{self.settings.authorize_base_url}/oauth/v2/authorize?{query}"

    def exchange_code(self, code: str) -> CloverTokenPair:
        return self._token_request(
            "/oauth/v2/token",
            {
                "client_id": self.settings.app_id,
                "client_secret": self.settings.app_secret,
                "code": code,
            },
        )

    def refresh_access_token(self, refresh_token: str) -> CloverTokenPair:
        return self._token_request(
            "/oauth/v2/refresh",
            {
                "client_id": self.settings.app_id,
                "refresh_token": refresh_token,
            },
        )

    def _token_request(self, path: str, payload: dict[str, str]) -> CloverTokenPair:
        response = self._post(
            f"{self.settings.api_base_url}{path}",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json=payload,
        )
        data = self._response_json(response, "Clover token request failed")
        try:
            expires_at = datetime.fromtimestamp(
                int(data["access_token_expiration"]), tz=timezone.utc
            )
            if expires_at <= datetime.now(timezone.utc):
                raise ValueError("access token is already expired")
            access_token = data["access_token"]
            refresh_token = data["refresh_token"]
            if (
                not isinstance(access_token, str)
                or not access_token
                or not isinstance(refresh_token, str)
                or not refresh_token
            ):
                raise ValueError("tokens must be non-empty strings")
            return CloverTokenPair(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
            )
        except (KeyError, TypeError, ValueError) as error:
            raise CloverApiError("Clover returned an invalid token response.") from error

    def create_checkout(
        self,
        *,
        access_token: str,
        merchant_id: str,
        payload: dict,
    ) -> dict:
        response = self._post(
            (
                f"{self.settings.api_base_url}"
                "/invoicingcheckoutservice/v1/checkouts"
            ),
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "User-Agent": "guesthouse-preorder/0.1",
                "X-Clover-Merchant-Id": merchant_id,
            },
            json=payload,
        )
        data = self._response_json(response, "Clover checkout request failed")
        href = data.get("href")
        checkout_session_id = data.get("checkoutSessionId")
        if (
            not isinstance(href, str)
            or not href
            or urlparse(href).scheme != "https"
            or not urlparse(href).hostname
            or not isinstance(checkout_session_id, str)
            or not checkout_session_id
        ):
            raise CloverApiError("Clover returned an invalid checkout response.")
        return data

    @staticmethod
    def _response_json(response: httpx.Response, message: str) -> dict:
        try:
            data = response.json()
        except ValueError as error:
            raise CloverApiError(
                f"{message}: invalid response.",
                code="clover_invalid_response",
                upstream_status=response.status_code,
            ) from error
        if not response.is_success:
            raise CloverApiError(
                f"{message} ({response.status_code}).",
                code="clover_rejected_request",
                upstream_status=response.status_code,
            )
        if not isinstance(data, dict):
            raise CloverApiError(
                f"{message}: invalid response.",
                code="clover_invalid_response",
                upstream_status=response.status_code,
            )
        return data
