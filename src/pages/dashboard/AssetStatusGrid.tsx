import React from 'react'
import { Box, Button, Chip, Divider, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import TimerOffIcon from '@mui/icons-material/TimerOff'
import { differenceInDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import AppCard from '../../components/AppCard'
import EmptyState from '../../components/EmptyState'
import { useI18n } from '../../i18n'
import { useAppSelector } from '../../store/hooks'
import type { Asset, RepairTicket, UsageLog } from '../../types'
import { formatDateTime, formatDurationMs } from '../../utils/formatters'
import { getAssetStatusMeta, getRepairStatusMeta } from '../../utils/statusMeta'

export interface ActiveOccupancy {
  chamberId: string
  chamberName: string
  log: UsageLog
  activeCount: number
  startMs: number
  endMs: number
}

export interface AssetStatusGridProps {
  assetsByCategory: Array<[string, Asset[]]>
  activeOccupancyByAssetId: Map<string, ActiveOccupancy>
  activeRepairByAssetId: Map<string, RepairTicket>
  projectNameById: Map<string, string>
  testProjectNameById: Map<string, string>
  isLoading: boolean
}

const buildStatusCardSx = (theme: Theme, accent: string, opts: { isOverdue: boolean }) => {
  const isDark = theme.palette.mode === 'dark'
  const effectiveAccent = opts.isOverdue ? theme.palette.error.main : accent

  return {
    borderRadius: 2,
    p: 1.25,
    cursor: 'pointer',
    height: 92,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid',
    borderColor: alpha(effectiveAccent, isDark ? 0.30 : 0.22),
    borderLeftWidth: 4,
    borderLeftColor: effectiveAccent,
    backgroundColor: alpha(effectiveAccent, isDark ? 0.10 : 0.045),
    transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease',
    '&:hover': {
      transform: 'translateY(-1px)',
      backgroundColor: alpha(effectiveAccent, isDark ? 0.14 : 0.075),
      borderColor: alpha(effectiveAccent, isDark ? 0.48 : 0.40),
      borderLeftColor: effectiveAccent,
      boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, isDark ? 0.32 : 0.08)}`,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  } as const
}

const GRID_COLUMNS_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
    lg: 'repeat(6, minmax(0, 1fr))',
    xl: 'repeat(8, minmax(0, 1fr))',
  },
  gap: 1.25,
} as const

const AssetStatusGrid: React.FC<AssetStatusGridProps> = ({
  assetsByCategory,
  activeOccupancyByAssetId,
  activeRepairByAssetId,
  projectNameById,
  testProjectNameById,
  isLoading,
}) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const { tr } = useI18n()
  const role = useAppSelector((s) => s.auth.user?.role)
  const canManage = role === 'admin' || role === 'manager'

  const nowForCardMs = Date.now()
  const nowDate = new Date(nowForCardMs)

  return (
    <AppCard
      title={tr('设备状态总览', 'Asset status')}
      actions={
        <Stack direction="row" spacing={1}>
          {canManage ? (
            <Button size="small" variant="outlined" onClick={() => navigate('/chambers')} sx={{ whiteSpace: 'nowrap' }}>
              {tr('设备列表', 'Assets')}
            </Button>
          ) : null}
          <Button size="small" variant="outlined" onClick={() => navigate('/timeline')} sx={{ whiteSpace: 'nowrap' }}>
            {tr('设备排程', 'Occupancy Schedule')}
          </Button>
        </Stack>
      }
      sx={{ mt: 2 }}
      contentSx={{ mx: -2.5, mb: -2.5 }}
    >
      {isLoading && assetsByCategory.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Box sx={GRID_COLUMNS_SX}>
            {Array.from({ length: 12 }).map((_, idx) => (
              <Skeleton key={`asset-skeleton-${idx}`} variant="rounded" height={92} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        </Box>
      ) : assetsByCategory.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <EmptyState
            title={tr('暂无设备', 'No assets')}
            description={tr('当前还没有登记任何设备资产。', 'No assets have been registered yet.')}
            action={
              canManage ? (
                <Button size="small" variant="contained" onClick={() => navigate('/assets/new')}>
                  {tr('新增设备', 'Add asset')}
                </Button>
              ) : undefined
            }
          />
        </Box>
      ) : (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Stack spacing={2}>
            {assetsByCategory.map(([category, list], idx) => {
              const statusCounts = list.reduce(
                (acc, a) => {
                  if (a.status === 'available') acc.available += 1
                  else if (a.status === 'in-use') acc.inUse += 1
                  else if (a.status === 'maintenance') acc.maintenance += 1
                  return acc
                },
                { available: 0, inUse: 0, maintenance: 0 }
              )

              return (
                <Box key={category}>
                  <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{category}</Typography>
                    <Chip size="small" label={tr(`共 ${list.length}`, `Total ${list.length}`)} variant="outlined" />
                    <Box sx={{ flex: 1 }} />
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Chip size="small" label={tr(`可用 ${statusCounts.available}`, `Available ${statusCounts.available}`)} color="success" variant="outlined" />
                      <Chip size="small" label={tr(`使用中 ${statusCounts.inUse}`, `In use ${statusCounts.inUse}`)} color="warning" variant="outlined" />
                      <Chip size="small" label={tr(`维护 ${statusCounts.maintenance}`, `Maintenance ${statusCounts.maintenance}`)} color="error" variant="outlined" />
                    </Stack>
                  </Stack>
                  <Box sx={GRID_COLUMNS_SX}>
                    {list.map((asset) => {
                      const color =
                        asset.status === 'available'
                          ? theme.palette.success.main
                          : asset.status === 'in-use'
                            ? theme.palette.warning.main
                            : theme.palette.error.main

                      const statusLabel = getAssetStatusMeta(asset.status, tr).label
                      const occupancy = activeOccupancyByAssetId.get(asset.id)
                      const projectName = occupancy?.log.projectId ? projectNameById.get(occupancy.log.projectId) : undefined
                      const testProjectName = occupancy?.log.testProjectId ? testProjectNameById.get(occupancy.log.testProjectId) : undefined
                      const endText = occupancy ? formatDateTime(occupancy.log.endTime) : undefined
                      const isOverdue = occupancy ? Number.isFinite(occupancy.endMs) && occupancy.endMs < nowForCardMs : false
                      const diffMs = occupancy ? (isOverdue ? nowForCardMs - occupancy.endMs : occupancy.endMs - nowForCardMs) : 0
                      const activeRepair = asset.status === 'maintenance' ? activeRepairByAssetId.get(asset.id) : undefined
                      const maintenanceDays = activeRepair
                        ? differenceInDays(nowDate, new Date(activeRepair.startedAt ?? activeRepair.createdAt))
                        : 0
                      const maintenanceStageLabel =
                        activeRepair && activeRepair.status !== 'completed'
                          ? getRepairStatusMeta(activeRepair.status, tr).label
                          : undefined

                      const tooltip = occupancy ? (
                        <Box sx={{ p: 0.25 }}>
                          <Typography sx={{ fontWeight: 700 }}>{asset.name}</Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {tr('项目', 'Project')}: {projectName ?? testProjectName ?? '-'}
                          </Typography>
                          <Typography variant="body2">{tr('使用人', 'User')}: {occupancy.log.user || '-'}</Typography>
                          <Typography variant="body2">{tr('开始', 'Start')}: {formatDateTime(occupancy.log.startTime)}</Typography>
                          <Typography variant="body2">{tr('结束', 'End')}: {endText}</Typography>
                          {occupancy.log.notes ? (
                            <Typography variant="body2" sx={{ mt: 0.5, maxWidth: 360 }}>
                              {tr('备注', 'Notes')}: {occupancy.log.notes}
                            </Typography>
                          ) : null}
                        </Box>
                      ) : null

                      const openAsset = () => navigate(`/assets/${asset.id}`)

                      const card = (
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={openAsset}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openAsset()
                            }
                          }}
                          sx={buildStatusCardSx(theme, color, { isOverdue })}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                              {asset.name}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <Chip
                              size="small"
                              label={statusLabel}
                              variant="outlined"
                              sx={{
                                height: 22,
                                fontWeight: 600,
                                borderColor: alpha(color, 0.38),
                                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.28 : 0.55),
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          </Stack>

                          {occupancy && asset.status === 'in-use' ? (
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {occupancy.log.user}
                            </Typography>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.primary"
                              noWrap
                              sx={{ fontWeight: 600, visibility: 'hidden' }}
                            >
                              -
                            </Typography>
                          )}

                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography
                              variant="caption"
                              color={isOverdue ? 'error.main' : 'text.secondary'}
                              noWrap
                              sx={{
                                fontWeight: isOverdue ? 700 : 500,
                                minWidth: 0,
                              }}
                            >
                              {occupancy && asset.status === 'in-use'
                                ? isOverdue
                                  ? tr(`逾期: ${formatDurationMs(diffMs)}`, `Overdue: ${formatDurationMs(diffMs)}`)
                                  : tr(`剩余: ${formatDurationMs(diffMs)}`, `Remaining: ${formatDurationMs(diffMs)}`)
                                : activeRepair
                                  ? tr(`停机: ${maintenanceDays}天`, `Stopped: ${maintenanceDays}d`)
                                  : tr('—', '—')}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            {asset.status === 'maintenance' && maintenanceStageLabel ? (
                              <Chip
                                size="small"
                                label={maintenanceStageLabel}
                                variant="outlined"
                                sx={{
                                  height: 22,
                                  fontWeight: 600,
                                  borderColor: alpha(theme.palette.error.main, 0.34),
                                  backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.14 : 0.08),
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                            ) : isOverdue ? (
                              <Chip
                                size="small"
                                icon={<TimerOffIcon />}
                                label={tr('超时', 'Overdue')}
                                variant="outlined"
                                sx={{
                                  height: 22,
                                  fontWeight: 700,
                                  borderColor: alpha(theme.palette.error.main, 0.42),
                                  backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.14 : 0.08),
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                            ) : null}
                          </Stack>
                        </Box>
                      )

                      return (
                        <Box key={asset.id}>
                          {tooltip ? (
                            <Tooltip
                              title={tooltip}
                              arrow
                              placement="top-start"
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.98 : 0.96),
                                    color: 'text.primary',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    boxShadow: `0 12px 28px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.48 : 0.22)}`,
                                  },
                                },
                              }}
                            >
                              {card}
                            </Tooltip>
                          ) : (
                            card
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                  {idx === assetsByCategory.length - 1 ? null : <Divider sx={{ mt: 2 }} />}
                </Box>
              )
            })}
          </Stack>
        </Box>
      )}
    </AppCard>
  )
}

export default AssetStatusGrid
