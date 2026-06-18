import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play } from 'lucide-react'

interface BSRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
}

interface NetIncomeRow {
  net_income: number
  period_id: string
}

export function BalanceSheetPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [assets, setAssets] = useState<BSRow[]>([])
  const [liabilities, setLiabilities] = useState<BSRow[]>([])
  const [equity, setEquity] = useState<BSRow[]>([])
  const [netIncome, setNetIncome] = useState(0)
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

    let periodFilter = selectedPeriod
    if (!periodFilter && periods.length > 0) {
      periodFilter = periods[0]!.id
    }

    let bsQuery = supabase.from('v_balance_sheet').select('*')
    if (periodFilter) bsQuery = bsQuery.eq('period_id', periodFilter)
    const { data: bsData, error: bsError } = await bsQuery.order('account_code')

    if (bsError) { setError(`Report unavailable: ${bsError.message}`); setAssets([]); setLiabilities([]); setEquity([]); setNetIncome(0); setLoading(false); return }

    const all = (bsData as BSRow[]) ?? []
    setAssets(all.filter((r) => r.account_type === 'asset'))
    setLiabilities(all.filter((r) => r.account_type === 'liability'))
    setEquity(all.filter((r) => r.account_type === 'equity'))

    let niQuery = supabase.from('v_balance_sheet_net_income').select('net_income')
    if (periodFilter) niQuery = niQuery.eq('period_id', periodFilter)
    const { data: niData } = await niQuery
    const niRows = (niData as NetIncomeRow[]) ?? []
    setNetIncome(niRows[0]?.net_income ?? 0)

    setLoading(false)
  }

  const totalAssets = assets.reduce((s, r) => s + (r.total_debit - r.total_credit), 0)
  const totalLiabilities = liabilities.reduce((s, r) => s + (r.total_credit - r.total_debit), 0)
  const totalEquity = equity.reduce((s, r) => s + (r.total_credit - r.total_debit), 0)
  const totalEquityWithNetIncome = totalEquity + netIncome

  const equityWithNetIncome = [
    ...equity,
    ...(netIncome !== 0 ? [{
      account_id: 'net-income',
      account_code: '',
      account_name: 'Net Income (Laba Bersih)',
      account_type: 'equity' as string,
      total_debit: netIncome < 0 ? Math.abs(netIncome) : 0,
      total_credit: netIncome >= 0 ? netIncome : 0,
    }] : []),
  ]

  const sections = [
    { title: 'Assets', rows: assets, total: totalAssets },
    { title: 'Liabilities', rows: liabilities, total: totalLiabilities },
    { title: 'Equity', rows: equityWithNetIncome, total: totalEquityWithNetIncome },
  ]

  return (
    <div className="max-w-full">
      <h1 className="text-2xl font-bold mb-6">Balance Sheet</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="w-48">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F08521]/20 focus:border-[#F08521]"
          >
            <option value="">As of Today</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>As of {p.name}</option>
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
          {sections.map((section) => (
            <Card key={section.title}>
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.rows.map((r) => {
                      const balance = r.account_type === 'asset' ? r.total_debit - r.total_credit : r.total_credit - r.total_debit
                      return (
                        <TableRow key={r.account_id}>
                          <TableCell className="text-sm">{r.account_code ? `${r.account_code} - ` : ''}{r.account_name}</TableCell>
                          <TableCell className="text-right text-sm">{formatIDR(balance)}</TableCell>
                        </TableRow>
                      )
                    })}
                    {section.rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">None</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm font-semibold">
                  <span>Total {section.title}</span>
                  <span>{formatIDR(section.total)}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Total Liabilities + Equity</span>
                <span className="font-bold text-lg">{formatIDR(totalLiabilities + totalEquityWithNetIncome)}</span>
              </div>
              {totalAssets !== totalLiabilities + totalEquityWithNetIncome && (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>
                    Assets ({formatIDR(totalAssets)}) do not match Liabilities + Equity ({formatIDR(totalLiabilities + totalEquityWithNetIncome)})
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
