import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  generateRecipe,
  generateFromIngredients,
  generateFillUp,
  generateRandomRecipe,
  analyzeFridgePhoto,
  fileToBase64Jpeg,
  GeneratedRecipe,
} from '../lib/groq'
import PhotoInput from '../components/PhotoInput'

type Mode = 'freitext' | 'zutaten' | 'fillup' | 'zufall'

const CALORIE_GOAL_KEY = 'nutrisnap_calorie_goal'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function RecipeGenerator() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('freitext')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null)
  const [saving, setSaving] = useState(false)

  // Freitext
  const [input, setInput] = useState('')

  // Zutaten
  const [chips, setChips] = useState<string[]>([])
  const [ingredientInput, setIngredientInput] = useState('')
  const [scanningFridge, setScanningFridge] = useState(false)

  // Fill Up
  const [calorieGoal, setCalorieGoal] = useState<number>(() => {
    const stored = localStorage.getItem(CALORIE_GOAL_KEY)
    return stored ? Number(stored) : 2000
  })
  const [eatenToday, setEatenToday] = useState(0)
  const [mealLabel, setMealLabel] = useState('Abendessen')

  useEffect(() => {
    localStorage.setItem(CALORIE_GOAL_KEY, String(calorieGoal))
  }, [calorieGoal])

  useEffect(() => {
    if (!session || mode !== 'fillup') return
    supabase
      .from('diary_entries')
      .select('calories')
      .eq('user_id', session.user.id)
      .eq('date_str', toDateStr(new Date()))
      .then(({ data }) => {
        const sum = (data ?? []).reduce((acc, e: { calories: number }) => acc + e.calories, 0)
        setEatenToday(sum)
      })
  }, [session, mode])

  const remainingCalories = Math.max(0, calorieGoal - eatenToday)
  // Ohne Profil-Ziele auf dem Web nehmen wir ausgewogene Richtwerte relativ zum Kalorienrest an.
  const remainingProtein = Math.round((remainingCalories * 0.3) / 4)
  const remainingCarbs = Math.round((remainingCalories * 0.4) / 4)
  const remainingFat = Math.round((remainingCalories * 0.3) / 9)

  function addChip() {
    const trimmed = ingredientInput.trim()
    if (!trimmed) return
    if (!chips.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setChips([...chips, trimmed])
    }
    setIngredientInput('')
  }

  function removeChip(chip: string) {
    setChips(chips.filter((c) => c !== chip))
  }

  async function handleFridgePhoto(file: File) {
    setScanningFridge(true)
    setError(null)
    try {
      const base64 = await fileToBase64Jpeg(file)
      const res = await analyzeFridgePhoto(base64)
      setChips((prev) => {
        const merged = [...prev]
        for (const ing of res.ingredients) {
          if (!merged.some((c) => c.toLowerCase() === ing.toLowerCase())) merged.push(ing)
        }
        return merged
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Foto konnte nicht analysiert werden')
    } finally {
      setScanningFridge(false)
    }
  }

  async function runGenerate(fn: () => Promise<GeneratedRecipe>) {
    setLoading(true)
    setError(null)
    setRecipe(null)
    try {
      const r = await fn()
      setRecipe(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rezept konnte nicht erstellt werden')
    } finally {
      setLoading(false)
    }
  }

  async function handleFreitextSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    await runGenerate(() => generateRecipe(input.trim()))
  }

  async function handleSave() {
    if (!session || !recipe) return
    setSaving(true)
    const { error } = await supabase.from('recipes').insert({
      user_id: session.user.id,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients.join('\n'),
      instructions: recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      total_calories: recipe.calories,
      protein_per_serving: recipe.protein,
      carbs_per_serving: recipe.carbs,
      fat_per_serving: recipe.fat,
      servings: recipe.servings,
      prep_time_minutes: recipe.prepTimeMinutes,
      platform: 'ki-koch-web',
      saved_at: Date.now(),
    })
    setSaving(false)
    if (error) setError(error.message)
    else navigate('/recipes')
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: 'freitext', label: 'Freitext' },
    { id: 'zutaten', label: 'Zutaten' },
    { id: 'fillup', label: 'Fill Up' },
    { id: 'zufall', label: 'Zufall' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>KI-Koch</h1>
        <p>Rezeptidee, vorhandene Zutaten oder dein Tages-Restbudget – die KI zaubert ein Rezept.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="btn"
              onClick={() => {
                setMode(t.id)
                setError(null)
              }}
              style={{
                background: mode === t.id ? 'var(--accent, #d97706)' : 'transparent',
                color: mode === t.id ? '#fff' : 'var(--ink)',
                border: '1px solid var(--line)',
                padding: '8px 14px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'freitext' && (
          <form onSubmit={handleFreitextSubmit}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="prompt">Was möchtest du kochen?</label>
              <textarea
                id="prompt"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
                placeholder="z.B. 'proteinreiches Hähnchen-Bowl mit Reis' oder eingefügter Rezept-Text"
                style={{
                  padding: '10px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--line)',
                  background: '#fffdfb',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            <button className="btn" type="submit" disabled={loading || !input.trim()}>
              {loading ? 'Generiere Rezept…' : 'Rezept generieren'}
            </button>
          </form>
        )}

        {mode === 'zutaten' && (
          <div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="ingredient">Was hast du zuhause?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="ingredient"
                  value={ingredientInput}
                  onChange={(e) => setIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addChip()
                    }
                  }}
                  placeholder="z.B. Eier"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn" onClick={addChip} disabled={!ingredientInput.trim()}>
                  +
                </button>
              </div>
            </div>

            <PhotoInput label="📷 Kühlschrank fotografieren" onFileSelected={handleFridgePhoto} busy={scanningFridge} />

            {chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0' }}>
                {chips.map((chip) => (
                  <span
                    key={chip}
                    onClick={() => removeChip(chip)}
                    style={{
                      cursor: 'pointer',
                      padding: '5px 10px',
                      borderRadius: 999,
                      background: 'var(--card-alt, #f4ede4)',
                      border: '1px solid var(--line)',
                      fontSize: 13,
                    }}
                    title="Entfernen"
                  >
                    {chip} ✕
                  </span>
                ))}
              </div>
            )}

            <button
              className="btn"
              style={{ marginTop: 8 }}
              disabled={loading || chips.length === 0}
              onClick={() => runGenerate(() => generateFromIngredients(chips))}
            >
              {loading ? 'Zaubere Rezept…' : 'Rezept aus Zutaten zaubern'}
            </button>
          </div>
        )}

        {mode === 'fillup' && (
          <div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="goal">Tagesziel (kcal)</label>
              <input
                id="goal"
                type="number"
                value={calorieGoal}
                onChange={(e) => setCalorieGoal(Number(e.target.value) || 0)}
              />
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
                Wird lokal in diesem Browser gespeichert (kein synchronisiertes Profil auf dem Web).
              </p>
            </div>

            <div className="stat-row" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <div className="label">Heute noch übrig</div>
                <div className="value">{remainingCalories} kcal</div>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="meal">Für welche Mahlzeit?</label>
              <select id="meal" value={mealLabel} onChange={(e) => setMealLabel(e.target.value)}>
                <option value="Mittagessen">Mittagessen</option>
                <option value="Abendessen">Abendessen</option>
                <option value="Snack">Snack</option>
              </select>
            </div>

            <button
              className="btn"
              disabled={loading || remainingCalories <= 0}
              onClick={() =>
                runGenerate(() => generateFillUp(remainingCalories, remainingProtein, remainingCarbs, remainingFat, mealLabel))
              }
            >
              {loading ? 'Fülle auf…' : 'Mit Restbudget auffüllen'}
            </button>
            {remainingCalories <= 0 && (
              <p className="error-text">Kein Kalorienbudget mehr übrig für heute.</p>
            )}
          </div>
        )}

        {mode === 'zufall' && (
          <div>
            <p style={{ color: 'var(--ink-muted)', marginBottom: 12 }}>
              Lass dich überraschen – ein zufälliges, alltagstaugliches Rezept.
            </p>
            <button className="btn" disabled={loading} onClick={() => runGenerate(() => generateRandomRecipe())}>
              {loading ? 'Würfle Rezept…' : 'Zufallsrezept'}
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>

      {recipe && (
        <div className="card">
          <h2>{recipe.title}</h2>
          {recipe.description && <p style={{ color: 'var(--ink-muted)' }}>{recipe.description}</p>}

          <div className="stat-row" style={{ marginTop: 16 }}>
            <div className="stat-card">
              <div className="label">Kalorien</div>
              <div className="value">{Math.round(recipe.calories)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Protein</div>
              <div className="value">{Math.round(recipe.protein)}g</div>
            </div>
            <div className="stat-card">
              <div className="label">Kohlenhydrate</div>
              <div className="value">{Math.round(recipe.carbs)}g</div>
            </div>
            <div className="stat-card">
              <div className="label">Fett</div>
              <div className="value">{Math.round(recipe.fat)}g</div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 12 }}>
            {recipe.servings} Portionen · {recipe.prepTimeMinutes} Min. Zubereitung
          </p>

          <h3 style={{ marginTop: 24 }}>Zutaten</h3>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>

          <h3 style={{ marginTop: 20 }}>Zubereitung</h3>
          <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>

          <button className="btn" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
            {saving ? 'Speichert…' : 'Rezept speichern'}
          </button>
        </div>
      )}
    </div>
  )
}
