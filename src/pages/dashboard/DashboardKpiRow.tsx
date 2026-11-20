import React from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AssessmentIcon from '@mui/icons-material/Assessment'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import SpeedIcon from '@mui/icons-material/Speed'
import { useNavigate } from 'react-router-dom'
import AppCard from '../../components/AppCard'
import { useI18n } from '../../i18n'
import type { RangePreset } from '../../utils/dateRange'
import type { selectDashboardKpis } from '../../store/kpiSelectors'

const TOP_ROW_HEIGHT = 180

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

export interface DashboardKpiRowProps {
  kpis: ReturnType<typeof selectDashboardKpis>
  repairStats: {
    quotePending: number
    repairPending: number
    completedThisWeek: number
  }
  isLoading: boolean
  isRepairLoading: boolean
  preset: RangePreset
  hasTopSpacing?: boolean
}

const DashboardKpiRow: React.FC<DashboardKpiRowProps> = ({
  kpis,
  repairStats,
  isLoading,
  isRepairLoading,
  preset,
  hasTopSpacing = false,
}) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const { tr } = useI18n()

  const utilizationText = formatPercent(kpis.utilization.ratio)
  const windowLabel = tr(
    preset === 'custom' ? '自定义' : preset === '7d' ? '7天' : preset === '30d' ? '30天' : '90天',
    preset === 'custom' ? 'Custom' : preset === '7d' ? '7d' : preset === '30d' ? '30d' : '90d'
  )

  const statusTiles = [
    {
      label: tr('设备总数', 'Total'),
      value: kpis.totalAssets,
      color: theme.palette.primary.main,
      icon: <AssessmentIcon fontSize="small" />,
    },
    {
      label: tr('可用', 'Available'),
      value: kpis.statusCounts.available,
      color: theme.palette.success.main,
      icon: <EventAvailableIcon fontSize="small" />,
    },
    {
      label: tr('使用中', 'In use'),
      value: kpis.statusCounts['in-use'],
      color: theme.palette.warning.main,
      icon: <SpeedIcon fontSize="small" />,
    },
    {
      label: tr('维护中', 'Maintenance'),
      value: kpis.statusCounts.maintenance,
      color: theme.palette.error.main,
      icon: <BuildCircleIcon fontSize="small" />,
    },
  ] as const

  const summaryCards = [
    {
      title: tr('维修追踪', 'Repairs'),
      tone: 'warning' as const,
      attention: repairStats.quotePending > 0 || repairStats.repairPending > 0,
      value: isRepairLoading ? '-' : String(repairStats.quotePending + repairStats.repairPending),
      unit: tr('单', ''),
      notes: [
        tr(`未询价：${isRepairLoading ? '-' : repairStats.quotePending}`, `Quote pending: ${isRepairLoading ? '-' : repairStats.quotePending}`),
        tr(`待维修：${isRepairLoading ? '-' : repairStats.repairPending}`, `Repair pending: ${isRepairLoading ? '-' : repairStats.repairPending}`),
        tr(`本周完成：${isRepairLoading ? '-' : repairStats.completedThisWeek}`, `Completed (7d): ${isRepairLoading ? '-' : repairStats.completedThisWeek}`),
      ],
      onClick: () => navigate('/repairs'),
    },
    {
      title: tr(
        `校验提醒（≤${kpis.calibrationAttention.daysThreshold}天为即将到期）`,
        `Calibrations (due ≤${kpis.calibrationAttention.daysThreshold}d)`
      ),
      tone: 'warning' as const,
      attention: kpis.calibrationAttention.count > 0,
      value: String(kpis.calibrationAttention.count),
      unit: tr('台', ''),
      notes: [
        tr(`即将到期：${kpis.calibrationAttention.dueCount}`, `Due soon: ${kpis.calibrationAttention.dueCount}`),
        tr(`已逾期：${kpis.calibrationAttention.overdueCount}`, `Overdue: ${kpis.calibrationAttention.overdueCount}`),
        tr(`未填写：${kpis.calibrationAttention.missingCount}`, `Missing: ${kpis.calibrationAttention.missingCount}`),
      ],
      onClick: () => navigate('/calibrations'),
    },
    {
      title: tr('使用率', 'Utilization'),
      tone: 'primary' as const,
      attention: false,
      value: utilizationText,
      unit: '',
      notes: [
        tr(`时间窗：${windowLabel}`, `Window: ${windowLabel}`),
        tr('口径：合并占用时段', 'Logic: merged occupancy'),
        tr(`数据：${isLoading ? '加载中' : '已更新'}`, `Data: ${isLoading ? 'Loading' : 'Updated'}`),
      ],
      onClick: () => navigate('/timeline'),
    },
    {
      title: tr('超时/逾期', 'Overdue'),
      tone: 'error' as const,
      attention: kpis.overdueActiveCount > 0,
      value: String(kpis.overdueActiveCount),
      unit: tr('条', ''),
      notes: [
        tr('口径：时间窗内逾期记录', 'Logic: overdue within window'),
        tr(`时间窗：${windowLabel}`, `Window: ${windowLabel}`),
        tr(`数据：${isLoading ? '加载中' : '已更新'}`, `Data: ${isLoading ? 'Loading' : 'Updated'}`),
      ],
      onClick: () => navigate('/usage-logs'),
    },
  ] as const

  return (
    <Box
      sx={{
        mt: hasTopSpacing ? 2 : 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, minmax(0, 1fr))',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
        gridAutoRows: `${TOP_ROW_HEIGHT}px`,
        gridAutoFlow: 'row',
        gap: 2,
        alignItems: 'stretch',
      }}
    >
      <Box sx={{ display: 'flex', minWidth: 0, height: '100%', alignItems: 'stretch' }}>
        <AppCard
          sx={{
            flex: 1,
            height: '100%',
            p: 0,
            border: 'none',
            boxShadow: 'none',
            backgroundColor: 'transparent',
          }}
          contentSx={{ mt: 0, height: '100%' }}
        >
          <Box sx={{ height: '100%', overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(2, auto)',
                gap: 1.25,
                minWidth: 0,
                alignContent: 'start',
              }}
            >
              {statusTiles.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    border: '1px solid',
                    borderColor: alpha(item.color, 0.24),
                    background: `linear-gradient(180deg, ${alpha(item.color, 0.10)} 0%, ${alpha(theme.palette.background.paper, 1)} 74%)`,
                    borderRadius: 2,
                    p: 1.5,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 1.25,
                    minWidth: 0,
                  }}
                >
                  <Typography sx={{ fontWeight: 950, fontSize: 40, lineHeight: 1, letterSpacing: -0.9 }} noWrap>
                    {item.value}
                  </Typography>
                  <Stack spacing={0.35} alignItems="flex-end" justifyContent="center" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: alpha(item.color, 0.14),
                        color: item.color,
                        flex: '0 0 auto',
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }} noWrap>
                      {item.label}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        </AppCard>
      </Box>

      {summaryCards.map((card) => {
        const accent = card.attention
          ? card.tone === 'warning'
            ? theme.palette.warning.main
            : card.tone === 'error'
              ? theme.palette.error.main
              : theme.palette.primary.main
          : theme.palette.primary.main

        return (
          <Box key={card.title} sx={{ display: 'flex', minWidth: 0, height: '100%', alignItems: 'stretch' }}>
            <AppCard
              sx={{
                flex: 1,
                height: '100%',
                p: 0,
                border: 'none',
                boxShadow: 'none',
                backgroundColor: 'transparent',
              }}
              contentSx={{ mt: 0 }}
            >
              <Box
                onClick={card.onClick}
                sx={{
                  height: '100%',
                  minHeight: 160,
                  border: '1px solid',
                  borderColor: alpha(accent, 0.24),
                  background: `linear-gradient(180deg, ${alpha(accent, 0.12)} 0%, ${alpha(theme.palette.background.paper, 1)} 68%)`,
                  borderRadius: 2,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${alpha(accent, 0.25)}`,
                  },
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 950, lineHeight: 1.15, mb: 2, fontSize: { xs: 16, sm: 17 } }} noWrap>
                  {card.title}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 1.25, alignItems: 'center', flex: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 950, fontSize: 56, lineHeight: 1, letterSpacing: -1.2 }} noWrap>
                        {card.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 850, ml: 0.5 }}>
                        {card.unit || ' '}
                      </Typography>
                    </Stack>
                  </Box>

                  <Stack spacing={0.75} sx={{ minWidth: 0, alignItems: 'flex-end', textAlign: 'right' }}>
                    {card.notes.map((t) => (
                      <Typography key={t} variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }} noWrap>
                        {t}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              </Box>
            </AppCard>
          </Box>
        )
      })}
    </Box>
  )
}

export default DashboardKpiRow
