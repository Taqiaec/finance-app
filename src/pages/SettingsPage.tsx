import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { UserProfile, UserRole } from '../lib/types'

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
        <p className="text-gray-500">You do not have permission to access this page.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">User & Role Management</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{u.full_name ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.id === profile?.id ? (
                      <span className="text-xs text-gray-400">You</span>
                    ) : (
                      <button
                        onClick={() => updateRole(u.id, u.role === 'admin' ? 'viewer' : 'admin')}
                        disabled={updating === u.id}
                        className="text-blue-600 hover:underline text-xs disabled:opacity-50"
                      >
                        {u.role === 'admin' ? 'Demote to Viewer' : 'Promote to Admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
