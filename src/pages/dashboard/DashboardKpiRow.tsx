import React from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { RangePreset } from '../../utils/dateRange'
import type { selectDashboardKpis } from '../../store/kpiSelectors'

const CARD_HEIGHT = 156

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
  const isDark = theme.palette.mode === 'dark'
  const { tr } = useI18n()

  const utilizationRatio = Math.max(0, Math.min(1, kpis.utilization.ratio || 0))
  const utilizationText = formatPercent(utilizationRatio)
  const windowLabel = tr(
    preset === 'custom' ? '自定义' : preset === '7d' ? '7天' : preset === '30d' ? '30天' : '90天',
    preset === 'custom' ? 'Custom' : preset === '7d' ? '7d' : preset === '30d' ? '30d' : '90d'
  )

  const totalAssets = kpis.totalAssets
  const availableCount = kpis.statusCounts.available
  const inUseCount = kpis.statusCounts['in-use']
  const maintenanceCount = kpis.statusCounts.maintenance
  const availablePct = totalAssets > 0 ? Math.round((availableCount / totalAssets) * 100) : 0

  const activeRepairsCount = repairStats.quotePending + repairStats.repairPending
  const hasRepairAttention = activeRepairsCount > 0
  const hasCalibrationAttention = kpis.calibrationAttention.count > 0
  const hasOverdueAttention = kpis.overdueActiveCount > 0

  const buildCardSx = (accent: string) => ({
    height: CARD_HEIGHT,
    borderRadius: '12px',
    p: 1.75,
    border: '1px solid',
    borderColor: alpha(accent, isDark ? 0.34 : 0.24),
    background: `linear-gradient(180deg, ${alpha(accent, isDark ? 0.16 : 0.1)} 0%, ${theme.palette.background.paper} 66%)`,
    boxShadow: isDark
      ? `0 4px 16px -4px rgba(0, 0, 0, 0.45)`
      : `0 2px 10px -2px rgba(15, 23, 42, 0.05)`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: 'pointer',
    minWidth: 0,
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: alpha(accent, isDark ? 0.52 : 0.42),
      boxShadow: `0 8px 20px -6px ${alpha(accent, isDark ? 0.32 : 0.22)}`,
    },
  })

  const buildBadgeSx = (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    px: 0.85,
    borderRadius: '6px',
    fontSize: '0.68rem',
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: isDark ? alpha('#ffffff', 0.92) : color,
    backgroundColor: alpha(color, isDark ? 0.24 : 0.12),
    flexShrink: 0,
  })

  const footerRowSx = (accent: string) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0.75,
    pt: 1,
    borderTop: '1px solid',
    borderColor: alpha(accent, isDark ? 0.18 : 0.12),
    fontSize: '0.73rem',
    color: 'text.secondary',
    minWidth: 0,
  })

  // Donut gauge geometry
  const ringRadius = 18
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringDashOffset = ringCircumference * (1 - utilizationRatio)

  const fleetAccent = theme.palette.success.main
  const utilizationAccent = theme.palette.primary.main
  const overdueAccent = hasOverdueAttention ? theme.palette.error.main : theme.palette.primary.main
  const repairAccent = hasRepairAttention ? theme.palette.warning.main : theme.palette.primary.main
  const calibrationAccent =
    kpis.calibrationAttention.overdueCount > 0
      ? theme.palette.error.main
      : hasCalibrationAttention
        ? theme.palette.warning.main
        : theme.palette.primary.main

  return (
    <Box
      sx={{
        mt: hasTopSpacing ? 2 : 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, minmax(0, 1fr))',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
          lg: '1.15fr repeat(4, minmax(0, 1fr))',
        },
        gap: 1.75,
        alignItems: 'stretch',
      }}
    >
      {/* Card 1: Fleet Status Distribution */}
      <Box onClick={() => navigate('/chambers')} sx={buildCardSx(fleetAccent)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 850, fontSize: '0.92rem', lineHeight: 1.2 }} noWrap>
            {tr('设备运行态势', 'Fleet Status')}
          </Typography>
          <Box component="span" sx={buildBadgeSx(theme.palette.primary.main)}>
            {tr(`共 ${totalAssets} 台`, `${totalAssets} Total`)}
          </Box>
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 1 }}>
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: '2.15rem',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {availableCount}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: 'success.main' }} noWrap>
              {tr('台可用', 'available')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 'auto', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}
              noWrap
            >
              {availablePct}% {tr('空闲', 'free')}
            </Typography>
          </Box>

          {/* Three-color segmented bar */}
          <Box
            sx={{
              height: 7,
              borderRadius: 999,
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.08),
              display: 'flex',
              overflow: 'hidden',
              gap: '2px',
            }}
          >
            {totalAssets > 0 ? (
              <>
                {availableCount > 0 ? (
                  <Box
                    sx={{
                      flex: availableCount,
                      backgroundColor: 'success.main',
                      borderRadius: 999,
                      transition: 'flex 300ms ease',
                    }}
                  />
                ) : null}
                {inUseCount > 0 ? (
                  <Box
                    sx={{
                      flex: inUseCount,
                      backgroundColor: 'warning.main',
                      borderRadius: 999,
                      transition: 'flex 300ms ease',
                    }}
                  />
                ) : null}
                {maintenanceCount > 0 ? (
                  <Box
                    sx={{
                      flex: maintenanceCount,
                      backgroundColor: 'error.main',
                      borderRadius: 999,
                      transition: 'flex 300ms ease',
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </Box>
        </Box>

        <Box sx={footerRowSx(fleetAccent)}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
            {tr('可用', 'Avail')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {availableCount}
            </Box>
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />
            {tr('使用', 'In use')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {inUseCount}
            </Box>
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main' }} />
            {tr('维护', 'Maint')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {maintenanceCount}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Card 2: Utilization with Donut Gauge */}
      <Box onClick={() => navigate('/timeline')} sx={buildCardSx(utilizationAccent)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 850, fontSize: '0.92rem', lineHeight: 1.2 }} noWrap>
            {tr('设备使用率', 'Utilization')}
          </Typography>
          <Box component="span" sx={buildBadgeSx(utilizationAccent)}>
            {tr(preset === 'custom' ? '自定义窗' : `近 ${windowLabel}`, windowLabel)}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: '2.25rem',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                color: 'text.primary',
              }}
            >
              {isLoading ? '-' : utilizationText}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, fontWeight: 550 }} noWrap>
              {tr('合并占用时段', 'Merged occupancy')}
            </Typography>
          </Box>

          <Box
            component="svg"
            width={48}
            height={48}
            viewBox="0 0 44 44"
            sx={{ flexShrink: 0, transform: 'rotate(-90deg)' }}
            aria-hidden="true"
          >
            <circle
              cx="22"
              cy="22"
              r={ringRadius}
              fill="none"
              stroke={alpha(theme.palette.text.primary, isDark ? 0.16 : 0.1)}
              strokeWidth="5"
            />
            <circle
              cx="22"
              cy="22"
              r={ringRadius}
              fill="none"
              stroke={utilizationAccent}
              strokeWidth="5"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringDashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          </Box>
        </Box>

        <Box sx={footerRowSx(utilizationAccent)}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', fontVariantNumeric: 'tabular-nums' }} noWrap>
            {tr(`活跃占用 ${inUseCount} / ${totalAssets} 台`, `Active ${inUseCount} / ${totalAssets}`)}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.73rem', fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>
            {tr('排程 ›', 'Schedule ›')}
          </Typography>
        </Box>
      </Box>

      {/* Card 3: Overdue */}
      <Box onClick={() => navigate('/usage-logs')} sx={buildCardSx(overdueAccent)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 850, fontSize: '0.92rem', lineHeight: 1.2 }} noWrap>
            {tr('超时 / 逾期', 'Overdue')}
          </Typography>
          <Box
            component="span"
            sx={buildBadgeSx(hasOverdueAttention ? theme.palette.error.main : theme.palette.success.main)}
          >
            {hasOverdueAttention ? tr('需关注', 'Action needed') : tr('无逾期', 'Clear')}
          </Box>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: '2.35rem',
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              color: hasOverdueAttention ? 'error.main' : 'text.primary',
            }}
          >
            {isLoading ? '-' : kpis.overdueActiveCount}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 750,
              color: hasOverdueAttention ? 'error.main' : 'text.secondary',
            }}
            noWrap
          >
            {tr('条未完成', 'overdue')}
          </Typography>
        </Stack>

        <Box sx={footerRowSx(overdueAccent)}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem' }} noWrap>
            {tr(`时间窗：${windowLabel}`, `Window: ${windowLabel}`)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.73rem',
              fontWeight: 700,
              color: hasOverdueAttention ? 'error.main' : 'primary.main',
              whiteSpace: 'nowrap',
            }}
          >
            {tr('去处理 ›', 'View ›')}
          </Typography>
        </Box>
      </Box>

      {/* Card 4: Repairs */}
      <Box onClick={() => navigate('/repairs')} sx={buildCardSx(repairAccent)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 850, fontSize: '0.92rem', lineHeight: 1.2 }} noWrap>
            {tr('维修追踪', 'Repairs')}
          </Typography>
          <Box
            component="span"
            sx={buildBadgeSx(hasRepairAttention ? theme.palette.warning.main : theme.palette.success.main)}
          >
            {hasRepairAttention ? tr('处理中', 'Active') : tr('正常', 'Normal')}
          </Box>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: '2.35rem',
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              color: hasRepairAttention ? 'warning.main' : 'text.primary',
            }}
          >
            {isRepairLoading ? '-' : activeRepairsCount}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: 'text.secondary' }} noWrap>
            {tr('单进行中', 'active')}
          </Typography>
        </Stack>

        <Box sx={footerRowSx(repairAccent)}>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {tr('未询价', 'Quote')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {isRepairLoading ? '-' : repairStats.quotePending}
            </Box>
          </Box>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {tr('待修', 'Pending')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {isRepairLoading ? '-' : repairStats.repairPending}
            </Box>
          </Box>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {tr('周完成', '7d')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {isRepairLoading ? '-' : repairStats.completedThisWeek}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Card 5: Calibrations */}
      <Box onClick={() => navigate('/calibrations')} sx={buildCardSx(calibrationAccent)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 850, fontSize: '0.92rem', lineHeight: 1.2 }} noWrap>
            {tr('校验提醒', 'Calibrations')}
          </Typography>
          <Box
            component="span"
            sx={buildBadgeSx(hasCalibrationAttention ? calibrationAccent : theme.palette.text.secondary)}
          >
            {tr(`阈值 ≤${kpis.calibrationAttention.daysThreshold}天`, `Due ≤${kpis.calibrationAttention.daysThreshold}d`)}
          </Box>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: '2.35rem',
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              color:
                kpis.calibrationAttention.overdueCount > 0
                  ? 'error.main'
                  : hasCalibrationAttention
                    ? 'warning.main'
                    : 'text.primary',
            }}
          >
            {kpis.calibrationAttention.count}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: 'text.secondary' }} noWrap>
            {tr('台即将到期', 'due soon')}
          </Typography>
        </Stack>

        <Box sx={footerRowSx(calibrationAccent)}>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {tr('到期', 'Due')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {kpis.calibrationAttention.dueCount}
            </Box>
          </Box>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {tr('逾期', 'Over')}{' '}
            <Box
              component="b"
              sx={{
                color: kpis.calibrationAttention.overdueCount > 0 ? 'error.main' : 'text.primary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {kpis.calibrationAttention.overdueCount}
            </Box>
          </Box>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {tr('未填', 'Unset')}{' '}
            <Box component="b" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {kpis.calibrationAttention.missingCount}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default DashboardKpiRow
