import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'

interface TrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
}

export function TrialBalancePage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
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

    let query = supabase.from('v_trial_balance').select('*')
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setRows([]); setLoading(false); return }
    setRows((data as TrialBalanceRow[]) ?? [])
    setLoading(false)
  }

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0)

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Trial Balance</h1>

      <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">All Periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button onClick={runReport} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          Run Report
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</p>}

      {!loading && ran && !error && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-3 py-2 sm:px-4 sm:py-3">Code</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">Account</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-right">Debit</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account_id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 sm:px-4 font-mono text-xs whitespace-nowrap">{r.account_code}</td>
                  <td className="px-3 py-2 sm:px-4 whitespace-nowrap">{r.account_name}</td>
                  <td className="px-3 py-2 sm:px-4 text-right whitespace-nowrap">{r.total_debit > 0 ? formatIDR(r.total_debit) : ''}</td>
                  <td className="px-3 py-2 sm:px-4 text-right whitespace-nowrap">{r.total_credit > 0 ? formatIDR(r.total_credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2 bg-gray-50">
                <td className="px-3 py-2 sm:px-4 sm:py-3" colSpan={2}>Total</td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right">{formatIDR(totalDebit)}</td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right">{formatIDR(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
          {totalDebit !== totalCredit && (
            <p className="text-red-600 text-sm p-4">
              Warning: Debits ({formatIDR(totalDebit)}) do not equal Credits ({formatIDR(totalCredit)})
            </p>
          )}
        </div>
      )}
    </div>
  )
}
