// Web-Pendant zu FoodSearchRepository.kt (Android). Dort werden mehrere Quellen
// (OFF, USDA, Nutritionix, Swiss-DB, Groq) kombiniert — die meisten brauchen API-Keys,
// die im Browser nicht sicher gehalten werden können. Open Food Facts ist öffentlich,
// braucht keinen Key und deckt Barcode-Produkte gut ab, daher hier als einzige Quelle.

export interface ProductResult {
  barcode: string | null
  name: string
  brand: string | null
  imageUrl: string | null
  // Naehrwerte pro 100g/100ml, wie in FoodItem.kt (Android)
  kcal: number
  protein: number
  carbs: number
  fat: number
}

interface OffNutriments {
  ['energy-kcal_100g']?: number
  ['energy-kcal_serving']?: number
  proteins_100g?: number
  carbohydrates_100g?: number
  fat_100g?: number
}

interface OffProduct {
  code?: string
  product_name?: string
  product_name_de?: string
  brands?: string
  image_small_url?: string
  nutriments?: OffNutriments
}

function toResult(p: OffProduct): ProductResult | null {
  const name = p.product_name_de || p.product_name
  const n = p.nutriments
  if (!name || !n || n['energy-kcal_100g'] == null) return null
  return {
    barcode: p.code ?? null,
    name,
    brand: p.brands ? p.brands.split(',')[0].trim() : null,
    imageUrl: p.image_small_url ?? null,
    kcal: n['energy-kcal_100g'] ?? 0,
    protein: n.proteins_100g ?? 0,
    carbs: n.carbohydrates_100g ?? 0,
    fat: n.fat_100g ?? 0,
  }
}

const FIELDS = 'code,product_name,product_name_de,brands,image_small_url,nutriments'

export async function searchProducts(query: string): Promise<ProductResult[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Suche fehlgeschlagen')
  const data = (await res.json()) as { products?: OffProduct[] }
  return (data.products ?? [])
    .map(toResult)
    .filter((r): r is ProductResult => r !== null)
}

export async function lookupBarcode(code: string): Promise<ProductResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Abfrage fehlgeschlagen')
  const data = (await res.json()) as { status?: number; product?: OffProduct }
  if (data.status !== 1 || !data.product) return null
  return toResult({ ...data.product, code })
}
