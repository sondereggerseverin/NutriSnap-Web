import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RecipeRow } from '../lib/types'

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
        <RecipeDetail recipe={openRecipe} onBack={() => setOpenRecipe(null)} />
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

function RecipeDetail({ recipe, onBack }: { recipe: RecipeRow; onBack: () => void }) {
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
