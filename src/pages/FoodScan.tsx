import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { analyzeFoodPhoto, fileToBase64Jpeg, FoodScanResult } from '../lib/groq'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../lib/types'
import PhotoInput from '../components/PhotoInput'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function FoodScan() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FoodScanResult | null>(null)
  const [gramsText, setGramsText] = useState('')
  const [mealType, setMealType] = useState<MealType>('LUNCH')
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const base64 = await fileToBase64Jpeg(file)
      const res = await analyzeFoodPhoto(base64)
      setResult(res)
      setGramsText(String(Math.round(res.estimatedGrams)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!session || !result) return
    const originalGrams = result.estimatedGrams || 1
    const factor = (Number(gramsText) || originalGrams) / originalGrams
    setSaving(true)
    const { error } = await supabase.from('diary_entries').insert({
      user_id: session.user.id,
      food_name: result.foodName || 'Gescanntes Essen',
      amount_grams: Number(gramsText) || result.estimatedGrams,
      meal_type: mealType,
      date_str: toDateStr(new Date()),
      calories: result.calories * factor,
      protein: result.protein * factor,
      carbs: result.carbs * factor,
      fat: result.fat * factor,
    })
    setSaving(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  const originalGrams = result?.estimatedGrams || 1
  const factor = (Number(gramsText) || originalGrams) / originalGrams
  const scaled = result
    ? {
        calories: result.calories * factor,
        protein: result.protein * factor,
        carbs: result.carbs * factor,
        fat: result.fat * factor,
      }
    : null

  return (
    <div>
      <div className="page-header">
        <h1>Essen scannen</h1>
        <p>Foto vom Teller – die KI schätzt Kalorien &amp; Makros.</p>
      </div>

      <div className="card">
        <PhotoInput label="Foto aufnehmen / hochladen" onFileSelected={handleFile} busy={busy} />
        {error && <p className="error-text">{error}</p>}
      </div>

      {result && scaled && (
        <div className="card">
          <h2>{result.foodName}</h2>
          <p style={{ color: 'var(--ink-muted)', marginBottom: 16 }}>
            Sicherheit der Schätzung: {result.confidence}
          </p>

          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="grams">Geschätzte Menge (g)</label>
              <input id="grams" type="number" value={gramsText} onChange={(e) => setGramsText(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="meal">Mahlzeit</label>
              <select id="meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_TYPE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-card">
              <div className="label">Kalorien</div>
              <div className="value">{Math.round(scaled.calories)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Protein</div>
              <div className="value">{Math.round(scaled.protein)}g</div>
            </div>
            <div className="stat-card">
              <div className="label">Kohlenhydrate</div>
              <div className="value">{Math.round(scaled.carbs)}g</div>
            </div>
            <div className="stat-card">
              <div className="label">Fett</div>
              <div className="value">{Math.round(scaled.fat)}g</div>
            </div>
          </div>

          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichert…' : 'Zum Tagebuch hinzufügen'}
          </button>
        </div>
      )}
    </div>
  )
}
