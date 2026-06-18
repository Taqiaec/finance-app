import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'

interface CFRow {
  account_id: string
  account_code: string
  account_name: string
  cash_flow_category: string
  total_debit: number
  total_credit: number
}

interface CFSection {
  label: string
  category: string
  rows: CFRow[]
  total: number
}

export function CashFlowPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [sections, setSections] = useState<CFSection[]>([])
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

    let query = supabase.from('v_cash_flow').select('*')
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setSections([]); setLoading(false); return }
    const all = (data as CFRow[]) ?? []
    const catIndex: Record<string, number> = { operating: 0, investing: 1, financing: 2 }
    const groups: CFRow[][] = [[], [], []]

    for (const row of all) {
      const idx = catIndex[row.cash_flow_category]
      if (idx !== undefined) groups[idx]!.push(row)
    }

    const labels = ['Operating Activities', 'Investing Activities', 'Financing Activities'] as const
    const cats = ['operating', 'investing', 'financing'] as const
    const result: CFSection[] = labels.map((label, i) => ({
      label,
      category: cats[i]!,
      rows: groups[i]!,
      total: groups[i]!.reduce((s, r) => s + (r.total_debit - r.total_credit), 0),
    }))
    setSections(result)
    setLoading(false)
  }

  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0)

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Cash Flow Statement (Indirect Method)</h1>

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
          {sections.map((sec) => (
            <div key={sec.category} className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h2 className="font-semibold mb-3">{sec.label}</h2>
              <table className="w-full text-sm min-w-[300px]">
                <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Cash Flow</th></tr></thead>
                <tbody>
                  {sec.rows.map((r) => {
                    const net = r.total_debit - r.total_credit
                    return (
                      <tr key={r.account_id} className="border-b last:border-0">
                        <td className="py-2 whitespace-nowrap">{r.account_code} - {r.account_name}</td>
                        <td className={`py-2 text-right whitespace-nowrap ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatIDR(net)}</td>
                      </tr>
                    )
                  })}
                  {sec.rows.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">None</td></tr>}
                </tbody>
                <tfoot><tr className="font-semibold border-t"><td className="pt-2">Net {sec.label}</td><td className={`pt-2 text-right ${sec.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatIDR(sec.total)}</td></tr></tfoot>
              </table>
            </div>
          ))}

          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold">Net Change in Cash</span>
              <span className={`font-bold text-lg ${grandTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatIDR(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
