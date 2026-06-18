import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'

interface BSRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
}

export function BalanceSheetPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [assets, setAssets] = useState<BSRow[]>([])
  const [liabilities, setLiabilities] = useState<BSRow[]>([])
  const [equity, setEquity] = useState<BSRow[]>([])
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

    let periodFilter = selectedPeriod
    if (!periodFilter && periods.length > 0) {
      periodFilter = periods[0]!.id
    }

    let query = supabase.from('v_balance_sheet').select('*')
    if (periodFilter) query = query.eq('period_id', periodFilter)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setAssets([]); setLiabilities([]); setEquity([]); setLoading(false); return }
    const all = (data as BSRow[]) ?? []
    setAssets(all.filter((r) => r.account_type === 'asset'))
    setLiabilities(all.filter((r) => r.account_type === 'liability'))
    setEquity(all.filter((r) => r.account_type === 'equity'))
    setLoading(false)
  }

  const totalAssets = assets.reduce((s, r) => s + (r.total_debit - r.total_credit), 0)
  const totalLiabilities = liabilities.reduce((s, r) => s + (r.total_credit - r.total_debit), 0)
  const totalEquity = equity.reduce((s, r) => s + (r.total_credit - r.total_debit), 0)

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Balance Sheet</h1>

      <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">As of Today</option>
            {periods.map((p) => (<option key={p.id} value={p.id}>As of {p.name}</option>))}
          </select>
        </div>
        <button onClick={runReport} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Run Report</button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3 mb-4">{error}</p>}

      {!loading && ran && !error && (
        <div className="space-y-4 sm:space-y-6">
          {[
            { title: 'Assets', rows: assets, total: totalAssets },
            { title: 'Liabilities', rows: liabilities, total: totalLiabilities },
            { title: 'Equity', rows: equity, total: totalEquity },
          ].map((section) => (
            <div key={section.title} className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h2 className="font-semibold mb-3">{section.title}</h2>
              <table className="w-full text-sm min-w-[300px]">
                <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Balance</th></tr></thead>
                <tbody>
                  {section.rows.map((r) => {
                    const balance = r.account_type === 'asset' ? r.total_debit - r.total_credit : r.total_credit - r.total_debit
                    return (
                      <tr key={r.account_id} className="border-b last:border-0">
                        <td className="py-2 whitespace-nowrap">{r.account_code} - {r.account_name}</td>
                        <td className="py-2 text-right whitespace-nowrap">{formatIDR(balance)}</td>
                      </tr>
                    )
                  })}
                  {section.rows.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">None</td></tr>}
                </tbody>
                <tfoot><tr className="font-semibold border-t"><td className="pt-2">Total {section.title}</td><td className="pt-2 text-right">{formatIDR(section.total)}</td></tr></tfoot>
              </table>
            </div>
          ))}

          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold">Total Liabilities + Equity</span>
              <span className="font-bold text-lg">{formatIDR(totalLiabilities + totalEquity)}</span>
            </div>
            {totalAssets !== totalLiabilities + totalEquity && (
              <p className="text-red-600 text-sm mt-2">
                Assets ({formatIDR(totalAssets)}) do not match Liabilities + Equity ({formatIDR(totalLiabilities + totalEquity)})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
