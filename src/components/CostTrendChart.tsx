import React, { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { useI18n } from '../i18n'
import type { ProjectCostReportSeriesPoint } from '../services/reportService'
import EChart from './EChart'

export interface CostTrendChartProps {
  series: ProjectCostReportSeriesPoint[]
  title: string
  emptyText: string
}

const CostTrendChart: React.FC<CostTrendChartProps> = ({ series, title, emptyText }) => {
  const { tr } = useI18n()
  const maxCostCents = useMemo(
    () => Math.max(0, ...series.map((p) => (Number.isFinite(p.costCents) ? p.costCents : 0))),
    [series]
  )

  const option = useMemo(
    () => ({
      grid: { top: 18, left: 58, right: 22, bottom: 48 },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'line' as const },
        valueFormatter: (v: unknown) => `¥${(Number(v) || 0).toFixed(2)}`,
      },
      xAxis: {
        type: 'category' as const,
        data: series.map((p) => p.day),
        axisLabel: {
          formatter: (v: string) => String(v).slice(5),
        },
        name: tr('日期', 'Date'),
        nameLocation: 'middle' as const,
        nameGap: 34,
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: (v: number) => `¥${Number(v).toFixed(0)}` },
        name: tr('费用', 'Cost'),
        nameLocation: 'middle' as const,
        nameGap: 44,
      },
      series: [
        {
          type: 'line' as const,
          smooth: 0.35,
          showSymbol: false,
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.18 },
          emphasis: { focus: 'series' as const },
          data: series.map((p) => (Number.isFinite(p.costCents) ? p.costCents : 0) / 100),
        },
      ],
    }),
    [series, tr]
  )

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
        {series.length ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
            {series[0].day} → {series[series.length - 1].day}
          </Typography>
        ) : null}
      </Stack>
      {series.length <= 1 || maxCostCents <= 0 ? (
        <Typography color="text.secondary">{emptyText}</Typography>
      ) : (
        <EChart height={260} option={option} />
      )}
    </Box>
  )
}

export default CostTrendChart
