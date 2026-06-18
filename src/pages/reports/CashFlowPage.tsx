import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatIDR } from '../../lib/format'
import type { Period } from '../../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Play } from 'lucide-react'

interface CFRow {
  account_id: string
  account_code: string
  account_name: string
  cash_flow_category: string
  total_debit: number
  total_credit: number
}

interface CFSection {
  label: string
  category: string
  rows: CFRow[]
  total: number
}

export function CashFlowPage() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [sections, setSections] = useState<CFSection[]>([])
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

    let query = supabase.from('v_cash_flow').select('*')
    if (selectedPeriod) query = query.eq('period_id', selectedPeriod)
    const { data, error: queryError } = await query.order('account_code')

    if (queryError) { setError(`Report unavailable: ${queryError.message}`); setSections([]); setLoading(false); return }
    const all = (data as CFRow[]) ?? []
    const catIndex: Record<string, number> = { operating: 0, investing: 1, financing: 2 }
    const groups: CFRow[][] = [[], [], []]

    for (const row of all) {
      const idx = catIndex[row.cash_flow_category]
      if (idx !== undefined) groups[idx]!.push(row)
    }

    const labels = ['Operating Activities', 'Investing Activities', 'Financing Activities'] as const
    const cats = ['operating', 'investing', 'financing'] as const
    const result: CFSection[] = labels.map((label, i) => ({
      label,
      category: cats[i]!,
      rows: groups[i]!,
      total: groups[i]!.reduce((s, r) => s + (r.total_debit - r.total_credit), 0),
    }))
    setSections(result)
    setLoading(false)
  }

  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0)

  return (
    <div className="max-w-full">
      <h1 className="text-2xl font-bold mb-6">Cash Flow Statement (Indirect Method)</h1>

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
          {sections.map((sec) => (
            <Card key={sec.category}>
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-lg">{sec.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Cash Flow</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sec.rows.map((r) => {
                      const net = r.total_debit - r.total_credit
                      return (
                        <TableRow key={r.account_id}>
                          <TableCell className="text-sm">{r.account_code} - {r.account_name}</TableCell>
                          <TableCell className={`text-right text-sm ${net >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {formatIDR(net)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {sec.rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">None</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm font-semibold">
                  <span>Net {sec.label}</span>
                  <span className={sec.total >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                    {formatIDR(sec.total)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">Net Change in Cash</span>
                <span className={`font-bold text-lg ${grandTotal >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {formatIDR(grandTotal)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
