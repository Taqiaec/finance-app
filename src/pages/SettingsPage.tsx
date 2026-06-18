import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { UserProfile, UserRole } from '../lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowUp, ArrowDown } from 'lucide-react'

export function SettingsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('user_profiles').select('*').order('created_at')
      if (data) setUsers(data as UserProfile[])
      setLoading(false)
    }
    load()
  }, [])

  async function updateRole(userId: string, newRole: UserRole) {
    setUpdating(userId)
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
    setUsers(users.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    setUpdating(null)
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">User & Role Management</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Card>
          <CardContent className="p-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm whitespace-nowrap">{u.full_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell>
                      {u.id === profile?.id ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateRole(u.id, u.role === 'admin' ? 'viewer' : 'admin')}
                          disabled={updating === u.id}
                          className="h-7 px-2 text-xs"
                        >
                          {u.role === 'admin' ? (
                            <><ArrowDown className="h-3 w-3 mr-1" /> Demote</>
                          ) : (
                            <><ArrowUp className="h-3 w-3 mr-1" /> Promote</>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No users found
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
