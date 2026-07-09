import { supabase } from './supabase'
import { MealType } from './types'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

/**
 * Legt einen Tagebucheintrag fuer ein Rezept an. Spiegelt den Insert-Pfad aus
 * DiaryRepository.insertAndSync auf Android (foodItemId dort -999 fuer
 * generierte/gespeicherte Rezepte, hier ohne lokale FoodItem-Tabelle nicht
 * noetig, aber Werte-Semantik bleibt gleich: absolute Werte, nicht pro 100g).
 */
export async function addRecipeToDiary(params: {
  userId: string
  title: string
  calories: number
  protein: number
  carbs: number
  fat: number
  mealType: MealType
  dateStr?: string
}) {
  const { userId, title, calories, protein, carbs, fat, mealType, dateStr } = params
  return supabase.from('diary_entries').insert({
    user_id: userId,
    food_name: title,
    amount_grams: 0,
    meal_type: mealType,
    date_str: dateStr ?? toDateStr(new Date()),
    calories,
    protein,
    carbs,
    fat,
  })
}
