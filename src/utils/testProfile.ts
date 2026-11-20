import type { TestStage } from '../types'

export type StageDraft = {
  id: string
  durationMinutes: string
  targetTemp: string
  targetHumidity: string
}

export type ProfileStep = {
  index: number
  name?: string
  durationMinutes: number
  x0: number
  x1: number
  kind: 'ramp' | 'dwell'
  startTemp?: number
  endTemp?: number
  startHumidity?: number
  endHumidity?: number
}

export const toNumber = (value: string): number | undefined => {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export const buildStages = (drafts: StageDraft[]): TestStage[] => {
  return drafts
    .map((d) => ({
      durationMinutes: Math.max(0, Math.floor(Number(d.durationMinutes || 0))),
      targetTemp: toNumber(d.targetTemp),
      targetHumidity: toNumber(d.targetHumidity),
    }))
    .filter((s) => s.durationMinutes > 0)
}

export const buildProfileSteps = (
  stages: TestStage[],
  defaults: { temp: number; humidity: number }
): ProfileStep[] => {
  let t = 0
  let prevTemp: number | undefined = defaults.temp
  let prevHum: number | undefined = defaults.humidity
  const out: ProfileStep[] = []

  stages.forEach((s, i) => {
    const dur = s.durationMinutes
    if (!Number.isFinite(dur) || dur <= 0) return
    const x0 = t
    const x1 = t + dur
    t = x1

    const endTemp = Number.isFinite(s.targetTemp) ? (s.targetTemp as number) : prevTemp
    const endHum = Number.isFinite(s.targetHumidity) ? (s.targetHumidity as number) : prevHum
    const startTemp = prevTemp
    const startHumidity = prevHum
    const isRamp =
      (startTemp !== undefined && endTemp !== undefined && startTemp !== endTemp) ||
      (startHumidity !== undefined && endHum !== undefined && startHumidity !== endHum)

    out.push({
      index: i + 1,
      name: s.name,
      durationMinutes: dur,
      x0,
      x1,
      kind: isRamp ? 'ramp' : 'dwell',
      startTemp,
      endTemp,
      startHumidity,
      endHumidity: endHum,
    })

    prevTemp = endTemp
    prevHum = endHum
  })

  return out
}
