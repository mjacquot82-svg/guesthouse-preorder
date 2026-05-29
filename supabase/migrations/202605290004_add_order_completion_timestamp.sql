-- Store the exact time staff mark an order ready for pickup.

alter table public.orders
  add column if not exists completed_at timestamptz;
