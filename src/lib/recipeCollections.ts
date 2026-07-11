const COLLECTIONS_KEY = 'nutrisnap_recipe_collections'
const ASSIGNMENTS_KEY = 'nutrisnap_recipe_collection_assignments'

export interface RecipeCollection {
  id: string
  name: string
  emoji: string
  createdAt: number
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCollections(): RecipeCollection[] {
  return read<RecipeCollection[]>(COLLECTIONS_KEY, []).sort((a, b) => a.name.localeCompare(b.name))
}

export function createCollection(name: string, emoji: string): RecipeCollection {
  const collections = read<RecipeCollection[]>(COLLECTIONS_KEY, [])
  const collection: RecipeCollection = { id: crypto.randomUUID(), name: name.trim(), emoji, createdAt: Date.now() }
  collections.push(collection)
  write(COLLECTIONS_KEY, collections)
  return collection
}

export function deleteCollection(id: string) {
  write(
    COLLECTIONS_KEY,
    read<RecipeCollection[]>(COLLECTIONS_KEY, []).filter((c) => c.id !== id)
  )
  // Zuordnungen der geloeschten Sammlung ebenfalls entfernen
  const assignments = read<Record<number, string>>(ASSIGNMENTS_KEY, {})
  for (const recipeId of Object.keys(assignments)) {
    if (assignments[Number(recipeId)] === id) delete assignments[Number(recipeId)]
  }
  write(ASSIGNMENTS_KEY, assignments)
}

/** recipeId -> collectionId (undefined = keiner Sammlung zugeordnet) */
export function getAssignments(): Record<number, string> {
  return read<Record<number, string>>(ASSIGNMENTS_KEY, {})
}

export function assignToCollection(recipeId: number, collectionId: string | null) {
  const assignments = read<Record<number, string>>(ASSIGNMENTS_KEY, {})
  if (collectionId) assignments[recipeId] = collectionId
  else delete assignments[recipeId]
  write(ASSIGNMENTS_KEY, assignments)
}
