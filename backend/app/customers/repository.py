from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.customers.models import CustomerProfile
from app.jds_auth.models import JdsUser
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
