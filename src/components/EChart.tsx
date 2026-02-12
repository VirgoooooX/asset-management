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
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const handler = () => chart.resize()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
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

