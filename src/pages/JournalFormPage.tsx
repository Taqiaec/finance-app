import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { calcDebitTotal, calcCreditTotal, isBalanced, hasValidLines } from '../lib/accounting'
import { formatIDR } from '../lib/format'
import type { Account, Period } from '../lib/types'
import type { DraftLine } from '../lib/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Plus, X } from 'lucide-react'

let lineIdCounter = 0
function newLineId(): string {
  return `draft-${++lineIdCounter}`
}

export function JournalFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(id)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([
    { id: newLineId(), account_id: '', type: 'debit', amount: 0 },
    { id: newLineId(), account_id: '', type: 'credit', amount: 0 },
  ])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [aRes, pRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_active', true).order('code'),
        supabase.from('periods').select('*').order('start_date', { ascending: false }),
      ])
      if (aRes.data) setAccounts(aRes.data as Account[])
      if (pRes.data) setPeriods(pRes.data as Period[])

      if (id) {
        const { data } = await supabase.from('journals').select('*, journal_lines(*)').eq('id', id).single()
        if (data) {
          setDate(data.date)
          setDescription(data.description)
          setPeriodId(data.period_id ?? '')
          setLines(data.journal_lines.map((l: { id: string; account_id: string; type: string; amount: number }) => ({
            id: l.id,
            account_id: l.account_id,
            type: l.type as 'debit' | 'credit',
            amount: l.amount,
          })))
        }
      }
    }
    load()
  }, [id])

  function addLine() {
    setLines([...lines, { id: newLineId(), account_id: '', type: 'debit', amount: 0 }])
  }

  function removeLine(lineId: string) {
    if (lines.length <= 2) return
    setLines(lines.filter((l) => l.id !== lineId))
  }

  function updateLine(lineId: string, field: keyof DraftLine, value: string | number) {
    setLines(lines.map((l) => l.id === lineId ? { ...l, [field]: value } : l))
  }

  function toggleLineType(lineId: string) {
    setLines(lines.map((l) => l.id === lineId ? { ...l, type: l.type === 'debit' ? 'credit' : 'debit' } : l))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!description.trim()) { setError('Description required'); return }
    if (!hasValidLines(lines)) { setError('Need at least 2 lines with accounts and amounts > 0'); return }
    if (!isBalanced(lines)) { setError(`Debits (${formatIDR(calcDebitTotal(lines))}) != Credits (${formatIDR(calcCreditTotal(lines))})`); return }

    setSaving(true)

    if (isEdit && id) {
      const { error: rpcErr } = await supabase.rpc('edit_journal', {
        p_journal_id: id,
        p_date: date,
        p_description: description,
        p_period_id: periodId || null,
        p_lines: lines.map((l) => ({ account_id: l.account_id, type: l.type, amount: l.amount })),
      })
      if (rpcErr) { setError(`Failed to update journal: ${rpcErr.message}`); setSaving(false); return }
    } else {
      const { data: journal, error: jErr } = await supabase
        .from('journals')
        .insert({ date, description, period_id: periodId || null, status: 'posted', created_by: user?.id ?? null })
        .select()
        .single()

      if (jErr || !journal) { setError(jErr?.message ?? 'Failed to create journal'); setSaving(false); return }

      const { error: lErr } = await supabase.from('journal_lines').insert(
        lines.map((l) => ({ journal_id: journal.id, account_id: l.account_id, type: l.type, amount: l.amount }))
      )

      if (lErr) {
        await supabase.from('journals').delete().eq('id', journal.id)
        setError(`Failed to insert lines: ${lErr.message}. Journal rolled back.`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/journals')
  }

  const debitTotal = calcDebitTotal(lines)
  const creditTotal = calcCreditTotal(lines)
  const balanced = isBalanced(lines)

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={periodId} onValueChange={(v) => setPeriodId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="No period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No period</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.is_locked ? '(locked)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Cash sale to customer"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="p-5 pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Journal Lines</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="text-right w-40">Amount (IDR)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <Select value={line.account_id} onValueChange={(v) => updateLine(line.id, 'account_id', v ?? '')}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLineType(line.id)}
                          className={`text-xs font-medium ${
                            line.type === 'debit'
                              ? 'border-[#F08521]/30 text-[#F08521] bg-[#F08521]/5 hover:bg-[#F08521]/10'
                              : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {line.type.toUpperCase()}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={line.amount || ''}
                          onChange={(e) => updateLine(line.id, 'amount', parseInt(e.target.value) || 0)}
                          className="text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {lines.length > 2 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {lines.map((line, idx) => (
                <Card key={line.id} className="border border-border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">Line {idx + 1}</span>
                      {lines.length > 2 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.id)} className="h-6 px-2 text-xs text-destructive hover:text-destructive">
                          Remove
                        </Button>
                      )}
                    </div>
                    <Select value={line.account_id} onValueChange={(v) => updateLine(line.id, 'account_id', v ?? '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleLineType(line.id)}
                        className={`shrink-0 text-xs font-medium ${
                          line.type === 'debit'
                            ? 'border-[#F08521]/30 text-[#F08521] bg-[#F08521]/5'
                            : 'border-emerald-300 text-emerald-700 bg-emerald-50'
                        }`}
                      >
                        {line.type.toUpperCase()}
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={line.amount || ''}
                        onChange={(e) => updateLine(line.id, 'amount', parseInt(e.target.value) || 0)}
                        className="text-right"
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold">Totals</span>
              <span className="text-sm">
                <span className="text-[#F08521] font-medium">{formatIDR(debitTotal)}</span>
                {' / '}
                <span className="text-emerald-600 font-medium">{formatIDR(creditTotal)}</span>
              </span>
              {balanced ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                  Balanced
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                  Unbalanced ({formatIDR(Math.abs(debitTotal - creditTotal))} difference)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={saving || !balanced}
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Post Entry'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/journals')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
