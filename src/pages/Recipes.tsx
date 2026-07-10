import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType, RecipeRow } from '../lib/types'
import { addRecipeToDiary } from '../lib/diary'
import { addRecipeIngredients } from '../lib/shoppingList'
import { importRecipesFromUrls, BatchImportItem } from '../lib/recipeImport'

export default function Recipes() {
  const { session } = useAuth()
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRecipe, setOpenRecipe] = useState<RecipeRow | null>(null)
  const [showImport, setShowImport] = useState(false)

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
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>Rezepte</h1>
          <p>Alle in der App gespeicherten Rezepte.</p>
        </div>
        <button className="btn-ghost btn" type="button" onClick={() => setShowImport((v) => !v)}>
          {showImport ? '✕ Schliessen' : '🔗 Von Link importieren'}
        </button>
      </div>

      {showImport && session && (
        <LinkImportPanel userId={session.user.id} onImported={load} onClose={() => setShowImport(false)} />
      )}

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

function LinkImportPanel({
  userId,
  onImported,
  onClose,
}: {
  userId: string
  onImported: () => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [items, setItems] = useState<BatchImportItem[]>([])
  const [running, setRunning] = useState(false)

  const urls = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http://') || l.startsWith('https://'))

  async function handleImport() {
    if (urls.length === 0 || running) return
    setRunning(true)
    await importRecipesFromUrls(urls, userId, setItems)
    setRunning(false)
    onImported()
  }

  const allDone = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error')

  const statusIcon: Record<BatchImportItem['status'], string> = {
    pending: '⏳',
    running: '🔄',
    done: '✅',
    error: '⚠️',
  }

  return (
    <div className="card" style={{ marginBottom: 20, background: 'var(--bg-elevated)' }}>
      <h3 style={{ marginBottom: 6 }}>Rezept(e) von Link importieren</h3>
      <p style={{ color: 'var(--ink-muted)', fontSize: 14, marginBottom: 12 }}>
        Ein Link pro Zeile — funktioniert mit Rezept-Webseiten, Instagram- und TikTok-Posts. Der Inhalt wird abgerufen
        und per KI zu einem Rezept extrahiert und direkt gespeichert.
      </p>
      <textarea
        rows={4}
        placeholder={'https://example.com/rezept\nhttps://www.instagram.com/p/...'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button className="btn" type="button" onClick={handleImport} disabled={running || urls.length === 0}>
          {running ? 'Importiert…' : urls.length > 1 ? `${urls.length} Links importieren` : 'Importieren'}
        </button>
        {allDone && (
          <button className="btn-ghost btn" type="button" onClick={onClose}>
            Fertig
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => (
            <div key={item.url} style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span>{statusIcon[item.status]}</span>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.url}
                </div>
                {item.status === 'done' && item.resultTitle && <div>Gespeichert: {item.resultTitle}</div>}
                {item.status === 'error' && <div className="error-text">{item.error}</div>}
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
  const [addedToShoppingList, setAddedToShoppingList] = useState(false)

  function handleAddToShoppingList() {
    if (!recipe.ingredients) return
    addRecipeIngredients(recipe.title, recipe.ingredients.split('\n'))
    setAddedToShoppingList(true)
  }

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
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24 }}>
            <h3>Zutaten</h3>
            <button className="btn-ghost btn" type="button" onClick={handleAddToShoppingList}>
              🛒 Zur Einkaufsliste
            </button>
          </div>
          {addedToShoppingList && <span style={{ color: 'var(--accent)' }}>Zur Einkaufsliste hinzugefügt ✓</span>}
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
