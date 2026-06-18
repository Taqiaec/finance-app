import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  BookOpen,
  ScrollText,
  ListOrdered,
  Calendar,
  BarChart3,
  TrendingUp,
  Wallet,
  Activity,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from 'lucide-react'

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Chart of Accounts', icon: BookOpen },
  { to: '/mutasi', label: 'Account Statement', icon: ListOrdered },
  { to: '/journals', label: 'Journal Entries', icon: ScrollText },
]

const reportNav = [
  { to: '/reports/trial-balance', label: 'Trial Balance', icon: BarChart3 },
  { to: '/reports/profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { to: '/reports/balance-sheet', label: 'Balance Sheet', icon: Wallet },
  { to: '/reports/cash-flow', label: 'Cash Flow', icon: Activity },
]

const adminNav = [
  { to: '/periods', label: 'Periods', icon: Calendar },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-[#F08521]/10 text-[#F08521] font-medium'
            : 'text-gray-300 hover:bg-white/5 hover:text-white'
        } ${collapsed ? 'justify-center' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function SidebarSection({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-1">
      {!collapsed && (
        <p className="px-2.5 mb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function getInitials() {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return profile?.id.slice(0, 2).toUpperCase() ?? 'U'
  }

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-60'

  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#18181B] text-white transition-all duration-200 lg:relative ${
          sidebarWidth
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand */}
        <div className={`flex items-center gap-2 p-3 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F08521] text-white font-bold text-sm">
            F
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold truncate">Finance App</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-4">
          <SidebarSection label="Main" collapsed={collapsed}>
            {mainNav.map((item) => (
              <SidebarLink key={item.to} {...item} collapsed={collapsed} />
            ))}
          </SidebarSection>

          <SidebarSection label="Reports" collapsed={collapsed}>
            {reportNav.map((item) => (
              <SidebarLink key={item.to} {...item} collapsed={collapsed} />
            ))}
          </SidebarSection>

          {profile?.role === 'admin' && (
            <SidebarSection label="Admin" collapsed={collapsed}>
              {adminNav.map((item) => (
                <SidebarLink key={item.to} {...item} collapsed={collapsed} />
              ))}
            </SidebarSection>
          )}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-white/10 p-2 space-y-2">
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F08521]/15 text-[#F08521] text-xs font-semibold">
              {getInitials()}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</span>
                <span className="text-[11px] text-gray-400 capitalize">{profile?.role}</span>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-white lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-semibold">Finance App</span>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-white">
          <Separator orientation="vertical" className="h-4" />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
