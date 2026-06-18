import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { calcDebitTotal, calcCreditTotal, isBalanced, hasValidLines } from '../lib/accounting'
import { formatIDR } from '../lib/format'
import type { Account, Period } from '../lib/types'
import type { DraftLine } from '../lib/accounting'

let lineIdCounter = 0
function newLineId(): string {
  return `draft-${++lineIdCounter}`
}

export function JournalFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(id)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { id: newLineId(), account_id: '', type: 'debit', amount: 0 },
    { id: newLineId(), account_id: '', type: 'credit', amount: 0 },
  ])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [aRes, pRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_active', true).order('code'),
        supabase.from('periods').select('*').order('start_date', { ascending: false }),
      ])
      if (aRes.data) setAccounts(aRes.data as Account[])
      if (pRes.data) setPeriods(pRes.data as Period[])

      if (id) {
        const { data } = await supabase.from('journals').select('*, journal_lines(*)').eq('id', id).single()
        if (data) {
          setDate(data.date)
          setDescription(data.description)
          setPeriodId(data.period_id ?? '')
          setLines(data.journal_lines.map((l: { id: string; account_id: string; type: string; amount: number }) => ({
            id: l.id,
            account_id: l.account_id,
            type: l.type as 'debit' | 'credit',
            amount: l.amount,
          })))
        }
      }
    }
    load()
  }, [id])

  function addLine() {
    setLines([...lines, { id: newLineId(), account_id: '', type: 'debit', amount: 0 }])
  }

  function removeLine(lineId: string) {
    if (lines.length <= 2) return
    setLines(lines.filter((l) => l.id !== lineId))
  }

  function updateLine(lineId: string, field: keyof DraftLine, value: string | number) {
    setLines(lines.map((l) => l.id === lineId ? { ...l, [field]: value } : l))
  }

  function toggleLineType(lineId: string) {
    setLines(lines.map((l) => l.id === lineId ? { ...l, type: l.type === 'debit' ? 'credit' : 'debit' } : l))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!description.trim()) { setError('Description required'); return }
    if (!hasValidLines(lines)) { setError('Need at least 2 lines with accounts and amounts > 0'); return }
    if (!isBalanced(lines)) { setError(`Debits (${formatIDR(calcDebitTotal(lines))}) != Credits (${formatIDR(calcCreditTotal(lines))})`); return }

    setSaving(true)

    if (isEdit && id) {
      const { error: rpcErr } = await supabase.rpc('edit_journal', {
        p_journal_id: id,
        p_date: date,
        p_description: description,
        p_period_id: periodId || null,
        p_lines: lines.map((l) => ({ account_id: l.account_id, type: l.type, amount: l.amount })),
      })
      if (rpcErr) { setError(`Failed to update journal: ${rpcErr.message}`); setSaving(false); return }
    } else {
      const { data: journal, error: jErr } = await supabase
        .from('journals')
        .insert({ date, description, period_id: periodId || null, status: 'posted', created_by: user?.id ?? null })
        .select()
        .single()

      if (jErr || !journal) { setError(jErr?.message ?? 'Failed to create journal'); setSaving(false); return }

      const { error: lErr } = await supabase.from('journal_lines').insert(
        lines.map((l) => ({ journal_id: journal.id, account_id: l.account_id, type: l.type, amount: l.amount }))
      )

      if (lErr) {
        await supabase.from('journals').delete().eq('id', journal.id)
        setError(`Failed to insert lines: ${lErr.message}. Journal rolled back.`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/journals')
  }

  const debitTotal = calcDebitTotal(lines)
  const creditTotal = calcCreditTotal(lines)
  const balanced = isBalanced(lines)

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">No period</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.name} {p.is_locked ? '(locked)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1 md:col-start-1 md:row-start-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. Cash sale to customer"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-sm">Journal Lines</h2>
            <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:underline">+ Add Line</button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b">
                  <th className="text-left pb-2">Account</th>
                  <th className="text-left pb-2 w-24">Type</th>
                  <th className="text-right pb-2 w-40">Amount (IDR)</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-2">
                      <select
                        value={line.account_id}
                        onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => toggleLineType(line.id)}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          line.type === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {line.type.toUpperCase()}
                      </button>
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={line.amount || ''}
                        onChange={(e) => updateLine(line.id, 'amount', parseInt(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right"
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2 text-center">
                      {lines.length > 2 && (
                        <button type="button" onClick={() => removeLine(line.id)} className="text-red-500 hover:text-red-700 text-xs">
                          X
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-sm border-t-2">
                  <td className="pt-2">Totals</td>
                  <td></td>
                  <td className="pt-2 text-right">
                    <span className="text-blue-600">{formatIDR(debitTotal)}</span>
                    {' / '}
                    <span className="text-green-600">{formatIDR(creditTotal)}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="md:hidden space-y-3">
            {lines.map((line, idx) => (
              <div key={line.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">Line {idx + 1}</span>
                  {lines.length > 2 && (
                    <button type="button" onClick={() => removeLine(line.id)} className="text-red-500 hover:text-red-700 text-xs">
                      Remove
                    </button>
                  )}
                </div>
                <select
                  value={line.account_id}
                  onChange={(e) => updateLine(line.id, 'account_id', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLineType(line.id)}
                    className={`shrink-0 px-4 py-2 rounded text-xs font-medium ${
                      line.type === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {line.type.toUpperCase()}
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.amount || ''}
                    onChange={(e) => updateLine(line.id, 'amount', parseInt(e.target.value) || 0)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm text-right"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm font-semibold">Totals</span>
            <span className="text-sm">
              <span className="text-blue-600">{formatIDR(debitTotal)}</span>
              {' / '}
              <span className="text-green-600">{formatIDR(creditTotal)}</span>
            </span>
            {balanced ? (
              <span className="text-green-600 text-sm font-medium">Balanced</span>
            ) : (
              <span className="text-red-600 text-sm font-medium">
                Unbalanced ({formatIDR(Math.abs(debitTotal - creditTotal))} difference)
              </span>
            )}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !balanced}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Post Entry'}
          </button>
          <button type="button" onClick={() => navigate('/journals')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
