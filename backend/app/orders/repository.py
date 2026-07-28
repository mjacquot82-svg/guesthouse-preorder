from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.catalog.models import (
    ModifierGroup,
    Product,
    ProductModifierGroup,
)
from app.orders.models import Order, OrderItem


class OrderRepository:
    """Catalog reads and pending-order aggregate persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_idempotency_key(self, idempotency_key: str) -> Order | None:
        return self._session.scalar(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.modifiers),
            )
            .where(Order.idempotency_key == idempotency_key)
        )

    def get_product_for_order(self, product_id: int) -> Product | None:
        return self._session.scalar(
            select(Product)
            .options(
                joinedload(Product.category),
                selectinload(Product.variants),
                selectinload(
                    Product.modifier_group_assignments
                )
                .joinedload(ProductModifierGroup.modifier_group)
                .selectinload(ModifierGroup.options),
            )
            .where(Product.id == product_id)
        )

    def add(self, order: Order) -> None:
        self._session.add(order)
