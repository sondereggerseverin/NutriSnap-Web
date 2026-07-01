import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { WeightEntryRow } from '../lib/types'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function Weight() {
  const { session } = useAuth()
  const [entries, setEntries] = useState<WeightEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()))
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date_str', { ascending: true })
    if (error) setError(error.message)
    else setEntries(data as WeightEntryRow[])
    setLoading(false)
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const chartData = useMemo(
    () =>
      entries.map((e) => ({
        date: new Date(e.date_str + 'T00:00:00').toLocaleDateString('de-CH', {
          day: '2-digit',
          month: '2-digit',
        }),
        weight: e.weight_kg,
      })),
    [entries]
  )

  const latest = entries.length > 0 ? entries[entries.length - 1] : null
  const weekAgo = useMemo(() => {
    if (entries.length === 0) return null
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const inRange = entries.filter((e) => new Date(e.date_str + 'T00:00:00') >= cutoff)
    if (inRange.length === 0) return null
    return inRange.reduce((sum, e) => sum + e.weight_kg, 0) / inRange.length
  }, [entries])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!session || !weight) return
    setSaving(true)
    const { error } = await supabase
      .from('weight_entries')
      .upsert(
        { user_id: session.user.id, date_str: dateStr, weight_kg: Number(weight) },
        { onConflict: 'user_id,date_str' }
      )
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setWeight('')
    load()
  }

  async function handleDelete(entryDateStr: string) {
    if (!session) return
    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('user_id', session.user.id)
      .eq('date_str', entryDateStr)
    if (error) setError(error.message)
    else setEntries((prev) => prev.filter((e) => e.date_str !== entryDateStr))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Gewicht</h1>
        <p>Verlauf, synchronisiert mit der App.</p>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat-card">
          <div className="label">Aktuell</div>
          <div className="value">{latest ? `${latest.weight_kg.toFixed(1)} kg` : '–'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ø letzte 7 Tage</div>
          <div className="value">{weekAgo ? `${weekAgo.toFixed(1)} kg` : '–'}</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="empty-state">Lädt…</p>
        ) : chartData.length === 0 ? (
          <p className="empty-state">Noch keine Gewichtseinträge.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 12, fill: 'var(--ink-muted)' }}
                unit=" kg"
              />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', fontSize: 13 }}
                formatter={(v: number) => [`${v.toFixed(1)} kg`, 'Gewicht']}
              />
              <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Eintrag hinzufügen</h3>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="wdate">Datum</label>
              <input
                id="wdate"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="wkg">Gewicht (kg)</label>
              <input
                id="wkg"
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      {entries.length > 0 && (
        <div className="card">
          <div className="entry-list">
            {[...entries]
              .reverse()
              .slice(0, 10)
              .map((e) => (
                <div className="entry-row" key={e.date_str}>
                  <span className="entry-name">
                    {new Date(e.date_str + 'T00:00:00').toLocaleDateString('de-CH', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="entry-kcal">{e.weight_kg.toFixed(1)} kg</span>
                    <button className="delete-btn" onClick={() => handleDelete(e.date_str)}>
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
