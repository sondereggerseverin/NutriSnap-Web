const STORAGE_KEY = 'nutrisnap_shopping_list'

export interface ShoppingListItem {
  id: string
  name: string
  amount?: string
  checked: boolean
  recipeTitle?: string
  createdAt: number
}

function read(): ShoppingListItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ShoppingListItem[]) : []
  } catch {
    return []
  }
}

function write(items: ShoppingListItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function getShoppingList(): ShoppingListItem[] {
  return read().sort((a, b) => Number(a.checked) - Number(b.checked) || b.createdAt - a.createdAt)
}

export function addShoppingItem(name: string, amount?: string, recipeTitle?: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const items = read()
  items.push({
    id: crypto.randomUUID(),
    name: trimmed,
    amount: amount?.trim() || undefined,
    checked: false,
    recipeTitle,
    createdAt: Date.now(),
  })
  write(items)
}

/** Zerlegt Rezept-Zutatenzeilen ("500 g Magerquark") in Name + Mengenangabe. */
export function addRecipeIngredients(recipeTitle: string, ingredientLines: string[]) {
  const items = read()
  const now = Date.now()
  for (const line of ingredientLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^([\d.,]+\s*[a-zA-ZäöüÄÖÜ]*)\s+(.+)$/)
    items.push({
      id: crypto.randomUUID(),
      name: match ? match[2] : trimmed,
      amount: match ? match[1] : undefined,
      checked: false,
      recipeTitle,
      createdAt: now,
    })
  }
  write(items)
}

export function toggleShoppingItem(id: string) {
  write(read().map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)))
}

export function deleteShoppingItem(id: string) {
  write(read().filter((i) => i.id !== id))
}

export function clearCheckedShoppingItems() {
  write(read().filter((i) => !i.checked))
}

export function clearAllShoppingItems() {
  write([])
}
