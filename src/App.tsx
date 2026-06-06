import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AccountsPage } from './pages/AccountsPage'
import { JournalsPage } from './pages/JournalsPage'
import { JournalFormPage } from './pages/JournalFormPage'
import { PeriodsPage } from './pages/PeriodsPage'
import { TrialBalancePage } from './pages/reports/TrialBalancePage'
import { ProfitLossPage } from './pages/reports/ProfitLossPage'
import { BalanceSheetPage } from './pages/reports/BalanceSheetPage'
import { CashFlowPage } from './pages/reports/CashFlowPage'
import { ProtectedRoute } from './components/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="journals" element={<JournalsPage />} />
              <Route path="journals/new" element={<JournalFormPage />} />
              <Route path="journals/:id" element={<JournalFormPage />} />
              <Route path="periods" element={<PeriodsPage />} />
              <Route path="reports/trial-balance" element={<TrialBalancePage />} />
              <Route path="reports/profit-loss" element={<ProfitLossPage />} />
              <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="reports/cash-flow" element={<CashFlowPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
