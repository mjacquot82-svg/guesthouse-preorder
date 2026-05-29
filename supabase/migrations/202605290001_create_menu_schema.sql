-- Menu catalog schema for Supabase.
-- This migration creates tables only. It does not migrate localStorage data or connect app code.

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

create table if not exists public.categories (
  id text primary key,
  name text not null,
  note text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_name_not_blank check (length(trim(name)) > 0),
  constraint categories_sort_order_nonnegative check (sort_order >= 0)
);

drop trigger if exists set_categories_updated_at on public.categories;

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create table if not exists public.products (
  id text primary key,
  category_id text not null references public.categories(id) on update cascade on delete restrict,
  name text not null,
  description text not null default '',
  base_price numeric(10, 2) not null default 0,
  price numeric(10, 2) not null default 0,
  image text not null default '',
  active boolean not null default true,
  featured boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_base_price_nonnegative check (base_price >= 0),
  constraint products_price_nonnegative check (price >= 0),
  constraint products_sort_order_nonnegative check (sort_order >= 0)
);

drop trigger if exists set_products_updated_at on public.products;

create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on update cascade on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_variants_name_not_blank check (length(trim(name)) > 0),
  constraint product_variants_price_nonnegative check (price >= 0),
  constraint product_variants_sort_order_nonnegative check (sort_order >= 0),
  constraint product_variants_unique_product_name unique (product_id, name)
);

drop trigger if exists set_product_variants_updated_at on public.product_variants;

create trigger set_product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_updated_at();

create table if not exists public.modifier_groups (
  id text primary key,
  name text not null,
  description text not null default '',
  active boolean not null default true,
  selection_type text not null default 'single',
  required boolean not null default false,
  min_selections integer not null default 0,
  max_selections integer not null default 1,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint modifier_groups_name_not_blank check (length(trim(name)) > 0),
  constraint modifier_groups_selection_type_valid check (selection_type in ('single', 'multiple')),
  constraint modifier_groups_min_selections_nonnegative check (min_selections >= 0),
  constraint modifier_groups_max_selections_nonnegative check (max_selections >= 0),
  constraint modifier_groups_selection_range_valid check (max_selections = 0 or max_selections >= min_selections),
  constraint modifier_groups_sort_order_nonnegative check (sort_order >= 0)
);

drop trigger if exists set_modifier_groups_updated_at on public.modifier_groups;

create trigger set_modifier_groups_updated_at
before update on public.modifier_groups
for each row
execute function public.set_updated_at();

create table if not exists public.modifier_options (
  id text primary key,
  modifier_group_id text not null references public.modifier_groups(id) on update cascade on delete cascade,
  name text not null,
  price_adjustment numeric(10, 2) not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint modifier_options_name_not_blank check (length(trim(name)) > 0),
  constraint modifier_options_sort_order_nonnegative check (sort_order >= 0),
  constraint modifier_options_unique_group_name unique (modifier_group_id, name)
);

drop trigger if exists set_modifier_options_updated_at on public.modifier_options;

create trigger set_modifier_options_updated_at
before update on public.modifier_options
for each row
execute function public.set_updated_at();

create table if not exists public.product_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on update cascade on delete cascade,
  modifier_group_id text not null references public.modifier_groups(id) on update cascade on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_modifier_groups_sort_order_nonnegative check (sort_order >= 0),
  constraint product_modifier_groups_unique_link unique (product_id, modifier_group_id)
);

drop trigger if exists set_product_modifier_groups_updated_at on public.product_modifier_groups;

create trigger set_product_modifier_groups_updated_at
before update on public.product_modifier_groups
for each row
execute function public.set_updated_at();

create index if not exists categories_active_sort_order_idx
  on public.categories(active, sort_order, name);

create index if not exists products_category_sort_order_idx
  on public.products(category_id, active, sort_order, name);

create index if not exists products_featured_active_idx
  on public.products(featured, active)
  where featured = true;

create index if not exists product_variants_product_sort_order_idx
  on public.product_variants(product_id, active, sort_order, name);

create index if not exists modifier_groups_active_sort_order_idx
  on public.modifier_groups(active, sort_order, name);

create index if not exists modifier_options_group_sort_order_idx
  on public.modifier_options(modifier_group_id, active, sort_order, name);

create index if not exists product_modifier_groups_product_sort_order_idx
  on public.product_modifier_groups(product_id, active, sort_order);

create index if not exists product_modifier_groups_group_idx
  on public.product_modifier_groups(modifier_group_id);
