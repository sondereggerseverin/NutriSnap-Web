// Port of AdaptiveTdeeCalculator.kt (Android). Mirrors the trend-based branch only:
// the web app has no access to BMR profile inputs (height/age/gender/activity level)
// or Samsung Health active-calorie data, since neither is synced to Supabase — only
// diary_entries and weight_entries are. So there's no formula-TDEE fallback and no
// same-day activity bonus here; if there isn't enough overlapping weight+intake
// history, computeDailyTarget just returns null and the UI shows a "need more data"
// hint instead of a formula-based guess.

export const KCAL_PER_KG = 7700
export const DEFAULT_DEFICIT_KCAL = 500
export const MIN_TREND_DAYS = 5
export const SAFETY_FLOOR_KCAL = 1500

export interface AdaptiveCalorieTarget {
  targetKcal: number
  baseKcal: number
  isTrendBased: true
  deficitKcal: number
}

/**
 * Derives real average TDEE from overlapping weight + intake history.
 * Returns null if there isn't enough overlapping data to trust the trend.
 *
 * weightByDate / intakeByDate: maps of 'YYYY-MM-DD' -> value.
 */
export function computeTrendTdee(
  weightByDate: Record<string, number>,
  intakeByDate: Record<string, number>
): number | null {
  const days = Object.keys(weightByDate)
    .filter((d) => d in intakeByDate)
    .sort()
  if (days.length < MIN_TREND_DAYS) return null

  const spanDays = Math.round(
    (new Date(days[days.length - 1] + 'T00:00:00').getTime() - new Date(days[0] + 'T00:00:00').getTime()) /
      86400000
  )
  if (spanDays < MIN_TREND_DAYS - 1) return null // guard against clustered/duplicate dates

  const avg = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length
  const startWeight = avg(days.slice(0, 2).map((d) => weightByDate[d]))
  const endWeight = avg(days.slice(-2).map((d) => weightByDate[d]))
  const weightChangeKg = endWeight - startWeight

  const avgIntake = avg(days.map((d) => intakeByDate[d]))

  return avgIntake - (weightChangeKg * KCAL_PER_KG) / spanDays
}

/**
 * Trend-only daily target: maintenance (from computeTrendTdee) minus the default
 * deficit, floored at SAFETY_FLOOR_KCAL. Returns null if no trend TDEE is available.
 */
export function computeDailyTarget(
  trendTdee: number | null,
  deficitKcal: number = DEFAULT_DEFICIT_KCAL
): AdaptiveCalorieTarget | null {
  if (trendTdee == null) return null
  const base = trendTdee - deficitKcal
  const target = Math.max(base, SAFETY_FLOOR_KCAL)
  return {
    targetKcal: Math.round(target),
    baseKcal: Math.round(base),
    isTrendBased: true,
    deficitKcal: Math.round(deficitKcal),
  }
}
