# Supabase Menu Schema

This schema is a database foundation only. The app still reads and writes the current localStorage catalog until a later integration step changes that behavior.

## Run Order

Run this single migration file in Supabase:

1. `supabase/migrations/202605290001_create_menu_schema.sql`

The file is ordered by dependency:

1. `categories`
2. `products`
3. `product_variants`
4. `modifier_groups`
5. `modifier_options`
6. `product_modifier_groups`
7. indexes

## Supabase SQL Editor Steps

1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Create a new query.
4. Paste the full contents of `supabase/migrations/202605290001_create_menu_schema.sql`.
5. Click **Run**.
6. Confirm the tables appear under **Table Editor** in the `public` schema.

Do not insert menu rows yet if you want to keep this as schema-only work.

## Tables

### `categories`

Menu sections such as `coffee`, `tea`, `cold-drinks`, `pastries`, `sandwiches`, and `snacks`.

LocalStorage mapping:

- Source key: `cafe-catalog-categories`
- Defaults: `menuCategories` in `src/data/catalog.js`
- `id` maps to `category.id`
- `name` maps to `category.name`
- `note` maps to `category.note`
- `active` maps to `category.active`
- `sort_order` maps to `category.sortOrder`

### `products`

Sellable menu items, such as `drip-coffee`, `latte`, or `croissant`.

LocalStorage mapping:

- Source key: `cafe-catalog-products`
- Defaults: `initialCatalogProducts` in `src/data/catalog.js`
- `id` maps to `product.id`
- `category_id` maps to `product.category`
- `name` maps to `product.name`
- `description` maps to `product.description`
- `base_price` maps to `product.basePrice`
- `price` maps to `product.price`
- `image` maps to `product.image`
- `active` maps to `product.active` or legacy `product.available`
- `featured` maps to `product.featured`
- `metadata` is available for future fields that do not deserve first-class columns yet

Deleting a category is restricted while products reference it, which avoids orphaned products. Delete, move, or deactivate products first.

### `product_variants`

Product size or format rows, such as Small, Medium, and Large. The current app stores these in `product.variants`.

LocalStorage mapping:

- Source key: nested under each product in `cafe-catalog-products`
- `id` maps to `variant.id`
- `product_id` maps to parent `product.id`
- `name` maps to `variant.name`
- `price` maps to `variant.price`
- `active` maps to `variant.active`
- `sort_order` maps to `variant.sortOrder`

Deleting a product cascades to its variants because variants have no meaning without their product.

### `modifier_groups`

Reusable customization groups, such as Milk, Flavour shots, Extras, and Toast.

LocalStorage mapping:

- Source key: `cafe-catalog-modifier-groups`
- Defaults: `modifierGroups` in `src/data/catalog.js`
- `id` maps to `group.id`
- `name` maps to `group.name`
- `description` maps to `group.description`
- `active` maps to `group.active`
- `selection_type` maps to `group.selectionType` or legacy `group.type`
- `required` maps to `group.required`
- `min_selections` maps to `group.minSelections`
- `max_selections` maps to `group.maxSelections`
- `sort_order` maps to `group.sortOrder`

### `modifier_options`

Selectable choices inside a modifier group, such as Oat milk or Extra shot.

LocalStorage mapping:

- Source key: nested under each modifier group in `cafe-catalog-modifier-groups`
- `id` maps to `option.id`
- `modifier_group_id` maps to parent `group.id`
- `name` maps to `option.name`
- `price_adjustment` maps to `option.priceAdjustment` or legacy `option.priceDelta`
- `active` maps to `option.active`
- `sort_order` maps to `option.sortOrder`

Deleting a modifier group cascades to its options because options are owned by the group.

### `product_modifier_groups`

Join table that attaches reusable modifier groups to products. This replaces each product's `modifierGroupIds` array.

LocalStorage mapping:

- Source key: `product.modifierGroupIds` in `cafe-catalog-products`
- `product_id` maps to `product.id`
- `modifier_group_id` maps to each string in `product.modifierGroupIds`
- `sort_order` preserves the order of IDs in the array
- `active` allows temporarily disabling a product-specific modifier relationship

Deleting a product cascades to its modifier links. Deleting a modifier group is restricted while products reference it, so remove or deactivate product links first.

## Notes For Later Integration

- This migration intentionally does not enable Row Level Security because the app is not connected to these tables yet. Add RLS policies when the frontend or admin portal starts using Supabase reads/writes.
- IDs are `text` to preserve the current slug-style localStorage IDs and make migration straightforward.
- Prices use `numeric(10, 2)` for currency-like values.
- `created_at` and `updated_at` are maintained on every table; `updated_at` is refreshed by the `public.set_updated_at()` trigger.
- `active` supports soft-hiding categories, products, variants, modifier groups, modifier options, and product-specific modifier links without deleting historical references.
