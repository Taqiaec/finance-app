import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Account, AccountType, CashFlowCategory } from '../lib/types'

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']
const CASH_FLOW_CATS: CashFlowCategory[] = ['operating', 'investing', 'financing', 'none']

const typeColors: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-red-100 text-red-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-green-100 text-green-700',
  expense: 'bg-orange-100 text-orange-700',
}

interface AccountForm {
  code: string
  name: string
  type: AccountType
  cash_flow_category: CashFlowCategory
}

const emptyForm: AccountForm = { code: '', name: '', type: 'asset', cash_flow_category: 'none' }

export function AccountsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AccountForm>(emptyForm)
  const [filter, setFilter] = useState<AccountType | 'all'>('all')
  const [error, setError] = useState('')

  async function loadAccounts() {
    setLoading(true)
    const { data } = await supabase.from('accounts').select('*').order('code')
    if (data) setAccounts(data as Account[])
    setLoading(false)
  }

  useEffect(() => { loadAccounts() }, [])

  function startCreate() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    setError('')
  }

  function startEdit(account: Account) {
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      cash_flow_category: account.cash_flow_category,
    })
    setEditingId(account.id)
    setShowForm(true)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and name are required')
      return
    }

    if (editingId) {
      const { error: updateErr } = await supabase
        .from('accounts')
        .update({ code: form.code, name: form.name, type: form.type, cash_flow_category: form.cash_flow_category })
        .eq('id', editingId)
      if (updateErr) { setError(updateErr.message); return }
    } else {
      const { error: insertErr } = await supabase
        .from('accounts')
        .insert({ code: form.code, name: form.name, type: form.type, cash_flow_category: form.cash_flow_category })
      if (insertErr) { setError(insertErr.message); return }
    }

    setShowForm(false)
    await loadAccounts()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('accounts').update({ is_active: !current }).eq('id', id)
    await loadAccounts()
  }

  const filtered = filter === 'all' ? accounts : accounts.filter((a) => a.type === filter)

  return (
    <div className="max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Chart of Accounts</h1>
        {isAdmin && (
          <button onClick={startCreate} className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm hover:bg-blue-700">
            + New Account
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded text-xs sm:text-sm ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          All
        </button>
        {ACCOUNT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2.5 py-1 rounded text-xs sm:text-sm capitalize ${filter === t ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit Account' : 'New Account'}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g. 1-1001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash Flow</label>
              <select
                value={form.cash_flow_category}
                onChange={(e) => setForm({ ...form, cash_flow_category: e.target.value as CashFlowCategory })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {CASH_FLOW_CATS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm">
                Cancel
              </button>
              {error && <span className="text-red-600 text-sm self-center">{error}</span>}
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-3 py-2 sm:px-4 sm:py-3">Code</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">Name</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">Type</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3 hidden md:table-cell">Cash Flow</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">Status</th>
                {isAdmin && <th className="px-3 py-2 sm:px-4 sm:py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => (
                <tr key={account.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 sm:px-4 sm:py-3 font-mono text-xs whitespace-nowrap">{account.code}</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{account.name}</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs capitalize ${typeColors[account.type]}`}>
                      {account.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 text-xs capitalize hidden md:table-cell">{account.cash_flow_category}</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                    <span className={`text-xs ${account.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                      <button onClick={() => startEdit(account)} className="text-blue-600 hover:underline text-xs mr-1.5">Edit</button>
                      <button onClick={() => toggleActive(account.id, account.is_active)} className="text-xs hover:underline text-gray-600">
                        {account.is_active ? 'Deact.' : 'Activate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-400">No accounts found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
