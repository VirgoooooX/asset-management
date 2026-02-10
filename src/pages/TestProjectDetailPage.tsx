import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import AppCard from '../components/AppCard'
import { useI18n } from '../i18n'
import { useNavigate, useParams } from 'react-router-dom'
import * as testProjectService from '../services/testProjectService'
import type { TestProject, TestStage } from '../types'
import { useAppSelector } from '../store/hooks'

type StageDraft = {
  id: string
  durationMinutes: string
  targetTemp: string
  targetHumidity: string
}

const toNumber = (value: string) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const buildStages = (drafts: StageDraft[]): TestStage[] => {
  return drafts
    .map((d) => ({
      durationMinutes: Math.max(0, Math.floor(Number(d.durationMinutes || 0))),
      targetTemp: toNumber(d.targetTemp),
      targetHumidity: toNumber(d.targetHumidity),
    }))
    .filter((s) => s.durationMinutes > 0)
}

type ProfileStep = {
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

const buildProfileSteps = (stages: TestStage[], defaults: { temp: number; humidity: number }): ProfileStep[] => {
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

const ProfileChart: React.FC<{
  steps: ProfileStep[]
  defaults: { temp: number; humidity: number }
  rampText: string
  dwellText: string
  temperatureText: string
  humidityText: string
  soakText: string
  timeText: string
  minuteText: string
  hourText: string
}> = ({ steps, defaults, rampText, dwellText, temperatureText, humidityText, soakText, timeText, minuteText, hourText }) => {
  const totalMinutes = useMemo(() => steps.length ? steps[steps.length - 1].x1 : 0, [steps])

  const formatDurationShort = useCallback((minutes: number) => {
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} ${hourText}`
    return `${minutes} ${minuteText}`
  }, [hourText, minuteText])

  const pickNiceStep = (range: number) => {
    if (!Number.isFinite(range) || range <= 0) return 5
    return range <= 25 ? 5 : 10
  }

  const buildNiceTicks = (rawMin: number, rawMax: number, clamp?: { min: number; max: number }) => {
    const min = clamp ? Math.max(clamp.min, rawMin) : rawMin
    const max = clamp ? Math.min(clamp.max, rawMax) : rawMax
    const step = pickNiceStep(max - min)
    const niceMin = Math.floor(min / step) * step
    const niceMaxBase = Math.ceil(max / step) * step
    const niceMax = niceMaxBase === niceMin ? niceMin + step : niceMaxBase
    const ticks: number[] = []
    for (let v = niceMin; v <= niceMax + 1e-9; v += step) ticks.push(v)
    return { min: niceMin, max: niceMax, step, ticks }
  }

  const tempDomain = useMemo(() => {
    const ys = steps
      .flatMap((s) => [s.startTemp, s.endTemp])
      .concat([defaults.temp])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const min = ys.length ? Math.min(...ys) : defaults.temp
    const max = ys.length ? Math.max(...ys) : defaults.temp + 1
    const pad = min === max ? 1 : (max - min) * 0.06
    return buildNiceTicks(min - pad, max + pad)
  }, [defaults.temp, steps])

  const humDomain = useMemo(() => {
    const ys = steps
      .flatMap((s) => [s.startHumidity, s.endHumidity])
      .concat([defaults.humidity])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const min = ys.length ? Math.min(...ys) : defaults.humidity
    const max = ys.length ? Math.max(...ys) : defaults.humidity + 1
    const pad = min === max ? 1 : (max - min) * 0.06
    return buildNiceTicks(min - pad, max + pad, { min: 0, max: 100 })
  }, [defaults.humidity, steps])

  const svg = useMemo(() => {
    const width = 980
    const height = 440
    const left = 70
    const right = 56
    const top = 18
    const bottom = 62
    const plotW = width - left - right

    const tempTop = top
    const tempH = 150
    const midBandTop = tempTop + tempH
    const midBandH = 58
    const humTop = midBandTop + midBandH
    const humH = 150
    const xAxisY = humTop + humH + 22

    const dwellEffectiveMinutes = (minutes: number) => {
      const dur = Math.max(0, minutes)
      const head = Math.min(dur, 60)
      const tail = Math.max(0, dur - 60)
      return Math.max(18, head * 0.55 + tail * 0.12)
    }

    const rampEffectiveMinutes = (minutes: number) => {
      const dur = Math.max(0, minutes)
      return Math.max(12, dur)
    }

    const displayRanges = (() => {
      let acc = 0
      return steps.map((s) => {
        const eff = s.kind === 'dwell' ? dwellEffectiveMinutes(s.durationMinutes) : rampEffectiveMinutes(s.durationMinutes)
        const d0 = acc
        acc += eff
        const d1 = acc
        return { d0, d1, eff }
      })
    })()

    const displayTotal = displayRanges.length ? displayRanges[displayRanges.length - 1].d1 : 0

    const xScaleTime = (t: number) => {
      if (!Number.isFinite(t) || t <= 0) return left
      if (totalMinutes <= 0 || displayTotal <= 0) return left
      if (t >= totalMinutes) return left + plotW

      const idx = steps.findIndex((s) => t <= s.x1)
      const i = idx === -1 ? steps.length - 1 : idx
      const s = steps[i]
      const r = displayRanges[i]
      const denom = s.x1 - s.x0 || 1
      const frac = Math.max(0, Math.min(1, (t - s.x0) / denom))
      const displayX = r.d0 + frac * r.eff
      return left + (displayX / displayTotal) * plotW
    }
    const yTemp = (y: number) => tempTop + (tempDomain.max - y) / (tempDomain.max - tempDomain.min || 1) * tempH
    const yHum = (y: number) => humTop + (humDomain.max - y) / (humDomain.max - humDomain.min || 1) * humH

    const pickTimeStepMinutes = (total: number, desiredTickCount: number) => {
      if (!Number.isFinite(total) || total <= 0) return 60
      const rough = total / Math.max(2, desiredTickCount)
      const nice = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720, 960, 1440, 2880, 4320, 5760, 7200]
      for (const s of nice) if (s >= rough) return s
      return nice[nice.length - 1]
    }

    const buildTimeTicks = (total: number) => {
      const minTickPx = 110
      const desiredCount = Math.max(2, Math.floor(plotW / minTickPx))
      const step = pickTimeStepMinutes(total, desiredCount)
      const ticks: number[] = [0]
      if (step > 0) {
        for (let t = step; t < total - 1e-9; t += step) ticks.push(t)
      }
      if (total > 0 && ticks[ticks.length - 1] !== total) ticks.push(total)
      return { step, ticks }
    }

    const xTicks = buildTimeTicks(totalMinutes)
    const axisUsesHours = totalMinutes >= 360 && xTicks.step >= 60
    const formatAxisTime = (minutes: number) => {
      if (!Number.isFinite(minutes)) return ''
      if (minutes <= 0) return ''
      if (!axisUsesHours) return `${Math.round(minutes)}`
      const h = minutes / 60
      if (Math.abs(h - Math.round(h)) < 1e-9) return `${Math.round(h)}${hourText}`
      return `${Math.round(h * 10) / 10}${hourText}`
    }

    const boundaries = steps.map((s) => s.x1)
    const pointTimes = [0].concat(boundaries)
    const tempPoints = [defaults.temp].concat(steps.map((s) => s.endTemp ?? s.startTemp ?? defaults.temp))
    const humPoints = [defaults.humidity].concat(steps.map((s) => s.endHumidity ?? s.startHumidity ?? defaults.humidity))

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Profile chart">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />

        {steps
          .filter((s) => s.kind === 'dwell')
          .map((s) => {
            const x0 = xScaleTime(s.x0)
            const x1 = xScaleTime(s.x1)
            const showLabel = x1 - x0 > 160
            return (
              <g key={`shade-${s.index}`}>
                <rect x={x0} y={tempTop} width={x1 - x0} height={tempH + midBandH + humH} fill="rgba(96,165,250,0.14)" />
                {showLabel ? (
                  <text x={(x0 + x1) / 2} y={humTop + humH / 2} fontSize={13} textAnchor="middle" fill="rgba(0,0,0,0.50)">
                    {soakText}
                  </text>
                ) : null}
              </g>
            )
          })}

        {boundaries.slice(0, Math.max(0, boundaries.length - 1)).map((v) => {
          const x = xScaleTime(v)
          return (
            <line
              key={`b-${v}`}
              x1={x}
              x2={x}
              y1={tempTop}
              y2={humTop + humH}
              stroke="rgba(59,130,246,0.45)"
              strokeWidth={1}
            />
          )
        })}

        {tempDomain.ticks.map((v, idx) => {
          const y = yTemp(v)
          return (
            <g key={`t-${idx}`}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="rgba(0,0,0,0.10)" strokeWidth={1} />
              <text x={left - 10} y={y + 4} fontSize={12} textAnchor="end" fill="rgba(0,0,0,0.62)">
                {Math.round(v * 100) / 100}
              </text>
            </g>
          )
        })}

        {humDomain.ticks.map((v, idx) => {
          const y = yHum(v)
          return (
            <g key={`h-${idx}`}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
              <text x={left - 10} y={y + 4} fontSize={12} textAnchor="end" fill="rgba(0,0,0,0.62)">
                {Math.round(v * 100) / 100}
              </text>
            </g>
          )
        })}

        <text x={18} y={tempTop + tempH / 2} fontSize={12} fill="rgba(0,0,0,0.62)" transform={`rotate(-90 18 ${tempTop + tempH / 2})`}>
          {temperatureText} (°C)
        </text>
        <text x={18} y={humTop + humH / 2} fontSize={12} fill="rgba(0,0,0,0.62)" transform={`rotate(-90 18 ${humTop + humH / 2})`}>
          {humidityText} (%RH)
        </text>

        {steps.map((s) => {
          const x0 = xScaleTime(s.x0)
          const x1 = xScaleTime(s.x1)
          const isRamp = s.kind === 'ramp'

          const t0 = s.startTemp
          const t1 = s.endTemp
          const h0 = s.startHumidity
          const h1 = s.endHumidity

          return (
            <g key={`seg-${s.index}`}>
              {typeof t0 === 'number' && typeof t1 === 'number' ? (
                <line
                  x1={x0}
                  x2={x1}
                  y1={yTemp(t0)}
                  y2={yTemp(t1)}
                  stroke="rgba(17,24,39,0.92)"
                  strokeWidth={3.2}
                  strokeLinecap="round"
                />
              ) : null}
              {typeof h0 === 'number' && typeof h1 === 'number' ? (
                <line
                  x1={x0}
                  x2={x1}
                  y1={yHum(h0)}
                  y2={yHum(h1)}
                  stroke="rgba(17,24,39,0.92)"
                  strokeWidth={3.2}
                  strokeLinecap="round"
                />
              ) : null}

              <g>
                <circle cx={(x0 + x1) / 2} cy={midBandTop + midBandH / 2} r={16} fill="#fff" stroke="rgba(59,130,246,0.45)" strokeWidth={2} />
                <text x={(x0 + x1) / 2} y={midBandTop + midBandH / 2 + 4} fontSize={12} textAnchor="middle" fill="rgba(0,0,0,0.75)">
                  {s.index}
                </text>
              </g>

              {x1 - x0 > 92 ? (
                <text
                  x={(x0 + x1) / 2}
                  y={midBandTop + midBandH - 10}
                  fontSize={11}
                  textAnchor="middle"
                  fill="rgba(0,0,0,0.62)"
                >
                  {formatDurationShort(s.durationMinutes)} {isRamp ? rampText : dwellText}
                </text>
              ) : null}
            </g>
          )
        })}

        {(() => {
          let prevX = -1e9
          let prevY = -1e9
          let prevV: number | undefined
          return pointTimes.map((t, i) => {
            const x = xScaleTime(t)
            const tv = tempPoints[i]
            if (typeof tv !== 'number' || !Number.isFinite(tv)) return null
            const y = yTemp(tv)
            let dy = y < tempTop + 18 ? 14 : -12
            let dx = 0
            let anchor: 'start' | 'middle' | 'end' = 'middle'
            if (x < left + 16) {
              anchor = 'start'
              dx = 6
            } else if (x > width - right - 16) {
              anchor = 'end'
              dx = -6
            }

            const sameAsPrev = typeof prevV === 'number' && Math.abs(tv - prevV) < 1e-9
            const tooClose =
              Math.abs(x - prevX) < 28 && Math.abs((y + dy) - prevY) < 16

            if (tooClose) {
              dy = -dy
              if (Math.abs(x - prevX) < 28 && Math.abs((y + dy) - prevY) < 16) dx += i % 2 === 0 ? 10 : -10
            }

            const hideLabel = sameAsPrev && Math.abs(x - prevX) < 18 && Math.abs(y - (prevY - dy)) < 8

            prevX = x + dx
            prevY = y + dy
            prevV = tv

            return (
              <g key={`pt-t-${i}`}>
                <circle cx={x} cy={y} r={3.25} fill="rgba(17,24,39,0.92)" />
                {!hideLabel ? (
                  <text
                    x={x + dx}
                    y={y + dy}
                    fontSize={11}
                    textAnchor={anchor}
                    fill="rgba(17,24,39,0.86)"
                    stroke="rgba(255,255,255,0.92)"
                    strokeWidth={3.5}
                    paintOrder="stroke"
                  >
                    {Math.round(tv * 10) / 10}
                  </text>
                ) : null}
              </g>
            )
          })
        })()}

        {(() => {
          let prevX = -1e9
          let prevY = -1e9
          let prevV: number | undefined
          return pointTimes.map((t, i) => {
            const x = xScaleTime(t)
            const hv = humPoints[i]
            if (typeof hv !== 'number' || !Number.isFinite(hv)) return null
            const y = yHum(hv)
            let dy = y > humTop + humH - 18 ? -12 : 14
            let dx = 0
            let anchor: 'start' | 'middle' | 'end' = 'middle'
            if (x < left + 16) {
              anchor = 'start'
              dx = 6
            } else if (x > width - right - 16) {
              anchor = 'end'
              dx = -6
            }

            const sameAsPrev = typeof prevV === 'number' && Math.abs(hv - prevV) < 1e-9
            const tooClose =
              Math.abs(x - prevX) < 28 && Math.abs((y + dy) - prevY) < 16

            if (tooClose) {
              dy = -dy
              if (Math.abs(x - prevX) < 28 && Math.abs((y + dy) - prevY) < 16) dx += i % 2 === 0 ? 10 : -10
            }

            const hideLabel = sameAsPrev && Math.abs(x - prevX) < 18 && Math.abs(y - (prevY - dy)) < 8

            prevX = x + dx
            prevY = y + dy
            prevV = hv

            return (
              <g key={`pt-h-${i}`}>
                <circle cx={x} cy={y} r={3.25} fill="rgba(17,24,39,0.92)" />
                {!hideLabel ? (
                  <text
                    x={x + dx}
                    y={y + dy}
                    fontSize={11}
                    textAnchor={anchor}
                    fill="rgba(17,24,39,0.86)"
                    stroke="rgba(255,255,255,0.92)"
                    strokeWidth={3.5}
                    paintOrder="stroke"
                  >
                    {Math.round(hv * 10) / 10}
                  </text>
                ) : null}
              </g>
            )
          })
        })()}

        {xTicks.ticks.map((v) => {
          const x = xScaleTime(v)
          const label = formatAxisTime(v)
          return (
            <g key={`x-${v}`}>
              <line x1={x} x2={x} y1={humTop} y2={humTop + humH} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
              {label ? (
                <text x={x} y={height - bottom + 40} fontSize={12} textAnchor="middle" fill="rgba(0,0,0,0.62)">
                  {label}
                </text>
              ) : null}
            </g>
          )
        })}

        <text x={width / 2} y={height - bottom + 56} fontSize={12} textAnchor="middle" fill="rgba(0,0,0,0.62)">
          {axisUsesHours ? `${timeText} (${hourText})` : `${timeText} (${minuteText})`}
        </text>
        <text x={left} y={height - 18} fontSize={12} fill="rgba(0,0,0,0.62)">
          Start {defaults.temp}°C / {defaults.humidity}%
        </text>
      </svg>
    )
  }, [
    defaults.humidity,
    defaults.temp,
    dwellText,
    formatDurationShort,
    hourText,
    humDomain.max,
    humDomain.min,
    humDomain.ticks,
    humidityText,
    minuteText,
    rampText,
    soakText,
    steps,
    tempDomain.max,
    tempDomain.min,
    tempDomain.ticks,
    temperatureText,
    timeText,
    totalMinutes,
  ])

  return <Box sx={{ width: '100%', height: 440 }}>{svg}</Box>
}

const TestProjectDetailPage: React.FC = () => {
  const { tr } = useI18n()
  const navigate = useNavigate()
  const { testProjectId } = useParams()
  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tp, setTp] = useState<TestProject | null>(null)

  const [procedure, setProcedure] = useState('')
  const [stages, setStages] = useState<StageDraft[]>([])

  const load = useCallback(async () => {
    if (!testProjectId) return
    setLoading(true)
    setError(null)
    setSaveError(null)
    try {
      const item = await testProjectService.getTestProjectById(testProjectId)
      if (!item) {
        setTp(null)
        setError(tr('测试项目不存在', 'Test project not found'))
        return
      }
      setTp(item)
      setProcedure(item.procedure || '')
      const loadedStages = Array.isArray(item.stages) ? item.stages : []
      setStages(
        loadedStages.map((s, idx) => ({
          id: `${Date.now()}-${idx}`,
          durationMinutes: s.durationMinutes !== undefined ? String(s.durationMinutes) : '',
          targetTemp:
            (s.targetTemp ?? (s as any).endTemp ?? (s as any).startTemp) !== undefined
              ? String(s.targetTemp ?? (s as any).endTemp ?? (s as any).startTemp)
              : '',
          targetHumidity:
            (s.targetHumidity ?? (s as any).endHumidity ?? (s as any).startHumidity) !== undefined
              ? String(s.targetHumidity ?? (s as any).endHumidity ?? (s as any).startHumidity)
              : '',
        }))
      )
    } catch (e: any) {
      setError(e?.message || tr('加载失败', 'Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [testProjectId, tr])

  useEffect(() => {
    load()
  }, [load])

  const stageModels = useMemo(() => buildStages(stages), [stages])

  const handleAddStage = useCallback(() => {
    setStages((prev) =>
      prev.concat([
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          durationMinutes: '60',
          targetTemp: '',
          targetHumidity: '',
        },
      ])
    )
  }, [])

  const handleRemoveStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleSave = useCallback(async () => {
    if (!tp) return
    if (!canManage) return
    setSaving(true)
    setSaveError(null)
    try {
      const normalizedStages = buildStages(stages)
      await testProjectService.updateTestProject(tp.id, {
        procedure: procedure.trim() || undefined,
        stages: normalizedStages.length > 0 ? normalizedStages : undefined,
      })
      await load()
    } catch (e: any) {
      setSaveError(e?.message || tr('保存失败', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }, [canManage, load, procedure, stages, tp, tr])

  return (
    <PageShell
      title={<TitleWithIcon icon={<PlaylistAddCheckIcon />}>{tr('测试项目详情', 'Test project')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            {tr('返回', 'Back')}
          </Button>
          {canManage ? (
            <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || loading || !tp}>
              {tr('保存', 'Save')}
            </Button>
          ) : null}
        </Stack>
      }
    >
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={22} />
          <Typography sx={{ ml: 2 }}>{tr('正在加载...', 'Loading...')}</Typography>
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : !tp ? (
        <Alert severity="error">{tr('测试项目不存在', 'Not found')}</Alert>
      ) : (
        <Stack spacing={1.75}>
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}

          <AppCard title={tr('基础信息', 'Overview')} sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(0, 0.85fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{tp.name}</Typography>
                <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {tr('温度', 'Temperature')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{tp.temperature}°C</Typography>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {tr('湿度', 'Humidity')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{tp.humidity}%</Typography>
                  </Box>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {tr('时长', 'Duration')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{tp.duration} h</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary">
                  {tr('适用设备类型', 'Asset categories')}
                </Typography>
                <Typography sx={{ mt: 0.25, fontWeight: 700, lineHeight: 1.35 }}>
                  {tp.assetCategories && tp.assetCategories.length > 0 ? tp.assetCategories.join(' · ') : tr('全部', 'All')}
                </Typography>
              </Box>
            </Box>
          </AppCard>

          <AppCard title={tr('测试流程说明', 'Procedure')} sx={{ p: 2 }}>
            <TextField
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              size="small"
              placeholder={tr('输入测试流程说明（支持纯文本/Markdown）', 'Describe the procedure (plain text/markdown).')}
              disabled={!canManage || saving}
            />
          </AppCard>

          <AppCard
            title={tr('阶段参数与流程曲线', 'Stages & Curve')}
            sx={{ p: 2 }}
            actions={
              canManage ? (
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddStage} disabled={saving}>
                  {tr('新增阶段', 'Add stage')}
                </Button>
              ) : undefined
            }
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 0.4fr) minmax(0, 0.6fr)' },
                gap: 1.75,
                alignItems: 'stretch',
              }}
            >
              <Box sx={{ height: 440, overflow: 'auto' }}>
                <Table
                  size="small"
                  sx={{
                    minWidth: 480,
                    '& .MuiTableCell-root': { py: 0.4, px: 1.25, verticalAlign: 'middle' },
                    '& .MuiTableCell-head': { py: 0.6 },
                  }}
                >
                  <TableHead sx={{ backgroundColor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 650, width: 72 }} align="center">
                        {tr('阶段', 'Stage')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 650, width: 104 }} align="center">
                        {tr('时长(min)', 'Minutes')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 650, width: 126 }} align="center">
                        {tr('目标温度(°C)', 'Temp (°C)')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 650, width: 126 }} align="center">
                        {tr('目标湿度(%)', 'Humidity (%)')}
                      </TableCell>
                      {canManage ? (
                        <TableCell sx={{ fontWeight: 650, width: 64 }} align="center">
                          {tr('操作', 'Actions')}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManage ? 5 : 4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            {tr('暂无阶段（可新增）', 'No stages')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stages.map((s, idx) => (
                        <TableRow key={s.id} hover>
                          <TableCell align="center">
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 26,
                                height: 26,
                                borderRadius: 99,
                                border: '1px solid',
                                borderColor: 'divider',
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            >
                              {idx + 1}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              value={s.durationMinutes}
                              onChange={(e) =>
                                setStages((prev) =>
                                  prev.map((x) => (x.id === s.id ? { ...x, durationMinutes: e.target.value } : x))
                                )
                              }
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ min: 0, step: 1, style: { textAlign: 'center' } }}
                              sx={{
                                minWidth: 92,
                                '& .MuiInputBase-root': { minHeight: 30 },
                                '& .MuiInputBase-input': { py: 0.55, textAlign: 'center' },
                              }}
                              disabled={!canManage || saving}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              value={s.targetTemp}
                              onChange={(e) =>
                                setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, targetTemp: e.target.value } : x)))
                              }
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ style: { textAlign: 'center' } }}
                              sx={{
                                minWidth: 106,
                                '& .MuiInputBase-root': { minHeight: 30 },
                                '& .MuiInputBase-input': { py: 0.55, textAlign: 'center' },
                              }}
                              disabled={!canManage || saving}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              value={s.targetHumidity}
                              onChange={(e) =>
                                setStages((prev) =>
                                  prev.map((x) => (x.id === s.id ? { ...x, targetHumidity: e.target.value } : x))
                                )
                              }
                              size="small"
                              type="number"
                              fullWidth
                              inputProps={{ min: 0, max: 100, style: { textAlign: 'center' } }}
                              sx={{
                                minWidth: 106,
                                '& .MuiInputBase-root': { minHeight: 30 },
                                '& .MuiInputBase-input': { py: 0.55, textAlign: 'center' },
                              }}
                              disabled={!canManage || saving}
                            />
                          </TableCell>
                          {canManage ? (
                            <TableCell align="center">
                              <IconButton onClick={() => handleRemoveStage(s.id)} size="small" color="error" disabled={saving} sx={{ p: 0.5 }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>

              <Box
                sx={{
                  pl: { xs: 0, lg: 2 },
                  borderLeft: { xs: 'none', lg: '1px solid' },
                  borderColor: { xs: 'transparent', lg: 'divider' },
                  height: 440,
                  display: 'flex',
                  alignItems: 'stretch',
                }}
              >
                {stageModels.length === 0 ? (
                  <Typography color="text.secondary">{tr('填写阶段参数后将自动生成曲线', 'Add stages to generate a curve.')}</Typography>
                ) : (
                  (() => {
                    const defaults = { temp: 25, humidity: 50 }
                    const steps = buildProfileSteps(stageModels, defaults)
                    return (
                      <ProfileChart
                        steps={steps}
                        defaults={defaults}
                        rampText={tr('升降', 'ramp')}
                        dwellText={tr('稳态', 'dwell')}
                        temperatureText={tr('温度', 'Temperature')}
                        humidityText={tr('湿度', 'Humidity')}
                        soakText={tr('浸泡', 'Soak')}
                        timeText={tr('时间', 'Time')}
                        minuteText={tr('分钟', 'min')}
                        hourText={tr('小时', 'hour')}
                      />
                    )
                  })()
                )}
              </Box>
            </Box>
          </AppCard>
        </Stack>
      )}
    </PageShell>
  )
}

export default TestProjectDetailPage
