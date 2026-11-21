import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, addMonths, differenceInCalendarDays, getYear, isEqual } from 'date-fns'
import { Alert, Box, Button, CircularProgress, Menu, MenuItem, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import type { AssetStatus, UsageLog } from '../types'
import { useMinuteClock } from '../hooks/useMinuteClock'
import { getAssetStatusMeta } from '../utils/statusMeta'
import EmptyState from './EmptyState'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice'
import { fetchTestProjects } from '../store/testProjectsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { loadHolidayCalendar, type HolidayDetail } from '../services/holidayService'
import {
  CHAMBER_NAME_WIDTH_PX,
  DAY_WIDTH_PX,
  DEFAULT_SHIFT_START_MINUTES,
  MIN_ROW_HEIGHT_PX,
  assignTracksToLogs,
  calculateBarPositionAndWidth,
  classifyDay,
  generateDateHeadersFromRange,
  getTimelineBaseDate,
  getTimelineDisplayData,
  type TimelineUsageLogDisplayData,
} from '../utils/timelineLayout'
import TimelineHeader from './timeline/TimelineHeader'
import TimelineBar from './timeline/TimelineBar'
import { useI18n } from '../i18n'
import styles from './ScrollingTimeline.module.css'

const DEFAULT_ITEM_BAR_HEIGHT_PX = 44
const DEFAULT_ITEM_BAR_GAP_PX = 2

const buildTimelineCssVars = (theme: Theme) => {
  const headerGlass = `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%), ${alpha(theme.palette.background.paper, 0.58)}`
  const stickyGlass = `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%), ${alpha(theme.palette.background.paper, 0.62)}`
  const vars: Record<string, string> = {
    ['--timeline-bg']: alpha(theme.palette.background.paper, 0.95),
    ['--timeline-header-bg']: headerGlass,
    ['--timeline-sticky-bg']: stickyGlass,
    ['--timeline-border']: theme.palette.divider,
    ['--timeline-grid-line']: alpha(theme.palette.text.primary, 0.08),
    ['--timeline-grid-line-soft']: alpha(theme.palette.text.primary, 0.06),
    ['--timeline-weekend-bg']: alpha(theme.palette.text.primary, 0.03),
    ['--timeline-holiday-bg']: alpha(theme.palette.error.main, 0.08),
    ['--timeline-workday-override-bg']: alpha(theme.palette.text.primary, 0.02),
    ['--timeline-today-bg']: alpha(theme.palette.info.main, 0.1),
    ['--timeline-today-text']: theme.palette.mode === 'dark' ? theme.palette.info.light : theme.palette.info.main,
    ['--timeline-now-line']: theme.palette.error.main,
    ['--timeline-bar-shadow']: `0 1px 2px ${alpha(theme.palette.text.primary, 0.18)}`,
    ['--timeline-bar-shadow-hover']: `0 6px 14px ${alpha(theme.palette.text.primary, 0.22)}`,
    ['--timeline-scrollbar-thumb']: alpha(theme.palette.text.primary, 0.32),
    ['--timeline-scrollbar-thumb-hover']: alpha(theme.palette.text.primary, 0.44),
    ['--timeline-scrollbar-track']: alpha(theme.palette.text.primary, 0.08),
  }
  return vars as unknown as React.CSSProperties
}

interface ScrollingTimelineProps {
  usageLogs: UsageLog[]
  onViewUsageLog: (logId: string) => void
  onDeleteUsageLog?: (logId: string, configId: string) => void
  regionCode?: 'cn' | 'tw'
  dayWidthPx?: number
  scrollToTodaySignal?: number
  minRowHeightPx?: number
  itemBarHeightPx?: number
  itemBarGapPx?: number
  getMinRowHeightPx?: (chamberId: string) => number
  showConfigCountBadge?: boolean
  searchQuery?: string
  statusFilter?: 'all' | AssetStatus
  onResetFilters?: () => void
}

const ScrollingTimeline: React.FC<ScrollingTimelineProps> = ({
  usageLogs: propsUsageLogs = [],
  onViewUsageLog,
  onDeleteUsageLog,
  regionCode = 'cn',
  dayWidthPx: propsDayWidthPx,
  scrollToTodaySignal,
  minRowHeightPx: propsMinRowHeightPx,
  itemBarHeightPx: propsItemBarHeightPx,
  itemBarGapPx: propsItemBarGapPx,
  getMinRowHeightPx,
  showConfigCountBadge: propsShowConfigCountBadge,
  searchQuery,
  statusFilter = 'all',
  onResetFilters,
}) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const theme = useTheme()
  const { tr } = useI18n()
  const nowMs = useMinuteClock(true)

  const timelineCssVars = useMemo(() => buildTimelineCssVars(theme), [theme])
  const dayWidthPx = propsDayWidthPx ?? DAY_WIDTH_PX
  const minRowHeightPx = propsMinRowHeightPx ?? MIN_ROW_HEIGHT_PX
  const itemBarHeightPx = propsItemBarHeightPx ?? DEFAULT_ITEM_BAR_HEIGHT_PX
  const itemBarGapPx = propsItemBarGapPx ?? DEFAULT_ITEM_BAR_GAP_PX
  const itemBarTotalHeightPx = itemBarHeightPx + itemBarGapPx
  const showConfigCountBadge = propsShowConfigCountBadge ?? true

  const shiftStartMinutes = useAppSelector((state) => state.settings.timeline.shiftStartMinutes) ?? DEFAULT_SHIFT_START_MINUTES
  const { assets: chambers, loading: chambersLoading, error: chambersError } = useAppSelector((state) => state.assets)
  const { projects, loading: projectsLoading, error: projectsError } = useAppSelector((state) => state.projects)
  const { testProjects, loading: testProjectsLoading, error: testProjectsError } = useAppSelector((state) => state.testProjects)
  const { loading: usageLogsDataLoading } = useAppSelector((state) => state.usageLogs)

  const initialTimelineBaseDate = useMemo(() => getTimelineBaseDate(new Date(), shiftStartMinutes), [shiftStartMinutes])
  const [rangeStart, setRangeStart] = useState(() => addMonths(initialTimelineBaseDate, -1))
  const [rangeEnd, setRangeEnd] = useState(() => addMonths(initialTimelineBaseDate, 1))
  const [configDeleteMenu, setConfigDeleteMenu] = useState<{
    anchorEl: HTMLElement
    logId: string
    items: Array<{ id: string; name: string }>
  } | null>(null)

  const [processedHolidays, setProcessedHolidays] = useState<Map<string, HolidayDetail>>(new Map())
  const holidayRequestsRef = useRef(new Map<string, Promise<Map<string, HolidayDetail>>>())
  const startYear = getYear(rangeStart)
  const endYear = getYear(rangeEnd)

  const dateHeaders = useMemo(
    () => generateDateHeadersFromRange(rangeStart, rangeEnd, shiftStartMinutes),
    [rangeStart, rangeEnd, shiftStartMinutes]
  )
  const totalTimelineWidth = useMemo(() => dateHeaders.length * dayWidthPx, [dateHeaders.length, dayWidthPx])

  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const initialScrollPerformedForCurrentViewRef = useRef(false)
  const desiredScrollLeftAfterPrependRef = useRef<number | null>(null)
  const isExtendingLeftRef = useRef(false)
  const isExtendingRightRef = useRef(false)
  const lastHandledTodaySignalRef = useRef(0)
  const rafUpdateVisibleRangeRef = useRef<number | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const base = getTimelineBaseDate(new Date(), shiftStartMinutes)
    setRangeStart(addMonths(base, -1))
    setRangeEnd(addMonths(base, 1))
    initialScrollPerformedForCurrentViewRef.current = false
  }, [shiftStartMinutes])

  const [visibleDayIndexRange, setVisibleDayIndexRange] = useState<{ startIndex: number; endIndexExclusive: number }>({
    startIndex: 0,
    endIndexExclusive: 0,
  })

  const updateVisibleDayIndexRange = useCallback(() => {
    const container = timelineContainerRef.current
    const totalDays = dateHeaders.length
    if (!container || totalDays === 0) {
      setVisibleDayIndexRange({ startIndex: 0, endIndexExclusive: 0 })
      return
    }
    const visibleGridWidth = Math.max(0, container.clientWidth - CHAMBER_NAME_WIDTH_PX)
    const gridScrollLeft = Math.max(0, container.scrollLeft)
    const overscanDays = 20
    const startIndex = Math.max(0, Math.floor(gridScrollLeft / dayWidthPx) - overscanDays)
    const endIndexExclusive = Math.min(totalDays, Math.ceil((gridScrollLeft + visibleGridWidth) / dayWidthPx) + overscanDays)

    setVisibleDayIndexRange((prev) => {
      if (prev.startIndex === startIndex && prev.endIndexExclusive === endIndexExclusive) return prev
      return { startIndex, endIndexExclusive }
    })
  }, [dateHeaders.length, dayWidthPx])

  useEffect(() => {
    const container = timelineContainerRef.current
    if (!container) return

    let rafId: number | null = null
    const schedule = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        updateVisibleDayIndexRange()
      })
    }

    schedule()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => schedule())
      ro.observe(container)
    }

    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('resize', schedule)
      if (ro) ro.disconnect()
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      if (rafUpdateVisibleRangeRef.current !== null) {
        window.cancelAnimationFrame(rafUpdateVisibleRangeRef.current)
        rafUpdateVisibleRangeRef.current = null
      }
    }
  }, [updateVisibleDayIndexRange])

  const handleTimelineScroll = useCallback(() => {
    const container = timelineContainerRef.current
    if (!container) return

    const thresholdPx = dayWidthPx * 10
    if (container.scrollLeft < thresholdPx && !isExtendingLeftRef.current) {
      isExtendingLeftRef.current = true
      const beforeExtendScrollLeft = container.scrollLeft
      startTransition(() => {
        setRangeStart((prevStart) => {
          const nextStart = addMonths(prevStart, -1)
          const addedDays = differenceInCalendarDays(prevStart, nextStart)
          desiredScrollLeftAfterPrependRef.current = beforeExtendScrollLeft + addedDays * dayWidthPx
          return nextStart
        })
      })
    }

    if (
      container.scrollLeft + container.clientWidth > container.scrollWidth - thresholdPx &&
      !isExtendingRightRef.current
    ) {
      isExtendingRightRef.current = true
      startTransition(() => {
        setRangeEnd((prevEnd) => addMonths(prevEnd, 1))
      })
    }

    if (rafUpdateVisibleRangeRef.current === null) {
      rafUpdateVisibleRangeRef.current = window.requestAnimationFrame(() => {
        rafUpdateVisibleRangeRef.current = null
        updateVisibleDayIndexRange()
      })
    }
  }, [dayWidthPx, startTransition, updateVisibleDayIndexRange])

  useLayoutEffect(() => {
    const container = timelineContainerRef.current
    if (container && desiredScrollLeftAfterPrependRef.current !== null) {
      container.scrollLeft = desiredScrollLeftAfterPrependRef.current
      desiredScrollLeftAfterPrependRef.current = null
    }
    isExtendingLeftRef.current = false
    isExtendingRightRef.current = false
    updateVisibleDayIndexRange()
  }, [dateHeaders.length, updateVisibleDayIndexRange])

  useEffect(() => {
    if (!scrollToTodaySignal || scrollToTodaySignal === lastHandledTodaySignalRef.current) return
    const container = timelineContainerRef.current
    if (!container || dateHeaders.length === 0) return

    const todayByShift = getTimelineBaseDate(new Date(), shiftStartMinutes)
    const todayIndex = dateHeaders.findIndex((d) => isEqual(d, todayByShift))
    if (todayIndex < 0) return

    lastHandledTodaySignalRef.current = scrollToTodaySignal
    const desiredTodayCellOffset = 2
    const targetGridScrollLeft = Math.max(0, (todayIndex - desiredTodayCellOffset) * dayWidthPx)
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
    const clampedScrollLeft = Math.min(targetGridScrollLeft, maxScroll)

    ;(container as any).scrollTo?.({ left: clampedScrollLeft, behavior: 'smooth' })
    if (!(container as any).scrollTo) container.scrollLeft = clampedScrollLeft
  }, [dateHeaders, dayWidthPx, scrollToTodaySignal, shiftStartMinutes])

  useEffect(() => {
    setProcessedHolidays(new Map())
  }, [regionCode])

  useEffect(() => {
    let active = true
    const requests = holidayRequestsRef.current
    for (let year = startYear; year <= endYear; year++) {
      const key = `${regionCode}-${year}`
      let request = requests.get(key)
      if (!request) {
        request = loadHolidayCalendar(year, regionCode)
        requests.set(key, request)
      }
      void request.then((calendar) => {
        if (active && calendar.size > 0) {
          setProcessedHolidays((previous) => new Map([...previous, ...calendar]))
        }
      })
    }
    return () => {
      active = false
    }
  }, [startYear, endYear, regionCode])

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchProjects())
    dispatch(fetchTestProjects())
  }, [dispatch])

  const timelineViewActualStart = useMemo(
    () => (dateHeaders.length > 0 ? dateHeaders[0] : getTimelineBaseDate(new Date(), shiftStartMinutes)),
    [dateHeaders, shiftStartMinutes]
  )

  const timelineViewActualEnd = useMemo(() => {
    const fallback = addDays(getTimelineBaseDate(new Date(), shiftStartMinutes), 1)
    return dateHeaders.length > 0 ? addDays(dateHeaders[dateHeaders.length - 1], 1) : fallback
  }, [dateHeaders, shiftStartMinutes])

  const usageLogById = useMemo(() => {
    const map = new Map<string, UsageLog>()
    ;(propsUsageLogs || []).forEach((l) => map.set(l.id, l))
    return map
  }, [propsUsageLogs])

  const timelineDisplayItems = useMemo(
    () => (propsUsageLogs && projects && testProjects ? getTimelineDisplayData(propsUsageLogs, projects, testProjects) : []),
    [propsUsageLogs, projects, testProjects]
  )

  const timelineItemsByChamberId = useMemo(() => {
    const map = new Map<string, TimelineUsageLogDisplayData[]>()
    timelineDisplayItems.forEach((item) => {
      const existing = map.get(item.chamberId)
      if (existing) existing.push(item)
      else map.set(item.chamberId, [item])
    })
    return map
  }, [timelineDisplayItems])

  const filteredChambers = useMemo(() => {
    const q = (searchQuery ?? '').trim().toLowerCase()
    return (chambers ?? []).filter((chamber) => {
      if (statusFilter !== 'all' && chamber.status !== statusFilter) return false
      if (!q) return true
      const haystack = [chamber.name, chamber.assetCode ?? '', chamber.category ?? '', chamber.location ?? '']
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [chambers, searchQuery, statusFilter])

  const chamberLayouts = useMemo(() => {
    const layouts = new Map<string, { logsWithTracks: (TimelineUsageLogDisplayData & { trackIndex: number })[]; maxTracks: number }>()
    if (filteredChambers.length > 0) {
      filteredChambers.forEach((chamber) => {
        const chamberLogs = timelineItemsByChamberId.get(chamber.id) || []
        const logsWithTracksData = assignTracksToLogs(chamberLogs)
        const maxTracks = logsWithTracksData.reduce((maxVal, log) => Math.max(maxVal, log.trackIndex + 1), 0)
        layouts.set(chamber.id, { logsWithTracks: logsWithTracksData, maxTracks })
      })
    }
    return layouts
  }, [filteredChambers, timelineItemsByChamberId])

  const getChamberRowHeight = useCallback(
    (chamberId: string): number => {
      const layout = chamberLayouts.get(chamberId)
      const chamberMinRowHeightPx = getMinRowHeightPx?.(chamberId) ?? minRowHeightPx
      if (layout && layout.maxTracks > 0) {
        return Math.max(chamberMinRowHeightPx, layout.maxTracks * itemBarTotalHeightPx + itemBarGapPx * 2)
      }
      return chamberMinRowHeightPx
    },
    [chamberLayouts, getMinRowHeightPx, itemBarGapPx, itemBarTotalHeightPx, minRowHeightPx]
  )

  const totalTimelineGridHeight = useMemo(() => {
    if (filteredChambers.length === 0) return minRowHeightPx * 3
    return filteredChambers.reduce((sum, chamber) => sum + getChamberRowHeight(chamber.id), 0)
  }, [filteredChambers, getChamberRowHeight, minRowHeightPx])

  const chamberRowTopById = useMemo(() => {
    const map = new Map<string, number>()
    if (filteredChambers.length === 0) return map
    let topOffset = 0
    filteredChambers.forEach((chamber) => {
      map.set(chamber.id, topOffset)
      topOffset += getChamberRowHeight(chamber.id)
    })
    return map
  }, [filteredChambers, getChamberRowHeight])

  const nowLeftPx = useMemo(() => {
    const startMs = timelineViewActualStart.getTime()
    const endMs = timelineViewActualEnd.getTime()
    if (nowMs < startMs || nowMs > endMs) return null
    return ((nowMs - startMs) / (24 * 60 * 60 * 1000)) * dayWidthPx
  }, [dayWidthPx, nowMs, timelineViewActualEnd, timelineViewActualStart])

  useEffect(() => {
    const container = timelineContainerRef.current
    const allDataLoaded = !chambersLoading && !projectsLoading && !testProjectsLoading && !usageLogsDataLoading
    if (!container || !allDataLoaded || !(dateHeaders.length > 0) || !(totalTimelineWidth > 0) || !(container.clientWidth > 0)) {
      return
    }

    let targetScrollPosition = 0
    const todayByShift = getTimelineBaseDate(new Date(), shiftStartMinutes)
    const todayIndex = dateHeaders.findIndex((dh) => isEqual(dh, todayByShift))
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)

    if (todayIndex !== -1) {
      targetScrollPosition = Math.min(Math.max(0, (todayIndex - 2) * dayWidthPx), maxScroll)
    } else {
      const visibleGridWidth = Math.max(0, container.clientWidth - CHAMBER_NAME_WIDTH_PX)
      targetScrollPosition = Math.min(Math.max(0, totalTimelineWidth / 2 - visibleGridWidth / 2), maxScroll)
    }

    if (!initialScrollPerformedForCurrentViewRef.current) {
      if (container.scrollLeft !== targetScrollPosition) {
        container.scrollLeft = targetScrollPosition
      }
      initialScrollPerformedForCurrentViewRef.current = true
    }
  }, [dateHeaders, totalTimelineWidth, dayWidthPx, shiftStartMinutes, chambersLoading, projectsLoading, testProjectsLoading, usageLogsDataLoading])

  const handleOpenDeleteConfig = useCallback(
    (anchorEl: HTMLElement, logDisplayItem: TimelineUsageLogDisplayData) => {
      const items = logDisplayItem.configIds.map((id, idx) => ({
        id,
        name: logDisplayItem.configNames[idx] || id,
      }))
      if (items.length === 1) {
        onDeleteUsageLog?.(logDisplayItem.originalLogId, items[0].id)
        return
      }
      setConfigDeleteMenu({ anchorEl, logId: logDisplayItem.originalLogId, items })
    },
    [onDeleteUsageLog]
  )

  const shouldBlockOnPrimaryLoading =
    (chambersLoading && chambers.length === 0) ||
    (projectsLoading && projects.length === 0) ||
    (testProjectsLoading && testProjects.length === 0) ||
    (usageLogsDataLoading && propsUsageLogs.length === 0)

  if (shouldBlockOnPrimaryLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{tr('加载数据中，请稍候...', 'Loading data, please wait...')}</Typography>
      </Box>
    )
  }

  const anyCoreDataError = chambersError || projectsError || testProjectsError
  if (anyCoreDataError) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', p: 3 }}>
        <Alert severity="error" sx={{ width: '100%', maxWidth: '600px' }}>
          {tr('加载核心依赖数据失败:', 'Failed to load core data:')} {anyCoreDataError}
        </Alert>
      </Box>
    )
  }

  const todayByShift = getTimelineBaseDate(new Date(), shiftStartMinutes)
  const dayLabels = { weekend: tr('周末', 'Weekend'), weekday: tr('工作日', 'Workday') }
  const visibleDays = dateHeaders.slice(visibleDayIndexRange.startIndex, visibleDayIndexRange.endIndexExclusive)
  const visibleDayClassifications = visibleDays.map((d) => classifyDay(d, processedHolidays, dayLabels))
  const visibleLeftPx = visibleDayIndexRange.startIndex * dayWidthPx
  const visibleRightPx = visibleDayIndexRange.endIndexExclusive * dayWidthPx

  if (chambers.length > 0 && filteredChambers.length === 0) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <EmptyState
          title={tr('没有匹配的设备', 'No matching assets')}
          description={tr('请尝试调整搜索关键词或设备状态筛选条件。', 'Try adjusting your search query or status filter.')}
          action={
            onResetFilters ? (
              <Button size="small" variant="outlined" onClick={onResetFilters}>
                {tr('重置筛选', 'Reset filters')}
              </Button>
            ) : undefined
          }
        />
      </Box>
    )
  }

  return (
    <div className={styles.timelinePageContainer} style={timelineCssVars}>
      <div ref={timelineContainerRef} className={styles.timelineScrollContainer} onScroll={handleTimelineScroll}>
        <TimelineHeader
          totalTimelineWidth={totalTimelineWidth}
          dayWidthPx={dayWidthPx}
          visibleDays={visibleDays}
          visibleStartIndex={visibleDayIndexRange.startIndex}
          visibleDayClassifications={visibleDayClassifications}
          todayByShift={todayByShift}
        />

        <div className={styles.timelineBodyRow} style={{ width: `${CHAMBER_NAME_WIDTH_PX + totalTimelineWidth}px` }}>
          <div className={styles.timelineChamberColumn} style={{ width: `${CHAMBER_NAME_WIDTH_PX}px` }}>
            {filteredChambers.map((chamber) => {
              const statusMeta = getAssetStatusMeta(chamber.status, tr)
              const dotColor =
                chamber.status === 'available'
                  ? theme.palette.success.main
                  : chamber.status === 'in-use'
                    ? theme.palette.warning.main
                    : theme.palette.error.main
              const tooltipTitle = [
                chamber.name,
                chamber.assetCode ? `(${chamber.assetCode})` : '',
                statusMeta.label,
                chamber.location || '',
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <Tooltip key={chamber.id} title={tooltipTitle} placement="right" arrow>
                  <div
                    className={styles.chamberRowName}
                    style={{ height: `${getChamberRowHeight(chamber.id)}px`, cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/assets/${chamber.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/assets/${chamber.id}`)
                      }
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chamber.name}
                    </Box>
                  </div>
                </Tooltip>
              )
            })}
            {chambers.length === 0 && !chambersLoading && (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="textSecondary">
                  {tr('暂无环境箱', 'No chambers')}
                </Typography>
              </Box>
            )}
          </div>

          <div className={styles.timelineGridContent} style={{ width: `${totalTimelineWidth}px`, minHeight: `${totalTimelineGridHeight}px` }}>
            {visibleDays.map((_dayCellStartTime, offset) => {
              const dayIndex = visibleDayIndexRange.startIndex + offset
              const classification = visibleDayClassifications[offset]
              let dayBgClass = styles.timelineDayBackground
              if (classification.type === 'publicHolidayHighWage') {
                dayBgClass += ` ${styles.publicHolidayStrongRedBackground}`
              } else if (classification.type === 'publicHolidayLowWage' || classification.type === 'weekendRest') {
                dayBgClass += ` ${styles.weekendSoftRedBackground}`
              } else if (classification.type === 'workdayOverride') {
                dayBgClass += ` ${styles.workdayOnWeekendBackground}`
              }
              return (
                <div
                  key={`day-bg-${dayIndex}`}
                  className={dayBgClass}
                  style={{ left: `${dayIndex * dayWidthPx}px`, width: `${dayWidthPx}px`, height: `${totalTimelineGridHeight}px` }}
                  title={classification.name || ''}
                />
              )
            })}

            {filteredChambers.map((chamber) => (
              <div
                key={`row-bg-${chamber.id}`}
                className={styles.timelineRowBackground}
                style={{
                  top: `${chamberRowTopById.get(chamber.id) || 0}px`,
                  height: `${getChamberRowHeight(chamber.id)}px`,
                  width: `${totalTimelineWidth}px`,
                }}
              />
            ))}

            {nowLeftPx !== null ? (
              <div
                className={styles.timelineNowLine}
                style={{ left: `${nowLeftPx}px`, height: `${totalTimelineGridHeight}px` }}
                aria-hidden="true"
              />
            ) : null}

            {filteredChambers.map((chamber) => {
              const layoutInfo = chamberLayouts.get(chamber.id)
              const logsToRender = layoutInfo ? layoutInfo.logsWithTracks : []
              const rowTopOffset = chamberRowTopById.get(chamber.id) || 0
              const rowHeight = getChamberRowHeight(chamber.id)
              const totalTracks = layoutInfo ? layoutInfo.maxTracks : 0
              const tracksHeight = totalTracks > 0 ? totalTracks * itemBarTotalHeightPx : 0
              const baseTrackOffset = Math.max(itemBarGapPx, Math.floor((rowHeight - tracksHeight) / 2))

              return (
                <div
                  key={chamber.id}
                  className={styles.timelineRow}
                  style={{ position: 'absolute', top: `${rowTopOffset}px`, height: `${rowHeight}px`, width: `${totalTimelineWidth}px` }}
                >
                  {logsToRender.map((logDisplayItem) => {
                    const originalLog = usageLogById.get(logDisplayItem.originalLogId)
                    if (!originalLog) return null

                    const { left, width, display } = calculateBarPositionAndWidth(
                      originalLog,
                      timelineViewActualStart,
                      timelineViewActualEnd,
                      logDisplayItem.effectiveStatus,
                      dayWidthPx,
                      new Date(nowMs)
                    )
                    if (!display || width <= 0) return null
                    if (left + width < visibleLeftPx || left > visibleRightPx) return null

                    const barTopPosition = baseTrackOffset + logDisplayItem.trackIndex * itemBarTotalHeightPx
                    return (
                      <TimelineBar
                        key={logDisplayItem.displayId}
                        logDisplayItem={logDisplayItem}
                        originalLog={originalLog}
                        left={left}
                        width={width}
                        height={itemBarHeightPx}
                        top={barTopPosition}
                        showConfigCountBadge={showConfigCountBadge}
                        canDeleteConfig={Boolean(onDeleteUsageLog)}
                        onViewUsageLog={onViewUsageLog}
                        onDeleteConfig={handleOpenDeleteConfig}
                      />
                    )
                  })}
                </div>
              )
            })}

            <Menu
              open={Boolean(configDeleteMenu)}
              anchorEl={configDeleteMenu?.anchorEl ?? null}
              onClose={() => setConfigDeleteMenu(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {(configDeleteMenu?.items ?? []).map((it) => (
                <MenuItem
                  key={it.id}
                  onClick={() => {
                    onDeleteUsageLog?.(configDeleteMenu?.logId || '', it.id)
                    setConfigDeleteMenu(null)
                  }}
                >
                  {it.name}
                </MenuItem>
              ))}
            </Menu>

            {(!propsUsageLogs || propsUsageLogs.length === 0) && chambers.length > 0 && !shouldBlockOnPrimaryLoading && (
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  {tr('当前时间范围无使用记录。', 'No usage logs in the current window.')}
                </Typography>
              </Box>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScrollingTimeline
