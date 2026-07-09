import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType, RecipeRow } from '../lib/types'
import { addRecipeToDiary } from '../lib/diary'

export default function Recipes() {
  const { session } = useAuth()
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRecipe, setOpenRecipe] = useState<RecipeRow | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('saved_at', { ascending: false })
    if (error) setError(error.message)
    else setRecipes(data as RecipeRow[])
    setLoading(false)
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="page-header">
        <h1>Rezepte</h1>
        <p>Alle in der App gespeicherten Rezepte.</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="empty-state">Lädt…</p>
      ) : recipes.length === 0 ? (
        <div className="card">
          <p className="empty-state">Noch keine Rezepte gespeichert.</p>
        </div>
      ) : openRecipe ? (
        <RecipeDetail recipe={openRecipe} onBack={() => setOpenRecipe(null)} userId={session?.user.id} />
      ) : (
        <div className="recipe-grid">
          {recipes.map((r) => (
            <div className="recipe-card" key={r.id} onClick={() => setOpenRecipe(r)} style={{ cursor: 'pointer' }}>
              {r.image_url && <img src={r.image_url} alt={r.title} />}
              <div className="recipe-card-body">
                <h3>{r.title}</h3>
                <div className="recipe-meta">
                  {r.total_calories ? `${Math.round(r.total_calories)} kcal` : ''}
                  {r.prep_time_minutes ? ` · ${r.prep_time_minutes} min` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecipeDetail({
  recipe,
  onBack,
  userId,
}: {
  recipe: RecipeRow
  onBack: () => void
  userId: string | undefined
}) {
  const [servings, setServings] = useState(1)
  const [mealType, setMealType] = useState<MealType>('LUNCH')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAddToDiary() {
    if (!userId) return
    setAdding(true)
    setAdded(false)
    setAddError(null)
    const { error } = await addRecipeToDiary({
      userId,
      title: recipe.title,
      calories: (recipe.total_calories ?? 0) * servings,
      protein: (recipe.protein_per_serving ?? 0) * servings,
      carbs: (recipe.carbs_per_serving ?? 0) * servings,
      fat: (recipe.fat_per_serving ?? 0) * servings,
      mealType,
    })
    setAdding(false)
    if (error) setAddError(error.message)
    else setAdded(true)
  }

  return (
    <div className="card">
      <button className="btn-ghost btn" style={{ marginBottom: 16 }} onClick={onBack}>
        ‹ Zurück zur Übersicht
      </button>
      <h2>{recipe.title}</h2>
      {recipe.description && <p style={{ color: 'var(--ink-muted)' }}>{recipe.description}</p>}

      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 16 }}>
        <div className="stat-card">
          <div className="label">Kalorien</div>
          <div className="value">{recipe.total_calories ? Math.round(recipe.total_calories) : '–'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Protein</div>
          <div className="value">{recipe.protein_per_serving ? Math.round(recipe.protein_per_serving) : '–'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Kohlenhydrate</div>
          <div className="value">{recipe.carbs_per_serving ? Math.round(recipe.carbs_per_serving) : '–'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Fett</div>
          <div className="value">{recipe.fat_per_serving ? Math.round(recipe.fat_per_serving) : '–'}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, background: 'var(--bg-elevated)' }}>
        <h3 style={{ marginBottom: 14 }}>Zum Tagebuch hinzufügen</h3>
        <div className="form-row">
          <div className="field">
            <label htmlFor="rd-servings">Portionen</label>
            <input
              id="rd-servings"
              type="number"
              step="0.5"
              min="0.5"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label htmlFor="rd-meal">Mahlzeit</label>
            <select id="rd-meal" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {MEAL_TYPE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="button" onClick={handleAddToDiary} disabled={adding || !userId}>
            {adding ? 'Fügt hinzu…' : 'Hinzufügen'}
          </button>
        </div>
        {added && <span style={{ color: 'var(--accent)' }}>Zum Tagebuch hinzugefügt ✓</span>}
        {addError && <p className="error-text">{addError}</p>}
      </div>

      {recipe.ingredients && (
        <>
          <h3 style={{ marginTop: 24 }}>Zutaten</h3>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.6 }}>{recipe.ingredients}</div>
        </>
      )}

      {recipe.instructions && (
        <>
          <h3 style={{ marginTop: 24 }}>Zubereitung</h3>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.6 }}>{recipe.instructions}</div>
        </>
      )}

      {recipe.source_url && (
        <p style={{ marginTop: 20 }}>
          <a href={recipe.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            Originalquelle öffnen ↗
          </a>
        </p>
      )}
    </div>
  )
}
