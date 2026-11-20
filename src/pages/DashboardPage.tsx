import React, { useEffect, useMemo, useState } from 'react'
import { Chip, Stack } from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import { startOfDay, subDays } from 'date-fns'
import AppCard from '../components/AppCard'
import { CustomDateRangePickers, DateRangePresetBar } from '../components/DateRangePresetBar'
import PageShell from '../components/PageShell'
import TitleWithIcon from '../components/TitleWithIcon'
import { useI18n } from '../i18n'
import { fetchAssetsByType } from '../store/assetsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { selectDashboardKpis } from '../store/kpiSelectors'
import { fetchProjects } from '../store/projectsSlice'
import { fetchRepairTickets } from '../store/repairTicketsSlice'
import { setDashboardRangePreset } from '../store/settingsSlice'
import { fetchTestProjects } from '../store/testProjectsSlice'
import { fetchUsageLogs } from '../store/usageLogsSlice'
import type { Asset, UsageLog } from '../types'
import { resolveDateRange, type RangePreset } from '../utils/dateRange'
import { isUsageLogOccupyingAsset } from '../utils/statusHelpers'
import AssetStatusGrid, { type ActiveOccupancy } from './dashboard/AssetStatusGrid'
import DashboardKpiRow from './dashboard/DashboardKpiRow'

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { tr, language } = useI18n()

  const assetsLoading = useAppSelector((s) => s.assets.loading)
  const usageLogsLoading = useAppSelector((s) => s.usageLogs.loading)
  const repairTicketsLoading = useAppSelector((s) => s.repairTickets.loading)
  const repairTickets = useAppSelector((s) => s.repairTickets.tickets)
  const assets = useAppSelector((s) => s.assets.assets)
  const usageLogs = useAppSelector((s) => s.usageLogs.usageLogs)
  const projects = useAppSelector((s) => s.projects.projects)
  const testProjects = useAppSelector((s) => s.testProjects.testProjects)
  const dashboardRangePreset = useAppSelector((s) => s.settings.dashboard.rangePreset)
  const dashboardGroupBy = useAppSelector((s) => s.settings.dashboard.groupBy)
  const calibrationDaysThreshold = useAppSelector((s) => s.settings.alerts.calibrationDaysThreshold)

  const [preset, setPreset] = useState<RangePreset>(dashboardRangePreset)
  const [customStart, setCustomStart] = useState<Date | null>(startOfDay(subDays(new Date(), 30)))
  const [customEnd, setCustomEnd] = useState<Date | null>(new Date())

  useEffect(() => {
    if (preset !== 'custom') setPreset(dashboardRangePreset)
  }, [preset, dashboardRangePreset])

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchUsageLogs())
    dispatch(fetchRepairTickets(undefined))
    dispatch(fetchProjects())
    dispatch(fetchTestProjects())
  }, [dispatch])

  const { startMs, endMs, nowMs } = useMemo(
    () => resolveDateRange(preset, customStart, customEnd),
    [customEnd, customStart, preset]
  )

  const kpis = useAppSelector((state) =>
    selectDashboardKpis(state, startMs, endMs, calibrationDaysThreshold, nowMs)
  )

  const isLoading = assetsLoading || usageLogsLoading
  const isRepairLoading = repairTicketsLoading

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
      const currentMs = now.getTime()
      return logs
        .slice()
        .sort((a, b) => {
          const aEnd = parseMs(a.endTime)
          const bEnd = parseMs(b.endTime)
          if (aEnd !== bEnd) return aEnd - bEnd
          const aStart = parseMs(a.startTime, currentMs)
          const bStart = parseMs(b.startTime, currentMs)
          return bStart - aStart
        })[0]
    }

    const result: ActiveOccupancy[] = []
    byChamber.forEach((logs, chamberId) => {
      const best = pickBestLog(logs)
      const chamberName = assetNameById.get(chamberId) ?? chamberId.slice(0, 8)
      const logStartMs = parseMs(best.startTime, now.getTime())
      const logEndMs = parseMs(best.endTime)
      result.push({
        chamberId,
        chamberName,
        log: best,
        activeCount: logs.length,
        startMs: logStartMs,
        endMs: logEndMs,
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

  const activeRepairByAssetId = useMemo(() => {
    const map = new Map<string, (typeof repairTickets)[number]>()
    for (const t of repairTickets) {
      if (t.status === 'completed') continue
      if (!map.has(t.assetId)) map.set(t.assetId, t)
    }
    return map
  }, [repairTickets])

  const assetsByCategory = useMemo(() => {
    const map = new Map<string, Asset[]>()
    const sortLocale = language === 'en' ? 'en' : 'zh-Hans-CN'
    assets.forEach((asset) => {
      const key =
        dashboardGroupBy === 'location'
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
  }, [assets, dashboardGroupBy, language, tr])

  return (
    <PageShell
      title={<TitleWithIcon icon={<DashboardIcon />}>{tr('设备总览', 'Dashboard')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <DateRangePresetBar
            preset={preset}
            onPresetChange={(value) => {
              if (value === 'custom') {
                setPreset('custom')
                return
              }
              dispatch(setDashboardRangePreset(value))
              setPreset(value)
            }}
          />
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
          <CustomDateRangePickers
            start={customStart}
            end={customEnd}
            onStartChange={setCustomStart}
            onEndChange={setCustomEnd}
          />
        </AppCard>
      ) : null}

      <DashboardKpiRow
        kpis={kpis}
        repairStats={repairStats}
        isLoading={isLoading}
        isRepairLoading={isRepairLoading}
        preset={preset}
        hasTopSpacing={preset === 'custom'}
      />

      <AssetStatusGrid
        assetsByCategory={assetsByCategory}
        activeOccupancyByAssetId={activeOccupancyByAssetId}
        activeRepairByAssetId={activeRepairByAssetId}
        projectNameById={projectNameById}
        testProjectNameById={testProjectNameById}
        isLoading={isLoading}
      />
    </PageShell>
  )
}

export default DashboardPage
