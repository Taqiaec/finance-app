-- =============================================
-- Finance Webapp — Report Views Migration
-- =============================================

-- Indexes on FK columns for view performance
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_id ON public.journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_journals_date ON public.journals(date);

-- View 1: Trial Balance
-- Aggregated debit/credit per account per period
CREATE OR REPLACE VIEW public.v_trial_balance AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'), 0) AS total_debit,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0) AS total_credit,
  j.period_id
FROM public.accounts a
JOIN public.journal_lines jl ON jl.account_id = a.id
JOIN public.journals j ON j.id = jl.journal_id
WHERE j.status = 'posted'
GROUP BY a.id, a.code, a.name, a.type, j.period_id;

-- View 2: Profit & Loss
-- Revenue and expense accounts with credit/debit totals per period
CREATE OR REPLACE VIEW public.v_profit_loss AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0) AS credit_total,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'), 0) AS debit_total,
  j.period_id
FROM public.accounts a
JOIN public.journal_lines jl ON jl.account_id = a.id
JOIN public.journals j ON j.id = jl.journal_id
WHERE j.status = 'posted' AND a.type IN ('revenue', 'expense')
GROUP BY a.id, a.code, a.name, a.type, j.period_id;

-- View 3: Balance Sheet (cumulative)
-- Asset/liability/equity balances as of period end date
-- Uses CROSS JOIN so each journal contributes to every period ending on or after its date
CREATE OR REPLACE VIEW public.v_balance_sheet AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'), 0) AS total_debit,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0) AS total_credit,
  p.id AS period_id,
  p.end_date AS period_end_date
FROM public.accounts a
JOIN public.journal_lines jl ON jl.account_id = a.id
JOIN public.journals j ON j.id = jl.journal_id
CROSS JOIN public.periods p
WHERE j.status = 'posted' AND a.type IN ('asset', 'liability', 'equity')
  AND j.date <= p.end_date
GROUP BY a.id, a.code, a.name, a.type, p.id, p.end_date;

-- View 4: Cash Flow
-- Grouped by cash_flow_category per period
CREATE OR REPLACE VIEW public.v_cash_flow AS
SELECT
  a.cash_flow_category,
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'debit'), 0) AS total_debit,
  COALESCE(SUM(jl.amount) FILTER (WHERE jl.type = 'credit'), 0) AS total_credit,
  j.period_id
FROM public.accounts a
JOIN public.journal_lines jl ON jl.account_id = a.id
JOIN public.journals j ON j.id = jl.journal_id
WHERE j.status = 'posted' AND a.cash_flow_category != 'none'
GROUP BY a.cash_flow_category, a.id, a.code, a.name, j.period_id;

-- Grant SELECT on views to authenticated role
GRANT SELECT ON public.v_trial_balance TO authenticated;
GRANT SELECT ON public.v_profit_loss TO authenticated;
GRANT SELECT ON public.v_balance_sheet TO authenticated;
GRANT SELECT ON public.v_cash_flow TO authenticated;

-- Prevent admin self-demote via RLS
DROP POLICY IF EXISTS "Admins can update profiles" ON public.user_profiles;
CREATE POLICY "Admins can update profiles"
  ON public.user_profiles FOR update
  USING (public.is_admin())
  WITH CHECK (
    public.is_admin()
    AND id != auth.uid()
  );
