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

// Spiegelt HealthDailyDto aus SupabaseSync.kt (Android pusht, Web liest nur)
export interface HealthDailyRow {
  user_id: string
  date_str: string
  active_calories_kcal: number | null
  steps: number | null
}

// Spiegelt UserProfileDto aus SupabaseSync.kt (1 Zeile pro Nutzer)
export interface UserProfileRow {
  user_id: string
  weight_kg: number
  height_cm: number
  age_years: number
  daily_calorie_goal: number
  protein_goal_g: number
  carbs_goal_g: number
  fat_goal_g: number
  activity_factor: number
  sex: 'MALE' | 'FEMALE' | 'UNSPECIFIED'
  updated_at: number
}
