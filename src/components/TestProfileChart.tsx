import React, { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import EChart from './EChart'

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

const isNum = (v: any): v is number => typeof v === 'number' && Number.isFinite(v)

export const TestProfileChart: React.FC<{
  steps: ProfileStep[]
  defaults: { temp: number; humidity: number }
  title: string
  rampText: string
  dwellText: string
  temperatureText: string
  humidityText: string
  timeText: string
  minuteText: string
  hourText: string
}> = ({ steps, defaults, title, rampText, dwellText, temperatureText, humidityText, timeText, minuteText, hourText }) => {
  const theme = useTheme()
  const totalMinutes = useMemo(() => (steps.length ? steps[steps.length - 1].x1 : 0), [steps])

  const scaled = useMemo(() => {
    const widths = steps.map((s) => Math.max(0, s.durationMinutes))
    const dwellIdx = steps.reduce((best, s, i) => {
      if (s.kind !== 'dwell') return best
      if (best === -1) return i
      return widths[i] > widths[best] ? i : best
    }, -1)

    if (dwellIdx === -1) {
      const ranges: Array<{ d0: number; d1: number; eff: number }> = []
      let acc = 0
      widths.forEach((w) => {
        const d0 = acc
        acc += w
        ranges.push({ d0, d1: acc, eff: w })
      })
      return { total: acc, ranges }
    }

    const D = widths[dwellIdx]
    const S = widths.reduce((sum, w, i) => (i === dwellIdx ? sum : sum + w), 0)
    if (S <= 0 || D <= 0) {
      const ranges: Array<{ d0: number; d1: number; eff: number }> = []
      let acc = 0
      widths.forEach((w) => {
        const d0 = acc
        acc += w
        ranges.push({ d0, d1: acc, eff: w })
      })
      return { total: acc, ranges }
    }

    const cap = 1.5 * S
    const D2 = Math.max(18, Math.min(D, cap))
    const widths2 = widths.slice()
    widths2[dwellIdx] = D2

    const ranges: Array<{ d0: number; d1: number; eff: number }> = []
    let acc = 0
    widths2.forEach((w) => {
      const d0 = acc
      acc += w
      ranges.push({ d0, d1: acc, eff: w })
    })
    return { total: acc, ranges }
  }, [steps])

  const mapRealToDisplay = useMemo(() => {
    const ranges = scaled.ranges
    return (t: number) => {
      if (!Number.isFinite(t) || t <= 0) return 0
      if (!ranges.length || totalMinutes <= 0) return t
      if (t >= totalMinutes) return scaled.total
      const idx = steps.findIndex((s) => t <= s.x1 + 1e-9)
      const i = idx === -1 ? steps.length - 1 : idx
      const s = steps[i]
      const r = ranges[i]
      const denom = s.x1 - s.x0 || 1
      const frac = Math.max(0, Math.min(1, (t - s.x0) / denom))
      return r.d0 + frac * r.eff
    }
  }, [scaled.ranges, scaled.total, steps, totalMinutes])

  const mapDisplayToReal = useMemo(() => {
    const ranges = scaled.ranges
    return (d: number) => {
      if (!Number.isFinite(d) || d <= 0) return 0
      if (!ranges.length || scaled.total <= 0) return d
      if (d >= scaled.total) return totalMinutes
      const idx = ranges.findIndex((r) => d <= r.d1 + 1e-9)
      const i = idx === -1 ? ranges.length - 1 : idx
      const r = ranges[i]
      const s = steps[i]
      const denom = r.eff || 1
      const frac = Math.max(0, Math.min(1, (d - r.d0) / denom))
      return s.x0 + frac * (s.x1 - s.x0)
    }
  }, [scaled.ranges, scaled.total, steps, totalMinutes])

  const points = useMemo(() => {
    let temp = defaults.temp
    let hum = defaults.humidity
    const tempPoints: Array<[number, number]> = [[0, temp]]
    const humPoints: Array<[number, number]> = [[0, hum]]

    steps.forEach((s) => {
      const endT = isNum(s.endTemp) ? s.endTemp : isNum(s.startTemp) ? s.startTemp : temp
      const endH = isNum(s.endHumidity) ? s.endHumidity : isNum(s.startHumidity) ? s.startHumidity : hum
      const x1 = mapRealToDisplay(s.x1)
      tempPoints.push([x1, endT])
      humPoints.push([x1, endH])
      temp = endT
      hum = endH
    })

    return { tempPoints, humPoints }
  }, [defaults.humidity, defaults.temp, mapRealToDisplay, steps])

  const markAreas = useMemo(() => {
    const rampColor = theme.palette.primary.main
    const dwellColor = theme.palette.success.main
    return steps.map((s, i) => {
      const base = s.kind === 'ramp' ? rampColor : dwellColor
      const opacity = s.kind === 'ramp' ? 0.08 : 0.06
      const r = scaled.ranges[i]
      return [
        {
          xAxis: r?.d0 ?? mapRealToDisplay(s.x0),
          itemStyle: { color: base, opacity },
          label: { show: false },
        },
        { xAxis: r?.d1 ?? mapRealToDisplay(s.x1) },
      ]
    })
  }, [mapRealToDisplay, scaled.ranges, steps, theme.palette.primary.main, theme.palette.success.main])

  const xAxis = useMemo(() => {
    const useHours = totalMinutes >= 360
    const name = `${timeText}`
    return {
      type: 'value' as const,
      min: 0,
      max: Math.max(0, scaled.total),
      name,
      nameLocation: 'middle',
      nameGap: 76,
      axisLabel: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.palette.divider, opacity: 0.5 } },
    }
  }, [scaled.total, theme.palette.divider, timeText, totalMinutes])

  if (!steps.length) return null

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
          {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)} ${hourText}` : `${totalMinutes} ${minuteText}`}
        </Typography>
      </Stack>

      <EChart
        height={440}
        minWidth={640}
        option={
          ({
          color: [theme.palette.error.main, theme.palette.info.main],
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params: any) => {
              const items = Array.isArray(params) ? params : [params]
              const dx = Number(items[0]?.axisValue)
              const x = mapDisplayToReal(dx)
              const step = steps.find((s) => x > s.x0 - 1e-9 && x <= s.x1 + 1e-9)
              const stepTitle = step
                ? `${step.kind === 'ramp' ? rampText : dwellText}${step.name ? ` · ${step.name}` : ''}`
                : ''
              const t = Number.isFinite(x)
                ? totalMinutes >= 360
                  ? `${Math.round((x / 60) * 10) / 10}${hourText}`
                  : `${Math.round(x)}${minuteText}`
                : ''
              const lines = [`<div style="font-weight:800;margin-bottom:2px;">${t}</div>`]
              if (stepTitle) lines.push(`<div style="opacity:0.8;margin-bottom:6px;">${stepTitle}</div>`)
              items.forEach((it: any) => {
                const name = String(it?.seriesName || '')
                const val = Array.isArray(it?.data) ? it.data[1] : it?.data
                const unit = name === temperatureText ? '°C' : '%'
                const safe = Number.isFinite(Number(val)) ? Number(val) : 0
                lines.push(`<div>${it.marker}${name}: <span style="font-weight:800;">${safe}</span> ${unit}</div>`)
              })
              return lines.join('')
            },
          },
          legend: {
            top: 8,
            left: 12,
            textStyle: { color: theme.palette.text.secondary },
            itemWidth: 10,
            itemHeight: 10,
            data: [temperatureText, humidityText],
          },
          grid: { top: 44, left: 56, right: 56, bottom: 124 },
          xAxis,
          yAxis: [
            {
              type: 'value',
              min: 0,
              max: 100,
              splitNumber: 5,
              name: `${temperatureText} (°C)`,
              nameLocation: 'middle',
              nameGap: 44,
              axisLabel: { formatter: (v: number) => `${v}°` },
              splitLine: { lineStyle: { color: theme.palette.divider, opacity: 0.5 } },
            },
            {
              type: 'value',
              min: 0,
              max: 100,
              splitNumber: 5,
              name: `${humidityText} (%)`,
              nameLocation: 'middle',
              nameGap: 44,
              axisLabel: { formatter: (v: number) => `${v}%` },
              splitLine: { show: false },
            },
          ],
          series: [
            {
              name: temperatureText,
              type: 'line',
              yAxisIndex: 0,
              showSymbol: false,
              smooth: false,
              itemStyle: { color: theme.palette.error.main },
              lineStyle: { width: 3, color: theme.palette.error.main },
              areaStyle: { opacity: 0.07, color: theme.palette.error.main },
              data: points.tempPoints,
              markArea: { silent: true, data: markAreas as any },
              markLine: {
                symbol: ['none', 'none'],
                label: { show: false },
                lineStyle: { color: theme.palette.divider, opacity: 0.65, type: 'dashed', width: 1 },
                data: scaled.ranges.slice(0, -1).map((r) => ({ xAxis: r.d1 })),
              },
            },
            {
              name: humidityText,
              type: 'line',
              yAxisIndex: 1,
              showSymbol: false,
              smooth: false,
              itemStyle: { color: theme.palette.info.main },
              lineStyle: { width: 3, color: theme.palette.info.main },
              areaStyle: { opacity: 0.05, color: theme.palette.info.main },
              data: points.humPoints,
            },
            {
              name: '__durations__',
              type: 'custom',
              coordinateSystem: 'cartesian2d',
              silent: true,
              tooltip: { show: false },
              xAxisIndex: 0,
              yAxisIndex: 0,
              z: 10,
              clip: false,
              renderItem: (params: any, api: any) => {
                const x0 = Number(api.value(0) ?? 0)
                const x1 = Number(api.value(1) ?? 0)
                const minutes = Number(api.value(2) ?? 0)
                const idx = Number(api.value(3) ?? 0)

                const c0 = api.coord([x0, 0])
                const c1 = api.coord([x1, 0])
                const cs = params.coordSys
                const yBase = (cs?.y ?? 0) + (cs?.height ?? 0)

                const left = Math.min(c0[0], c1[0])
                const width = Math.max(0, Math.abs(c1[0] - c0[0]))

                const label = (() => {
                  const m = Number.isFinite(minutes) ? Math.max(0, minutes) : 0
                  if (m >= 60) {
                    const h = m / 60
                    if (Math.abs(h - Math.round(h)) < 1e-9) return `${Math.round(h)}${hourText}`
                    return `${Math.round(h * 10) / 10}${hourText}`
                  }
                  return `${Math.round(m)}${minuteText}`
                })()

                const bandTop = yBase + 6
                const bandH = 22
                const bandFill = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.00)'

                return {
                  type: 'group',
                  children: [
                    {
                      type: 'rect',
                      shape: { x: left, y: bandTop, width, height: bandH, r: 3 },
                      style: { fill: bandFill, stroke: theme.palette.divider, lineWidth: 1, opacity: 1 },
                      silent: true,
                    },
                    {
                      type: 'line',
                      shape: { x1: left, y1: bandTop, x2: left, y2: bandTop + bandH },
                      style: { stroke: theme.palette.divider, lineWidth: 1, opacity: 0.85 },
                      silent: true,
                    },
                    {
                      type: 'text',
                      x: left + width / 2,
                      y: bandTop + bandH / 2 + 1,
                      style: {
                        text: label,
                        fill: theme.palette.text.secondary,
                        font: `800 12px ${theme.typography.fontFamily}`,
                        align: 'center',
                        verticalAlign: 'middle',
                      },
                      silent: true,
                    },
                  ],
                  silent: true,
                }
              },
              data: (() => {
                return scaled.ranges.map((r, i) => [r.d0, r.d1, steps[i]?.durationMinutes ?? 0, i])
              })(),
              emphasis: { disabled: true },
            },
          ],
          } as any)
        }
      />
    </Box>
  )
}

export default TestProfileChart

