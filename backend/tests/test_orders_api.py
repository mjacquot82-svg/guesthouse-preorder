from collections.abc import Iterator
from datetime import date

import pytest
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.availability.models import ProductAvailabilityOverride
from app.api.v1.orders import get_current_time
from app.main import create_app
from app.orders.models import Order
from tests.test_migrations import make_alembic_config
from tests.test_order_service import local_datetime, seed_order_dependencies


@pytest.fixture
def orders_api(
    postgresql_url: str,
) -> Iterator[tuple[TestClient, Engine, dict[str, int]]]:
    command.upgrade(make_alembic_config(postgresql_url), "head")
    engine = create_engine(postgresql_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE order_item_modifiers, order_items, orders, "
                "product_availability_overrides, product_availability, "
                "business_closures, business_hours, business_settings, "
                "product_modifier_groups, modifier_options, "
                "product_variants, products, modifier_groups, categories "
                "RESTART IDENTITY CASCADE"
            )
        )
    with Session(engine, expire_on_commit=False) as session:
        ids = seed_order_dependencies(session)

    application = create_app(postgresql_url)
    application.dependency_overrides[get_current_time] = lambda: local_datetime(8)
    with TestClient(application) as client:
        yield client, engine, ids

    with engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE order_item_modifiers, order_items, orders, "
                "product_availability_overrides, product_availability, "
                "business_closures, business_hours, business_settings, "
                "product_modifier_groups, modifier_options, "
                "product_variants, products, modifier_groups, categories "
                "RESTART IDENTITY CASCADE"
            )
        )
    engine.dispose()


def order_payload(ids: dict[str, int], **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "idempotency_key": "api-order-request-123",
        "customer": {
            "name": "Jessie Guest",
            "email": "jessie@example.com",
            "phone": "+15551234567",
        },
        "requested_pickup_at": local_datetime(8, 30).isoformat(),
        "notes": "Extra hot",
        "lines": [
            {
                "product_id": ids["product"],
                "variant_id": ids["large"],
                "modifier_option_ids": [ids["oat"], ids["vanilla"]],
                "quantity": 2,
            }
        ],
    }
    payload.update(overrides)
    return payload


@pytest.mark.postgresql
def test_create_order_returns_public_pending_snapshot(
    orders_api: tuple[TestClient, Engine, dict[str, int]],
) -> None:
    client, engine, ids = orders_api

    response = client.post("/api/v1/orders", json=order_payload(ids))

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "public_token",
        "status",
        "customer",
        "notes",
        "requested_pickup_at",
        "business_timezone",
        "currency",
        "subtotal_cents",
        "tax_cents",
        "total_cents",
        "expires_at",
        "created_at",
        "updated_at",
        "items",
    }
    assert body["status"] == "pending"
    assert body["customer"] == {
        "name": "Jessie Guest",
        "email": "jessie@example.com",
        "phone": "+15551234567",
    }
    assert body["subtotal_cents"] == 1620
    assert body["total_cents"] == 1620
    assert body["items"][0]["variant_key"] == "large"
    assert [modifier["option_key"] for modifier in body["items"][0]["modifiers"]] == [
        "oat",
        "vanilla",
    ]
    assert "id" not in body
    assert "source_product_id" not in body["items"][0]
    assert "idempotency_key" not in body

    with Session(engine) as session:
        assert session.scalar(select(text("count(*)")).select_from(Order)) == 1


@pytest.mark.postgresql
def test_create_order_replays_idempotently_and_rejects_conflict(
    orders_api: tuple[TestClient, Engine, dict[str, int]],
) -> None:
    client, engine, ids = orders_api
    payload = order_payload(ids)

    first = client.post("/api/v1/orders", json=payload)
    replay = client.post("/api/v1/orders", json=payload)
    conflicting_payload = order_payload(ids)
    conflicting_payload["notes"] = "Different notes"
    conflict = client.post("/api/v1/orders", json=conflicting_payload)

    assert first.status_code == 201
    assert replay.status_code == 201
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json() == {
        "detail": {
            "code": "idempotency_conflict",
            "message": "Idempotency key was already used for a different order.",
        }
    }
    with Session(engine) as session:
        assert session.scalar(select(text("count(*)")).select_from(Order)) == 1


@pytest.mark.postgresql
def test_create_order_rejects_invalid_customer_and_pickup(
    orders_api: tuple[TestClient, Engine, dict[str, int]],
) -> None:
    client, _, ids = orders_api
    invalid_customer = order_payload(ids)
    invalid_customer["customer"] = {
        "name": "Guest",
        "email": "invalid",
        "phone": "123",
    }

    customer_response = client.post("/api/v1/orders", json=invalid_customer)
    pickup_response = client.post(
        "/api/v1/orders",
        json=order_payload(
            ids,
            idempotency_key="invalid-pickup-request",
            requested_pickup_at=local_datetime(6, 30).isoformat(),
        ),
    )

    assert customer_response.status_code == 422
    assert customer_response.json() == {
        "detail": {
            "code": "request_validation_error",
            "message": "Order request validation failed.",
        }
    }
    assert pickup_response.status_code == 422
    assert pickup_response.json()["detail"]["code"] == "pickup_invalid"


@pytest.mark.postgresql
@pytest.mark.parametrize(
    ("line", "expected_code"),
    [
        (
            {
                "product_id": 999999,
                "variant_id": None,
                "modifier_option_ids": [],
                "quantity": 1,
            },
            "product_not_sellable",
        ),
        (
            {
                "product_id": "product",
                "variant_id": "small",
                "modifier_option_ids": [999999],
                "quantity": 1,
            },
            "modifier_option_invalid",
        ),
    ],
)
def test_create_order_rejects_invalid_products_and_modifiers(
    orders_api: tuple[TestClient, Engine, dict[str, int]],
    line: dict[str, object],
    expected_code: str,
) -> None:
    client, _, ids = orders_api
    resolved_line = {
        key: ids[value] if isinstance(value, str) else value
        for key, value in line.items()
    }

    response = client.post(
        "/api/v1/orders",
        json=order_payload(
            ids,
            idempotency_key=f"invalid-{expected_code}",
            lines=[resolved_line],
        ),
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == expected_code


@pytest.mark.postgresql
def test_get_order_by_public_token_and_return_not_found(
    orders_api: tuple[TestClient, Engine, dict[str, int]],
) -> None:
    client, _, ids = orders_api
    created = client.post("/api/v1/orders", json=order_payload(ids))
    token = created.json()["public_token"]

    found = client.get(f"/api/v1/orders/{token}")
    missing = client.get("/api/v1/orders/not-a-real-order-token")

    assert found.status_code == 200
    assert found.json() == created.json()
    assert missing.status_code == 404
    assert missing.json() == {
        "detail": {
            "code": "order_not_found",
            "message": "Pending order was not found.",
        }
    }


@pytest.mark.postgresql
def test_create_order_rejects_unavailable_product(
    orders_api: tuple[TestClient, Engine, dict[str, int]],
) -> None:
    client, engine, ids = orders_api
    with Session(engine) as session:
        session.add(
            ProductAvailabilityOverride(
                product_id=ids["product"],
                business_date=date(2026, 7, 28),
                is_available=False,
                reason="Sold out today",
            )
        )
        session.commit()

    response = client.post(
        "/api/v1/orders",
        json=order_payload(ids),
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {
        "code": "product_not_sellable",
        "message": "Sold out today",
    }


def test_order_openapi_documents_contract_and_errors() -> None:
    with TestClient(create_app()) as client:
        schema = client.get("/openapi.json").json()

    post_operation = schema["paths"]["/api/v1/orders"]["post"]
    get_operation = schema["paths"]["/api/v1/orders/{public_token}"]["get"]
    assert post_operation["tags"] == ["orders"]
    assert post_operation["responses"]["201"]
    assert post_operation["responses"]["409"]
    assert post_operation["responses"]["422"]
    assert get_operation["responses"]["200"]
    assert get_operation["responses"]["404"]
