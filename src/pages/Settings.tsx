import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { UserProfileRow } from '../lib/types'

const SEXES: { value: UserProfileRow['sex']; label: string }[] = [
  { value: 'MALE', label: 'Männlich' },
  { value: 'FEMALE', label: 'Weiblich' },
  { value: 'UNSPECIFIED', label: 'Keine Angabe' },
]

// Fallback-Werte, falls noch kein Profil existiert (siehe UserProfileDto in SupabaseSync.kt).
const DEFAULT_PROFILE: Omit<UserProfileRow, 'user_id'> = {
  weight_kg: 0,
  height_cm: 0,
  age_years: 0,
  daily_calorie_goal: 2000,
  protein_goal_g: 120,
  carbs_goal_g: 220,
  fat_goal_g: 65,
  activity_factor: 1.55,
  sex: 'UNSPECIFIED',
  updated_at: 0,
}

export default function Settings() {
  const { session } = useAuth()
  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) setError(error.message)
    setProfile(data ?? { user_id: session.user.id, ...DEFAULT_PROFILE })
    setLoading(false)
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!session || !profile) return
    setSaving(true)
    setSaved(false)
    setError(null)
    const { error } = await supabase.from('user_profiles').upsert(
      { ...profile, user_id: session.user.id, updated_at: Date.now() },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    if (error) setError(error.message)
    else setSaved(true)
  }

  function update<K extends keyof UserProfileRow>(key: K, value: UserProfileRow[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Einstellungen</h1>
        </div>
        <p className="empty-state">Lädt…</p>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div>
      <div className="page-header">
        <h1>Einstellungen</h1>
        <p>Profil &amp; Ziele, synchronisiert mit der App.</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Körperdaten</h3>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="field">
              <label htmlFor="p-weight">Gewicht (kg)</label>
              <input
                id="p-weight"
                type="number"
                step="0.1"
                value={profile.weight_kg}
                onChange={(e) => update('weight_kg', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-height">Grösse (cm)</label>
              <input
                id="p-height"
                type="number"
                value={profile.height_cm}
                onChange={(e) => update('height_cm', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-age">Alter (Jahre)</label>
              <input
                id="p-age"
                type="number"
                value={profile.age_years}
                onChange={(e) => update('age_years', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-sex">Geschlecht</label>
              <select
                id="p-sex"
                value={profile.sex}
                onChange={(e) => update('sex', e.target.value as UserProfileRow['sex'])}
              >
                {SEXES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h3 style={{ margin: '20px 0 14px' }}>Ziele</h3>
          <div className="form-row">
            <div className="field">
              <label htmlFor="p-kcal">Kalorienziel (kcal)</label>
              <input
                id="p-kcal"
                type="number"
                value={profile.daily_calorie_goal}
                onChange={(e) => update('daily_calorie_goal', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-protein">Protein (g)</label>
              <input
                id="p-protein"
                type="number"
                step="0.1"
                value={profile.protein_goal_g}
                onChange={(e) => update('protein_goal_g', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-carbs">Kohlenhydrate (g)</label>
              <input
                id="p-carbs"
                type="number"
                step="0.1"
                value={profile.carbs_goal_g}
                onChange={(e) => update('carbs_goal_g', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-fat">Fett (g)</label>
              <input
                id="p-fat"
                type="number"
                step="0.1"
                value={profile.fat_goal_g}
                onChange={(e) => update('fat_goal_g', Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="p-activity">Aktivitätsfaktor (PAL)</label>
              <input
                id="p-activity"
                type="number"
                step="0.05"
                value={profile.activity_factor}
                onChange={(e) => update('activity_factor', Number(e.target.value))}
              />
            </div>
          </div>

          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 16 }}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          {saved && <span style={{ marginLeft: 12, color: 'var(--accent)' }}>Gespeichert ✓</span>}
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
