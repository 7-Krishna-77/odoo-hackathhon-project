-- =============================================================================
-- STOCKSENSE — Supabase (PostgreSQL) Schema
-- Run this entire script in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Idempotent-ish: safe to re-run on a fresh project. Drops are guarded.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('Inventory Manager', 'Warehouse Staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_doc_type as enum ('Receipt', 'Delivery', 'Internal', 'Adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_status as enum ('Draft', 'Waiting', 'Ready', 'Done', 'Canceled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. USERS_PROFILES  (1:1 extension of auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'Warehouse Staff',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. LOCATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. PRODUCT_CATEGORIES
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. PRODUCTS
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  sku             text not null,
  category_id     uuid references public.product_categories(id) on delete set null,
  unit_of_measure text not null default 'unit',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_products_sku on public.products (sku);

-- ---------------------------------------------------------------------------
-- 6. STOCK_LEVELS  (current quantity per product per location)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_levels (
  id               uuid primary key default uuid_generate_v4(),
  product_id       uuid not null references public.products(id) on delete cascade,
  location_id      uuid not null references public.locations(id) on delete cascade,
  current_quantity integer not null default 0 check (current_quantity >= 0),
  updated_at       timestamptz not null default now(),
  unique (product_id, location_id)
);

-- ---------------------------------------------------------------------------
-- 7. STOCK_LEDGER  (movement documents / headers)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_ledger (
  id                     uuid primary key default uuid_generate_v4(),
  document_type          ledger_doc_type not null,
  status                 ledger_status not null default 'Draft',
  reference              text,                              -- human-friendly doc number, e.g. RCPT-00001
  source_location_id     uuid references public.locations(id),
  destination_location_id uuid references public.locations(id),
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  validated_at           timestamptz,
  constraint chk_locations_not_both_null check (
    source_location_id is not null or destination_location_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- 8. LEDGER_ITEMS  (movement document lines)
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_items (
  id          uuid primary key default uuid_generate_v4(),
  ledger_id   uuid not null references public.stock_ledger(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  quantity    integer not null check (quantity > 0),
  -- For Adjustments: the counted physical quantity, used to compute variance
  counted_quantity integer,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ledger_items_ledger_id on public.ledger_items (ledger_id);
create index if not exists idx_stock_levels_product on public.stock_levels (product_id);
create index if not exists idx_stock_levels_location on public.stock_levels (location_id);
create index if not exists idx_stock_ledger_status on public.stock_ledger (status);
create index if not exists idx_stock_ledger_type on public.stock_ledger (document_type);

-- ---------------------------------------------------------------------------
-- 9. updated_at HELPER TRIGGER (generic)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ledger_updated_at on public.stock_ledger;
create trigger trg_ledger_updated_at
  before update on public.stock_ledger
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.users_profiles;
create trigger trg_profiles_updated_at
  before update on public.users_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. CORE STOCK MOVEMENT HELPER
--     Adjusts stock_levels safely, raising a friendly error on negative stock
--     instead of a raw constraint violation.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_delta(
  p_product_id  uuid,
  p_location_id uuid,
  p_delta       integer
) returns void as $$
declare
  v_current integer;
begin
  insert into public.stock_levels (product_id, location_id, current_quantity)
  values (p_product_id, p_location_id, 0)
  on conflict (product_id, location_id) do nothing;

  select current_quantity into v_current
  from public.stock_levels
  where product_id = p_product_id and location_id = p_location_id
  for update;

  if (v_current + p_delta) < 0 then
    raise exception 'Insufficient stock for product % at location % (have %, requested %)',
      p_product_id, p_location_id, v_current, p_delta
      using errcode = 'P0001';
  end if;

  update public.stock_levels
    set current_quantity = v_current + p_delta,
        updated_at = now()
  where product_id = p_product_id and location_id = p_location_id;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 11. MAIN TRIGGER FUNCTION
--     Fires when stock_ledger.status transitions -> 'Done'
--     Applies the correct stock movement per document_type:
--       Receipt    : + destination_location_id
--       Delivery   : - source_location_id
--       Internal   : - source_location_id, + destination_location_id
--       Adjustment : sync current_quantity to counted_quantity at destination
-- ---------------------------------------------------------------------------
create or replace function public.process_ledger_validation()
returns trigger as $$
declare
  item record;
  v_current integer;
begin
  -- Only act on a transition INTO 'Done'
  if new.status = 'Done' and (old.status is distinct from 'Done') then

    if new.document_type = 'Receipt' then
      if new.destination_location_id is null then
        raise exception 'Receipt documents require a destination_location_id';
      end if;
      for item in select * from public.ledger_items where ledger_id = new.id loop
        perform public.apply_stock_delta(item.product_id, new.destination_location_id, item.quantity);
      end loop;

    elsif new.document_type = 'Delivery' then
      if new.source_location_id is null then
        raise exception 'Delivery documents require a source_location_id';
      end if;
      for item in select * from public.ledger_items where ledger_id = new.id loop
        perform public.apply_stock_delta(item.product_id, new.source_location_id, -item.quantity);
      end loop;

    elsif new.document_type = 'Internal' then
      if new.source_location_id is null or new.destination_location_id is null then
        raise exception 'Internal transfers require both source_location_id and destination_location_id';
      end if;
      for item in select * from public.ledger_items where ledger_id = new.id loop
        perform public.apply_stock_delta(item.product_id, new.source_location_id, -item.quantity);
        perform public.apply_stock_delta(item.product_id, new.destination_location_id, item.quantity);
      end loop;

    elsif new.document_type = 'Adjustment' then
      if new.destination_location_id is null then
        raise exception 'Adjustment documents require a destination_location_id (the location being counted)';
      end if;
      for item in select * from public.ledger_items where ledger_id = new.id loop
        if item.counted_quantity is null then
          raise exception 'Adjustment line for product % is missing counted_quantity', item.product_id;
        end if;

        insert into public.stock_levels (product_id, location_id, current_quantity)
        values (item.product_id, new.destination_location_id, 0)
        on conflict (product_id, location_id) do nothing;

        update public.stock_levels
          set current_quantity = item.counted_quantity,
              updated_at = now()
        where product_id = item.product_id and location_id = new.destination_location_id;
      end loop;
    end if;

    new.validated_at = now();
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_process_ledger_validation on public.stock_ledger;
create trigger trg_process_ledger_validation
  before update on public.stock_ledger
  for each row execute function public.process_ledger_validation();

-- NOTE: documents are always created as 'Draft' via POST /api/operations/ledger
-- and transitioned to 'Done' via PUT /api/operations/ledger/:id/validate, which
-- performs an UPDATE and fires trg_process_ledger_validation above. The API
-- layer deliberately never inserts a row with status = 'Done' directly.

-- ---------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY
--     Hackathon-pragmatic policy: any authenticated user can read/write.
--     Tighten per-role (Inventory Manager vs Warehouse Staff) as needed.
-- ---------------------------------------------------------------------------
alter table public.users_profiles     enable row level security;
alter table public.locations          enable row level security;
alter table public.product_categories enable row level security;
alter table public.products           enable row level security;
alter table public.stock_levels       enable row level security;
alter table public.stock_ledger       enable row level security;
alter table public.ledger_items       enable row level security;

drop policy if exists "auth read profiles" on public.users_profiles;
create policy "auth read profiles" on public.users_profiles
  for select using (auth.role() = 'authenticated');
drop policy if exists "self update profile" on public.users_profiles;
create policy "self update profile" on public.users_profiles
  for update using (auth.uid() = id);
drop policy if exists "self insert profile" on public.users_profiles;
create policy "self insert profile" on public.users_profiles
  for insert with check (auth.uid() = id);

drop policy if exists "auth all locations" on public.locations;
create policy "auth all locations" on public.locations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth all categories" on public.product_categories;
create policy "auth all categories" on public.product_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth all products" on public.products;
create policy "auth all products" on public.products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth all stock_levels" on public.stock_levels;
create policy "auth all stock_levels" on public.stock_levels
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth all stock_ledger" on public.stock_ledger;
create policy "auth all stock_ledger" on public.stock_ledger
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth all ledger_items" on public.ledger_items;
create policy "auth all ledger_items" on public.ledger_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 13. SEED DATA — problem statement example (Steel Rods, Chairs, Main
--     Warehouse, Production Rack/Floor)
-- ---------------------------------------------------------------------------
insert into public.locations (name) values
  ('Main Warehouse'),
  ('Production Floor'),
  ('Rack A')
on conflict (name) do nothing;

insert into public.product_categories (name) values
  ('Raw Materials'),
  ('Finished Goods')
on conflict (name) do nothing;

insert into public.products (name, sku, category_id, unit_of_measure)
select 'Steel Rods', 'RM-STEEL-001', c.id, 'kg'
from public.product_categories c where c.name = 'Raw Materials'
on conflict (sku) do nothing;

insert into public.products (name, sku, category_id, unit_of_measure)
select 'Chairs', 'FG-CHAIR-001', c.id, 'unit'
from public.product_categories c where c.name = 'Finished Goods'
on conflict (sku) do nothing;

-- Seed opening stock: 500kg Steel Rods in Main Warehouse, 20 Chairs in Rack A
insert into public.stock_levels (product_id, location_id, current_quantity)
select p.id, l.id, 500
from public.products p, public.locations l
where p.sku = 'RM-STEEL-001' and l.name = 'Main Warehouse'
on conflict (product_id, location_id) do update set current_quantity = excluded.current_quantity;

insert into public.stock_levels (product_id, location_id, current_quantity)
select p.id, l.id, 20
from public.products p, public.locations l
where p.sku = 'FG-CHAIR-001' and l.name = 'Rack A'
on conflict (product_id, location_id) do update set current_quantity = excluded.current_quantity;

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================
