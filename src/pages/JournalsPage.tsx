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

    const { error } = await supabase.rpc('reverse_journal', { p_journal_id: id })
    if (error) { alert(error.message); return }

    window.location.reload()
  }

  return (
    <div className="max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Journal Entries</h1>
        {isAdmin && (
          <Link to="/journals/new" className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm hover:bg-blue-700">
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
              <div key={j.id} className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-1 mb-2">
                  <div>
                    <p className="font-semibold text-sm sm:text-base">{j.description}</p>
                    <p className="text-xs sm:text-sm text-gray-500">{formatDate(j.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      j.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {j.status}
                    </span>
                    {isAdmin && j.status === 'posted' && (
                      <button onClick={() => handleReverse(j.id)} className="text-xs text-red-600 hover:underline whitespace-nowrap">
                        Reverse
                      </button>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm mt-2 min-w-[300px]">
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
                        <td className="py-1 whitespace-nowrap">{accounts[line.account_id]?.code} - {accounts[line.account_id]?.name}</td>
                        <td className="py-1 text-right whitespace-nowrap">{line.type === 'debit' ? formatIDR(line.amount) : ''}</td>
                        <td className="py-1 text-right whitespace-nowrap">{line.type === 'credit' ? formatIDR(line.amount) : ''}</td>
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
