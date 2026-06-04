-- LUCI Gold v2.0 — Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

create type transaction_channel as enum ('g2g', 'direct');
create type transaction_status as enum ('pending', 'completed', 'cancelled');
create type capital_log_type as enum ('topup', 'withdrawal', 'profit_inject', 'expense');
create type expense_type as enum ('rutin', 'non_rutin');
create type user_role as enum ('admin', 'investor');

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'investor',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FEE CONFIGURATION
-- ============================================================

create table fee_config (
  id uuid primary key default gen_random_uuid(),
  seller_rank text not null,
  commission_pct numeric(5,2) not null,
  vat_pct numeric(5,2) not null default 11,
  withdrawal_method text not null,
  withdrawal_fee_pct numeric(5,2) not null,
  withdrawal_fee_fixed numeric(12,2) not null default 0,
  currency text not null default 'IDR',
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Seed default fee config (Uncommon + DOKU Bank Transfer)
insert into fee_config (seller_rank, commission_pct, vat_pct, withdrawal_method, withdrawal_fee_pct, withdrawal_fee_fixed, currency, is_active)
values ('Uncommon', 7.99, 11, 'DOKU Bank Transfer', 1.99, 19999, 'IDR', true);

-- ============================================================
-- PROFIT SHARING CONFIG
-- ============================================================

create table profit_sharing_config (
  id uuid primary key default gen_random_uuid(),
  ops_percentage numeric(5,2) not null default 50,
  updated_at timestamptz not null default now()
);

insert into profit_sharing_config (ops_percentage) values (50);

-- ============================================================
-- TRANSACTIONS
-- ============================================================

create table transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  transaction_date date not null,
  channel transaction_channel not null,
  game_name text not null default 'FFXIV',
  gold_amount numeric(16,2) not null,
  buy_price_idr numeric(16,2) not null,
  sell_price_idr numeric(16,2) not null,
  commission_fee_pct numeric(5,2),
  payment_fee_pct numeric(5,2),
  status transaction_status not null default 'pending',
  settled_at timestamptz,
  profit_idr numeric(16,2),
  notes text,
  created_by uuid references profiles(id),
  week_number int generated always as (extract(week from transaction_date)::int) stored
);

-- ============================================================
-- WITHDRAWALS (G2G → Bank)
-- ============================================================

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  withdrawal_date date not null,
  amount_idr numeric(16,2) not null,
  withdrawal_fee_pct numeric(5,2) not null,
  withdrawal_fee_fixed_idr numeric(12,2) not null default 19999,
  amount_received_idr numeric(16,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- OPERATIONAL EXPENSES
-- ============================================================

create table operational_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null,
  description text not null,
  amount_idr numeric(16,2) not null,
  expense_type expense_type not null default 'non_rutin',
  week_number int generated always as (extract(week from expense_date)::int) stored,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CAPITAL LOG
-- ============================================================

create table capital_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  type capital_log_type not null,
  amount_idr numeric(16,2) not null,
  description text,
  balance_after numeric(16,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table transactions enable row level security;
alter table withdrawals enable row level security;
alter table operational_expenses enable row level security;
alter table capital_log enable row level security;
alter table fee_config enable row level security;
alter table profit_sharing_config enable row level security;

-- Helper function: get current user role
create or replace function get_my_role()
returns user_role
language sql security definer
as $$
  select role from profiles where id = auth.uid();
$$;

-- Profiles: user can read own, admin can read all
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or get_my_role() = 'admin');

create policy "profiles_insert_admin" on profiles for insert
  with check (get_my_role() = 'admin');

create policy "profiles_update_admin" on profiles for update
  using (get_my_role() = 'admin');

-- Transactions: authenticated users can read, only admin can write
create policy "transactions_select" on transactions for select
  using (auth.uid() is not null);

create policy "transactions_insert_admin" on transactions for insert
  with check (get_my_role() = 'admin');

create policy "transactions_update_admin" on transactions for update
  using (get_my_role() = 'admin');

create policy "transactions_delete_admin" on transactions for delete
  using (get_my_role() = 'admin');

-- Withdrawals: same pattern
create policy "withdrawals_select" on withdrawals for select
  using (auth.uid() is not null);

create policy "withdrawals_write_admin" on withdrawals for all
  using (get_my_role() = 'admin');

-- Operational expenses
create policy "expenses_select" on operational_expenses for select
  using (auth.uid() is not null);

create policy "expenses_write_admin" on operational_expenses for all
  using (get_my_role() = 'admin');

-- Capital log
create policy "capital_select" on capital_log for select
  using (auth.uid() is not null);

create policy "capital_write_admin" on capital_log for all
  using (get_my_role() = 'admin');

-- Fee config: read for all auth, write admin only
create policy "fee_config_select" on fee_config for select
  using (auth.uid() is not null);

create policy "fee_config_write_admin" on fee_config for all
  using (get_my_role() = 'admin');

-- Profit sharing config
create policy "ps_config_select" on profit_sharing_config for select
  using (auth.uid() is not null);

create policy "ps_config_write_admin" on profit_sharing_config for all
  using (get_my_role() = 'admin');

-- ============================================================
-- TRIGGER: auto-create profile after signup
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'investor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
