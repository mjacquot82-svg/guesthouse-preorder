from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.orders.constants import FulfillmentStatus, OrderStatus
from app.orders.models import Order


ORDER_EVENT_LABELS = {
    FulfillmentStatus.NEW: "Order received",
    FulfillmentStatus.PREPARING: "Preparing",
    FulfillmentStatus.READY: "Ready for pickup",
    FulfillmentStatus.COMPLETED: "Completed",
    FulfillmentStatus.CANCELLED: "Cancelled",
}

TEMPLATES = (
    ("order_received", "Order received", "Order", "email_sms", "Awaiting delivery provider"),
    ("order_preparing", "Preparing", "Order", "email_sms", "Awaiting delivery provider"),
    ("order_ready", "Ready for pickup", "Order", "email_sms", "Awaiting delivery provider"),
    ("order_completed", "Completed", "Order", "email", "Awaiting delivery provider"),
    ("order_cancelled", "Cancelled", "Order", "email_sms", "Awaiting delivery provider"),
    ("password_reset", "Password reset", "Account", "email", "Managed by Supabase Auth"),
    ("account_verification", "Account verification", "Account", "email", "Managed by Supabase Auth"),
)


class CommunicationCenterService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def snapshot(self) -> dict[str, object]:
        orders = list(self._session.scalars(
            select(Order).order_by(Order.updated_at.desc(), Order.id.desc()).limit(100)
        ))
        return {
            "generated_at": datetime.now(timezone.utc),
            "summary": {"pending": 0, "sent_today": 0, "failed": 0, "scheduled": 0},
            "orders": [self._order(order) for order in orders],
            "templates": [
                {"key": key, "name": name, "category": category, "channel": channel, "status": status}
                for key, name, category, channel, status in TEMPLATES
            ],
            "activity": [],
            "health": [
                {"key": "auth_email", "name": "Authentication email", "status": "connected", "detail": "Password reset and verification are managed by Supabase Auth."},
                {"key": "order_email", "name": "Order email", "status": "not_configured", "detail": "No transactional order-email provider is configured."},
                {"key": "sms", "name": "SMS", "status": "not_configured", "detail": "No SMS delivery provider is configured."},
                {"key": "queue", "name": "Notification queue", "status": "not_configured", "detail": "Delivery queue persistence is not installed yet."},
                {"key": "twilio", "name": "Twilio", "status": "not_configured", "detail": "No Twilio integration exists in this deployment."},
            ],
        }

    @staticmethod
    def _order(order: Order) -> dict[str, object]:
        event = ORDER_EVENT_LABELS[order.fulfillment_status]
        capable = order.status == OrderStatus.PAID
        return {
            "id": order.id,
            "reference": f"GH-{order.id:06d}",
            "customer_name": order.guest_name,
            "customer_email": order.guest_email,
            "customer_phone": order.guest_phone,
            "event": event,
            "payment_status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "fulfillment_status": order.fulfillment_status.value if isinstance(order.fulfillment_status, FulfillmentStatus) else order.fulfillment_status,
            "channel": "disabled",
            "capable": capable,
            "updated_at": order.updated_at,
        }
