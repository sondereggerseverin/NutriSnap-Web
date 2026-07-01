import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DiaryEntryRow, MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../lib/types'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default function Diary() {
  const { session } = useAuth()
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()))
  const [entries, setEntries] = useState<DiaryEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Formularfelder für neuen Eintrag
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('100')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [mealType, setMealType] = useState<MealType>('LUNCH')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date_str', dateStr)
      .order('id', { ascending: true })
    if (error) setError(error.message)
    else setEntries(data as DiaryEntryRow[])
    setLoading(false)
  }, [session, dateStr])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          kcal: acc.kcal + e.calories,
          protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs,
          fat: acc.fat + e.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [entries]
  )

  const grouped = useMemo(() => {
    const map: Record<MealType, DiaryEntryRow[]> = { BREAKFAST: [], LUNCH: [], DINNER: [], SNACK: [] }
    for (const e of entries) map[e.meal_type]?.push(e)
    return map
  }, [entries])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!session || !name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('diary_entries').insert({
      user_id: session.user.id,
      food_name: name.trim(),
      amount_grams: Number(grams) || 0,
      meal_type: mealType,
      date_str: dateStr,
      calories: Number(kcal) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setGrams('100')
    setKcal('')
    setProtein('')
    setCarbs('')
    setFat('')
    load()
  }

  async function handleDelete(id: number) {
    const { error } = await supabase.from('diary_entries').delete().eq('id', id)
    if (error) setError(error.message)
    else setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function shiftDate(days: number) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setDateStr(toDateStr(d))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Tagebuch</h1>
        <p>Deine Mahlzeiten, synchronisiert mit der App.</p>
      </div>

      <div className="date-nav">
        <button onClick={() => shiftDate(-1)} aria-label="Vorheriger Tag">
          ‹
        </button>
        <span className="date-label">{formatDateLabel(dateStr)}</span>
        <button onClick={() => shiftDate(1)} aria-label="Nächster Tag">
          ›
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="label">Kalorien</div>
          <div className="value">{Math.round(totals.kcal)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Protein</div>
          <div className="value">{Math.round(totals.protein)}g</div>
        </div>
        <div className="stat-card">
          <div className="label">Kohlenhydrate</div>
          <div className="value">{Math.round(totals.carbs)}g</div>
        </div>
        <div className="stat-card">
          <div className="label">Fett</div>
          <div className="value">{Math.round(totals.fat)}g</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Eintrag hinzufügen</h3>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor="name">Bezeichnung</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="grams">Menge (g)</label>
              <input id="grams" type="number" value={grams} onChange={(e) => setGrams(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="kcal">Kalorien</label>
              <input id="kcal" type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="protein">Protein (g)</label>
              <input id="protein" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="carbs">Kohlenhydrate (g)</label>
              <input id="carbs" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fat">Fett (g)</label>
              <input id="fat" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="mealType">Mahlzeit</label>
              <select id="mealType" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_TYPE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Speichert…' : 'Hinzufügen'}
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        {loading ? (
          <p className="empty-state">Lädt…</p>
        ) : entries.length === 0 ? (
          <p className="empty-state">Noch keine Einträge für diesen Tag.</p>
        ) : (
          MEAL_TYPES.map((mt) =>
            grouped[mt].length === 0 ? null : (
              <div key={mt}>
                <div className="meal-group-title">{MEAL_TYPE_LABELS[mt]}</div>
                <div className="entry-list">
                  {grouped[mt].map((entry) => (
                    <div className="entry-row" key={entry.id}>
                      <div className="entry-main">
                        <span className="entry-name">{entry.food_name}</span>
                        <span className="entry-meta">{entry.amount_grams} g</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="entry-macros">
                          <div className="entry-kcal">{Math.round(entry.calories)} kcal</div>
                          <div>
                            P {Math.round(entry.protein)} · K {Math.round(entry.carbs)} · F{' '}
                            {Math.round(entry.fat)}
                          </div>
                        </div>
                        <button className="delete-btn" onClick={() => handleDelete(entry.id)}>
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}
