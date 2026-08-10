import json
from dataclasses import dataclass
from typing import Callable, Protocol

from app.push.config import PushSettings


@dataclass(frozen=True)
class ProviderResult:
    accepted: bool
    permanent: bool
    expired: bool = False
    http_status: int | None = None
    error_code: str | None = None


class PushProvider(Protocol):
    def send(
        self,
        subscription: dict,
        payload: dict,
        ttl: int,
        urgency: str,
        topic: str,
    ) -> ProviderResult: ...


def classify_status(status: int | None) -> ProviderResult:
    if status is not None and 200 <= status < 300:
        return ProviderResult(True, permanent=False, http_status=status)
    if status in (404, 410):
        return ProviderResult(
            False,
            permanent=True,
            expired=True,
            http_status=status,
            error_code="subscription_expired",
        )
    transient = status is None or status == 429 or (status is not None and status >= 500)
    return ProviderResult(
        False,
        permanent=not transient,
        http_status=status,
        error_code="network_error" if status is None else "push_service_error",
    )


class PyWebPushProvider:
    def __init__(self, settings: PushSettings, send_impl: Callable | None = None):
        self.settings = settings
        if send_impl is None:
            from pywebpush import webpush

            send_impl = webpush
        self._send = send_impl

    def send(self, subscription: dict, payload: dict, ttl: int, urgency: str, topic: str) -> ProviderResult:
        try:
            response = self._send(
                subscription_info=subscription,
                data=json.dumps(payload, separators=(",", ":")),
                vapid_private_key=self.settings.vapid_private_key,
                vapid_claims={"sub": self.settings.vapid_subject},
                ttl=ttl,
                headers={"Urgency": urgency, "Topic": topic},
                timeout=self.settings.request_timeout_seconds,
            )
            return classify_status(getattr(response, "status_code", None))
        except Exception as error:
            # Deliberately discard exception text: it can contain a capability URL.
            return classify_status(getattr(getattr(error, "response", None), "status_code", None))
