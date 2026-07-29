from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet

from app.api.v1.clover import _checkout_payload
from app.clover.client import CloverApiError, CloverClient
from app.clover.config import CloverConfigurationError, CloverSettings
from app.clover.security import (
    InvalidWebhookSignature,
    InvalidOAuthState,
    TokenCipher,
    create_oauth_state,
    verify_oauth_state,
    verify_webhook_signature,
)
from app.orders.models import Order, OrderItem


def settings(**overrides: str) -> CloverSettings:
    values = {
        "app_id": "app-id",
        "app_secret": "app-secret",
        "token_encryption_key": Fernet.generate_key().decode(),
        "state_secret": "s" * 48,
        "webhook_secret": "w" * 48,
        "public_app_url": "https://api.example.com",
        "frontend_url": "https://shop.example.com",
        "merchant_id": "merchant-id",
        "environment": "sandbox",
    }
    values.update(overrides)
    return CloverSettings(**values)


def test_clover_settings_expose_registered_callback_and_environment_hosts() -> None:
    config = settings()
    config.validate()

    assert config.callback_url == (
        "https://api.example.com/api/v1/clover/oauth/callback"
    )
    assert config.launch_url == "https://api.example.com/api/v1/clover/oauth/start"
    assert config.authorize_base_url == "https://sandbox.dev.clover.com"
    assert config.api_base_url == "https://apisandbox.dev.clover.com"


def test_clover_settings_reject_insecure_public_urls() -> None:
    with pytest.raises(CloverConfigurationError, match="HTTPS"):
        settings(frontend_url="http://shop.example.com").validate()
    with pytest.raises(CloverConfigurationError, match="without credentials"):
        settings(frontend_url="https://shop.example.com/path").validate()
    with pytest.raises(CloverConfigurationError, match="without credentials"):
        settings(frontend_url="https://shop.example.com/").validate()
    with pytest.raises(CloverConfigurationError, match="Fernet"):
        settings(token_encryption_key="not-a-key").validate()


def test_oauth_state_is_signed_and_expires() -> None:
    state = create_oauth_state("secret", now=100)
    verify_oauth_state(state, "secret", now=200)

    with pytest.raises(InvalidOAuthState):
        verify_oauth_state(state, "different-secret", now=200)
    with pytest.raises(InvalidOAuthState, match="expired"):
        verify_oauth_state(state, "secret", now=701)


def test_token_cipher_round_trip() -> None:
    cipher = TokenCipher(Fernet.generate_key().decode())
    encrypted = cipher.encrypt("sensitive-token")

    assert encrypted != "sensitive-token"
    assert cipher.decrypt(encrypted) == "sensitive-token"


def test_hosted_checkout_webhook_signature() -> None:
    import hashlib
    import hmac

    body = b'{"status":"APPROVED"}'
    signature = hmac.new(
        b"webhook-secret", b"100." + body, hashlib.sha256
    ).hexdigest()
    verify_webhook_signature(
        body,
        f"t=100,v1={signature}",
        "webhook-secret",
        now=200,
    )
    with pytest.raises(InvalidWebhookSignature, match="expired"):
        verify_webhook_signature(
            body,
            f"t=100,v1={signature}",
            "webhook-secret",
            now=401,
        )


def test_oauth_authorization_and_token_exchange_contract() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "access_token": "access",
                "access_token_expiration": 2_000_000_000,
                "refresh_token": "refresh",
                "refresh_token_expiration": 2_100_000_000,
            },
        )

    client = CloverClient(
        settings(),
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    authorization_url = urlparse(client.authorization_url("signed-state"))
    query = parse_qs(authorization_url.query)

    assert authorization_url.netloc == "sandbox.dev.clover.com"
    assert query["client_id"] == ["app-id"]
    assert query["response_type"] == ["code"]
    assert query["state"] == ["signed-state"]
    assert query["redirect_uri"] == [
        "https://api.example.com/api/v1/clover/oauth/callback"
    ]

    tokens = client.exchange_code("authorization-code")
    assert tokens.access_token == "access"
    assert tokens.refresh_token == "refresh"
    assert tokens.expires_at == datetime.fromtimestamp(
        2_000_000_000, tz=timezone.utc
    )
    assert requests[0].url.path == "/oauth/v2/token"
    assert requests[0].headers["content-type"] == "application/json"


def test_hosted_checkout_uses_server_side_bearer_token() -> None:
    captured: httpx.Request | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured
        captured = request
        return httpx.Response(
            200,
            json={
                "href": "https://checkout.clover.test/session",
                "checkoutSessionId": "session-id",
            },
        )

    client = CloverClient(
        settings(),
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    response = client.create_checkout(
        access_token="private-token",
        merchant_id="merchant-id",
        payload={"customer": {}, "shoppingCart": {"lineItems": []}},
    )

    assert response["checkoutSessionId"] == "session-id"
    assert captured is not None
    assert captured.headers["authorization"] == "Bearer private-token"
    assert captured.headers["x-clover-merchant-id"] == "merchant-id"


def test_clover_network_failures_and_insecure_checkout_urls_are_rejected() -> None:
    def network_failure(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("internal detail")

    unavailable = CloverClient(
        settings(),
        http_client=httpx.Client(transport=httpx.MockTransport(network_failure)),
    )
    with pytest.raises(CloverApiError, match="Unable to reach Clover"):
        unavailable.exchange_code("code")

    insecure = CloverClient(
        settings(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    200,
                    json={
                        "href": "http://checkout.example.test/session",
                        "checkoutSessionId": "session-id",
                    },
                )
            )
        ),
    )
    with pytest.raises(CloverApiError, match="invalid checkout"):
        insecure.create_checkout(
            access_token="token",
            merchant_id="merchant-id",
            payload={},
        )


def test_checkout_payload_matches_authoritative_total_and_rejects_tax() -> None:
    now = datetime.now(timezone.utc)
    order = Order(
        idempotency_key="checkout-payload-key",
        request_fingerprint="a" * 64,
        public_access_token="public-token",
        guest_name="Jessie Guest",
        guest_email="jessie@example.com",
        guest_phone="+15551234567",
        requested_pickup_at=now,
        business_timezone="America/New_York",
        currency="USD",
        subtotal_cents=500,
        tax_cents=0,
        total_cents=500,
        expires_at=now,
    )
    order.items.append(
        OrderItem(
            product_slug="coffee",
            product_name="Coffee",
            base_unit_price_cents=250,
            unit_price_cents=250,
            quantity=2,
            line_subtotal_cents=500,
            sort_order=0,
        )
    )

    payload = _checkout_payload(order, settings())
    assert payload["shoppingCart"]["lineItems"][0]["price"] == 250
    assert payload["shoppingCart"]["lineItems"][0]["unitQty"] == 2
    assert payload["customer"]["lastName"] == "Guest"

    order.tax_cents = 40
    order.total_cents = 540
    with pytest.raises(ValueError, match="tax-rate"):
        _checkout_payload(order, settings())
