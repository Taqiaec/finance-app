# Finance App

Double-entry bookkeeping web application for company finance management. Client-side SPA with a PostgreSQL backend, built to replace traditional accounting software.

## Features

- **Chart of Accounts** — Manage your account registry with account types (Asset, Liability, Equity, Revenue, Expense) and cash flow classifications
- **Journal Entry** — Create double-entry transactions with automatic debit/credit balancing validation
- **Period Management** — Define fiscal months and lock periods to prevent retroactive edits
- **Trial Balance** — View summed debits and credits per account for any period
- **Financial Reports** — Profit & Loss, Balance Sheet, and Cash Flow Statement (indirect method)
- **Role-based Access** — Admin (full access) and Viewer (read-only reports and trial balance)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Firebase Hosting |

No backend server — the browser talks directly to Supabase via the JS client, secured by Row Level Security.

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Setup

```bash
# Clone and install
git clone <repo-url>
cd "Finance app"
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` with your Supabase project credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup

Run the initial schema migration from `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor. This creates all tables, triggers, RLS policies, and the `is_admin()` helper function.

If you need to re-apply grants manually (after schema changes), run:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO authenticated;
```

### Run Locally

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### First Admin

1. Sign up through the app — creates a user with Viewer role
2. In the Supabase SQL Editor, promote yourself:

```sql
UPDATE public.user_profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
```

3. Log out and back in — admin features appear

## Usage Guide

### Chart of Accounts

Navigation: **Accounts** in sidebar.

Accounts are the foundation. Each account has:
- **Code** — unique identifier (e.g., `1-1001` for Cash, `4-2001` for Sales Revenue)
- **Name** — descriptive label
- **Type** — Asset, Liability, Equity, Revenue, or Expense
- **Cash Flow Category** — Operating, Investing, Financing, or None

Add accounts before creating journal entries. Deactivate accounts you no longer use.

### Journal Entries

Navigation: **Journals** → **+ New Entry**.

A journal entry records a transaction using debits and credits:
1. Select a date and optional fiscal period
2. Add a description
3. Add at least one debit line and one credit line
4. Debit total must equal credit total — the indicator shows "Balanced" when equal
5. Click **Post Entry**

Business rules:
- Amounts are whole-IDR integers (no decimals)
- Posted entries cannot be deleted — use **Reverse** to create a counter-entry
- Locked periods block new entries and edits

### Periods

Navigation: **Periods** in sidebar.

Create fiscal periods (e.g., `2026-01` for January 2026). Lock a period to freeze all transactions within it. Only admins can create or lock periods.

### Reports

All reports filter by period and include only posted transactions.

**Trial Balance** — Sum of all debits and credits per account. A validation check before generating final reports.

**Profit & Loss** — Revenue minus expenses for the period. Shows net income.

**Balance Sheet** — Assets, liabilities, and equity snapshot as of period end.

**Cash Flow** — Indirect method, grouped by operating/investing/financing categories.

### Roles

| Role | Permissions |
|------|------------|
| Admin | Full CRUD on accounts, journals, periods. Access to all reports. |
| Viewer | Read-only access to reports and trial balance. |

Role changes require direct database update by an existing admin.

## Architecture

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

Reports query PostgreSQL views and functions — all computation happens in the database, not the browser.

## Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build → /dist
npm run typecheck  # TypeScript type check
npm run lint       # ESLint
firebase deploy    # Deploy to Firebase Hosting
```

## Project Structure

```
/src
  /pages
    /accounts        Chart of Accounts
    /journals        Journal list + form
    /periods         Period management
    /reports         Trial Balance, P&L, Balance Sheet, Cash Flow
  /lib
    supabase.ts      Supabase client
    types.ts         Shared TypeScript types
    accounting.ts    Frontend validation (debit/credit)
    format.ts        IDR currency formatting
  /components
    Layout.tsx       App shell + sidebar
    ProtectedRoute.tsx Auth guard
/supabase
  /migrations        SQL migration files
```

## Scope

Current (Phase 1):
- Chart of Accounts management
- Double-entry journal entries with validation
- Fiscal period locking
- Trial Balance, P&L, Balance Sheet, Cash Flow reports
- Admin/Viewer role system

Out of scope:
- Multi-currency
- Tax calculation (PPN, PPh)
- Fixed asset depreciation
- Payroll
- Import/export
