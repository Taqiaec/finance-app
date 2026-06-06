export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type CashFlowCategory = 'operating' | 'investing' | 'financing' | 'none'
export type JournalStatus = 'posted' | 'reversed'
export type JournalLineType = 'debit' | 'credit'
export type UserRole = 'admin' | 'viewer'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  created_at: string
}

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  cash_flow_category: CashFlowCategory
  is_active: boolean
  created_at: string
}

export interface Period {
  id: string
  name: string
  start_date: string
  end_date: string
  is_locked: boolean
  created_at: string
}

export interface Journal {
  id: string
  date: string
  description: string
  period_id: string | null
  status: JournalStatus
  reversed_by: string | null
  created_by: string | null
  created_at: string
}

export interface JournalLine {
  id: string
  journal_id: string
  account_id: string
  type: JournalLineType
  amount: number
  created_at: string
}

export interface JournalWithLines extends Journal {
  journal_lines: JournalLine[]
}

export interface TrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  total_debit: number
  total_credit: number
  balance: number
}

export interface ReportPeriod {
  id: string
  name: string
  start_date: string
  end_date: string
}
