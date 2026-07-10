import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DiaryEntryRow, MEAL_TYPES, MEAL_TYPE_LABELS, MealType, UserProfileRow } from '../lib/types'
import { computeDailyTarget, computeTrendTdee, MIN_TREND_DAYS } from '../lib/adaptiveTdee'

const TREND_WINDOW_DAYS = 30

// Icon/Farbe je Mahlzeit — identisch zu HomeViewModel.kt (Android MealOverview).
const MEAL_META: Record<MealType, { icon: string; color: string }> = {
  BREAKFAST: { icon: '☀️', color: '#FF9B45' },
  LUNCH: { icon: '🌤️', color: '#4B8BF5' },
  DINNER: { icon: '🌙', color: '#A259FF' },
  SNACK: { icon: '🍎', color: '#2D7D46' },
}

function greetingForHour(h: number) {
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

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

  // Adaptive-Kalorienziel: braucht Gewichts- + Tagebuch-Historie der letzten Tage,
  // plus optional Aktivkalorien (health_daily, von Android gepusht) fuer den Sport-Bonus.
  const [weightByDate, setWeightByDate] = useState<Record<string, number>>({})
  const [intakeByDate, setIntakeByDate] = useState<Record<string, number>>({})
  const [activeKcalByDate, setActiveKcalByDate] = useState<Record<string, number>>({})
  const [stepsByDate, setStepsByDate] = useState<Record<string, number>>({})
  const [profile, setProfile] = useState<UserProfileRow | null>(null)

  useEffect(() => {
    if (!session) return
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as UserProfileRow | null))
  }, [session])

  const loadTrendData = useCallback(async () => {
    if (!session) return
    const cutoff = toDateStr(new Date(Date.now() - TREND_WINDOW_DAYS * 86400000))

    const [
      { data: weightRows, error: weightErr },
      { data: diaryRows, error: diaryErr },
      { data: healthRows, error: healthErr },
    ] = await Promise.all([
      supabase
        .from('weight_entries')
        .select('date_str, weight_kg')
        .eq('user_id', session.user.id)
        .gte('date_str', cutoff),
      supabase
        .from('diary_entries')
        .select('date_str, calories')
        .eq('user_id', session.user.id)
        .gte('date_str', cutoff),
      supabase
        .from('health_daily')
        .select('date_str, active_calories_kcal, steps, weight_kg')
        .eq('user_id', session.user.id)
        .gte('date_str', cutoff),
    ])

    if (!weightErr && weightRows) {
      const map: Record<string, number> = {}
      for (const r of weightRows as { date_str: string; weight_kg: number }[]) map[r.date_str] = r.weight_kg
      setWeightByDate((prev) => ({ ...prev, ...map }))
    }
    if (!diaryErr && diaryRows) {
      const map: Record<string, number> = {}
      for (const r of diaryRows as { date_str: string; calories: number }[]) {
        map[r.date_str] = (map[r.date_str] ?? 0) + r.calories
      }
      setIntakeByDate(map)
    }
    // health_daily existiert evtl. noch nicht (Tabelle muss einmalig in Supabase
    // angelegt werden) -- Fehler hier sind nicht kritisch, Sport-Bonus faellt dann weg.
    if (!healthErr && healthRows) {
      const kcalMap: Record<string, number> = {}
      const stepsMap: Record<string, number> = {}
      const weightFallback: Record<string, number> = {}
      for (const r of healthRows as {
        date_str: string
        active_calories_kcal: number | null
        steps: number | null
        weight_kg: number | null
      }[]) {
        if (r.active_calories_kcal != null) kcalMap[r.date_str] = r.active_calories_kcal
        if (r.steps != null) stepsMap[r.date_str] = r.steps
        if (r.weight_kg != null) weightFallback[r.date_str] = r.weight_kg
      }
      setActiveKcalByDate(kcalMap)
      setStepsByDate(stepsMap)
      // weight_entries hat Vorrang; health_daily.weight_kg dient nur als Fallback
      // (z.B. wenn nur Health Connect, aber noch kein manueller Eintrag existiert).
      setWeightByDate((prev) => ({ ...weightFallback, ...prev }))
    }
  }, [session])

  useEffect(() => {
    loadTrendData()
  }, [loadTrendData])

  const adaptiveTarget = useMemo(() => {
    const trendTdee = computeTrendTdee(weightByDate, intakeByDate)
    const todayStr = toDateStr(new Date())
    const activeDays = Object.keys(activeKcalByDate).filter((d) => d !== todayStr).sort()
    const last7 = activeDays.slice(-7)
    const avgActiveKcal = last7.length > 0 ? last7.reduce((a, d) => a + activeKcalByDate[d], 0) / last7.length : null
    const todayActiveKcal = activeKcalByDate[todayStr] ?? null
    return computeDailyTarget(trendTdee, todayActiveKcal, avgActiveKcal)
  }, [weightByDate, intakeByDate, activeKcalByDate])

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

  const mealOverview = useMemo(
    () =>
      MEAL_TYPES.map((mt) => ({
        type: mt,
        label: MEAL_TYPE_LABELS[mt],
        ...MEAL_META[mt],
        kcal: grouped[mt].reduce((sum, e) => sum + e.calories, 0),
        count: grouped[mt].length,
      })),
    [grouped]
  )

  const burnedKcal = activeKcalByDate[dateStr] ?? 0
  const calorieGoal = profile?.daily_calorie_goal ?? 2000
  const proteinGoal = profile?.protein_goal_g ?? 120
  const carbsGoal = profile?.carbs_goal_g ?? 220
  const fatGoal = profile?.fat_goal_g ?? 65
  // Wenn adaptives Ziel verfügbar ist, ist der Aktivitätsbonus schon eingerechnet
  // (siehe adjustedGoal in Android HomeUiState) — sonst wird burnedKcal separat addiert.
  const adjustedGoal = adaptiveTarget ? adaptiveTarget.targetKcal : calorieGoal + burnedKcal
  const remaining = Math.max(0, adjustedGoal - totals.kcal)
  const ringPct = Math.min(1, adjustedGoal > 0 ? totals.kcal / adjustedGoal : 0)
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), [])

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

  function quickAdd(mt: MealType) {
    setMealType(mt)
    document.getElementById('add-form-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    document.getElementById('add-form-name')?.focus()
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

      <div className="card health-card">
        <h3 style={{ marginBottom: 14 }}>Health</h3>
        {stepsByDate[dateStr] == null && activeKcalByDate[dateStr] == null && weightByDate[dateStr] == null ? (
          <p className="empty-state" style={{ textAlign: 'left', margin: 0 }}>
            Noch keine Health-Daten für diesen Tag (Sync über die Android-App mit Health Connect).
          </p>
        ) : (
          <div className="health-stat-row">
            <div className="health-stat">
              <span className="health-icon">👟</span>
              <span className="health-value">
                {stepsByDate[dateStr] != null ? stepsByDate[dateStr].toLocaleString('de-CH') : '–'}
              </span>
              <span className="health-label">Schritte</span>
            </div>
            <div className="health-stat">
              <span className="health-icon">🔥</span>
              <span className="health-value">
                {activeKcalByDate[dateStr] != null ? `${Math.round(activeKcalByDate[dateStr])} kcal` : '–'}
              </span>
              <span className="health-label">Verbrannt</span>
            </div>
            <div className="health-stat">
              <span className="health-icon">⚖️</span>
              <span className="health-value">
                {weightByDate[dateStr] != null ? `${weightByDate[dateStr].toFixed(1)} kg` : '–'}
              </span>
              <span className="health-label">Gewicht</span>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-header">
        <div className="dashboard-top">
          <div>
            <div className="dashboard-greeting">{greeting} 👋</div>
            <div className="dashboard-title">Dein Tag im Überblick</div>
            {adaptiveTarget && (
              <div className="dashboard-adaptive">🎯 Adaptives Ziel</div>
            )}
          </div>
        </div>

        <div className="dashboard-ring-row">
          <div className="ring-wrap">
            <svg viewBox="0 0 120 120" width="110" height="110">
              <circle cx="60" cy="60" r="51" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="9" />
              <circle
                cx="60"
                cy="60"
                r="51"
                fill="none"
                stroke={ringPct > 1 ? '#FFD67A' : '#ffffff'}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 51}
                strokeDashoffset={2 * Math.PI * 51 * (1 - Math.min(ringPct, 1))}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="ring-center">
              <span className="ring-value">{Math.round(remaining)}</span>
              <span className="ring-label">kcal übrig</span>
            </div>
          </div>

          <div className="dashboard-stats">
            <div className="dashboard-labeled-values">
              <div className="labeled-value">
                <span className="lv-value">{Math.round(totals.kcal)}</span>
                <span className="lv-label">gegessen</span>
              </div>
              {burnedKcal > 0 && (
                <div className="labeled-value">
                  <span className="lv-value">+{Math.round(burnedKcal)}</span>
                  <span className="lv-label">aktiv</span>
                </div>
              )}
              <div className="labeled-value">
                <span className="lv-value">{Math.round(adjustedGoal)}</span>
                <span className="lv-label">Ziel</span>
              </div>
            </div>
            <div className="macro-bar-white">
              <div className="macro-bar-head">
                <span>Protein</span>
                <span>{Math.round(totals.protein)}g</span>
              </div>
              <div className="macro-bar-track">
                <div
                  className="macro-bar-fill"
                  style={{ width: `${Math.min(100, (totals.protein / Math.max(1, proteinGoal)) * 100)}%` }}
                />
              </div>
            </div>
            <div className="macro-bar-white">
              <div className="macro-bar-head">
                <span>Kohlenh.</span>
                <span>{Math.round(totals.carbs)}g</span>
              </div>
              <div className="macro-bar-track">
                <div
                  className="macro-bar-fill"
                  style={{ width: `${Math.min(100, (totals.carbs / Math.max(1, carbsGoal)) * 100)}%` }}
                />
              </div>
            </div>
            <div className="macro-bar-white">
              <div className="macro-bar-head">
                <span>Fett</span>
                <span>{Math.round(totals.fat)}g</span>
              </div>
              <div className="macro-bar-track">
                <div
                  className="macro-bar-fill"
                  style={{ width: `${Math.min(100, (totals.fat / Math.max(1, fatGoal)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="meal-grid">
        {mealOverview.map((meal) => (
          <div key={meal.type} className="meal-card">
            <button type="button" className="meal-card-body" onClick={() => quickAdd(meal.type)}>
              <div className="meal-card-head">
                <span className="meal-card-icon" style={{ background: `${meal.color}26` }}>
                  {meal.icon}
                </span>
                <span className="meal-card-label">{meal.label}</span>
              </div>
              <div className="meal-card-kcal" style={{ color: meal.count > 0 ? 'var(--accent)' : 'var(--ink-muted)' }}>
                {Math.round(meal.kcal)} kcal
              </div>
              <div className="meal-card-count">{meal.count} Einträge</div>
            </button>
            <button
              type="button"
              className="meal-card-add"
              style={{ background: meal.color }}
              aria-label={`Zu ${meal.label} hinzufügen`}
              onClick={() => quickAdd(meal.type)}
            >
              +
            </button>
          </div>
        ))}
      </div>


      {adaptiveTarget ? (
        <p className="empty-state" style={{ textAlign: 'left', margin: '0 0 16px' }}>
          Trend-TDEE aus Gewichts- &amp; Tagebuchverlauf: {adaptiveTarget.baseKcal + adaptiveTarget.deficitKcal} kcal
          Erhaltung − {adaptiveTarget.deficitKcal} kcal Defizit
          {adaptiveTarget.activityBonusKcal !== 0
            ? ` ${adaptiveTarget.activityBonusKcal > 0 ? '+' : '−'} ${Math.abs(adaptiveTarget.activityBonusKcal)} kcal Sport-Bonus`
            : ''}{' '}
          = {adaptiveTarget.targetKcal} kcal Ziel.
        </p>
      ) : (
        <p className="empty-state" style={{ textAlign: 'left', margin: '0 0 16px' }}>
          Adaptives Ziel: noch nicht genug Daten (mind. {MIN_TREND_DAYS} Tage mit Gewicht &amp; Tagebuch-Einträgen
          nötig).
        </p>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Eintrag hinzufügen</h3>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor="add-form-name">Bezeichnung</label>
              <input id="add-form-name" value={name} onChange={(e) => setName(e.target.value)} required />
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
