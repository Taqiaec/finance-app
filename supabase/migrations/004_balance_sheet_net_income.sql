-- =============================================
-- Finance Webapp — Cumulative Net Income for Balance Sheet
-- =============================================

-- Cumulative net income as of each period end date, using the same
-- CROSS JOIN + j.date <= p.end_date pattern as v_balance_sheet.
-- This ensures revenue/expense are included only up to the period's end date,
-- making the balance sheet equation balance correctly.
CREATE OR REPLACE VIEW public.v_balance_sheet_net_income AS
SELECT
  p.id AS period_id,
  p.end_date AS period_end_date,
  -- Net Income = (Revenue credits - Revenue debits) - (Expense debits - Expense credits)
  COALESCE(SUM(jl.amount) FILTER (WHERE a.type = 'revenue' AND jl.type = 'credit'), 0)
    - COALESCE(SUM(jl.amount) FILTER (WHERE a.type = 'revenue' AND jl.type = 'debit'), 0)
    - COALESCE(SUM(jl.amount) FILTER (WHERE a.type = 'expense' AND jl.type = 'debit'), 0)
    + COALESCE(SUM(jl.amount) FILTER (WHERE a.type = 'expense' AND jl.type = 'credit'), 0)
    AS net_income
FROM public.accounts a
JOIN public.journal_lines jl ON jl.account_id = a.id
JOIN public.journals j ON j.id = jl.journal_id
CROSS JOIN public.periods p
WHERE j.status = 'posted' AND a.type IN ('revenue', 'expense')
  AND j.date <= p.end_date
GROUP BY p.id, p.end_date;

GRANT SELECT ON public.v_balance_sheet_net_income TO authenticated;
