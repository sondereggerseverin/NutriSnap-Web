// Port of AdaptiveTdeeCalculator.kt (Android). The trend-TDEE part mirrors Android
// exactly. The daily-target part now also supports the same-day activity bonus,
// using health_daily (active_calories_kcal) which Android pushes to Supabase after
// every Health Connect / Samsung Health sync. There's still no formula-TDEE fallback
// here (that needs BMR profile inputs — height/age/gender/activity level — which
// aren't synced), so computeDailyTarget returns null if there's no trend TDEE yet.

export const KCAL_PER_KG = 7700
export const DEFAULT_DEFICIT_KCAL = 500
export const ACTIVITY_ADJUSTMENT_FACTOR = 0.5
export const MIN_TREND_DAYS = 5
export const SAFETY_FLOOR_KCAL = 1500

export interface AdaptiveCalorieTarget {
  targetKcal: number
  baseKcal: number
  activityBonusKcal: number
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
 * Trend-based daily target: maintenance (from computeTrendTdee) minus the default
 * deficit, plus a damped adjustment for today's active calories vs. the recent
 * average (same 0.5x factor as Android), floored at SAFETY_FLOOR_KCAL.
 * Returns null if no trend TDEE is available.
 */
export function computeDailyTarget(
  trendTdee: number | null,
  todayActiveKcal: number | null = null,
  avgActiveKcal: number | null = null,
  deficitKcal: number = DEFAULT_DEFICIT_KCAL
): AdaptiveCalorieTarget | null {
  if (trendTdee == null) return null
  const base = trendTdee - deficitKcal

  const bonus =
    todayActiveKcal != null && avgActiveKcal != null && avgActiveKcal > 0
      ? (todayActiveKcal - avgActiveKcal) * ACTIVITY_ADJUSTMENT_FACTOR
      : 0

  const target = Math.max(base + bonus, SAFETY_FLOOR_KCAL)

  return {
    targetKcal: Math.round(target),
    baseKcal: Math.round(base),
    activityBonusKcal: Math.round(bonus),
    isTrendBased: true,
    deficitKcal: Math.round(deficitKcal),
  }
}
