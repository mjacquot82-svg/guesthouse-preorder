-- Customer communication preference opt-ins.
-- Defaults keep existing and newly-created customers subscribed until they opt out.

alter table public.customers
  add column if not exists receive_lunch_specials boolean not null default true,
  add column if not exists receive_promotions boolean not null default true,
  add column if not exists receive_pickup_notifications boolean not null default true,
  add column if not exists receive_new_product_announcements boolean not null default true;

update public.customers
set
  receive_lunch_specials = coalesce(receive_lunch_specials, true),
  receive_promotions = coalesce(receive_promotions, true),
  receive_pickup_notifications = coalesce(receive_pickup_notifications, true),
  receive_new_product_announcements = coalesce(receive_new_product_announcements, true);

alter table public.customers
  alter column receive_lunch_specials set default true,
  alter column receive_lunch_specials set not null,
  alter column receive_promotions set default true,
  alter column receive_promotions set not null,
  alter column receive_pickup_notifications set default true,
  alter column receive_pickup_notifications set not null,
  alter column receive_new_product_announcements set default true,
  alter column receive_new_product_announcements set not null;

create index if not exists customers_receive_lunch_specials_idx
  on public.customers(receive_lunch_specials)
  where receive_lunch_specials = true;

create index if not exists customers_receive_promotions_idx
  on public.customers(receive_promotions)
  where receive_promotions = true;

create index if not exists customers_receive_pickup_notifications_idx
  on public.customers(receive_pickup_notifications)
  where receive_pickup_notifications = true;

create index if not exists customers_receive_new_product_announcements_idx
  on public.customers(receive_new_product_announcements)
  where receive_new_product_announcements = true;
