import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { generateRecipe, GeneratedRecipe } from '../lib/groq'

export default function RecipeGenerator() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setRecipe(null)
    try {
      const r = await generateRecipe(input.trim())
      setRecipe(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rezept konnte nicht erstellt werden')
    } finally {
      setLoading(false)
    }
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

  return (
    <div>
      <div className="page-header">
        <h1>KI-Koch</h1>
        <p>Rezeptidee, Zutaten oder einen kopierten Insta/TikTok-Text eingeben.</p>
      </div>

      <div className="card">
        <form onSubmit={handleGenerate}>
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
