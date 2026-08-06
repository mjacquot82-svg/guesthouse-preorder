from sqlalchemy.orm import Session

from app.orders.constants import FulfillmentStatus
from tests.test_owner_orders import add_order, owner_orders_api


def test_owner_communication_center_reports_orders_templates_and_honest_health(owner_orders_api) -> None:
    client, engine = owner_orders_api
    with Session(engine) as session:
        order = add_order(session, key="communication-ready", fulfillment=FulfillmentStatus.READY)
        session.commit()
        order_id = order.id

    response = client.get("/api/v1/owner/communications")

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {"pending": 0, "sent_today": 0, "failed": 0, "scheduled": 0}
    assert payload["orders"][0]["id"] == order_id
    assert payload["orders"][0]["event"] == "Ready for pickup"
    assert payload["orders"][0]["channel"] == "disabled"
    assert {template["key"] for template in payload["templates"]} >= {"order_received", "order_ready", "password_reset", "account_verification"}
    assert payload["activity"] == []
    health = {item["key"]: item["status"] for item in payload["health"]}
    assert health == {"auth_email": "connected", "order_email": "not_configured", "sms": "not_configured", "queue": "not_configured", "twilio": "not_configured"}


def test_owner_communication_center_requires_order_read_permission(owner_orders_api) -> None:
    client, _ = owner_orders_api
    from app.api.v1.owner_auth import current_principal
    from tests.test_owner_orders import principal
    client.app.dependency_overrides[current_principal] = lambda: principal()
    assert client.get("/api/v1/owner/communications").status_code == 403
