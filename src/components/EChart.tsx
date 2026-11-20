import React, { useEffect, useMemo, useRef } from 'react'
import { Box } from '@mui/material'
import { echarts, type EChartsOption } from '../charts/echarts'
import { useTheme } from '@mui/material/styles'

export const EChart: React.FC<{
  option: EChartsOption
  height?: number
  minWidth?: number
}> = ({ option, height = 260, minWidth = 520 }) => {
  const theme = useTheme()
  const divRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null)

  const mergedOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      textStyle: { color: theme.palette.text.primary, fontFamily: theme.typography.fontFamily },
      ...option,
    } as EChartsOption
  }, [option, theme.palette.text.primary, theme.typography.fontFamily])

  useEffect(() => {
    if (!divRef.current) return
    const chart = echarts.init(divRef.current, undefined, { renderer: 'canvas' })
    chartRef.current = chart
    return () => {
      chartRef.current = null
      chart.dispose()
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption(mergedOption, { notMerge: true, lazyUpdate: true })
  }, [mergedOption])

  useEffect(() => {
    const el = divRef.current
    const chart = chartRef.current
    if (!el || !chart) return
    let rafId: number | null = null
    const ro = new ResizeObserver(() => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        chart.resize()
      })
    })
    ro.observe(el)
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Box sx={{ minWidth }}>
        <Box ref={divRef} sx={{ width: '100%', height }} />
      </Box>
    </Box>
  )
}

export default EChart

