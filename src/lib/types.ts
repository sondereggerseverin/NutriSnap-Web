export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'

export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Frühstück',
  LUNCH: 'Mittagessen',
  DINNER: 'Abendessen',
  SNACK: 'Snack',
}

// Spiegelt DiaryEntryDto aus SupabaseSync.kt
export interface DiaryEntryRow {
  id: number
  user_id: string
  food_name: string
  amount_grams: number
  meal_type: MealType
  date_str: string // YYYY-MM-DD
  calories: number
  protein: number
  carbs: number
  fat: number
  local_id: number | null
}

// Spiegelt WeightEntryDto
export interface WeightEntryRow {
  user_id: string
  date_str: string
  weight_kg: number
}

// Spiegelt RecipeDto
export interface RecipeRow {
  id: number
  user_id: string
  title: string
  description: string
  image_url: string | null
  source_url: string | null
  platform: string | null
  ingredients: string
  instructions: string
  total_calories: number | null
  protein_per_serving: number | null
  carbs_per_serving: number | null
  fat_per_serving: number | null
  servings: number
  prep_time_minutes: number | null
  tags: string
  is_favorite: boolean
  saved_at: number
  local_id: number | null
}
