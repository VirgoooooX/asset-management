import React, { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import SpeedIcon from '@mui/icons-material/Speed'
import TimerOffIcon from '@mui/icons-material/TimerOff'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { startOfDay, subDays, differenceInDays } from 'date-fns'
import AppCard from '../components/AppCard'
import PageShell from '../components/PageShell'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchUsageLogs } from '../store/usageLogsSlice'
import { selectDashboardKpis } from '../store/kpiSelectors'
import { setDashboardRangePreset } from '../store/settingsSlice'
import TitleWithIcon from '../components/TitleWithIcon'
import DashboardIcon from '@mui/icons-material/Dashboard'
import { fetchRepairTickets } from '../store/repairTicketsSlice'
import { useNavigate } from 'react-router-dom'
import { fetchProjects } from '../store/projectsSlice'
import { fetchTestProjects } from '../store/testProjectsSlice'
import { isUsageLogOccupyingAsset } from '../utils/statusHelpers'
import type { Asset, UsageLog } from '../types'
import { useI18n } from '../i18n'

type RangePreset = '7d' | '30d' | '90d' | 'custom'

const TOP_ROW_HEIGHT = 180

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const formatDuration = (ms: number) => {
  const abs = Math.max(0, Math.round(Math.abs(ms)))
  const totalMinutes = Math.floor(abs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const KpiTile: React.FC<{
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'error'
  footer?: React.ReactNode
}> = ({ label, value, icon, tone = 'default', footer }) => {
  const theme = useTheme()
  const color =
    tone === 'success'
      ? theme.palette.success.main
      : tone === 'warning'
        ? theme.palette.warning.main
        : tone === 'error'
          ? theme.palette.error.main
          : theme.palette.primary.main

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: alpha(color, 0.22),
        background: `linear-gradient(180deg, ${alpha(color, 0.10)} 0%, ${alpha(theme.palette.background.paper, 1)} 56%)`,
        borderRadius: 2,
        p: 1.5,
        minHeight: 92,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
        <Stack spacing={0.25}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ lineHeight: 1.05, fontWeight: 900 }}>
            {value}
          </Typography>
        </Stack>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: alpha(color, 0.14),
            color,
          }}
        >
          {icon}
        </Box>
      </Stack>
      {footer ? (
        <Box sx={{ mt: 1 }}>
          <Divider sx={{ mb: 1 }} />
          {footer}
        </Box>
      ) : null}
    </Box>
  )
}

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const theme = useTheme()
  const { tr, dateFnsLocale, language } = useI18n()

  const assetsLoading = useAppSelector((s) => s.assets.loading)
  const usageLogsLoading = useAppSelector((s) => s.usageLogs.loading)
  const repairTicketsLoading = useAppSelector((s) => s.repairTickets.loading)
  const repairTickets = useAppSelector((s) => s.repairTickets.tickets)
  const assets = useAppSelector((s) => s.assets.assets)
  const usageLogs = useAppSelector((s) => s.usageLogs.usageLogs)
  const projects = useAppSelector((s) => s.projects.projects)
  const testProjects = useAppSelector((s) => s.testProjects.testProjects)
  const settings = useAppSelector((s) => s.settings)

  const [preset, setPreset] = useState<RangePreset>(settings.dashboard.rangePreset)
  const [customStart, setCustomStart] = useState<Date | null>(startOfDay(subDays(new Date(), 30)))
  const [customEnd, setCustomEnd] = useState<Date | null>(new Date())
  const calibrationDaysThreshold = settings.alerts.calibrationDaysThreshold

  useEffect(() => {
    if (preset !== 'custom') setPreset(settings.dashboard.rangePreset)
  }, [preset, settings.dashboard.rangePreset])

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchUsageLogs())
    dispatch(fetchRepairTickets(undefined))
    dispatch(fetchProjects())
    dispatch(fetchTestProjects())
  }, [dispatch])

  const { startMs, endMs } = useMemo(() => {
    const now = new Date()
    if (preset === '7d') {
      return { startMs: startOfDay(subDays(now, 7)).getTime(), endMs: now.getTime() }
    }
    if (preset === '30d') {
      return { startMs: startOfDay(subDays(now, 30)).getTime(), endMs: now.getTime() }
    }
    if (preset === '90d') {
      return { startMs: startOfDay(subDays(now, 90)).getTime(), endMs: now.getTime() }
    }
    const start = customStart ?? startOfDay(subDays(now, 30))
    const end = customEnd ?? now
    return { startMs: start.getTime(), endMs: end.getTime() }
  }, [customEnd, customStart, preset])

  const nowMs = useMemo(() => Date.now(), [startMs, endMs])

  const glassCardSx = (accent: string, opts: { isOverdue: boolean }) => {
    const baseBgTop = alpha(accent, theme.palette.mode === 'dark' ? 0.16 : 0.10)
    const baseBgBottom = alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.44 : 0.92)
    const border = alpha(accent, theme.palette.mode === 'dark' ? 0.32 : 0.20)
    const shadow = alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.50 : 0.12)

    const overdueAccent = theme.palette.error.main
    const overdueBorder = alpha(overdueAccent, theme.palette.mode === 'dark' ? 0.46 : 0.32)
    const overdueGlow = alpha(overdueAccent, theme.palette.mode === 'dark' ? 0.22 : 0.14)

    return {
      borderRadius: 2,
      p: 1.1,
      cursor: 'pointer',
      height: 92,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid',
      borderColor: opts.isOverdue ? overdueBorder : border,
      background: `linear-gradient(180deg, ${baseBgTop}, ${baseBgBottom})`,
      boxShadow: `0 18px 36px ${shadow}`,
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 18% 22%, ${alpha(accent, 0.34)}, transparent 58%), radial-gradient(circle at 78% 88%, ${alpha(accent, 0.18)}, transparent 62%)`,
        opacity: theme.palette.mode === 'dark' ? 0.72 : 0.55,
        pointerEvents: 'none',
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        background: opts.isOverdue
          ? `radial-gradient(circle at 78% 18%, ${alpha(overdueAccent, 0.34)}, transparent 58%), linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 42%, rgba(255,255,255,0.08))`
          : 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 42%, rgba(255,255,255,0.08))',
        opacity: theme.palette.mode === 'dark' ? 0.22 : 0.18,
        pointerEvents: 'none',
      },
      ...(opts.isOverdue
        ? {
            outline: `1px solid ${alpha(overdueAccent, 0.22)}`,
            boxShadow: `0 20px 42px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.56 : 0.16)}, 0 10px 30px ${overdueGlow}`,
          }
        : null),
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: `0 20px 42px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.54 : 0.14)}`,
      },
      transition: 'transform 140ms ease, box-shadow 140ms ease',
    } as const
  }

  const kpis = useAppSelector((state) =>
    selectDashboardKpis(state, startMs, endMs, calibrationDaysThreshold, nowMs)
  )

  const isLoading = assetsLoading || usageLogsLoading
  const isRepairLoading = repairTicketsLoading
  const utilizationText = useMemo(() => formatPercent(kpis.utilization.ratio), [kpis.utilization.ratio])

  const repairStats = useMemo(() => {
    const quotePending = repairTickets.filter((t) => t.status === 'quote-pending').length
    const repairPending = repairTickets.filter((t) => t.status === 'repair-pending').length
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const completedThisWeek = repairTickets.filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false
      const ms = new Date(t.completedAt).getTime()
      return !Number.isNaN(ms) && ms >= weekAgo
    }).length
    return { quotePending, repairPending, completedThisWeek }
  }, [repairTickets])

  const urgentOpenRepairs = useMemo(() => {
    const open = repairTickets.filter((t) => t.status !== 'completed')
    return open
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt ?? a.createdAt).getTime()
        const bTime = new Date(b.updatedAt ?? b.createdAt).getTime()
        return bTime - aTime
      })
      .slice(0, 5)
  }, [repairTickets])

  const assetNameById = useMemo(() => {
    const map = new Map<string, string>()
    assets.forEach((a) => map.set(a.id, a.name))
    return map
  }, [assets])

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [projects])

  const testProjectNameById = useMemo(() => {
    const map = new Map<string, string>()
    testProjects.forEach((p) => map.set(p.id, p.name))
    return map
  }, [testProjects])

  type ActiveOccupancy = {
    chamberId: string
    chamberName: string
    log: UsageLog
    activeCount: number
    startMs: number
    endMs: number
  }

  const activeOccupancies = useMemo<ActiveOccupancy[]>(() => {
    const now = new Date()
    const byChamber = new Map<string, UsageLog[]>()
    const sortLocale = language === 'en' ? 'en' : 'zh-Hans-CN'

    usageLogs.forEach((log) => {
      if (!isUsageLogOccupyingAsset(log, now)) return
      const list = byChamber.get(log.chamberId) ?? []
      list.push(log)
      byChamber.set(log.chamberId, list)
    })

    const parseMs = (value?: string, fallback: number = Number.POSITIVE_INFINITY) => {
      if (!value) return fallback
      const ms = new Date(value).getTime()
      return Number.isNaN(ms) ? fallback : ms
    }

    const pickBestLog = (logs: UsageLog[]) => {
      const nowMs = now.getTime()
      return logs
        .slice()
        .sort((a, b) => {
          const aEnd = parseMs(a.endTime)
          const bEnd = parseMs(b.endTime)
          if (aEnd !== bEnd) return aEnd - bEnd
          const aStart = parseMs(a.startTime, nowMs)
          const bStart = parseMs(b.startTime, nowMs)
          return bStart - aStart
        })[0]
    }

    const result: ActiveOccupancy[] = []
    byChamber.forEach((logs, chamberId) => {
      const best = pickBestLog(logs)
      const chamberName = assetNameById.get(chamberId) ?? chamberId.slice(0, 8)
      const startMs = parseMs(best.startTime, now.getTime())
      const endMs = parseMs(best.endTime)
      result.push({
        chamberId,
        chamberName,
        log: best,
        activeCount: logs.length,
        startMs,
        endMs,
      })
    })

    return result.sort((a, b) => {
      if (a.endMs !== b.endMs) return a.endMs - b.endMs
      if (a.startMs !== b.startMs) return b.startMs - a.startMs
      return a.chamberName.localeCompare(b.chamberName, sortLocale)
    })
  }, [assetNameById, language, usageLogs])

  const activeOccupancyByAssetId = useMemo(() => {
    const map = new Map<string, ActiveOccupancy>()
    activeOccupancies.forEach((o) => map.set(o.chamberId, o))
    return map
  }, [activeOccupancies])

  const assetsByCategory = useMemo(() => {
    const map = new Map<string, Asset[]>()
    const sortLocale = language === 'en' ? 'en' : 'zh-Hans-CN'
    assets.forEach((asset) => {
      const key =
        settings.dashboard.groupBy === 'location'
          ? asset.location?.trim() || tr('未设置位置', 'Unassigned')
          : asset.category?.trim() || (asset.type === 'chamber' ? tr('环境箱', 'Chamber') : asset.type)
      const list = map.get(key) ?? []
      list.push(asset)
      map.set(key, list)
    })
    map.forEach((list, key) =>
      map.set(
        key,
        list.slice().sort((a, b) => {
          const aName = a.name || ''
          const bName = b.name || ''
          return aName.localeCompare(bName, sortLocale)
        })
      )
    )
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], sortLocale))
  }, [assets, language, settings.dashboard.groupBy, tr])

  return (
    <PageShell
      title={
        <TitleWithIcon icon={<DashboardIcon />}>{tr('设备总览', 'Dashboard')}</TitleWithIcon>
      }
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <ToggleButtonGroup
            value={preset}
            exclusive
            size="small"
            onChange={(_, value) => {
              if (!value) return
              if (value === 'custom') {
                setPreset('custom')
                return
              }
              dispatch(setDashboardRangePreset(value))
              setPreset(value)
            }}
          >
            <ToggleButton value="7d">{tr('7天', '7d')}</ToggleButton>
            <ToggleButton value="30d">{tr('30天', '30d')}</ToggleButton>
            <ToggleButton value="90d">{tr('90天', '90d')}</ToggleButton>
            <ToggleButton value="custom">{tr('自定义', 'Custom')}</ToggleButton>
          </ToggleButtonGroup>
          <Chip
            label={tr(`校准提醒: ${calibrationDaysThreshold}天`, `Calibration due: ${calibrationDaysThreshold} days`)}
            size="small"
            sx={{ fontWeight: 650 }}
          />
        </Stack>
      }
    >
      {preset === 'custom' ? (
        <AppCard title={tr('时间窗', 'Time window')}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label={tr('开始时间', 'Start time')}
                  value={customStart}
                  onChange={(v) => setCustomStart(v)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label={tr('结束时间', 'End time')}
                  value={customEnd}
                  onChange={(v) => setCustomEnd(v)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        </AppCard>
      ) : null}

      <Box
        sx={{
          mt: preset === 'custom' ? 2 : 0,
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
                {([
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
                ] as const).map((item) => (
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

        {([
          {
            title: tr('维修追踪', 'Repairs'),
            tone: 'warning' as const,
            value: isRepairLoading ? '-' : String(repairStats.quotePending + repairStats.repairPending),
            unit: tr('单', ''),
            notes: [
              tr(`未询价：${isRepairLoading ? '-' : repairStats.quotePending}`, `Quote pending: ${isRepairLoading ? '-' : repairStats.quotePending}`),
              tr(`待维修：${isRepairLoading ? '-' : repairStats.repairPending}`, `Repair pending: ${isRepairLoading ? '-' : repairStats.repairPending}`),
              tr(`本周完成：${isRepairLoading ? '-' : repairStats.completedThisWeek}`, `Completed (7d): ${isRepairLoading ? '-' : repairStats.completedThisWeek}`),
            ],
            cta: { label: tr('进入维修', 'Open repairs'), onClick: () => navigate('/repairs') },
            chip: { label: tr('待处理', 'Action'), color: 'warning' as const },
          },
          {
            title: tr(
              `校验提醒（≤${kpis.calibrationAttention.daysThreshold}天为即将到期）`,
              `Calibrations (due ≤${kpis.calibrationAttention.daysThreshold}d)`
            ),
            tone: 'warning' as const,
            value: String(kpis.calibrationAttention.count),
            unit: tr('台', ''),
            notes: [
              tr(`即将到期：${kpis.calibrationAttention.dueCount}`, `Due soon: ${kpis.calibrationAttention.dueCount}`),
              tr(`已逾期：${kpis.calibrationAttention.overdueCount}`, `Overdue: ${kpis.calibrationAttention.overdueCount}`),
              tr(`未填写：${kpis.calibrationAttention.missingCount}`, `Missing: ${kpis.calibrationAttention.missingCount}`),
            ],
            cta: { label: tr('打开校验管理', 'Open calibrations'), onClick: () => navigate('/calibrations') },
            chip: {
              label: kpis.calibrationAttention.count > 0 ? tr('需处理', 'Needs action') : tr('正常', 'OK'),
              color: kpis.calibrationAttention.count > 0 ? ('warning' as const) : ('success' as const),
            },
          },
          {
            title: tr('使用率', 'Utilization'),
            tone: 'primary' as const,
            value: utilizationText,
            unit: '',
            notes: [
              tr(
                `时间窗：${preset === 'custom' ? '自定义' : preset === '7d' ? '7天' : preset === '30d' ? '30天' : '90天'}`,
                `Window: ${preset === 'custom' ? 'Custom' : preset === '7d' ? '7d' : preset === '30d' ? '30d' : '90d'}`
              ),
              tr('口径：合并占用时段', 'Logic: merged occupancy'),
              tr(`数据：${isLoading ? '加载中' : '已更新'}`, `Data: ${isLoading ? 'Loading' : 'Updated'}`),
            ],
            cta: { label: tr('打开时间线', 'Open timeline'), onClick: () => navigate('/timeline') },
            chip: { label: tr('利用率', 'Utilization'), color: 'primary' as const },
          },
          {
            title: tr('超时/逾期', 'Overdue'),
            tone: 'error' as const,
            value: String(kpis.overdueActiveCount),
            unit: tr('条', ''),
            notes: [
              tr('口径：时间窗内逾期记录', 'Logic: overdue within window'),
              tr(
                `时间窗：${preset === 'custom' ? '自定义' : preset === '7d' ? '7天' : preset === '30d' ? '30天' : '90天'}`,
                `Window: ${preset === 'custom' ? 'Custom' : preset === '7d' ? '7d' : preset === '30d' ? '30d' : '90d'}`
              ),
              tr(`数据：${isLoading ? '加载中' : '已更新'}`, `Data: ${isLoading ? 'Loading' : 'Updated'}`),
            ],
            cta: { label: tr('打开记录', 'Open logs'), onClick: () => navigate('/usage-logs') },
            chip: {
              label: kpis.overdueActiveCount > 0 ? tr('关注', 'Attention') : tr('正常', 'OK'),
              color: kpis.overdueActiveCount > 0 ? ('error' as const) : ('success' as const),
            },
          },
        ] as const).map((card) => {
          const hasAttention =
            (card.title.includes('维修') && (repairStats.quotePending > 0 || repairStats.repairPending > 0)) ||
            (card.title.includes('校验') && kpis.calibrationAttention.count > 0) ||
            (card.title.includes('超时') && kpis.overdueActiveCount > 0)

          const accent = hasAttention
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
                  onClick={card.cta.onClick}
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

      <AppCard
        title={tr('设备状态总览', 'Asset status')}
        actions={
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => navigate('/chambers')} sx={{ whiteSpace: 'nowrap' }}>
              {tr('设备列表', 'Assets')}
            </Button>
            <Button size="small" variant="outlined" onClick={() => navigate('/timeline')} sx={{ whiteSpace: 'nowrap' }}>
              {tr('设备排程', 'Occupancy Schedule')}
            </Button>
          </Stack>
        }
        sx={{ mt: 2 }}
        contentSx={{ mx: -2.5, mb: -2.5 }}
      >
        {isLoading && assetsByCategory.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <LinearProgress />
          </Box>
        ) : assetsByCategory.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <Typography color="text.secondary">{tr('暂无设备', 'No assets')}</Typography>
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
                      <Typography sx={{ fontWeight: 950 }}>{category}</Typography>
                      <Chip size="small" label={tr(`共 ${list.length}`, `Total ${list.length}`)} variant="outlined" sx={{ fontWeight: 800 }} />
                      <Box sx={{ flex: 1 }} />
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                        <Chip size="small" label={tr(`可用 ${statusCounts.available}`, `Available ${statusCounts.available}`)} color="success" variant="outlined" />
                        <Chip size="small" label={tr(`使用中 ${statusCounts.inUse}`, `In use ${statusCounts.inUse}`)} color="warning" variant="outlined" />
                        <Chip size="small" label={tr(`维护 ${statusCounts.maintenance}`, `Maintenance ${statusCounts.maintenance}`)} color="error" variant="outlined" />
                      </Stack>
                    </Stack>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'repeat(2, minmax(0, 1fr))',
                          sm: 'repeat(3, minmax(0, 1fr))',
                          md: 'repeat(4, minmax(0, 1fr))',
                          lg: 'repeat(6, minmax(0, 1fr))',
                          xl: 'repeat(8, minmax(0, 1fr))',
                        },
                        gap: 1.25,
                      }}
                    >
                      {list.map((asset) => {
                          const color =
                            asset.status === 'available'
                              ? theme.palette.success.main
                              : asset.status === 'in-use'
                                ? theme.palette.warning.main
                                : theme.palette.error.main

                          const statusLabel =
                            asset.status === 'available'
                              ? tr('可用', 'Available')
                              : asset.status === 'in-use'
                                ? tr('使用中', 'In use')
                                : tr('维护', 'Maintenance')

                          const occupancy = activeOccupancyByAssetId.get(asset.id)
                          const projectName = occupancy?.log.projectId ? projectNameById.get(occupancy.log.projectId) : undefined
                          const testProjectName = occupancy?.log.testProjectId ? testProjectNameById.get(occupancy.log.testProjectId) : undefined
                          const endText = occupancy ? formatDateTime(occupancy.log.endTime) : undefined
                          const nowForCardMs = Date.now()
                          const isOverdue = occupancy ? Number.isFinite(occupancy.endMs) && occupancy.endMs < nowForCardMs : false
                          const diffMs = occupancy ? (isOverdue ? nowForCardMs - occupancy.endMs : occupancy.endMs - nowForCardMs) : 0
                          const activeRepair =
                            asset.status === 'maintenance'
                              ? repairTickets.find((t) => t.assetId === asset.id && t.status !== 'completed')
                              : undefined
                          const maintenanceDays = activeRepair
                            ? differenceInDays(new Date(), new Date(activeRepair.startedAt ?? activeRepair.createdAt))
                            : 0
                          const maintenanceStageLabel =
                            activeRepair?.status === 'quote-pending'
                              ? tr('未询价', 'Quote pending')
                              : activeRepair?.status === 'repair-pending'
                                ? tr('待维修', 'Repair pending')
                                : undefined

                          const tooltip = occupancy ? (
                            <Box sx={{ p: 0.25 }}>
                              <Typography sx={{ fontWeight: 900 }}>{asset.name}</Typography>
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

                          const card = (
                            <Box
                              onClick={() => navigate(`/assets/${asset.id}`)}
                              sx={glassCardSx(color, { isOverdue })}
                            >
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                                <Typography sx={{ fontWeight: 950, minWidth: 0 }} noWrap>
                                  {asset.name}
                                </Typography>
                                <Box sx={{ flex: 1 }} />
                                <Chip
                                  size="small"
                                  label={statusLabel}
                                  variant="outlined"
                                  sx={{
                                    height: 22,
                                    fontWeight: 900,
                                    borderColor: alpha(color, 0.38),
                                    backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.22 : 0.30),
                                    '& .MuiChip-label': { px: 0.75 },
                                  }}
                                />
                              </Stack>
                              
                              {occupancy && asset.status === 'in-use' ? (
                                <Typography variant="body2" sx={{ fontWeight: 900, position: 'relative', zIndex: 1 }} noWrap>
                                  {occupancy.log.user}
                                </Typography>
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.primary"
                                  noWrap
                                  sx={{
                                    fontWeight: 900,
                                    visibility: 'hidden',
                                    position: 'relative',
                                    zIndex: 1,
                                  }}
                                >
                                  -
                                </Typography>
                              )}

                              <Stack direction="row" spacing={1} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                                <Typography
                                  variant="caption"
                                  color={isOverdue ? 'error.main' : 'text.secondary'}
                                  noWrap
                                  sx={{
                                    fontWeight: isOverdue ? 900 : 600,
                                    minWidth: 0,
                                  }}
                                >
                                  {occupancy && asset.status === 'in-use'
                                    ? isOverdue
                                      ? tr(`逾期: ${formatDuration(diffMs)}`, `Overdue: ${formatDuration(diffMs)}`)
                                      : tr(`剩余: ${formatDuration(diffMs)}`, `Remaining: ${formatDuration(diffMs)}`)
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
                                      fontWeight: 900,
                                      borderColor: alpha(theme.palette.error.main, 0.30),
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
                                      fontWeight: 950,
                                      borderColor: alpha(theme.palette.error.main, 0.38),
                                      backgroundColor: alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
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
                                        boxShadow: (theme) =>
                                          `0 12px 28px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.48 : 0.22)}`,
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
    </PageShell>
  )
}

export default DashboardPage
