import { supabase } from './supabase'
import { parseRecipeFromScrapedContent, GeneratedRecipe } from './groq'

export type BatchStatus = 'pending' | 'running' | 'done' | 'error'

export interface BatchImportItem {
  url: string
  status: BatchStatus
  resultTitle?: string
  error?: string
}

export function detectPlatform(url: string): string {
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  return 'web'
}

/**
 * Ruft den lesbaren Inhalt einer Seite ab. Da die Web-App keinen eigenen Server hat
 * (Android scraped direkt via OkHttp), läuft dies über r.jina.ai — einen kostenlosen,
 * CORS-freundlichen "Reader"-Proxy, der auch JS-gerenderte Seiten (z.B. Instagram) lädt
 * und als lesbaren Text/Markdown zurückgibt.
 */
async function fetchReadableContent(url: string): Promise<string> {
  const readerUrl = `https://r.jina.ai/${url}`
  const res = await fetch(readerUrl, { headers: { Accept: 'text/plain' } })
  if (!res.ok) throw new Error(`Seite konnte nicht geladen werden (HTTP ${res.status})`)
  const text = await res.text()
  if (!text || text.trim().length < 20) throw new Error('Kein Inhalt gefunden — Seite evtl. blockiert oder leer.')
  return text
}

function extractFirstImage(markdown: string): string | null {
  const match = markdown.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/)
  return match ? match[1] : null
}

export interface ImportResult {
  success: boolean
  title?: string
  error?: string
}

/** Importiert ein einzelnes Rezept per Link und speichert es direkt in Supabase (analog Android). */
export async function importRecipeFromUrl(url: string, userId: string): Promise<ImportResult> {
  const trimmed = url.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { success: false, error: 'Keine gültige URL.' }
  }
  const platform = detectPlatform(trimmed)

  let content: string
  try {
    content = await fetchReadableContent(trimmed)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Fehler beim Abrufen der Seite.' }
  }

  let recipe: GeneratedRecipe
  try {
    recipe = await parseRecipeFromScrapedContent(content, trimmed, platform)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Fehler bei der KI-Auswertung.' }
  }

  const imageUrl = extractFirstImage(content)

  const { error } = await supabase.from('recipes').insert({
    user_id: userId,
    title: recipe.title,
    description: recipe.description,
    image_url: imageUrl,
    source_url: trimmed,
    platform,
    ingredients: (recipe.ingredients ?? []).join('\n'),
    instructions: (recipe.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
    total_calories: recipe.calories,
    protein_per_serving: recipe.protein,
    carbs_per_serving: recipe.carbs,
    fat_per_serving: recipe.fat,
    servings: recipe.servings,
    prep_time_minutes: recipe.prepTimeMinutes,
    saved_at: Date.now(),
  })

  if (error) return { success: false, error: error.message }
  return { success: true, title: recipe.title }
}

/**
 * Importiert mehrere Links sequenziell (schont den Reader-Proxy und Groq-Rate-Limits),
 * analog zu runBatchImport() in RecipesViewModel.kt. onUpdate wird nach jedem Item aufgerufen.
 */
export async function importRecipesFromUrls(
  urls: string[],
  userId: string,
  onUpdate: (items: BatchImportItem[]) => void
): Promise<void> {
  const items: BatchImportItem[] = urls
    .map((u) => u.trim())
    .filter(Boolean)
    .map((url) => ({ url, status: 'pending' as BatchStatus }))

  onUpdate([...items])

  for (const item of items) {
    item.status = 'running'
    onUpdate([...items])

    const result = await importRecipeFromUrl(item.url, userId)

    if (result.success) {
      item.status = 'done'
      item.resultTitle = result.title
    } else {
      item.status = 'error'
      item.error = result.error
    }
    onUpdate([...items])
  }
}
