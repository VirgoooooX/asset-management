import React from 'react'
import { Box, Skeleton, Stack, Typography } from '@mui/material'
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
      loading: isRepairLoading,
      value: String(repairStats.quotePending + repairStats.repairPending),
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
        `校验提醒（≤${kpis.calibrationAttention.daysThreshold}天到期）`,
        `Calibrations (≤${kpis.calibrationAttention.daysThreshold}d)`
      ),
      tone: 'warning' as const,
      attention: kpis.calibrationAttention.count > 0,
      loading: isLoading,
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
      loading: isLoading,
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
      loading: isLoading,
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
          lg: 'repeat(3, minmax(0, 1fr))',
          xl: 'repeat(5, minmax(0, 1fr))',
        },
        gridAutoRows: '1fr',
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
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
              gap: 1.25,
              minWidth: 0,
            }}
          >
            {statusTiles.map((item) => (
              <Box
                key={item.label}
                sx={{
                  border: '1px solid',
                  borderColor: alpha(item.color, 0.24),
                  background: `linear-gradient(180deg, ${alpha(item.color, theme.palette.mode === 'dark' ? 0.14 : 0.08)} 0%, ${alpha(theme.palette.background.paper, 1)} 78%)`,
                  borderRadius: 2,
                  p: 1.25,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 1,
                  minWidth: 0,
                }}
              >
                {isLoading ? (
                  <Skeleton variant="text" width={40} height={34} />
                ) : (
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: 'clamp(1.35rem, 1.8vw, 1.75rem)',
                      lineHeight: 1,
                      letterSpacing: -0.5,
                    }}
                    noWrap
                  >
                    {item.value}
                  </Typography>
                )}
                <Stack spacing={0.35} alignItems="flex-end" justifyContent="center" sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: 1.5,
                      display: 'grid',
                      placeItems: 'center',
                      backgroundColor: alpha(item.color, 0.14),
                      color: item.color,
                      flex: '0 0 auto',
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }} noWrap>
                    {item.label}
                  </Typography>
                </Stack>
              </Box>
            ))}
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
              contentSx={{ mt: 0, height: '100%' }}
            >
              <Box
                role="button"
                tabIndex={0}
                onClick={card.onClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    card.onClick()
                  }
                }}
                sx={{
                  height: '100%',
                  minHeight: 160,
                  border: '1px solid',
                  borderColor: alpha(accent, 0.24),
                  background: `linear-gradient(180deg, ${alpha(accent, theme.palette.mode === 'dark' ? 0.14 : 0.09)} 0%, ${alpha(theme.palette.background.paper, 1)} 72%)`,
                  borderRadius: 2,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: alpha(accent, 0.45),
                    boxShadow: `0 6px 16px ${alpha(accent, 0.18)}`,
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, lineHeight: 1.25, mb: 1.5, fontSize: { xs: 15, sm: 16 } }}
                  noWrap
                >
                  {card.title}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
                    gap: 1.25,
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    {card.loading ? (
                      <Skeleton variant="text" width={68} height={48} />
                    ) : (
                      <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: 'clamp(1.75rem, 2.4vw, 2.5rem)',
                            lineHeight: 1,
                            letterSpacing: -0.8,
                          }}
                          noWrap
                        >
                          {card.value}
                        </Typography>
                        {card.unit ? (
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {card.unit}
                          </Typography>
                        ) : null}
                      </Stack>
                    )}
                  </Box>

                  <Stack spacing={0.5} sx={{ minWidth: 0, alignItems: 'flex-end', textAlign: 'right' }}>
                    {card.notes.map((t) => (
                      <Typography key={t} variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
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
