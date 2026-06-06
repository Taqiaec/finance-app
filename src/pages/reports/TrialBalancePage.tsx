import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Account, Period, JournalLine } from '../../lib/types'

interface TrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
  balance: number
}

export function TrialBalancePage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
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
    if (selectedPeriod) {
      journalQuery = journalQuery.eq('period_id', selectedPeriod)
    }
    const { data: journals } = await journalQuery
    if (!journals || journals.length === 0) { setRows([]); setLoading(false); return }

    const journalIds = journals.map((j: { id: string }) => j.id)

    const { data: lines } = await supabase
      .from('journal_lines')
      .select('*')
      .in('journal_id', journalIds)

    if (!lines || lines.length === 0) { setRows([]); setLoading(false); return }

    const { data: accounts } = await supabase.from('accounts').select('*')
    const accountMap = new Map<string, Account>()
    if (accounts) for (const a of accounts as Account[]) accountMap.set(a.id, a)

    const agg = new Map<string, { debit: number; credit: number }>()
    for (const l of lines as JournalLine[]) {
      const prev = agg.get(l.account_id) ?? { debit: 0, credit: 0 }
      if (l.type === 'debit') prev.debit += l.amount
      else prev.credit += l.amount
      agg.set(l.account_id, prev)
    }

    const result: TrialBalanceRow[] = []
    for (const [accId, totals] of agg) {
      const acc = accountMap.get(accId)
      if (!acc) continue
      result.push({
        account_id: accId,
        account_code: acc.code,
        account_name: acc.name,
        account_type: acc.type,
        total_debit: totals.debit,
        total_credit: totals.credit,
        balance: totals.debit - totals.credit,
      })
    }
    result.sort((a, b) => a.account_code.localeCompare(b.account_code))
    setRows(result)
    setLoading(false)
  }

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Trial Balance</h1>

      <div className="flex gap-4 mb-6 items-end">
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

      {!loading && ran && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.account_id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.account_code}</td>
                  <td className="px-4 py-2">{r.account_name}</td>
                  <td className="px-4 py-2 text-right">{r.total_debit > 0 ? formatIDR(r.total_debit) : ''}</td>
                  <td className="px-4 py-2 text-right">{r.total_credit > 0 ? formatIDR(r.total_credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2 bg-gray-50">
                <td className="px-4 py-3" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right">{formatIDR(totalDebit)}</td>
                <td className="px-4 py-3 text-right">{formatIDR(totalCredit)}</td>
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
