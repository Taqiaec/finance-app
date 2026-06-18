# Plan 001: Make journal edit and reversal atomic via database RPC functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f59079c..HEAD -- src/pages/JournalFormPage.tsx src/pages/JournalsPage.tsx supabase/migrations/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f59079c`, 2026-06-18
- **Issue**: none

## Why this matters

The journal edit and reversal operations each perform multiple sequential Supabase calls without database-level atomicity. If any call fails mid-sequence, the database is left in a state where the accounting equation (debits == credits) is broken for that entry. These should be single atomic RPC functions that run inside a PostgreSQL transaction.

## Current state

**Journal edit** (`src/pages/JournalFormPage.tsx:87-96`) — 3 separate calls:
```
delete journal_lines → update journals → insert journal_lines
```
If the insert fails, the journal has zero lines. The DB trigger only fires on INSERT, so the delete is unguarded.

**Journal reversal** (`src/pages/JournalsPage.tsx:45-62`) — 3 separate calls:
```
insert new journal → insert reversed lines → update original status
```
Lines 58-60 have no error handling. If the line insert fails, the original is still marked `reversed` — double-counting disappears from reports.

**Existing migration files:**
- `supabase/migrations/001_initial_schema.sql` — tables, triggers, RLS
- `supabase/migrations/002_report_views.sql` — report views

**Conventions:**
- SQL migrations are numbered sequentially in `supabase/migrations/`
- All functions use `plpgsql`, `security definer` is used for `is_admin()`
- Frontend calls Supabase via `supabase.rpc('function_name', { params })`
- All monetary values are `bigint` (IDR integers, no decimals)

## Commands you will need

| Purpose   | Command                                    | Expected on success          |
|-----------|-------------------------------------------|------------------------------|
| Typecheck | `npm run typecheck`                       | exit 0, no errors            |
| Lint      | `npm run lint`                            | exit 0                       |

## Scope

**In scope:**
- `supabase/migrations/003_atomic_journal_operations.sql` (create)
- `src/pages/JournalFormPage.tsx` (modify handleSubmit edit branch)
- `src/pages/JournalsPage.tsx` (modify handleReverse)

**Out of scope:**
- `supabase/migrations/001_initial_schema.sql` — do not modify
- `supabase/migrations/002_report_views.sql` — do not modify
- `src/lib/accounting.ts` — no changes needed
- No changes to the balance sheet, P&L, cash flow, or trial balance views
- No changes to RLS policies (the RPC functions will use `SECURITY DEFINER` and run with the privileges of the function owner, bypassing RLS — same pattern as `is_admin()`)

## Git workflow

- Branch: `fix/atomic-journal-operations`
- Commit 1: migration file — message `fix: add atomic RPC functions for journal edit and reversal`
- Commit 2: frontend changes — message `fix: use atomic RPC functions for journal edit and reversal`

## Steps

### Step 1: Create the migration file with two RPC functions

Create `supabase/migrations/003_atomic_journal_operations.sql` with these two functions:

**Function 1: `edit_journal`**

```sql
CREATE OR REPLACE FUNCTION public.edit_journal(
  p_journal_id uuid,
  p_date date,
  p_description text,
  p_period_id uuid,
  p_lines jsonb  -- array of {account_id uuid, type text, amount bigint}
)
RETURNS void AS $$
BEGIN
  -- Verify the journal exists
  IF NOT EXISTS (SELECT 1 FROM public.journals WHERE id = p_journal_id) THEN
    RAISE EXCEPTION 'Journal % not found', p_journal_id;
  END IF;

  -- Delete existing lines
  DELETE FROM public.journal_lines WHERE journal_id = p_journal_id;

  -- Update journal metadata
  UPDATE public.journals
  SET date = p_date, description = p_description, period_id = p_period_id
  WHERE id = p_journal_id;

  -- Insert new lines
  INSERT INTO public.journal_lines (journal_id, account_id, type, amount)
  SELECT
    p_journal_id,
    (line->>'account_id')::uuid,
    line->>'type',
    (line->>'amount')::bigint
  FROM jsonb_array_elements(p_lines) AS line;

  -- The existing trigger validate_journal_balance will fire here
  -- and raise an exception if debits != credits
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Key properties:
- Runs in a single transaction — if any step fails, everything rolls back
- The `validate_journal_balance` trigger fires on the INSERT and validates the equation
- `SECURITY DEFINER` bypasses RLS (same pattern as `is_admin()`)

**Function 2: `reverse_journal`**

```sql
CREATE OR REPLACE FUNCTION public.reverse_journal(
  p_journal_id uuid
)
RETURNS uuid AS $$
DECLARE
  new_journal_id uuid;
BEGIN
  -- Verify the source journal exists and is posted
  IF NOT EXISTS (
    SELECT 1 FROM public.journals WHERE id = p_journal_id AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'Journal % not found or not posted', p_journal_id;
  END IF;

  -- Create the reversal journal
  INSERT INTO public.journals (date, description, period_id, status)
  SELECT
    CURRENT_DATE,
    'Reversal of: ' || description,
    period_id,
    'posted'
  FROM public.journals WHERE id = p_journal_id
  RETURNING id INTO new_journal_id;

  -- Insert reversed lines (swap debit↔credit, keep same amounts)
  INSERT INTO public.journal_lines (journal_id, account_id, type, amount)
  SELECT
    new_journal_id,
    jl.account_id,
    CASE WHEN jl.type = 'debit' THEN 'credit' ELSE 'debit' END,
    jl.amount
  FROM public.journal_lines jl
  WHERE jl.journal_id = p_journal_id;

  -- Mark original as reversed
  UPDATE public.journals
  SET status = 'reversed', reversed_by = new_journal_id
  WHERE id = p_journal_id;

  RETURN new_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Key properties:
- Single transaction — the trigger validates the reversal lines are balanced
- Returns the new journal ID
- Verifies the source is `posted` before reversing

**Verify**: After running this migration in Supabase SQL Editor:
- `SELECT proname FROM pg_proc WHERE proname IN ('edit_journal', 'reverse_journal');` → should return 2 rows

### Step 2: Modify `JournalFormPage.tsx` — replace edit branch

In `src/pages/JournalFormPage.tsx`, replace the edit branch (lines 87-97) from:

```typescript
if (isEdit && id) {
  const { error: delErr } = await supabase.from('journal_lines').delete().eq('journal_id', id)
  if (delErr) { setError(`Failed to clear lines: ${delErr.message}`); setSaving(false); return }

  const { error: updErr } = await supabase.from('journals').update({ date, description, period_id: periodId || null }).eq('id', id)
  if (updErr) { setError(`Failed to update journal: ${updErr.message}`); setSaving(false); return }

  const { error: insErr } = await supabase.from('journal_lines').insert(
    lines.map((l) => ({ journal_id: id, account_id: l.account_id, type: l.type, amount: l.amount }))
  )
  if (insErr) { setError(`Failed to insert lines: ${insErr.message}`); setSaving(false); return }
}
```

To:

```typescript
if (isEdit && id) {
  const { error: rpcErr } = await supabase.rpc('edit_journal', {
    p_journal_id: id,
    p_date: date,
    p_description: description,
    p_period_id: periodId || null,
    p_lines: lines.map((l) => ({ account_id: l.account_id, type: l.type, amount: l.amount })),
  })
  if (rpcErr) { setError(`Failed to update journal: ${rpcErr.message}`); setSaving(false); return }
}
```

**Verify**: `npm run typecheck` → exit 0, no errors

### Step 3: Modify `JournalsPage.tsx` — replace handleReverse

In `src/pages/JournalsPage.tsx`, replace the `handleReverse` function (lines 34-63) from:

```typescript
async function handleReverse(id: string) {
  if (!confirm('Reverse this journal entry?')) return
  const journal = journals.find((j) => j.id === id)
  if (!journal) return

  const reversedLines = journal.journal_lines.map((l) => ({
    account_id: l.account_id,
    type: l.type === 'debit' ? 'credit' : 'debit',
    amount: l.amount,
  }))

  const { data: newJournal, error } = await supabase
    .from('journals')
    .insert({
      date: new Date().toISOString().split('T')[0],
      description: `Reversal of: ${journal.description}`,
      period_id: journal.period_id,
      status: 'posted',
    })
    .select()
    .single()

  if (error || !newJournal) { alert(error?.message ?? 'Failed'); return }

  await supabase.from('journal_lines').insert(
    reversedLines.map((l) => ({ ...l, journal_id: newJournal.id }))
  )

  await supabase.from('journals').update({ status: 'reversed', reversed_by: newJournal.id }).eq('id', id)
  window.location.reload()
}
```

To:

```typescript
async function handleReverse(id: string) {
  if (!confirm('Reverse this journal entry?')) return

  const { error } = await supabase.rpc('reverse_journal', { p_journal_id: id })
  if (error) { alert(error.message); return }

  window.location.reload()
}
```

After this change, the `useAuth` import is still needed (for `profile`), but the `Journal` and `JournalLine` types imported on line 6 are still needed for the `journals` state on line 11. The `Account` type is still needed for the `accounts` state. No imports need to change.

**Verify**: `npm run typecheck` → exit 0, no errors

### Step 4: Full verification

```bash
npm run typecheck    # exit 0
npm run lint         # exit 0
```

## Test plan

This plan does not add unit tests (none exist in the project). Manual verification:

1. Create a new journal entry with 2 lines (debit 100,000 / credit 100,000) → should succeed
2. Edit that journal entry (change amount to 200,000 / 200,000) → should succeed
3. Edit the journal entry to an unbalanced state (debit 100,000 / credit 200,000) → should fail with error from the trigger
4. Reverse the journal entry → should create a new entry with swapped lines and mark original as `reversed`
5. Try to reverse an already-reversed entry → should fail

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `supabase/migrations/003_atomic_journal_operations.sql` exists with both functions
- [ ] `grep -n "delete().eq.*journal_id" src/pages/JournalFormPage.tsx` returns no matches (old pattern removed)
- [ ] `grep -n "insert.*reversedLines" src/pages/JournalsPage.tsx` returns no matches (old pattern removed)
- [ ] `grep -n "edit_journal\|reverse_journal" src/pages/JournalFormPage.tsx src/pages/JournalsPage.tsx` returns matches in both files
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The `supabase.rpc()` calls fail typecheck — this could mean the Supabase generated types need regeneration. If so, run `npx supabase gen types typescript --local > src/lib/database.types.ts` and retry.
- You discover that Supabase RPC functions with `SECURITY DEFINER` don't work in the project's Supabase setup.

## Maintenance notes

- If the `journals` or `journal_lines` schema changes, both RPC functions must be updated to match.
- The `validate_journal_balance` trigger (from migration 001) fires automatically on the INSERT inside `edit_journal` — no additional validation is needed in the function body.
- If RLS policies are tightened in the future, verify that `SECURITY DEFINER` functions still have the necessary grants.
