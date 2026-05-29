-- Customer profile schema for Supabase.
-- Authentication and orders intentionally remain localStorage-backed for now.

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

create table if not exists public.customers (
  id text primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_first_name_not_blank check (length(trim(first_name)) > 0),
  constraint customers_last_name_not_blank check (length(trim(last_name)) > 0),
  constraint customers_email_not_blank check (length(trim(email)) > 0),
  constraint customers_email_lowercase check (email = lower(email)),
  constraint customers_email_unique unique (email)
);

drop trigger if exists set_customers_updated_at on public.customers;

create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

create index if not exists customers_email_idx
  on public.customers(email);
