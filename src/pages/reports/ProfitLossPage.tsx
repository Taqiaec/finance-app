import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Account, Period, JournalLine } from '../../lib/types'

interface PnLRow {
  account_code: string
  account_name: string
  total: number
}

export function ProfitLossPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [revenue, setRevenue] = useState<PnLRow[]>([])
  const [expense, setExpense] = useState<PnLRow[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('periods').select('*').order('start_date', { ascending: false })
      if (data) setPeriods(data as Period[])
    }
    load()
  }, [])

  async function runReport() {
    setLoading(true)
    setRan(true)

    let journalQuery = supabase.from('journals').select('id').eq('status', 'posted')
    if (selectedPeriod) journalQuery = journalQuery.eq('period_id', selectedPeriod)
    const { data: journals } = await journalQuery
    if (!journals || journals.length === 0) { setRevenue([]); setExpense([]); setLoading(false); return }

    const journalIds = journals.map((j: { id: string }) => j.id)
    const { data: lines } = await supabase.from('journal_lines').select('*').in('journal_id', journalIds)
    const { data: accounts } = await supabase.from('accounts').select('*')

    if (!lines || !accounts) { setLoading(false); return }

    const accountMap = new Map<string, Account>()
    for (const a of accounts as Account[]) accountMap.set(a.id, a)

    const agg = new Map<string, { type: string; code: string; name: string; debit: number; credit: number }>()
    for (const l of lines as JournalLine[]) {
      const acc = accountMap.get(l.account_id)
      if (!acc || (acc.type !== 'revenue' && acc.type !== 'expense')) continue
      const prev = agg.get(l.account_id) ?? { type: acc.type, code: acc.code, name: acc.name, debit: 0, credit: 0 }
      if (l.type === 'debit') prev.debit += l.amount
      else prev.credit += l.amount
      agg.set(l.account_id, prev)
    }

    const revRows: PnLRow[] = []
    const expRows: PnLRow[] = []
    for (const [, v] of agg) {
      if (v.type === 'revenue') revRows.push({ account_code: v.code, account_name: v.name, total: v.credit - v.debit })
      else expRows.push({ account_code: v.code, account_name: v.name, total: v.debit - v.credit })
    }
    revRows.sort((a, b) => a.account_code.localeCompare(b.account_code))
    expRows.sort((a, b) => a.account_code.localeCompare(b.account_code))
    setRevenue(revRows)
    setExpense(expRows)
    setLoading(false)
  }

  const totalRevenue = revenue.reduce((s, r) => s + r.total, 0)
  const totalExpense = expense.reduce((s, r) => s + r.total, 0)
  const netIncome = totalRevenue - totalExpense

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Profit & Loss Statement</h1>

      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">All Periods</option>
            {periods.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <button onClick={runReport} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Run Report</button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && ran && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Revenue</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Amount</th></tr></thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.account_code} className="border-b last:border-0"><td className="py-2">{r.account_code} - {r.account_name}</td><td className="py-2 text-right">{formatIDR(r.total)}</td></tr>
                ))}
                {revenue.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">No revenue</td></tr>}
              </tbody>
              <tfoot><tr className="font-semibold border-t"><td className="pt-2">Total Revenue</td><td className="pt-2 text-right">{formatIDR(totalRevenue)}</td></tr></tfoot>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Expenses</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Amount</th></tr></thead>
              <tbody>
                {expense.map((r) => (
                  <tr key={r.account_code} className="border-b last:border-0"><td className="py-2">{r.account_code} - {r.account_name}</td><td className="py-2 text-right">{formatIDR(r.total)}</td></tr>
                ))}
                {expense.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">No expenses</td></tr>}
              </tbody>
              <tfoot><tr className="font-semibold border-t"><td className="pt-2">Total Expenses</td><td className="pt-2 text-right">{formatIDR(totalExpense)}</td></tr></tfoot>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold">Net Income</span>
              <span className={`font-bold text-lg ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatIDR(netIncome)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
