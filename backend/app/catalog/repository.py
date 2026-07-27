from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog.models import Category, ModifierGroup, Product


class CatalogRepository:
    """Database access primitives for catalog entities.

    Filtering for publication or availability belongs to later application
    services and APIs, not this Phase 1C persistence foundation.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def add(self, entity: object) -> None:
        self._session.add(entity)

    def get_category_by_slug(self, slug: str) -> Category | None:
        return self._session.scalar(select(Category).where(Category.slug == slug))

    def get_product_by_slug(self, slug: str) -> Product | None:
        return self._session.scalar(select(Product).where(Product.slug == slug))

    def get_modifier_group_by_key(self, key: str) -> ModifierGroup | None:
        return self._session.scalar(
            select(ModifierGroup).where(ModifierGroup.key == key)
        )

    def list_categories(self) -> Sequence[Category]:
        return self._session.scalars(
            select(Category).order_by(Category.sort_order, Category.id)
        ).all()
