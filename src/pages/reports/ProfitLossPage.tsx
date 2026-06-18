import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'

interface PnLRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  credit_total: number
  debit_total: number
}

export function ProfitLossPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [revenue, setRevenue] = useState<PnLRow[]>([])
  const [expense, setExpense] = useState<PnLRow[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [error, setError] = useState('')

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
    setError('')

    let query = supabase.from('v_profit_loss').select('*')
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setRevenue([]); setExpense([]); setLoading(false); return }
    const all = (data as PnLRow[]) ?? []
    setRevenue(all.filter((r) => r.account_type === 'revenue'))
    setExpense(all.filter((r) => r.account_type === 'expense'))
    setLoading(false)
  }

  const totalRevenue = revenue.reduce((s, r) => s + (r.credit_total - r.debit_total), 0)
  const totalExpense = expense.reduce((s, r) => s + (r.debit_total - r.credit_total), 0)
  const netIncome = totalRevenue - totalExpense

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Profit & Loss Statement</h1>

      <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 items-end">
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

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</p>}

      {!loading && ran && !error && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
            <h2 className="font-semibold mb-3">Revenue</h2>
            <table className="w-full text-sm min-w-[300px]">
              <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Amount</th></tr></thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.account_id} className="border-b last:border-0">
                    <td className="py-2 whitespace-nowrap">{r.account_code} - {r.account_name}</td>
                    <td className="py-2 text-right whitespace-nowrap">{formatIDR(r.credit_total - r.debit_total)}</td>
                  </tr>
                ))}
                {revenue.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">No revenue</td></tr>}
              </tbody>
              <tfoot><tr className="font-semibold border-t"><td className="pt-2">Total Revenue</td><td className="pt-2 text-right">{formatIDR(totalRevenue)}</td></tr></tfoot>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
            <h2 className="font-semibold mb-3">Expenses</h2>
            <table className="w-full text-sm min-w-[300px]">
              <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Amount</th></tr></thead>
              <tbody>
                {expense.map((r) => (
                  <tr key={r.account_id} className="border-b last:border-0">
                    <td className="py-2 whitespace-nowrap">{r.account_code} - {r.account_name}</td>
                    <td className="py-2 text-right whitespace-nowrap">{formatIDR(r.debit_total - r.credit_total)}</td>
                  </tr>
                ))}
                {expense.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">No expenses</td></tr>}
              </tbody>
              <tfoot><tr className="font-semibold border-t"><td className="pt-2">Total Expenses</td><td className="pt-2 text-right">{formatIDR(totalExpense)}</td></tr></tfoot>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
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
