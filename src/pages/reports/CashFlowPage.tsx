import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Account, Period, JournalLine } from '../../lib/types'

interface CFRow {
  account_code: string
  account_name: string
  amount: number
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
    if (!journals || journals.length === 0) { setSections([]); setLoading(false); return }

    const journalIds = journals.map((j: { id: string }) => j.id)
    const { data: lines } = await supabase.from('journal_lines').select('*').in('journal_id', journalIds)
    const { data: accounts } = await supabase.from('accounts').select('*')
    if (!lines || !accounts) { setLoading(false); return }

    const accountMap = new Map<string, Account>()
    for (const a of accounts as Account[]) accountMap.set(a.id, a)

    const agg = new Map<string, { category: string; code: string; name: string; debit: number; credit: number }>()

    for (const l of lines as JournalLine[]) {
      const acc = accountMap.get(l.account_id)
      if (!acc || acc.cash_flow_category === 'none') continue
      const prev = agg.get(l.account_id) ?? { category: acc.cash_flow_category, code: acc.code, name: acc.name, debit: 0, credit: 0 }
      if (l.type === 'debit') prev.debit += l.amount
      else prev.credit += l.amount
      agg.set(l.account_id, prev)
    }

    const groups: CFRow[][] = [[], [], []]
    const catIndex: Record<string, number> = { operating: 0, investing: 1, financing: 2 }
    for (const [, v] of agg) {
      let net = 0
      if (v.debit > v.credit) net = v.debit - v.credit
      else net = -(v.credit - v.debit)
      const idx = catIndex[v.category]
      if (idx !== undefined) {
        groups[idx]!.push({ account_code: v.code, account_name: v.name, amount: net })
      }
    }

    const labels = ['Operating Activities', 'Investing Activities', 'Financing Activities'] as const
    const cats = ['operating', 'investing', 'financing'] as const
    const result: CFSection[] = labels.map((label, i) => ({
      label,
      category: cats[i]!,
      rows: groups[i]!,
      total: groups[i]!.reduce((s, r) => s + r.amount, 0),
    }))
    setSections(result)
    setLoading(false)
  }

  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cash Flow Statement (Indirect Method)</h1>

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
          {sections.map((sec) => (
            <div key={sec.category} className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-3">{sec.label}</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Cash Flow</th></tr></thead>
                <tbody>
                  {sec.rows.map((r) => (
                    <tr key={r.account_code} className="border-b last:border-0">
                      <td className="py-2">{r.account_code} - {r.account_name}</td>
                      <td className={`py-2 text-right ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatIDR(r.amount)}</td>
                    </tr>
                  ))}
                  {sec.rows.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">None</td></tr>}
                </tbody>
                <tfoot><tr className="font-semibold border-t"><td className="pt-2">Net {sec.label}</td><td className={`pt-2 text-right ${sec.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatIDR(sec.total)}</td></tr></tfoot>
              </table>
            </div>
          ))}

          <div className="bg-white rounded-lg shadow p-4">
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
