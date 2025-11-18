import { useEffect, useState } from 'react'

function App() {
  const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tz, setTz] = useState('America/New_York')
  const [minutesBefore, setMinutesBefore] = useState(10)
  const [active, setActive] = useState(true)
  const [refreshToken, setRefreshToken] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/status`)
      const data = await res.json()
      setStatus(data)
    } catch (e) {
      setStatus({ error: e.message })
    }
  }

  const saveUser = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone_e164: phone, timezone: tz })
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Saved user details')
      await fetchStatus()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveRule = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${baseUrl}/api/reminder-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, minutes_before: Number(minutesBefore), active })
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Saved reminder rule')
      await fetchStatus()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveToken = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${baseUrl}/api/google/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, refresh_token: refreshToken })
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Saved Google refresh token')
      await fetchStatus()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const triggerNow = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`${baseUrl}/api/trigger`, { method: 'POST' })
      const data = await res.json()
      setMessage(`Triggered. Results: ${JSON.stringify(data.results || data)}`)
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.08),transparent_50%)]"></div>

      <header className="relative z-10 pt-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Calendar SMS Reminders</h1>
        <p className="text-blue-200/80 mt-2">Syncs your Google Calendar and texts you before meetings, with automatic timezone conversion</p>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-8">
        <section className="bg-slate-800/60 border border-blue-500/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Your Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-blue-200/80 mb-1">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-slate-900/60 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-blue-200/80 mb-1">Phone (E.164)</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+15551234567" className="w-full bg-slate-900/60 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-blue-200/80 mb-1">Timezone (IANA)</label>
              <input value={tz} onChange={e=>setTz(e.target.value)} placeholder="America/Los_Angeles" className="w-full bg-slate-900/60 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={saveUser} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded font-semibold">Save Details</button>
          </div>
        </section>

        <section className="bg-slate-800/60 border border-blue-500/20 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Reminder Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-blue-200/80 mb-1">Minutes before meeting</label>
              <input type="number" min={1} max={10080} value={minutesBefore} onChange={e=>setMinutesBefore(e.target.value)} className="w-full bg-slate-900/60 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-3">
              <input id="active" type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
              <label htmlFor="active" className="text-blue-200/80">Active</label>
            </div>
            <button onClick={saveRule} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 rounded font-semibold">Save Rule</button>
          </div>
        </section>

        <section className="bg-slate-800/60 border border-blue-500/20 rounded-2xl p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Connect Google Calendar</h2>
          <p className="text-blue-200/80 text-sm mb-3">Paste a Google OAuth refresh token with calendar.readonly scope. In production, use a proper OAuth flow.</p>
          <div className="flex flex-col md:flex-row gap-3">
            <input value={refreshToken} onChange={e=>setRefreshToken(e.target.value)} placeholder="Refresh token" className="flex-1 bg-slate-900/60 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={saveToken} disabled={loading} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-2 rounded font-semibold">Save Token</button>
            <button onClick={triggerNow} disabled={loading} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded font-semibold">Trigger Now</button>
          </div>
        </section>

        <section className="bg-slate-800/60 border border-blue-500/20 rounded-2xl p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Status</h2>
            <button onClick={fetchStatus} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">Refresh</button>
          </div>
          {status ? (
            status.error ? (
              <p className="text-red-300">{status.error}</p>
            ) : (
              <div className="text-blue-100 text-sm space-y-2">
                <p>Next run (UTC): {status.next_run || 'n/a'}</p>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <h3 className="font-semibold mb-1">Users</h3>
                    <pre className="bg-slate-900/60 p-3 rounded overflow-auto text-xs">{JSON.stringify(status.users, null, 2)}</pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Rules</h3>
                    <pre className="bg-slate-900/60 p-3 rounded overflow-auto text-xs">{JSON.stringify(status.rules, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )
          ) : (
            <p className="text-blue-200/80">Loading…</p>
          )}
          {message && (
            <div className="mt-4 text-sm bg-slate-900/60 border border-slate-700 rounded p-3">{message}</div>
          )}
        </section>
      </main>

      <footer className="relative z-10 text-center text-blue-300/60 pb-8">Backend: {baseUrl}</footer>
    </div>
  )
}

export default App
