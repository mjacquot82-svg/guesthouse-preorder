from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.catalog.models import (
    Category,
    ModifierGroup,
    ModifierOption,
    Product,
    ProductModifierGroup,
    ProductVariant,
)
from app.availability.models import ProductAvailability


class CatalogRepository:
    """Database access primitives for catalog persistence and public reads."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, entity: object) -> None:
        self._session.add(entity)

    def get_category_by_slug(self, slug: str) -> Category | None:
        return self._session.scalar(select(Category).where(Category.slug == slug))

    def get_product_by_slug(self, slug: str) -> Product | None:
        return self._session.scalar(select(Product).where(Product.slug == slug))

    def get_product(self, product_id: int) -> Product | None:
        return self._session.get(Product, product_id)

    def get_category(self, category_id: int) -> Category | None:
        return self._session.get(Category, category_id)

    def list_products(self) -> Sequence[Product]:
        return self._session.scalars(
            select(Product).where(Product.archived_at.is_(None)).order_by(
                Product.category_id, Product.sort_order, Product.name, Product.id
            )
        ).all()

    def list_modifier_groups(self) -> Sequence[ModifierGroup]:
        return self._session.scalars(
            select(ModifierGroup).order_by(
                ModifierGroup.sort_order, ModifierGroup.name, ModifierGroup.id
            )
        ).all()

    def replace_modifier_assignments(
        self, product_id: int, modifier_group_ids: Sequence[int]
    ) -> None:
        self._session.execute(
            delete(ProductModifierGroup).where(ProductModifierGroup.product_id == product_id)
        )
        for sort_order, group_id in enumerate(modifier_group_ids):
            self.add(ProductModifierGroup(
                product_id=product_id,
                modifier_group_id=group_id,
                is_active=True,
                sort_order=sort_order,
            ))

    def flush(self) -> None:
        self._session.flush()

    def commit(self) -> None:
        self._session.commit()

    def get_modifier_group_by_key(self, key: str) -> ModifierGroup | None:
        return self._session.scalar(
            select(ModifierGroup).where(ModifierGroup.key == key)
        )

    def list_categories(self) -> Sequence[Category]:
        return self._session.scalars(
            select(Category).order_by(Category.sort_order, Category.id)
        ).all()

    def list_published_categories(self) -> Sequence[Category]:
        return self._session.scalars(
            select(Category)
            .where(Category.is_published.is_(True))
            .order_by(Category.sort_order, Category.name, Category.id)
        ).all()

    def list_published_products(
        self,
        category_ids: Sequence[int],
    ) -> Sequence[Product]:
        return self._session.scalars(
            select(Product)
            .outerjoin(ProductAvailability, ProductAvailability.product_id == Product.id)
            .where(
                Product.category_id.in_(category_ids),
                Product.is_published.is_(True),
                Product.archived_at.is_(None),
                func.coalesce(ProductAvailability.default_available, True).is_(True),
            )
            .order_by(
                Product.category_id,
                Product.sort_order,
                Product.name,
                Product.id,
            )
        ).all()

    def list_active_variants(
        self,
        product_ids: Sequence[int],
    ) -> Sequence[ProductVariant]:
        return self._session.scalars(
            select(ProductVariant)
            .where(
                ProductVariant.product_id.in_(product_ids),
                ProductVariant.is_active.is_(True),
            )
            .order_by(
                ProductVariant.product_id,
                ProductVariant.sort_order,
                ProductVariant.name,
                ProductVariant.id,
            )
        ).all()

    def list_active_modifier_assignments(
        self,
        product_ids: Sequence[int],
    ) -> list[tuple[ProductModifierGroup, ModifierGroup]]:
        return [
            (assignment, group)
            for assignment, group in self._session.execute(
                select(ProductModifierGroup, ModifierGroup)
                .join(
                    ModifierGroup,
                    ProductModifierGroup.modifier_group_id == ModifierGroup.id,
                )
                .where(
                    ProductModifierGroup.product_id.in_(product_ids),
                    ProductModifierGroup.is_active.is_(True),
                    ModifierGroup.is_active.is_(True),
                )
                .order_by(
                    ProductModifierGroup.product_id,
                    ProductModifierGroup.sort_order,
                    ModifierGroup.name,
                    ModifierGroup.id,
                )
            ).all()
        ]

    def list_active_modifier_options(
        self,
        modifier_group_ids: Sequence[int],
    ) -> Sequence[ModifierOption]:
        return self._session.scalars(
            select(ModifierOption)
            .where(
                ModifierOption.modifier_group_id.in_(modifier_group_ids),
                ModifierOption.is_active.is_(True),
            )
            .order_by(
                ModifierOption.modifier_group_id,
                ModifierOption.sort_order,
                ModifierOption.name,
                ModifierOption.id,
            )
        ).all()
