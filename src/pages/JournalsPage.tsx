import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatIDR, formatDate } from '../lib/format'
import type { Journal, JournalLine, Account } from '../lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, RotateCcw } from 'lucide-react'

export function JournalsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [journals, setJournals] = useState<(Journal & { journal_lines: JournalLine[] })[]>([])
  const [accounts, setAccounts] = useState<Record<string, Account>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [jRes, aRes] = await Promise.all([
        supabase.from('journals')
          .select('*, journal_lines(*)')
          .order('date', { ascending: false }),
        supabase.from('accounts').select('*'),
      ])
      if (jRes.data) setJournals(jRes.data as (Journal & { journal_lines: JournalLine[] })[])
      if (aRes.data) {
        const map: Record<string, Account> = {}
        for (const a of aRes.data as Account[]) map[a.id] = a
        setAccounts(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleReverse(id: string) {
    if (!confirm('Reverse this journal entry?')) return

    const { error } = await supabase.rpc('reverse_journal', { p_journal_id: id })
    if (error) { alert(error.message); return }

    window.location.reload()
  }

  return (
    <div className="max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        {isAdmin && (
          <Button render={<Link to="/journals/new" />} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Entry
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          {journals.map((j) => {
            const totalDebit = j.journal_lines.filter((l) => l.type === 'debit').reduce((s, l) => s + l.amount, 0)
            return (
              <Card key={j.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
                    <div>
                      <p className="font-semibold">{j.description}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(j.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={j.status === 'posted' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {j.status}
                      </Badge>
                      {isAdmin && j.status === 'posted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReverse(j.id)}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reverse
                        </Button>
                      )}
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {j.journal_lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="text-sm">
                            {accounts[line.account_id]?.code} - {accounts[line.account_id]?.name}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {line.type === 'debit' ? formatIDR(line.amount) : ''}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {line.type === 'credit' ? formatIDR(line.amount) : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm font-semibold">
                    <span>Total</span>
                    <div className="flex gap-4">
                      <span className="text-[#F08521]">{formatIDR(totalDebit)}</span>
                      <span className="text-emerald-600">{formatIDR(totalDebit)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {journals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No journal entries yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
