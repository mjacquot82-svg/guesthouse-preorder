# Supabase Order Schema

This schema is a database foundation only. The app still reads and writes the current localStorage order store until a later integration step changes that behavior.

## Migration Files

Run this migration after the menu catalog and customer profile migrations:

1. `supabase/migrations/202605290001_create_menu_schema.sql`
2. `supabase/migrations/202605290002_create_customers_table.sql`
3. `supabase/migrations/202605290003_create_order_schema.sql`

The order migration is ordered by dependency:

1. `orders`
2. `order_items`
3. `order_item_modifiers`
4. indexes

Do not migrate existing localStorage orders yet if you want to keep this as schema-only work.

## Table Relationships

```text
customers.id 1 -> many orders.customer_id
orders.id 1 -> many order_items.order_id
order_items.id 1 -> many order_item_modifiers.order_item_id

products.id 1 -> many order_items.product_id
product_variants.id 1 -> many order_items.variant_id
modifier_groups.id 1 -> many order_item_modifiers.modifier_group_id
modifier_options.id 1 -> many order_item_modifiers.modifier_option_id
```

Customer, product, variant, modifier group, and modifier option references are nullable on order records. The order tables keep denormalized names and prices so customer history and reorder flows still work if catalog rows are later renamed, hidden, or deleted.

## Tables

### `orders`

One placed checkout order.

Current localStorage mapping:

- Source key: `cedar-oak-orders`
- `id` maps to `order.id`
- `customer_id` maps to `order.customerId`
- `customer_name` maps to `order.customerName`
- `customer_email` maps to `order.customerEmail`
- `customer_phone` maps to `order.customerPhone`
- `status` maps to `order.status`
- `subtotal` maps to `order.subtotal`
- `total` maps to `order.total`
- `notes` maps to `order.notes`
- `pickup_summary` maps to `order.pickupSummary`
- `created_at` maps to `order.createdAt`

Supported statuses match the current admin workflow:

- `New`
- `Preparing`
- `Ready for Pickup`
- `Completed`
- `Cancelled`

`status_updated_at` changes automatically when `status` changes. `updated_at` changes automatically on any update.

Clover-ready columns:

- `source` distinguishes `web`, `admin`, `clover`, and `import` orders.
- `clover_order_id` stores the Clover order identifier and is unique when present.
- `clover_payment_id` stores a related Clover payment identifier when available.
- `clover_sync_status` tracks `not_synced`, `pending`, `synced`, `failed`, or `skipped`.
- `clover_synced_at` records the latest successful sync time.
- `clover_payload` can preserve the raw Clover response or request details.

### `order_items`

One sellable line item inside an order.

Current localStorage mapping:

- `order_id` maps to parent `order.id`
- `line_key` maps to `item.id`
- `product_id` maps to `item.productId`
- `variant_id` maps to `item.variantId`
- `product_name` maps to `item.productName`
- `variant_name` maps to `item.variantName`
- `quantity` maps to `item.quantity`
- `unit_price` maps to `item.unitPrice`
- `total_price` maps to `item.totalPrice`
- `cart_item` maps to `item.cartItem`

`product_name`, `variant_name`, `unit_price`, `total_price`, and `cart_item` preserve the exact checkout snapshot needed for order history and reorder. `product_id` and `variant_id` remain useful for analytics, future menu validation, and Clover mapping but are not required for history display.

`line_key` is unique per order when present. This preserves the current cart-line identity but still allows legacy imports if an old row has no line key.

Clover-ready columns:

- `clover_line_item_id` stores the Clover line item identifier and is unique when present.
- `clover_payload` can preserve raw Clover line item data.

### `order_item_modifiers`

One selected modifier option on an order item.

Current localStorage mapping:

- `order_item_id` maps to parent `order_items.id`
- `modifier_group_id` maps to `modifier.groupId`
- `modifier_option_id` maps to `modifier.optionId`
- `group_name` maps to `modifier.groupName`
- `option_name` maps to `modifier.name`
- `price_delta` maps to `modifier.priceDelta`

`group_name`, `option_name`, and `price_delta` preserve the checkout snapshot for admin order review, customer order history, and reorder. Catalog references are nullable so historical modifier selections survive catalog edits.

Clover-ready columns:

- `clover_modifier_id` stores the Clover modifier identifier when Clover returns one.
- `clover_payload` can preserve raw Clover modifier data.

## Recommended Migration Order

For a clean Supabase project, apply migrations in this order:

1. Menu catalog schema.
2. Customer profile schema.
3. Order schema.
4. Later, a data migration for existing localStorage orders.
5. Later, application service changes that read/write orders through Supabase.
6. Later, RLS policies after the final client access pattern is known.

This order lets orders reference customers and catalog rows without requiring order migration now.

## Reorder Support

The schema supports reorder by storing both structured references and immutable checkout snapshots:

- Use `orders.customer_id` to load a signed-in customer's order history.
- Use `order_items` ordered by `sort_order` to rebuild cart lines.
- Use `order_item_modifiers` ordered by `sort_order` to rebuild selected options.
- Use `cart_item` as a compatibility snapshot while the app still has localStorage-shaped cart objects.

During the later app integration, prefer rebuilding from first-class columns and use `cart_item` only as a compatibility fallback.

## Future Realtime Considerations

When application behavior moves to Supabase, realtime can support admin order boards and customer status updates:

- Enable realtime publication for `orders` first; most screens only need order-level inserts and status changes.
- Subscribe admin views to `orders` changes filtered by active statuses: `New`, `Preparing`, and `Ready for Pickup`.
- Subscribe customer views to `orders` filtered by `customer_id` after RLS is in place.
- Avoid broadcasting full modifier payloads unless the UI needs live line-item edits; line items usually only need to load when an order is opened.
- Add RLS before client-side realtime subscriptions so customers can only see their own orders.
- Consider an `order_status_events` table later if the business needs a full audit trail of who changed each status and when.

## Notes For Later Integration

- This migration intentionally does not enable Row Level Security because the app is not connected to these tables yet.
- Prices use `numeric(10, 2)` to match the existing menu schema.
- Order item and modifier rows use UUID primary keys because current cart line IDs are only unique inside an order.
- Historical display should use snapshot columns, not joined catalog names.
- Clover sync should be implemented as an explicit backend process or Supabase Edge Function, not directly from browser UI code.
