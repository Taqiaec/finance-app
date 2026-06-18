import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play } from 'lucide-react'

interface PnLRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  credit_total: number
  debit_total: number
}

export function ProfitLossPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [revenue, setRevenue] = useState<PnLRow[]>([])
  const [expense, setExpense] = useState<PnLRow[]>([])
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

    let query = supabase.from('v_profit_loss').select('*')
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setRevenue([]); setExpense([]); setLoading(false); return }
    const all = (data as PnLRow[]) ?? []
    setRevenue(all.filter((r) => r.account_type === 'revenue'))
    setExpense(all.filter((r) => r.account_type === 'expense'))
    setLoading(false)
  }

  const totalRevenue = revenue.reduce((s, r) => s + (r.credit_total - r.debit_total), 0)
  const totalExpense = expense.reduce((s, r) => s + (r.debit_total - r.credit_total), 0)
  const netIncome = totalRevenue - totalExpense

  function ReportTable({ title, rows, totalLabel, totalValue }: { title: string; rows: PnLRow[]; totalLabel: string; totalValue: number }) {
    return (
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.account_id}>
                  <TableCell className="text-sm">{r.account_code} - {r.account_name}</TableCell>
                  <TableCell className="text-right text-sm">{formatIDR(title === 'Revenue' ? r.credit_total - r.debit_total : r.debit_total - r.credit_total)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">No {title.toLowerCase()}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm font-semibold">
            <span>{totalLabel}</span>
            <span>{formatIDR(totalValue)}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-full">
      <h1 className="text-2xl font-bold mb-6">Profit & Loss Statement</h1>

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
        <div className="space-y-4">
          <ReportTable title="Revenue" rows={revenue} totalLabel="Total Revenue" totalValue={totalRevenue} />
          <ReportTable title="Expenses" rows={expense} totalLabel="Total Expenses" totalValue={totalExpense} />

          <Card>
            <CardContent className="p-5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Net Income</span>
                <span className={`font-bold text-lg ${netIncome >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {formatIDR(netIncome)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
