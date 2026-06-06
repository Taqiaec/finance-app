import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatIDR } from '../lib/format'
import type { Account, Journal } from '../lib/types'

export function DashboardPage() {
  const [accountCount, setAccountCount] = useState(0)
  const [journalCount, setJournalCount] = useState(0)
  const [recentJournals, setRecentJournals] = useState<Journal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    async function load() {
      const [accRes, jrnlRes, recentRes] = await Promise.all([
        supabase.from('accounts').select('id', { count: 'exact', head: true }),
        supabase.from('journals').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
        supabase.from('journals').select('*').order('date', { ascending: false }).limit(5),
      ])
      if (accRes.count !== null) setAccountCount(accRes.count)
      if (jrnlRes.count !== null) setJournalCount(jrnlRes.count)
      if (recentRes.data) setRecentJournals(recentRes.data as Journal[])

      const accData = await supabase.from('accounts').select('*').eq('is_active', true)
      if (accData.data) setAccounts(accData.data as Account[])
    }
    load()
  }, [])

  const totalAssets = accounts
    .filter((a) => a.type === 'asset')
    .reduce((sum, a) => sum + (a.id ? 0 : 0), 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active Accounts</p>
          <p className="text-2xl font-bold">{accountCount}</p>
          <Link to="/accounts" className="text-sm text-blue-600 hover:underline">View All</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Posted Journals</p>
          <p className="text-2xl font-bold">{journalCount}</p>
          <Link to="/journals" className="text-sm text-blue-600 hover:underline">View All</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold">{formatIDR(totalAssets)}</p>
          <Link to="/reports/balance-sheet" className="text-sm text-blue-600 hover:underline">Balance Sheet</Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Journal Entries</h2>
          <Link to="/journals/new" className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
            New Entry
          </Link>
        </div>
        {recentJournals.length === 0 ? (
          <p className="text-gray-500 text-sm">No journal entries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentJournals.map((j) => (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="py-2">{j.date}</td>
                  <td className="py-2">{j.description}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      j.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {j.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
