import { startOfDay, subDays } from 'date-fns'

export type RangePreset = '7d' | '30d' | '90d' | 'custom'

export const resolveDateRange = (
  preset: RangePreset,
  customStart: Date | null,
  customEnd: Date | null,
  now: Date = new Date()
): { startMs: number; endMs: number; nowMs: number } => {
  const currentMs = now.getTime()
  if (preset === '7d') {
    return { startMs: startOfDay(subDays(now, 7)).getTime(), endMs: currentMs, nowMs: currentMs }
  }
  if (preset === '30d') {
    return { startMs: startOfDay(subDays(now, 30)).getTime(), endMs: currentMs, nowMs: currentMs }
  }
  if (preset === '90d') {
    return { startMs: startOfDay(subDays(now, 90)).getTime(), endMs: currentMs, nowMs: currentMs }
  }
  const start = customStart ?? startOfDay(subDays(now, 30))
  const end = customEnd ?? now
  return { startMs: start.getTime(), endMs: end.getTime(), nowMs: currentMs }
}
