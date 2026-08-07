from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.availability.models import ProductAvailability
from app.catalog.models import Category, Product


class CommunicationCenterService:
    """Build the operator-facing customer-announcement snapshot.

    Transactional order-email/SMS delivery was never installed. Authentication
    email remains owned by Supabase Auth and intentionally does not participate in
    this operational health response.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def snapshot(self) -> dict[str, object]:
        lunch_special = self._session.scalar(
            select(Product)
            .where(
                Product.is_lunch_special.is_(True),
                Product.archived_at.is_(None),
            )
            .order_by(Product.id)
            .limit(1)
        )
        return {
            "generated_at": datetime.now(timezone.utc),
            "summary": {
                "actionable_warnings": 0,
                "push_release_enabled": False,
            },
            "lunch_special": (
                self._lunch_special(lunch_special)
                if lunch_special is not None
                else None
            ),
            "activity": [],
            "health": [
                {
                    "key": "push",
                    "name": "Push notifications",
                    "status": "not_connected",
                    "detail": (
                        "Customer push delivery is not connected yet. "
                        "Announcement drafts cannot be sent."
                    ),
                    "actionable": False,
                }
            ],
        }

    def _lunch_special(self, product: Product) -> dict[str, object]:
        category_published, available = self._session.execute(
            select(
                Category.is_published,
                func.coalesce(ProductAvailability.default_available, True),
            )
            .select_from(Product)
            .join(Category, Category.id == product.category_id)
            .outerjoin(
                ProductAvailability,
                ProductAvailability.product_id == product.id,
            )
            .where(Product.id == product.id)
        ).one()
        customer_visible = bool(product.is_published and category_published)
        orderable = bool(customer_visible and available)
        warnings: list[str] = []
        if not customer_visible:
            warnings.append("This Lunch Special is hidden from the customer menu.")
        if not available:
            warnings.append("This Lunch Special is unavailable for online ordering.")
        return {
            "id": str(product.id),
            "name": product.name,
            "description": product.description or "",
            "price_cents": product.base_price_cents,
            "image": product.image_reference or "",
            "customer_visible": customer_visible,
            "orderable": orderable,
            "warnings": warnings,
        }
