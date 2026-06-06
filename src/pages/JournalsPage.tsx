import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatIDR, formatDate } from '../lib/format'
import type { Journal, JournalLine, Account } from '../lib/types'

export function JournalsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [journals, setJournals] = useState<(Journal & { journal_lines: JournalLine[] })[]>([])
  const [accounts, setAccounts] = useState<Record<string, Account>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [jRes, aRes] = await Promise.all([
        supabase.from('journals')
          .select('*, journal_lines(*)')
          .order('date', { ascending: false }),
        supabase.from('accounts').select('*'),
      ])
      if (jRes.data) setJournals(jRes.data as (Journal & { journal_lines: JournalLine[] })[])
      if (aRes.data) {
        const map: Record<string, Account> = {}
        for (const a of aRes.data as Account[]) map[a.id] = a
        setAccounts(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleReverse(id: string) {
    if (!confirm('Reverse this journal entry?')) return
    const journal = journals.find((j) => j.id === id)
    if (!journal) return

    const reversedLines = journal.journal_lines.map((l) => ({
      account_id: l.account_id,
      type: l.type === 'debit' ? 'credit' : 'debit',
      amount: l.amount,
    }))

    const { data: newJournal, error } = await supabase
      .from('journals')
      .insert({
        date: new Date().toISOString().split('T')[0],
        description: `Reversal of: ${journal.description}`,
        period_id: journal.period_id,
        status: 'posted',
      })
      .select()
      .single()

    if (error || !newJournal) { alert(error?.message ?? 'Failed'); return }

    await supabase.from('journal_lines').insert(
      reversedLines.map((l) => ({ ...l, journal_id: newJournal.id }))
    )

    await supabase.from('journals').update({ status: 'reversed', reversed_by: newJournal.id }).eq('id', id)
    window.location.reload()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        {isAdmin && (
          <Link to="/journals/new" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            + New Entry
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-4">
          {journals.map((j) => {
            const totalDebit = j.journal_lines.filter((l) => l.type === 'debit').reduce((s, l) => s + l.amount, 0)
            return (
              <div key={j.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{j.description}</p>
                    <p className="text-sm text-gray-500">{formatDate(j.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      j.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {j.status}
                    </span>
                    {isAdmin && j.status === 'posted' && (
                      <button onClick={() => handleReverse(j.id)} className="text-xs text-red-600 hover:underline">
                        Reverse
                      </button>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b">
                      <th className="text-left pb-1">Account</th>
                      <th className="text-right pb-1">Debit</th>
                      <th className="text-right pb-1">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.journal_lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-1">{accounts[line.account_id]?.code} - {accounts[line.account_id]?.name}</td>
                        <td className="py-1 text-right">{line.type === 'debit' ? formatIDR(line.amount) : ''}</td>
                        <td className="py-1 text-right">{line.type === 'credit' ? formatIDR(line.amount) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-xs">
                      <td className="pt-1">Total</td>
                      <td className="pt-1 text-right">{formatIDR(totalDebit)}</td>
                      <td className="pt-1 text-right">{formatIDR(totalDebit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}
          {journals.length === 0 && (
            <p className="text-gray-500 text-center py-8">No journal entries yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
