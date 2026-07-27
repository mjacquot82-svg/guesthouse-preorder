from collections import defaultdict
from datetime import datetime, timezone

from app.catalog.models import (
    ModifierGroup,
    ModifierOption,
    Product,
    ProductModifierGroup,
)
from app.catalog.repository import CatalogRepository
from app.catalog.schemas import (
    CatalogResponse,
    CategoryResponse,
    ModifierOptionResponse,
    ProductModifierGroupResponse,
    ProductResponse,
    ProductVariantResponse,
)

CATALOG_CONTRACT_VERSION = "1"


class CatalogService:
    def __init__(self, repository: CatalogRepository) -> None:
        self._repository = repository

    def build_catalog(self) -> CatalogResponse:
        categories = self._repository.list_published_categories()
        category_ids = [category.id for category in categories]
        products = self._repository.list_published_products(category_ids)
        product_ids = [product.id for product in products]

        variants_by_product: dict[int, list[ProductVariantResponse]] = defaultdict(list)
        for variant in self._repository.list_active_variants(product_ids):
            variants_by_product[variant.product_id].append(
                ProductVariantResponse(
                    id=str(variant.id),
                    key=variant.key,
                    name=variant.name,
                    price_cents=variant.price_cents,
                    sort_order=variant.sort_order,
                )
            )

        assignments = self._repository.list_active_modifier_assignments(product_ids)
        modifier_group_ids = list(
            dict.fromkeys(group.id for _, group in assignments)
        )
        options_by_group = self._options_by_group(modifier_group_ids)
        groups_by_product = self._groups_by_product(
            assignments,
            options_by_group,
        )

        products_by_category: dict[int, list[ProductResponse]] = defaultdict(list)
        for product in products:
            products_by_category[product.category_id].append(
                self._product_response(
                    product,
                    variants_by_product[product.id],
                    groups_by_product[product.id],
                )
            )

        return CatalogResponse(
            version=CATALOG_CONTRACT_VERSION,
            generated_at=datetime.now(timezone.utc),
            categories=[
                CategoryResponse(
                    id=str(category.id),
                    slug=category.slug,
                    name=category.name,
                    note=category.description or "",
                    sort_order=category.sort_order,
                    products=products_by_category[category.id],
                )
                for category in categories
            ],
        )

    def _options_by_group(
        self,
        modifier_group_ids: list[int],
    ) -> dict[int, list[ModifierOptionResponse]]:
        result: dict[int, list[ModifierOptionResponse]] = defaultdict(list)
        for option in self._repository.list_active_modifier_options(
            modifier_group_ids
        ):
            result[option.modifier_group_id].append(
                self._option_response(option)
            )
        return result

    @staticmethod
    def _groups_by_product(
        assignments: list[tuple[ProductModifierGroup, ModifierGroup]],
        options_by_group: dict[int, list[ModifierOptionResponse]],
    ) -> dict[int, list[ProductModifierGroupResponse]]:
        result: dict[int, list[ProductModifierGroupResponse]] = defaultdict(list)
        for assignment, group in assignments:
            result[assignment.product_id].append(
                ProductModifierGroupResponse(
                    id=str(group.id),
                    key=group.key,
                    name=group.name,
                    description=group.description or "",
                    selection_type=group.selection_type,
                    required=group.is_required,
                    min_selections=group.minimum_selections,
                    max_selections=group.maximum_selections,
                    sort_order=assignment.sort_order,
                    options=options_by_group[group.id],
                )
            )
        return result

    @staticmethod
    def _product_response(
        product: Product,
        variants: list[ProductVariantResponse],
        modifier_groups: list[ProductModifierGroupResponse],
    ) -> ProductResponse:
        return ProductResponse(
            id=str(product.id),
            slug=product.slug,
            name=product.name,
            description=product.description or "",
            image=product.image_reference or "",
            featured=product.is_featured,
            base_price_cents=product.base_price_cents,
            sort_order=product.sort_order,
            variants=variants,
            modifier_groups=modifier_groups,
        )

    @staticmethod
    def _option_response(option: ModifierOption) -> ModifierOptionResponse:
        return ModifierOptionResponse(
            id=str(option.id),
            key=option.key,
            name=option.name,
            price_adjustment_cents=option.price_adjustment_cents,
            sort_order=option.sort_order,
        )
