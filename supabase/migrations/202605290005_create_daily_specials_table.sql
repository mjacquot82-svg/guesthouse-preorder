-- Daily lunch special management.

create table if not exists public.daily_specials (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null default '',
  price numeric(10, 2) not null,
  category_id text references public.categories(id) on update cascade on delete set null,
  image_url text not null default '',
  active boolean not null default false,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_specials_title_not_blank check (length(trim(title)) > 0),
  constraint daily_specials_price_nonnegative check (price >= 0),
  constraint daily_specials_date_range_valid check (end_date >= start_date)
);

drop trigger if exists set_daily_specials_updated_at on public.daily_specials;

create trigger set_daily_specials_updated_at
before update on public.daily_specials
for each row
execute function public.set_updated_at();

create unique index if not exists daily_specials_only_one_active_idx
  on public.daily_specials(active)
  where active = true;

create index if not exists daily_specials_active_dates_idx
  on public.daily_specials(active, start_date, end_date);

create index if not exists daily_specials_category_idx
  on public.daily_specials(category_id);
