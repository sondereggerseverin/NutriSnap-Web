import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { analyzeNutritionLabel, fileToBase64Jpeg, NutritionLabelResult } from '../lib/groq'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../lib/types'
import PhotoInput from '../components/PhotoInput'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function LabelScan() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NutritionLabelResult | null>(null)
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('100')
  const [mealType, setMealType] = useState<MealType>('LUNCH')
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const base64 = await fileToBase64Jpeg(file)
      const res = await analyzeNutritionLabel(base64)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const factor = (Number(grams) || 0) / 100
  const scaled = result
    ? {
        calories: result.caloriesPer100g * factor,
        protein: result.proteinPer100g * factor,
        carbs: result.carbsPer100g * factor,
        fat: result.fatPer100g * factor,
      }
    : null

  async function handleSave() {
    if (!session || !result || !name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('diary_entries').insert({
      user_id: session.user.id,
      food_name: name.trim(),
      amount_grams: Number(grams) || 0,
      meal_type: mealType,
      date_str: toDateStr(new Date()),
      calories: scaled!.calories,
      protein: scaled!.protein,
      carbs: scaled!.carbs,
      fat: scaled!.fat,
    })
    setSaving(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div>
      <div className="page-header">
        <h1>Nährwerttabelle scannen</h1>
        <p>Foto der Tabelle – Werte pro 100g werden automatisch erkannt.</p>
      </div>

      <div className="card">
        <PhotoInput label="Foto aufnehmen / hochladen" onFileSelected={handleFile} busy={busy} />
        {error && <p className="error-text">{error}</p>}
      </div>

      {result && scaled && (
        <div className="card">
          <p style={{ color: 'var(--ink-muted)', marginBottom: 16, fontSize: 13.5 }}>
            Ein gespeichertes Produkt-Verzeichnis gibt es auf dem Web bisher nicht – die Werte werden direkt
            als Tagebuch-Eintrag für heute übernommen.
          </p>

          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="field" style={{ minWidth: 200 }}>
              <label htmlFor="name">Produktname</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="grams">Verzehrte Menge (g)</label>
              <input id="grams" type="number" value={grams} onChange={(e) => setGrams(e.target.value)} />
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

          <button className="btn" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Speichert…' : 'Zum Tagebuch hinzufügen'}
          </button>
        </div>
      )}
    </div>
  )
}
