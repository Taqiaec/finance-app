import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateShort } from '../lib/format'
import type { Period } from '../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Lock, Unlock } from 'lucide-react'

export function PeriodsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  async function loadPeriods() {
    setLoading(true)
    const { data } = await supabase.from('periods').select('*').order('start_date', { ascending: false })
    if (data) setPeriods(data as Period[])
    setLoading(false)
  }

  useEffect(() => { loadPeriods() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name || !startDate || !endDate) { setError('All fields required'); return }
    if (startDate > endDate) { setError('Start date must be before end date'); return }

    const overlap = periods.find((p) => !(endDate < p.start_date || startDate > p.end_date))
    if (overlap) { setError(`Overlaps with period "${overlap.name}"`); return }

    const { error: insertErr } = await supabase.from('periods').insert({
      name, start_date: startDate, end_date: endDate,
    })
    if (insertErr) { setError(insertErr.message); return }
    setShowForm(false)
    setName(''); setStartDate(''); setEndDate('')
    await loadPeriods()
  }

  async function toggleLock(id: string, current: boolean) {
    await supabase.from('periods').update({ is_locked: !current }).eq('id', id)
    await loadPeriods()
  }

  return (
    <div className="max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Fiscal Periods</h1>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Period
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-lg">New Period</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2024-01" />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" size="sm">Create</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
              {error && <p className="sm:col-span-2 lg:col-span-4 text-sm text-destructive">{error}</p>}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="text-sm">{formatDateShort(p.start_date)}</TableCell>
                    <TableCell className="text-sm">{formatDateShort(p.end_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          p.is_locked
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {p.is_locked ? 'Locked' : 'Open'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLock(p.id, p.is_locked)}
                          className="h-7 px-2 text-xs"
                        >
                          {p.is_locked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                          {p.is_locked ? 'Unlock' : 'Lock'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {periods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">
                      No periods
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
