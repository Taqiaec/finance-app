import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play } from 'lucide-react'

interface TrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
}

export function TrialBalancePage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [error, setError] = useState('')

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
    setError('')

    let query = supabase.from('v_trial_balance').select('*')
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setRows([]); setLoading(false); return }
    setRows((data as TrialBalanceRow[]) ?? [])
    setLoading(false)
  }

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0)

  return (
    <div className="max-w-full">
      <h1 className="text-2xl font-bold mb-6">Trial Balance</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="w-48">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F08521]/20 focus:border-[#F08521]"
          >
            <option value="">All Periods</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <Button onClick={runReport} size="sm">
          <Play className="h-4 w-4 mr-1" />
          Run Report
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && ran && !error && (
        <Card>
          <CardContent className="p-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.account_id}>
                    <TableCell className="font-mono text-xs">{r.account_code}</TableCell>
                    <TableCell className="text-sm">{r.account_name}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.total_debit > 0 ? formatIDR(r.total_debit) : ''}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.total_credit > 0 ? formatIDR(r.total_credit) : ''}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={2} className="text-sm">Total</TableCell>
                  <TableCell className="text-right text-sm">{formatIDR(totalDebit)}</TableCell>
                  <TableCell className="text-right text-sm">{formatIDR(totalCredit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {!loading && ran && !error && totalDebit !== totalCredit && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            Warning: Debits ({formatIDR(totalDebit)}) do not equal Credits ({formatIDR(totalCredit)})
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
