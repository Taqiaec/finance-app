import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatIDR, formatDate } from '../lib/format'
import type { Account, Period } from '../lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play } from 'lucide-react'

interface MutasiLine {
  id: string
  journal_id: string
  account_id: string
  type: 'debit' | 'credit'
  amount: number
  journals: {
    date: string
    description: string
    status: string
  }
}

interface MutasiRow extends MutasiLine {
  running_balance: number
}

export function MutasiPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [rows, setRows] = useState<MutasiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [error, setError] = useState('')
  const [accountInfo, setAccountInfo] = useState<Account | null>(null)

  useEffect(() => {
    async function load() {
      const [aRes, pRes] = await Promise.all([
        supabase.from('accounts').select('*').order('code'),
        supabase.from('periods').select('*').order('start_date', { ascending: false }),
      ])
      if (aRes.data) setAccounts(aRes.data as Account[])
      if (pRes.data) setPeriods(pRes.data as Period[])
    }
    load()
  }, [])

  async function runMutasi() {
    if (!selectedAccount) return

    setLoading(true)
    setRan(true)
    setError('')

    const account = accounts.find((a) => a.id === selectedAccount)
    setAccountInfo(account ?? null)

    let query = supabase
      .from('journal_lines')
      .select('*, journals!inner(date, description, status)')
      .eq('account_id', selectedAccount)
      .eq('journals.status', 'posted')

    if (selectedPeriod) {
      query = query.eq('journals.period_id', selectedPeriod)
    }

    query = query.order('date', { ascending: true, referencedTable: 'journals' })

    const { data, error } = await query

    if (error) {
      console.error(error)
      setError(error.message)
      setRows([])
      setLoading(false)
      return
    }

    const lines = (data as MutasiLine[]) ?? []

    const isDebitType = account?.type === 'asset' || account?.type === 'expense'

    let balance = 0
    const computed: MutasiRow[] = lines.map((line) => {
      if (isDebitType) {
        balance += line.type === 'debit' ? line.amount : -line.amount
      } else {
        balance += line.type === 'credit' ? line.amount : -line.amount
      }
      return { ...line, running_balance: balance }
    })

    setRows(computed)
    setLoading(false)
  }

  const totalDebit = rows.filter((r) => r.type === 'debit').reduce((s, r) => s + r.amount, 0)
  const totalCredit = rows.filter((r) => r.type === 'credit').reduce((s, r) => s + r.amount, 0)
  const lastRow = rows[rows.length - 1]
  const finalBalance = lastRow ? lastRow.running_balance : 0

  return (
    <div className="max-w-full">
      <h1 className="text-2xl font-bold mb-6">Account Statement</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="w-56">
          <label className="text-sm font-medium mb-1 block">Akun</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F08521]/20 focus:border-[#F08521]"
          >
            <option value="">Pilih Akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-48">
          <label className="text-sm font-medium mb-1 block">Periode</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F08521]/20 focus:border-[#F08521]"
          >
            <option value="">Semua Periode</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <Button onClick={runMutasi} size="sm" disabled={!selectedAccount || loading}>
          <Play className="h-4 w-4 mr-1" />
          {loading ? 'Loading...' : 'Run Report'}
        </Button>
      </div>

      {accountInfo && ran && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span className="font-mono text-muted-foreground">{accountInfo.code}</span>
          <span className="font-medium">{accountInfo.name}</span>
          <span className="capitalize text-muted-foreground">{accountInfo.type}</span>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && ran && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Belum ada mutasi untuk akun ini.</p>
      )}

      {!loading && ran && !error && rows.length > 0 && (
        <Card>
          <CardContent className="p-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-center">D/C</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(row.journals.date)}</TableCell>
                    <TableCell className="text-sm">{row.journals.description}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`text-xs font-semibold ${
                          row.type === 'debit' ? 'text-[#F08521]' : 'text-emerald-600'
                        }`}
                      >
                        {row.type === 'debit' ? 'D' : 'C'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatIDR(row.amount)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatIDR(row.running_balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap justify-between items-center mt-3 pt-3 border-t text-sm">
              <div className="flex gap-4">
                <span>
                  Total Debit:{' '}
                  <span className="font-semibold text-[#F08521]">{formatIDR(totalDebit)}</span>
                </span>
                <span>
                  Total Credit:{' '}
                  <span className="font-semibold text-emerald-600">{formatIDR(totalCredit)}</span>
                </span>
              </div>
              <span className="font-semibold">
                Saldo Akhir: {formatIDR(finalBalance)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
