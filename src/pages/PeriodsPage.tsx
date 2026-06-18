import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateShort } from '../lib/format'
import type { Period } from '../lib/types'

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Fiscal Periods</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm hover:bg-blue-700">
            + New Period
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">New Period</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="2024-01" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 items-end">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm">Cancel</button>
            </div>
            {error && <p className="sm:col-span-2 lg:col-span-4 text-red-600 text-sm">{error}</p>}
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-3 py-2 sm:px-4 sm:py-3">Name</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">Start</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">End</th>
                <th className="px-3 py-2 sm:px-4 sm:py-3">Status</th>
                {isAdmin && <th className="px-3 py-2 sm:px-4 sm:py-3">Action</th>}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 sm:px-4 sm:py-3 font-medium whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{formatDateShort(p.start_date)}</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">{formatDateShort(p.end_date)}</td>
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.is_locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {p.is_locked ? 'Locked' : 'Open'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                      <button onClick={() => toggleLock(p.id, p.is_locked)} className="text-xs hover:underline text-gray-600">
                        {p.is_locked ? 'Unlock' : 'Lock'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {periods.length === 0 && (
                <tr><td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-gray-400">No periods</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
