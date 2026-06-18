import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatIDR } from '../lib/format'
import type { Journal } from '../lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BookOpen, ScrollText, Wallet, Plus } from 'lucide-react'

export function DashboardPage() {
  const [accountCount, setAccountCount] = useState(0)
  const [journalCount, setJournalCount] = useState(0)
  const [recentJournals, setRecentJournals] = useState<Journal[]>([])
  const [totalAssets, setTotalAssets] = useState(0)

  useEffect(() => {
    async function load() {
      const [accRes, jrnlRes, recentRes, assetRes] = await Promise.all([
        supabase.from('accounts').select('id', { count: 'exact', head: true }),
        supabase.from('journals').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
        supabase.from('journals').select('*').order('date', { ascending: false }).limit(5),
        supabase
          .from('journal_lines')
          .select('amount, type, journals!inner(status), accounts!inner(type)')
          .eq('accounts.type', 'asset')
          .eq('journals.status', 'posted'),
      ])
      if (accRes.count !== null) setAccountCount(accRes.count)
      if (jrnlRes.count !== null) setJournalCount(jrnlRes.count)
      if (recentRes.data) setRecentJournals(recentRes.data as Journal[])

      if (assetRes.data) {
        const balance = (assetRes.data as { amount: number; type: string }[]).reduce(
          (sum, line) => sum + (line.type === 'debit' ? line.amount : -line.amount), 0
        )
        setTotalAssets(balance)
      }
    }
    load()
  }, [])

  const stats = [
    { title: 'Active Accounts', value: accountCount, icon: BookOpen, link: '/accounts', linkLabel: 'View All' },
    { title: 'Posted Journals', value: journalCount, icon: ScrollText, link: '/journals', linkLabel: 'View All' },
    { title: 'Total Assets', value: formatIDR(totalAssets), icon: Wallet, link: '/reports/balance-sheet', linkLabel: 'Balance Sheet' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button render={<Link to="/journals/new" />} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Entry
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F08521]/10">
                  <stat.icon className="h-5 w-5 text-[#F08521]" />
                </div>
              </div>
              <Link to={stat.link} className="text-sm text-[#F08521] hover:underline mt-3 inline-block">
                {stat.linkLabel}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-lg">Recent Journal Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {recentJournals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No journal entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJournals.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-sm">{j.date}</TableCell>
                    <TableCell className="text-sm">{j.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant={j.status === 'posted' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {j.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
