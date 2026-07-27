from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CatalogSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ModifierOptionResponse(CatalogSchema):
    id: str
    key: str
    name: str
    price_adjustment_cents: int
    sort_order: int


class ProductModifierGroupResponse(CatalogSchema):
    id: str
    key: str
    name: str
    description: str
    selection_type: Literal["single", "multiple"]
    required: bool
    min_selections: int
    max_selections: int
    sort_order: int
    options: list[ModifierOptionResponse]


class ProductVariantResponse(CatalogSchema):
    id: str
    key: str
    name: str
    price_cents: int
    sort_order: int


class ProductResponse(CatalogSchema):
    id: str
    slug: str
    name: str
    description: str
    image: str
    featured: bool
    base_price_cents: int
    sort_order: int
    variants: list[ProductVariantResponse]
    modifier_groups: list[ProductModifierGroupResponse]


class CategoryResponse(CatalogSchema):
    id: str
    slug: str
    name: str
    note: str
    sort_order: int
    products: list[ProductResponse]


class CatalogResponse(CatalogSchema):
    version: str
    generated_at: datetime
    categories: list[CategoryResponse]
