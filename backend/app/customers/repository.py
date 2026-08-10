from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.availability.models import ProductAvailability
from app.catalog.models import Category, Product
from app.customers.models import CustomerProfile
from app.jds_auth.models import JdsUser
from app.orders.constants import FulfillmentStatus, OrderStatus
from app.orders.models import Order, OrderItem


class CustomerRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def user(self, user_id: UUID) -> JdsUser | None:
        return self.session.get(JdsUser, user_id)

    def lock_user(self, user_id: UUID) -> JdsUser | None:
        return self.session.scalar(
            select(JdsUser)
            .where(JdsUser.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def profile(self, user_id: UUID) -> CustomerProfile | None:
        return self.session.get(CustomerProfile, user_id)

    def add(self, value: object) -> None:
        self.session.add(value)

    def latest_order_phone(self, user_id: UUID) -> str:
        return self.session.scalar(
            select(Order.guest_phone)
            .where(Order.customer_user_id == user_id)
            .order_by(Order.created_at.desc(), Order.id.desc())
            .limit(1)
        ) or ""

    def orders(self, user_id: UUID) -> list[Order]:
        return list(self.session.scalars(
            select(Order).options(selectinload(Order.items)).where(
                Order.customer_user_id == user_id
            ).order_by(Order.created_at.desc(), Order.id.desc())
        ).all())

    def order(self, user_id: UUID, order_id: int) -> Order | None:
        return self.session.scalar(
            select(Order).options(
                selectinload(Order.items).selectinload(OrderItem.modifiers)
            ).where(Order.customer_user_id == user_id, Order.id == order_id)
        )

    def quick_order_product_ids(self, user_id: UUID, *, limit: int = 6) -> list[int]:
        """Rank currently public products from this customer's paid purchases."""
        purchased_quantity = func.sum(OrderItem.quantity)
        latest_purchase_at = func.max(Order.created_at)
        return list(self.session.scalars(
            select(OrderItem.source_product_id)
            .join(Order, Order.id == OrderItem.order_id)
            .join(Product, Product.id == OrderItem.source_product_id)
            .join(Category, Category.id == Product.category_id)
            .outerjoin(
                ProductAvailability,
                ProductAvailability.product_id == Product.id,
            )
            .where(
                Order.customer_user_id == user_id,
                Order.status == OrderStatus.PAID,
                Order.fulfillment_status != FulfillmentStatus.CANCELLED,
                Category.is_published.is_(True),
                Product.is_published.is_(True),
                Product.archived_at.is_(None),
                func.coalesce(ProductAvailability.default_available, True).is_(True),
            )
            .group_by(OrderItem.source_product_id)
            .order_by(
                purchased_quantity.desc(),
                latest_purchase_at.desc(),
                OrderItem.source_product_id.asc(),
            )
            .limit(limit)
        ).all())
