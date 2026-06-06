# Finance Webapp — Project Context

## Project Overview
A double-entry bookkeeping web application for company finance management.
Built to replace an existing system (Kledo), with data entered fresh from scratch.

Core flow: **Chart of Accounts → Journal Entry → Reports**

## Tech Stack
- **Frontend:** React + Vite + Tailwind CSS + TypeScript
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Auth:** Supabase Auth
- **Hosting:** Firebase Hosting (static SPA)

No backend server. All data access goes directly from the browser to Supabase via the JS client, secured by RLS policies.

## Architecture

### Data Flow
```
Chart of Accounts
       ↓
Journal Entry (debit/credit pairs)
       ↓
Trial Balance
       ↓
┌──────────────┬────────────────┬──────────────────┐
│ Profit & Loss │ Balance Sheet  │ Cash Flow Stmt   │
└──────────────┴────────────────┴──────────────────┘
```

Reports are generated via **PostgreSQL views and RPC functions** in Supabase — not computed in the browser.

### Core Modules
1. **Chart of Accounts (CoA)** — account registry with type classification
2. **Journal Entry** — double-entry transactions with period tagging
3. **Trial Balance** — intermediate validation view
4. **Reports** — P&L, Balance Sheet, Cash Flow (indirect method)
5. **Period Management** — fiscal month/year open & lock
6. **Auth & Roles** — Admin and Viewer via Supabase Auth + RLS

## Database Schema (PostgreSQL)

```sql
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
  code text not null unique,           -- e.g. "1-1001"
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  cash_flow_category text check (cash_flow_category in ('operating', 'investing', 'financing', 'none')),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Fiscal periods
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,                  -- e.g. "2024-01"
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
  amount bigint not null check (amount > 0),  -- stored in IDR integer (no decimals)
  created_at timestamptz default now()
);
```

### DB Constraints & Triggers
- PostgreSQL trigger on `journals` to validate debit total = credit total before insert
- PostgreSQL trigger to block insert/update on `journals` when `period.is_locked = true`
- RLS on all tables — viewers can only SELECT, admins have full access

## Key Business Rules

### Double-Entry Validation
- EVERY journal entry must have total debits === total credits
- Enforce at BOTH frontend (before submit) AND database level (PostgreSQL trigger)
- Journal entries cannot be deleted — only reversed via a new counter-entry with `status = 'reversed'`

### Account Types
| Type | Normal Balance | Affects |
|------|---------------|---------|
| Asset | Debit | Balance Sheet |
| Liability | Credit | Balance Sheet |
| Equity | Credit | Balance Sheet |
| Revenue | Credit | P&L |
| Expense | Debit | P&L |

### Cash Flow Classification
Each account in CoA must have a `cash_flow_category`:
- `operating` | `investing` | `financing` | `none`
- Cash Flow Statement uses indirect method

### Period Locking
- Locked periods: no new journal entries or edits allowed
- Only Admin can lock/unlock a period
- Enforced via PostgreSQL trigger (not just frontend logic)

## Auth & Roles
- **Supabase Auth** for login/logout
- Role stored in `public.user_profiles.role`
- **Admin** — full access: CoA, journal entry, period management, reports
- **Viewer** — read-only: reports and trial balance only
- Enforced via **Row Level Security (RLS)** on all tables
- On sign-up, auto-create a `user_profiles` row with default role `viewer`

## Report Queries
- All reports generated via **PostgreSQL views or RPC functions** — not computed in JavaScript
- Always filter by `period_id` and `status = 'posted'`
- P&L: SUM revenue credits − SUM expense debits, grouped by account
- Balance Sheet: running balance of asset/liability/equity accounts up to period end date
- Cash Flow: grouped by `cash_flow_category`, indirect method

## Code Style
- TypeScript strict mode
- ES modules (`import/export`), never CommonJS (`require`)
- Destructure imports where possible
- All monetary values stored as **integers (IDR, no decimals)** to avoid float errors
- Use `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })` for display
- Dates as ISO 8601 strings in TypeScript, `date` type in PostgreSQL
- Use `@supabase/supabase-js` client directly — no SSR wrapper needed (SPA)

## Bash Commands
```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build → outputs to /dist
npm run typecheck  # Run TypeScript type checker
npm run lint       # Run ESLint
firebase deploy    # Deploy /dist to Firebase Hosting
npx supabase gen types typescript --local > src/lib/database.types.ts  # Regenerate DB types
```

## Workflow Rules
- ALWAYS run typecheck after a series of changes
- ALWAYS regenerate Supabase types after any schema migration
- NEVER hard-delete journal entries or journal lines — use reversal pattern
- NEVER allow journal save if debit total ≠ credit total (validate on frontend before submitting)
- When building a report, always filter by period and only include `status = 'posted'` journals
- All Supabase queries go through the JS client — no custom API server

## Out of Scope (Phase 1)
- Multi-currency
- Tax calculation (PPN, PPh)
- Fixed asset depreciation
- Payroll
- Import/export from external systems

## File Structure (Target)
```
/src
  /pages
    /dashboard
    /accounts          # Chart of Accounts
    /journals          # Journal entry list + form
    /reports
      /profit-loss
      /balance-sheet
      /cash-flow
      /trial-balance
    /periods           # Period management
    /settings          # User & role management
  /lib
    /supabase.ts       # Supabase client init
    /database.types.ts # Auto-generated from Supabase schema
    /accounting.ts     # Frontend validation logic (debit/credit check)
    /types.ts          # Shared TypeScript types
    /format.ts         # IDR formatting helpers
  /components
    /ui                # Reusable UI components
    /forms             # Journal entry form, CoA form
    /reports           # Report table components
/supabase
  /migrations          # SQL migration files
/dist                  # Vite build output → deployed to Firebase Hosting
```
