CREATE OR REPLACE FUNCTION public.edit_journal(
  p_journal_id uuid,
  p_date date,
  p_description text,
  p_period_id uuid,
  p_lines jsonb
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.journals WHERE id = p_journal_id) THEN
    RAISE EXCEPTION 'Journal % not found', p_journal_id;
  END IF;

  DELETE FROM public.journal_lines WHERE journal_id = p_journal_id;

  UPDATE public.journals
  SET date = p_date, description = p_description, period_id = p_period_id
  WHERE id = p_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, type, amount)
  SELECT
    p_journal_id,
    (line->>'account_id')::uuid,
    line->>'type',
    (line->>'amount')::bigint
  FROM jsonb_array_elements(p_lines) AS line;

  -- The existing trigger validate_journal_balance fires here
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reverse_journal(
  p_journal_id uuid
)
RETURNS uuid AS $$
DECLARE
  new_journal_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.journals WHERE id = p_journal_id AND status = 'posted'
  ) THEN
    RAISE EXCEPTION 'Journal % not found or not posted', p_journal_id;
  END IF;

  INSERT INTO public.journals (date, description, period_id, status)
  SELECT
    CURRENT_DATE,
    'Reversal of: ' || description,
    period_id,
    'posted'
  FROM public.journals WHERE id = p_journal_id
  RETURNING id INTO new_journal_id;

  INSERT INTO public.journal_lines (journal_id, account_id, type, amount)
  SELECT
    new_journal_id,
    jl.account_id,
    CASE WHEN jl.type = 'debit' THEN 'credit' ELSE 'debit' END,
    jl.amount
  FROM public.journal_lines jl
  WHERE jl.journal_id = p_journal_id;

  UPDATE public.journals
  SET status = 'reversed', reversed_by = new_journal_id
  WHERE id = p_journal_id;

  RETURN new_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
