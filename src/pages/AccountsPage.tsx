import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Account, AccountType, CashFlowCategory } from '../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']
const CASH_FLOW_CATS: CashFlowCategory[] = ['operating', 'investing', 'financing', 'none']

const typeBadgeVariant: Record<AccountType, string> = {
  asset: 'bg-blue-50 text-blue-700 hover:bg-blue-50',
  liability: 'bg-red-50 text-red-700 hover:bg-red-50',
  equity: 'bg-purple-50 text-purple-700 hover:bg-purple-50',
  revenue: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
  expense: 'bg-orange-50 text-orange-700 hover:bg-orange-50',
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        {isAdmin && (
          <Button onClick={startCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Account
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-[#F08521] text-white shadow-sm'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {ACCOUNT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === t
                ? 'bg-[#F08521] text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-lg">{editingId ? 'Edit Account' : 'New Account'}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. 1-1001"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cash Flow</Label>
                <Select value={form.cash_flow_category} onValueChange={(v) => setForm({ ...form, cash_flow_category: v as CashFlowCategory })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASH_FLOW_CATS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
                <Button type="submit" size="sm">
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                {error && <span className="text-sm text-destructive">{error}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Card>
          <CardContent className="p-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Cash Flow</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-xs">{account.code}</TableCell>
                    <TableCell className="text-sm">{account.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize text-xs ${typeBadgeVariant[account.type]}`}>
                        {account.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize hidden md:table-cell">{account.cash_flow_category}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${account.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(account)} className="h-7 px-2 text-xs">
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(account.id, account.is_active)} className="h-7 px-2 text-xs">
                            {account.is_active ? <ToggleRight className="h-3 w-3 mr-1" /> : <ToggleLeft className="h-3 w-3 mr-1" />}
                            {account.is_active ? 'Deact.' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      No accounts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
