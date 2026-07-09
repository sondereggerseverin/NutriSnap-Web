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
import { addRecipeToDiary } from '../lib/diary'
import { addRecipeIngredients } from '../lib/shoppingList'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType, UserProfileRow } from '../lib/types'

type Mode = 'freitext' | 'zutaten' | 'fillup' | 'zufall'

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
  const [resultMealType, setResultMealType] = useState<MealType>('LUNCH')
  const [addingToDiary, setAddingToDiary] = useState(false)
  const [addedToDiary, setAddedToDiary] = useState(false)
  const [addedToShoppingList, setAddedToShoppingList] = useState(false)

  // Freitext
  const [input, setInput] = useState('')

  // Zutaten
  const [chips, setChips] = useState<string[]>([])
  const [ingredientInput, setIngredientInput] = useState('')
  const [scanningFridge, setScanningFridge] = useState(false)

  // Fill Up — Ziele kommen aus dem synchronisierten user_profiles (wie in der App),
  // statt aus einem lokalen, unsynchronisierten Browser-Wert.
  const [profile, setProfile] = useState<UserProfileRow | null>(null)
  const [eatenToday, setEatenToday] = useState({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const [mealLabel, setMealLabel] = useState<MealType>('DINNER')

  useEffect(() => {
    if (!session || mode !== 'fillup') return
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as UserProfileRow | null))
    supabase
      .from('diary_entries')
      .select('calories, protein, carbs, fat')
      .eq('user_id', session.user.id)
      .eq('date_str', toDateStr(new Date()))
      .then(({ data }) => {
        const rows = (data ?? []) as { calories: number; protein: number; carbs: number; fat: number }[]
        setEatenToday(
          rows.reduce(
            (acc, e) => ({
              kcal: acc.kcal + e.calories,
              protein: acc.protein + e.protein,
              carbs: acc.carbs + e.carbs,
              fat: acc.fat + e.fat,
            }),
            { kcal: 0, protein: 0, carbs: 0, fat: 0 }
          )
        )
      })
  }, [session, mode])

  const calorieGoal = profile?.daily_calorie_goal ?? 2000
  const remainingCalories = Math.max(0, calorieGoal - eatenToday.kcal)
  const remainingProtein = profile
    ? Math.max(0, Math.round(profile.protein_goal_g - eatenToday.protein))
    : Math.round((remainingCalories * 0.3) / 4)
  const remainingCarbs = profile
    ? Math.max(0, Math.round(profile.carbs_goal_g - eatenToday.carbs))
    : Math.round((remainingCalories * 0.4) / 4)
  const remainingFat = profile
    ? Math.max(0, Math.round(profile.fat_goal_g - eatenToday.fat))
    : Math.round((remainingCalories * 0.3) / 9)

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
    setAddedToDiary(false)
    setAddedToShoppingList(false)
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

  async function handleAddResultToDiary() {
    if (!session || !recipe) return
    setAddingToDiary(true)
    setAddedToDiary(false)
    const { error } = await addRecipeToDiary({
      userId: session.user.id,
      title: recipe.title,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      mealType: resultMealType,
    })
    setAddingToDiary(false)
    if (error) setError(error.message)
    else setAddedToDiary(true)
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
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 12 }}>
              Tagesziel ({calorieGoal} kcal) kommt aus deinem synchronisierten Profil.{' '}
              {!profile && <a href="/settings">Jetzt in den Einstellungen festlegen</a>}
            </p>

            <div className="stat-row" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <div className="label">Heute noch übrig</div>
                <div className="value">{remainingCalories} kcal</div>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="meal">Für welche Mahlzeit?</label>
              <select id="meal" value={mealLabel} onChange={(e) => setMealLabel(e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_TYPE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn"
              disabled={loading || remainingCalories <= 0}
              onClick={() =>
                runGenerate(() =>
                  generateFillUp(remainingCalories, remainingProtein, remainingCarbs, remainingFat, MEAL_TYPE_LABELS[mealLabel])
                )
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

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24 }}>
            <h3>Zutaten</h3>
            <button
              className="btn-ghost btn"
              type="button"
              onClick={() => {
                addRecipeIngredients(recipe.title, recipe.ingredients)
                setAddedToShoppingList(true)
              }}
            >
              🛒 Zur Einkaufsliste
            </button>
          </div>
          {addedToShoppingList && <span style={{ color: 'var(--accent)' }}>Zur Einkaufsliste hinzugefügt ✓</span>}
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

          <div className="form-row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Speichert…' : 'Rezept speichern'}
            </button>
            <div className="field">
              <label htmlFor="result-meal">Mahlzeit</label>
              <select
                id="result-meal"
                value={resultMealType}
                onChange={(e) => setResultMealType(e.target.value as MealType)}
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_TYPE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-ghost btn" onClick={handleAddResultToDiary} disabled={addingToDiary || !session}>
              {addingToDiary ? 'Fügt hinzu…' : 'Zum Tagebuch hinzufügen'}
            </button>
          </div>
          {addedToDiary && (
            <span style={{ color: 'var(--accent)', display: 'inline-block', marginTop: 8 }}>
              Zum Tagebuch hinzugefügt ✓
            </span>
          )}
        </div>
      )}
    </div>
  )
}
