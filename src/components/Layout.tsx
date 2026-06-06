import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/accounts', label: 'Chart of Accounts' },
  { to: '/journals', label: 'Journal Entries' },
  { to: '/periods', label: 'Periods' },
  { to: '/reports/trial-balance', label: 'Trial Balance' },
  { to: '/reports/profit-loss', label: 'Profit & Loss' },
  { to: '/reports/balance-sheet', label: 'Balance Sheet' },
  { to: '/reports/cash-flow', label: 'Cash Flow' },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">Finance App</h1>
          {profile && (
            <p className="text-xs text-gray-400 mt-1">
              {profile.full_name ?? profile.id} ({profile.role})
            </p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${
                  isActive ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
