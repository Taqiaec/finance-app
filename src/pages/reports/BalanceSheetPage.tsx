import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Account, Period, JournalLine } from '../../lib/types'

interface BSRow {
  account_code: string
  account_name: string
  balance: number
}

export function BalanceSheetPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [assets, setAssets] = useState<BSRow[]>([])
  const [liabilities, setLiabilities] = useState<BSRow[]>([])
  const [equity, setEquity] = useState<BSRow[]>([])
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

    let journalQuery = supabase.from('journals').select('id, date').eq('status', 'posted')
    const { data: allPeriods } = await supabase.from('periods').select('*').order('end_date')
    if (selectedPeriod && allPeriods) {
      const period = (allPeriods as Period[]).find((p) => p.id === selectedPeriod)
      if (period) journalQuery = journalQuery.lte('date', period.end_date)
    }
    const { data: journals } = await journalQuery
    if (!journals || journals.length === 0) { setAssets([]); setLiabilities([]); setEquity([]); setLoading(false); return }

    const journalIds = journals.map((j: { id: string }) => j.id)
    const { data: lines } = await supabase.from('journal_lines').select('*').in('journal_id', journalIds)
    const { data: accounts } = await supabase.from('accounts').select('*')
    if (!lines || !accounts) { setLoading(false); return }

    const accountMap = new Map<string, Account>()
    for (const a of accounts as Account[]) accountMap.set(a.id, a)

    const agg = new Map<string, { type: string; code: string; name: string; debit: number; credit: number }>()
    for (const l of lines as JournalLine[]) {
      const acc = accountMap.get(l.account_id)
      if (!acc || (acc.type !== 'asset' && acc.type !== 'liability' && acc.type !== 'equity')) continue
      const prev = agg.get(l.account_id) ?? { type: acc.type, code: acc.code, name: acc.name, debit: 0, credit: 0 }
      if (l.type === 'debit') prev.debit += l.amount
      else prev.credit += l.amount
      agg.set(l.account_id, prev)
    }

    const assetRows: BSRow[] = []
    const liabRows: BSRow[] = []
    const eqRows: BSRow[] = []
    for (const [, v] of agg) {
      if (v.type === 'asset') assetRows.push({ account_code: v.code, account_name: v.name, balance: v.debit - v.credit })
      else if (v.type === 'liability') liabRows.push({ account_code: v.code, account_name: v.name, balance: v.credit - v.debit })
      else eqRows.push({ account_code: v.code, account_name: v.name, balance: v.credit - v.debit })
    }
    assetRows.sort((a, b) => a.account_code.localeCompare(b.account_code))
    liabRows.sort((a, b) => a.account_code.localeCompare(b.account_code))
    eqRows.sort((a, b) => a.account_code.localeCompare(b.account_code))
    setAssets(assetRows)
    setLiabilities(liabRows)
    setEquity(eqRows)
    setLoading(false)
  }

  const totalAssets = assets.reduce((s, r) => s + r.balance, 0)
  const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0)
  const totalEquity = equity.reduce((s, r) => s + r.balance, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Balance Sheet</h1>

      <div className="flex gap-4 mb-6 items-end">
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

      {!loading && ran && (
        <div className="space-y-6">
          {[
            { title: 'Assets', rows: assets, total: totalAssets },
            { title: 'Liabilities', rows: liabilities, total: totalLiabilities },
            { title: 'Equity', rows: equity, total: totalEquity },
          ].map((section) => (
            <div key={section.title} className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-3">{section.title}</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b"><th className="text-left pb-2">Account</th><th className="text-right pb-2">Balance</th></tr></thead>
                <tbody>
                  {section.rows.map((r) => (
                    <tr key={r.account_code} className="border-b last:border-0"><td className="py-2">{r.account_code} - {r.account_name}</td><td className="py-2 text-right">{formatIDR(r.balance)}</td></tr>
                  ))}
                  {section.rows.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">None</td></tr>}
                </tbody>
                <tfoot><tr className="font-semibold border-t"><td className="pt-2">Total {section.title}</td><td className="pt-2 text-right">{formatIDR(section.total)}</td></tr></tfoot>
              </table>
            </div>
          ))}

          <div className="bg-white rounded-lg shadow p-4">
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
