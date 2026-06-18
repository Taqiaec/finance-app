// =============================================
// Finance Webapp — Database Types
// Generated manually — run `npx supabase gen types typescript --local > src/lib/database.types.ts`
// after applying migrations to regenerate from schema.
// =============================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type CashFlowCategory = 'operating' | 'investing' | 'financing' | 'none'
export type JournalStatus = 'posted' | 'reversed'
export type JournalLineType = 'debit' | 'credit'
export type UserRole = 'admin' | 'viewer'

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          full_name?: string | null
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          code: string
          name: string
          type: AccountType
          cash_flow_category: CashFlowCategory
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          type: AccountType
          cash_flow_category?: CashFlowCategory
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          type?: AccountType
          cash_flow_category?: CashFlowCategory
          is_active?: boolean
          created_at?: string
        }
      }
      periods: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          is_locked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          is_locked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_date?: string
          end_date?: string
          is_locked?: boolean
          created_at?: string
        }
      }
      journals: {
        Row: {
          id: string
          date: string
          description: string
          period_id: string | null
          status: JournalStatus
          reversed_by: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          description: string
          period_id?: string | null
          status?: JournalStatus
          reversed_by?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          description?: string
          period_id?: string | null
          status?: JournalStatus
          reversed_by?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      journal_lines: {
        Row: {
          id: string
          journal_id: string
          account_id: string
          type: JournalLineType
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          journal_id: string
          account_id: string
          type: JournalLineType
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          journal_id?: string
          account_id?: string
          type?: JournalLineType
          amount?: number
          created_at?: string
        }
      }
    }
    Views: {
      v_trial_balance: {
        Row: {
          account_id: string
          account_code: string
          account_name: string
          account_type: AccountType
          total_debit: number
          total_credit: number
          period_id: string | null
        }
      }
      v_profit_loss: {
        Row: {
          account_id: string
          account_code: string
          account_name: string
          account_type: AccountType
          credit_total: number
          debit_total: number
          period_id: string | null
        }
      }
      v_balance_sheet: {
        Row: {
          account_id: string
          account_code: string
          account_name: string
          account_type: AccountType
          total_debit: number
          total_credit: number
          period_id: string
          period_end_date: string
        }
      }
      v_cash_flow: {
        Row: {
          cash_flow_category: CashFlowCategory
          account_id: string
          account_code: string
          account_name: string
          total_debit: number
          total_credit: number
          period_id: string | null
        }
      }
    }
  }
}
