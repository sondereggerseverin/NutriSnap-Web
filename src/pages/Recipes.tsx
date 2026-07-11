import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType, RecipeRow } from '../lib/types'
import { addRecipeToDiary } from '../lib/diary'
import { addRecipeIngredients } from '../lib/shoppingList'
import { importRecipesFromUrls, BatchImportItem } from '../lib/recipeImport'
import CookingMode from '../components/CookingMode'
import {
  RecipeCollection,
  assignToCollection,
  createCollection,
  deleteCollection,
  getAssignments,
  getCollections,
} from '../lib/recipeCollections'

const COLLECTION_EMOJIS = ['📁', '🍕', '🥗', '🍰', '🥩', '🍜', '🥤', '🌮', '🍱', '⭐']
const FAVORITES_FILTER = '__favorites__'

export default function Recipes() {
  const { session } = useAuth()
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openRecipe, setOpenRecipe] = useState<RecipeRow | null>(null)
  const [showImport, setShowImport] = useState(false)

  const [collections, setCollections] = useState<RecipeCollection[]>([])
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState(COLLECTION_EMOJIS[0])

  function refreshCollections() {
    setCollections(getCollections())
    setAssignments(getAssignments())
  }

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
    refreshCollections()
  }, [load])

  async function toggleFavorite(recipe: RecipeRow) {
    const { error } = await supabase.from('recipes').update({ is_favorite: !recipe.is_favorite }).eq('id', recipe.id)
    if (!error) {
      setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: !r.is_favorite } : r)))
      if (openRecipe?.id === recipe.id) setOpenRecipe({ ...openRecipe, is_favorite: !openRecipe.is_favorite })
    }
  }

  function handleCreateCollection() {
    if (!newName.trim()) return
    createCollection(newName, newEmoji)
    setNewName('')
    setShowNewCollection(false)
    refreshCollections()
  }

  function handleDeleteCollection(id: string) {
    deleteCollection(id)
    if (activeFilter === id) setActiveFilter(null)
    refreshCollections()
  }

  const visibleRecipes = useMemo(() => {
    if (activeFilter === FAVORITES_FILTER) return recipes.filter((r) => r.is_favorite)
    if (activeFilter) return recipes.filter((r) => assignments[r.id] === activeFilter)
    return recipes
  }, [recipes, activeFilter, assignments])

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

      {!openRecipe && (
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button
              className={activeFilter === null ? 'btn' : 'btn-ghost btn'}
              type="button"
              onClick={() => setActiveFilter(null)}
            >
              Alle
            </button>
            <button
              className={activeFilter === FAVORITES_FILTER ? 'btn' : 'btn-ghost btn'}
              type="button"
              onClick={() => setActiveFilter(FAVORITES_FILTER)}
            >
              ❤️ Favoriten
            </button>
            {collections.map((c) => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button
                  className={activeFilter === c.id ? 'btn' : 'btn-ghost btn'}
                  type="button"
                  onClick={() => setActiveFilter(c.id)}
                >
                  {c.emoji} {c.name}
                </button>
                <button
                  className="delete-btn"
                  type="button"
                  title="Sammlung löschen"
                  onClick={() => handleDeleteCollection(c.id)}
                >
                  ✕
                </button>
              </span>
            ))}
            <button className="btn-ghost btn" type="button" onClick={() => setShowNewCollection((s) => !s)}>
              + Neue Sammlung
            </button>
          </div>

          {showNewCollection && (
            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="col-name">Name</label>
                <input id="col-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z.B. Meal Prep" />
              </div>
              <div className="field">
                <label>Emoji</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220 }}>
                  {COLLECTION_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={e === newEmoji ? 'btn' : 'btn-ghost btn'}
                      style={{ padding: '4px 8px' }}
                      onClick={() => setNewEmoji(e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn" type="button" disabled={!newName.trim()} onClick={handleCreateCollection}>
                Erstellen
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="empty-state">Lädt…</p>
      ) : recipes.length === 0 ? (
        <div className="card">
          <p className="empty-state">Noch keine Rezepte gespeichert.</p>
        </div>
      ) : openRecipe ? (
        <RecipeDetail
          recipe={openRecipe}
          onBack={() => setOpenRecipe(null)}
          userId={session?.user.id}
          onToggleFavorite={() => toggleFavorite(openRecipe)}
          collections={collections}
          assignedCollectionId={assignments[openRecipe.id] ?? null}
          onAssignCollection={(cid) => {
            assignToCollection(openRecipe.id, cid)
            refreshCollections()
          }}
          onRecipeUpdated={(updated) => {
            setRecipes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            setOpenRecipe(updated)
          }}
        />
      ) : visibleRecipes.length === 0 ? (
        <div className="card">
          <p className="empty-state">Keine Rezepte in dieser Ansicht.</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {visibleRecipes.map((r) => (
            <div className="recipe-card" key={r.id} onClick={() => setOpenRecipe(r)} style={{ cursor: 'pointer', position: 'relative' }}>
              <button
                type="button"
                title={r.is_favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(r)
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.85)',
                  border: 'none',
                  borderRadius: 999,
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  fontSize: 15,
                }}
              >
                {r.is_favorite ? '❤️' : '🤍'}
              </button>
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
  onToggleFavorite,
  collections,
  assignedCollectionId,
  onAssignCollection,
  onRecipeUpdated,
}: {
  recipe: RecipeRow
  onBack: () => void
  userId: string | undefined
  onToggleFavorite: () => void
  collections: RecipeCollection[]
  assignedCollectionId: string | null
  onAssignCollection: (collectionId: string | null) => void
  onRecipeUpdated: (recipe: RecipeRow) => void
}) {
  const [servings, setServings] = useState(1)
  const [mealType, setMealType] = useState<MealType>('LUNCH')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addedToShoppingList, setAddedToShoppingList] = useState(false)
  const [cookingMode, setCookingMode] = useState(false)
  const [editing, setEditing] = useState(false)

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

  if (editing) {
    return (
      <RecipeEditForm
        recipe={recipe}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          onRecipeUpdated(updated)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="card">
      {cookingMode && <CookingMode recipe={recipe} onClose={() => setCookingMode(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn-ghost btn" onClick={onBack}>
          ‹ Zurück zur Übersicht
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost btn" type="button" onClick={onToggleFavorite}>
            {recipe.is_favorite ? '❤️ Favorit' : '🤍 Favorisieren'}
          </button>
          <button className="btn-ghost btn" type="button" onClick={() => setEditing(true)}>
            ✏️ Bearbeiten
          </button>
          <button className="btn" type="button" onClick={() => setCookingMode(true)}>
            👨‍🍳 Kochmodus
          </button>
        </div>
      </div>

      <h2>{recipe.title}</h2>
      {recipe.description && <p style={{ color: 'var(--ink-muted)' }}>{recipe.description}</p>}

      <div className="field" style={{ maxWidth: 280, marginTop: 12 }}>
        <label htmlFor="rd-collection">Sammlung</label>
        <select
          id="rd-collection"
          value={assignedCollectionId ?? ''}
          onChange={(e) => onAssignCollection(e.target.value || null)}
        >
          <option value="">Keine Sammlung</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

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

/** Bearbeiten-Formular für gespeicherte Rezepte — erlaubt das Korrigieren von Zutaten,
 *  Zubereitung und Nährwerten nach der KI-Generierung. Spiegelt RecipeEditSheet.kt auf
 *  Android (Titel/Beschreibung/Zutaten/Zubereitung/Portionen/Zeit), ergänzt um die
 *  Makro-Felder, da diese auf Android separat über den Zutaten-Verifikations-Flow
 *  (lokale FoodItem-Datenbank, auf Web nicht vorhanden) korrigiert werden. */
function RecipeEditForm({
  recipe,
  onCancel,
  onSaved,
}: {
  recipe: RecipeRow
  onCancel: () => void
  onSaved: (recipe: RecipeRow) => void
}) {
  const [title, setTitle] = useState(recipe.title)
  const [description, setDescription] = useState(recipe.description ?? '')
  const [ingredients, setIngredients] = useState(recipe.ingredients ?? '')
  const [instructions, setInstructions] = useState(recipe.instructions ?? '')
  const [servings, setServings] = useState(recipe.servings ?? 1)
  const [prepTime, setPrepTime] = useState(recipe.prep_time_minutes ?? 0)
  const [calories, setCalories] = useState(recipe.total_calories ?? 0)
  const [protein, setProtein] = useState(recipe.protein_per_serving ?? 0)
  const [carbs, setCarbs] = useState(recipe.carbs_per_serving ?? 0)
  const [fat, setFat] = useState(recipe.fat_per_serving ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const patch = {
      title: title.trim(),
      description,
      ingredients,
      instructions,
      servings,
      prep_time_minutes: prepTime || null,
      total_calories: calories || null,
      protein_per_serving: protein || null,
      carbs_per_serving: carbs || null,
      fat_per_serving: fat || null,
    }
    const { data, error } = await supabase.from('recipes').update(patch).eq('id', recipe.id).select().single()
    setSaving(false)
    if (error) setError(error.message)
    else onSaved(data as RecipeRow)
  }

  return (
    <div className="card">
      <button className="btn-ghost btn" style={{ marginBottom: 16 }} onClick={onCancel}>
        ‹ Abbrechen
      </button>
      <h2>Rezept bearbeiten</h2>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="edit-title">Titel</label>
        <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="edit-desc">Beschreibung</label>
        <input id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="edit-servings">Portionen</label>
          <input
            id="edit-servings"
            type="number"
            min="1"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 1)}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-prep">Zubereitungszeit (min)</label>
          <input
            id="edit-prep"
            type="number"
            min="0"
            value={prepTime}
            onChange={(e) => setPrepTime(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <h3 style={{ marginTop: 20 }}>Nährwerte gesamt</h3>
      <p style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Falls die KI-Schätzung nicht stimmt, hier korrigieren.</p>
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 8 }}>
        <div className="field">
          <label htmlFor="edit-kcal">Kalorien</label>
          <input id="edit-kcal" type="number" min="0" value={calories} onChange={(e) => setCalories(Number(e.target.value) || 0)} />
        </div>
        <div className="field">
          <label htmlFor="edit-protein">Protein (g)</label>
          <input id="edit-protein" type="number" min="0" value={protein} onChange={(e) => setProtein(Number(e.target.value) || 0)} />
        </div>
        <div className="field">
          <label htmlFor="edit-carbs">Kohlenhydrate (g)</label>
          <input id="edit-carbs" type="number" min="0" value={carbs} onChange={(e) => setCarbs(Number(e.target.value) || 0)} />
        </div>
        <div className="field">
          <label htmlFor="edit-fat">Fett (g)</label>
          <input id="edit-fat" type="number" min="0" value={fat} onChange={(e) => setFat(Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="edit-ingredients">Zutaten (eine pro Zeile)</label>
        <textarea
          id="edit-ingredients"
          rows={8}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 14.5, padding: 9, borderRadius: 9, border: '1px solid var(--line)' }}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="edit-instructions">Zubereitung</label>
        <textarea
          id="edit-instructions"
          rows={10}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 14.5, padding: 9, borderRadius: 9, border: '1px solid var(--line)' }}
        />
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn" style={{ marginTop: 16 }} disabled={saving || !title.trim()} onClick={handleSave}>
        {saving ? 'Speichert…' : 'Speichern'}
      </button>
    </div>
  )
}
