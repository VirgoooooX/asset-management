import React, { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useI18n } from '../i18n'
import type { ProjectCostReportSeriesPoint } from '../services/reportService'
import EChart from './EChart'
import EmptyState from './EmptyState'

export interface CostTrendChartProps {
  series: ProjectCostReportSeriesPoint[]
  title: string
  emptyText: string
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({ series, title, emptyText }) => {
  const { tr } = useI18n()
  const theme = useTheme()
  const maxCostCents = useMemo(
    () => Math.max(0, ...series.map((p) => (Number.isFinite(p.costCents) ? p.costCents : 0))),
    [series]
  )

  const option = useMemo(
    () => ({
      color: [theme.palette.primary.main],
      grid: { top: 18, left: 58, right: 22, bottom: 48 },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'line' as const },
        valueFormatter: (v: unknown) => `¥${(Number(v) || 0).toFixed(2)}`,
      },
      xAxis: {
        type: 'category' as const,
        data: series.map((p) => p.day),
        axisLine: { lineStyle: { color: theme.palette.divider } },
        axisLabel: {
          color: theme.palette.text.secondary,
          formatter: (v: string) => String(v).slice(5),
        },
        name: tr('日期', 'Date'),
        nameLocation: 'middle' as const,
        nameGap: 34,
        nameTextStyle: { color: theme.palette.text.secondary },
      },
      yAxis: {
        type: 'value' as const,
        axisLine: { lineStyle: { color: theme.palette.divider } },
        splitLine: { lineStyle: { color: theme.palette.divider, opacity: 0.6 } },
        axisLabel: { color: theme.palette.text.secondary, formatter: (v: number) => `¥${Number(v).toFixed(0)}` },
        name: tr('费用', 'Cost'),
        nameLocation: 'middle' as const,
        nameGap: 44,
        nameTextStyle: { color: theme.palette.text.secondary },
      },
      series: [
        {
          type: 'line' as const,
          smooth: 0.35,
          showSymbol: false,
          itemStyle: { color: theme.palette.primary.main },
          lineStyle: { width: 3, color: theme.palette.primary.main },
          areaStyle: { opacity: 0.18, color: theme.palette.primary.main },
          emphasis: { focus: 'series' as const },
          data: series.map((p) => (Number.isFinite(p.costCents) ? p.costCents : 0) / 100),
        },
      ],
    }),
    [series, theme.palette.divider, theme.palette.primary.main, theme.palette.text.secondary, tr]
  )

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {series.length ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {series[0].day} → {series[series.length - 1].day}
          </Typography>
        ) : null}
      </Stack>
      {series.length <= 1 || maxCostCents <= 0 ? (
        <EmptyState compact title={emptyText} />
      ) : (
        <EChart height={260} option={option} />
      )}
    </Box>
  )
}

export default CostTrendChart
