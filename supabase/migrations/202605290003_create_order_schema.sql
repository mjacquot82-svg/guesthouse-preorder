-- Order schema for Supabase.
-- This migration creates tables only. It does not migrate localStorage orders or connect app code.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.orders (
  id text primary key,
  customer_id text references public.customers(id) on update cascade on delete set null,
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  status text not null default 'New',
  subtotal numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  notes text not null default '',
  pickup_summary text not null default '',
  source text not null default 'web',
  clover_order_id text,
  clover_payment_id text,
  clover_sync_status text not null default 'not_synced',
  clover_synced_at timestamptz,
  clover_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint orders_status_valid check (
    status in ('New', 'Preparing', 'Ready for Pickup', 'Completed', 'Cancelled')
  ),
  constraint orders_subtotal_nonnegative check (subtotal >= 0),
  constraint orders_total_nonnegative check (total >= 0),
  constraint orders_source_valid check (source in ('web', 'admin', 'clover', 'import')),
  constraint orders_clover_sync_status_valid check (
    clover_sync_status in ('not_synced', 'pending', 'synced', 'failed', 'skipped')
  )
);

drop trigger if exists set_orders_updated_at on public.orders;

create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create or replace function public.set_order_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_orders_status_updated_at on public.orders;

create trigger set_orders_status_updated_at
before update on public.orders
for each row
execute function public.set_order_status_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on update cascade on delete cascade,
  line_key text not null default '',
  product_id text references public.products(id) on update cascade on delete set null,
  variant_id text references public.product_variants(id) on update cascade on delete set null,
  product_name text not null,
  variant_name text not null default '',
  category_name text not null default '',
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null default 0,
  total_price numeric(10, 2) not null default 0,
  base_price numeric(10, 2),
  variant_price numeric(10, 2),
  cart_item jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  clover_line_item_id text,
  clover_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_items_product_name_not_blank check (length(trim(product_name)) > 0),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonnegative check (unit_price >= 0),
  constraint order_items_total_price_nonnegative check (total_price >= 0),
  constraint order_items_base_price_nonnegative check (base_price is null or base_price >= 0),
  constraint order_items_variant_price_nonnegative check (variant_price is null or variant_price >= 0),
  constraint order_items_sort_order_nonnegative check (sort_order >= 0)
);

drop trigger if exists set_order_items_updated_at on public.order_items;

create trigger set_order_items_updated_at
before update on public.order_items
for each row
execute function public.set_updated_at();

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on update cascade on delete cascade,
  modifier_group_id text references public.modifier_groups(id) on update cascade on delete set null,
  modifier_option_id text references public.modifier_options(id) on update cascade on delete set null,
  group_name text not null default '',
  option_name text not null,
  price_delta numeric(10, 2) not null default 0,
  sort_order integer not null default 0,
  clover_modifier_id text,
  clover_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_item_modifiers_option_name_not_blank check (length(trim(option_name)) > 0),
  constraint order_item_modifiers_sort_order_nonnegative check (sort_order >= 0)
);

drop trigger if exists set_order_item_modifiers_updated_at on public.order_item_modifiers;

create trigger set_order_item_modifiers_updated_at
before update on public.order_item_modifiers
for each row
execute function public.set_updated_at();

create index if not exists orders_customer_created_at_idx
  on public.orders(customer_id, created_at desc)
  where customer_id is not null;

create index if not exists orders_status_created_at_idx
  on public.orders(status, created_at desc);

create index if not exists orders_created_at_idx
  on public.orders(created_at desc);

create unique index if not exists orders_clover_order_id_unique_idx
  on public.orders(clover_order_id)
  where clover_order_id is not null;

create index if not exists orders_clover_sync_status_idx
  on public.orders(clover_sync_status, created_at desc);

create index if not exists order_items_order_sort_order_idx
  on public.order_items(order_id, sort_order);

create unique index if not exists order_items_order_line_key_unique_idx
  on public.order_items(order_id, line_key)
  where line_key <> '';

create index if not exists order_items_product_idx
  on public.order_items(product_id)
  where product_id is not null;

create unique index if not exists order_items_clover_line_item_id_unique_idx
  on public.order_items(clover_line_item_id)
  where clover_line_item_id is not null;

create index if not exists order_item_modifiers_item_sort_order_idx
  on public.order_item_modifiers(order_item_id, sort_order);

create index if not exists order_item_modifiers_group_option_idx
  on public.order_item_modifiers(modifier_group_id, modifier_option_id);
