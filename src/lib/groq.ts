const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string
const CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

export interface RecipeIngredient {
  name: string
  amount: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface GeneratedRecipe {
  title: string
  description: string
  ingredients: string[]
  structuredIngredients: RecipeIngredient[]
  steps: string[]
  servings: number
  prepTimeMinutes: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodScanResult {
  foodName: string
  estimatedGrams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: string
}

export interface NutritionLabelResult {
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
}

function isUrl(input: string) {
  const t = input.trim()
  return t.startsWith('http://') || t.startsWith('https://')
}

function cleanJson(text: string) {
  return text
    .trim()
    .replace(/^```json/, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()
}

async function chatCompletion(model: string, content: unknown, jsonMode = true): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Kein VITE_GROQ_API_KEY konfiguriert (Vercel Environment Variables).')
  }
  const body: Record<string, unknown> = {
    model,
    temperature: model.includes('scout') ? 0.3 : 0.7,
    messages: [{ role: 'user', content }],
  }
  if (jsonMode) body.response_format = { type: 'json_object' }
  body[model.includes('scout') ? 'max_completion_tokens' : 'max_tokens'] = model.includes('scout') ? 1000 : 2000

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  const bodyText = await res.text()
  if (!res.ok) throw new Error(`API Fehler ${res.status}: ${bodyText}`)

  const root = JSON.parse(bodyText)
  return root.choices[0].message.content as string
}

/** Gleicher Prompt wie GroqRecipeGeneratorService.kt in der Android-App. */
export async function generateRecipe(userInput: string): Promise<GeneratedRecipe> {
  const isCaption = !isUrl(userInput) && userInput.length > 80

  const taskDescription = isCaption
    ? `Der Benutzer hat folgenden Text eingefügt (z.B. einen kopierten Instagram/TikTok-Caption oder ein Rezept aus dem Internet):

"""
${userInput}
"""

Extrahiere daraus alle Zutaten und Zubereitungsschritte. Falls Mengenangaben fehlen, schätze realistische Werte.
Falls kein Rezepttitel erkennbar ist, erfinde einen passenden deutschen Namen.`
    : `Erstelle ein realistisches Rezept für: ${userInput}`

  const prompt = `Du bist ein erfahrener Ernährungsberater und Koch.
${taskDescription}

Berechne die Nährwerte EXAKT basierend auf echten Zutatenmengen.
Referenzwerte pro 100g: Hühnerbrust=165kcal/31gP, Parmesan=431kcal/38gP,
Ricotta=174kcal/11gP, Hackfleisch=250kcal/17gP, Pasta=350kcal/13gP,
Reis=130kcal/3gP, Ei=155kcal/13gP, Butter=717kcal/1gP.

Antworte NUR mit folgendem JSON (kein Markdown, keine Erklärungen):
{
  "title": "Rezeptname",
  "description": "Kurze Beschreibung",
  "structuredIngredients": [
    {"name": "Hühnerbrust", "amount": "200g", "calories": 330, "protein": 62.0, "carbs": 0.0, "fat": 7.0}
  ],
  "ingredients": ["200g Hühnerbrust"],
  "steps": ["Schritt 1", "Schritt 2"],
  "servings": 4,
  "prepTimeMinutes": 30,
  "calories": 650,
  "protein": 55.0,
  "carbs": 45.0,
  "fat": 25.0
}

calories/protein/carbs/fat auf Toplevel = Werte PRO PORTION.
Werte in structuredIngredients = GESAMT für die gesamte Zutatenmenge.`

  const raw = await chatCompletion('llama-3.3-70b-versatile', prompt)
  return JSON.parse(cleanJson(raw)) as GeneratedRecipe
}

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

/** Skaliert + komprimiert ein Bild und gibt Base64 (ohne data:-Prefix) zurück. */
export async function fileToBase64Jpeg(file: File, maxDim = 1024, quality = 0.75): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * ratio)
  const h = Math.round(bitmap.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.split(',')[1]
}

export async function analyzeFoodPhoto(base64Jpeg: string): Promise<FoodScanResult> {
  const prompt = `Du bist ein erfahrener Ernährungsberater. Analysiere das Foto eines Gerichts/einer Mahlzeit.
Identifiziere was zu sehen ist, schätze die Portionsgrösse in Gramm und berechne realistische Nährwerte.

Antworte NUR mit folgendem JSON (kein Markdown, keine Erklärungen):
{
  "foodName": "Bezeichnung des Gerichts",
  "estimatedGrams": 350,
  "calories": 520,
  "protein": 28.0,
  "carbs": 55.0,
  "fat": 18.0,
  "confidence": "hoch"
}

confidence ist "hoch", "mittel" oder "niedrig" je nachdem wie sicher die Schätzung ist.
Alle Werte (calories/protein/carbs/fat) beziehen sich auf die GESAMTE geschätzte Portion, nicht auf 100g.`

  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` } },
  ]
  const raw = await chatCompletion(VISION_MODEL, content)
  return JSON.parse(cleanJson(raw)) as FoodScanResult
}

export async function analyzeNutritionLabel(base64Jpeg: string): Promise<NutritionLabelResult> {
  const prompt = `Auf dem Foto ist eine Nährwerttabelle (von einer Lebensmittelverpackung) zu sehen.
Lies die Werte PRO 100g/100ml aus der Tabelle ab. Falls die Tabelle nur Werte pro Portion zeigt
und die Portionsgrösse erkennbar ist, rechne korrekt auf 100g um.

Antworte NUR mit folgendem JSON (kein Markdown, keine Erklärungen):
{
  "caloriesPer100g": 250,
  "proteinPer100g": 12.0,
  "carbsPer100g": 30.0,
  "fatPer100g": 8.0,
  "fiberPer100g": 3.0
}`

  const content = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` } },
  ]
  const raw = await chatCompletion(VISION_MODEL, content)
  return JSON.parse(cleanJson(raw)) as NutritionLabelResult
}
