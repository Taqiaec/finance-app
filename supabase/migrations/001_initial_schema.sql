-- =============================================
-- Finance Webapp — Initial Schema Migration
-- =============================================

-- User roles
create table public.user_profiles (
  id uuid primary key references auth.users(id),
  role text not null check (role in ('admin', 'viewer')),
  full_name text,
  created_at timestamptz default now()
);

-- Chart of Accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  cash_flow_category text check (cash_flow_category in ('operating', 'investing', 'financing', 'none')),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Fiscal periods
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_locked boolean default false,
  created_at timestamptz default now()
);

-- Journal headers
create table public.journals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  period_id uuid references public.periods(id),
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reversed_by uuid references public.journals(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Journal lines (debit/credit)
create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id),
  account_id uuid not null references public.accounts(id),
  type text not null check (type in ('debit', 'credit')),
  amount bigint not null check (amount > 0),
  created_at timestamptz default now()
);

-- =============================================
-- Trigger: Validate debit = credit on journal insert
-- =============================================
create or replace function public.validate_journal_balance()
returns trigger as $$
declare
  total_debit bigint;
  total_credit bigint;
begin
  select coalesce(sum(amount), 0) into total_debit
  from public.journal_lines
  where journal_id = NEW.id and type = 'debit';

  select coalesce(sum(amount), 0) into total_credit
  from public.journal_lines
  where journal_id = NEW.id and type = 'credit';

  if total_debit != total_credit then
    raise exception 'Journal entry not balanced: debit % != credit %', total_debit, total_credit;
  end if;

  if total_debit = 0 then
    raise exception 'Journal entry has no lines';
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trigger_validate_journal_balance
  after insert on public.journal_lines
  for each statement
  execute function public.validate_journal_balance();

-- =============================================
-- Trigger: Block journal changes when period is locked
-- =============================================
create or replace function public.check_period_locked()
returns trigger as $$
declare
  period_locked boolean;
begin
  if NEW.period_id is not null then
    select is_locked into period_locked
    from public.periods
    where id = NEW.period_id;

    if period_locked = true then
      raise exception 'Cannot modify journal: period is locked';
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trigger_check_period_locked
  before insert or update on public.journals
  for each row
  execute function public.check_period_locked();

-- =============================================
-- Row Level Security
-- =============================================

alter table public.user_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.periods enable row level security;
alter table public.journals enable row level security;
alter table public.journal_lines enable row level security;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- user_profiles policies
create policy "Users can view own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "Admins can view all profiles"
  on public.user_profiles for select
  using (public.is_admin());

create policy "Admins can update profiles"
  on public.user_profiles for update
  using (public.is_admin());

-- accounts policies
create policy "Anyone can view accounts"
  on public.accounts for select
  using (true);

create policy "Admins can insert accounts"
  on public.accounts for insert
  with check (public.is_admin());

create policy "Admins can update accounts"
  on public.accounts for update
  using (public.is_admin());

create policy "Admins can delete accounts"
  on public.accounts for delete
  using (public.is_admin());

-- periods policies
create policy "Anyone can view periods"
  on public.periods for select
  using (true);

create policy "Admins can manage periods"
  on public.periods for all
  using (public.is_admin());

-- journals policies
create policy "Anyone can view journals"
  on public.journals for select
  using (true);

create policy "Admins can insert journals"
  on public.journals for insert
  with check (public.is_admin());

create policy "Admins can update journals"
  on public.journals for update
  using (public.is_admin());

create policy "Admins can delete journals"
  on public.journals for delete
  using (public.is_admin());

-- journal_lines policies
create policy "Anyone can view journal lines"
  on public.journal_lines for select
  using (true);

create policy "Admins can insert journal lines"
  on public.journal_lines for insert
  with check (public.is_admin());

create policy "Admins can update journal lines"
  on public.journal_lines for update
  using (public.is_admin());

create policy "Admins can delete journal lines"
  on public.journal_lines for delete
  using (public.is_admin());
