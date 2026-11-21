import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, addMonths, differenceInCalendarDays, differenceInMinutes, getYear, isEqual } from 'date-fns'
import { Alert, Box, CircularProgress, Menu, MenuItem, Typography } from '@mui/material'
import { alpha, decomposeColor, useTheme, type Theme } from '@mui/material/styles'
import type { UsageLog } from '../types'
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice'
import { fetchTestProjects } from '../store/testProjectsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { loadHolidayCalendar, type HolidayDetail } from '../services/holidayService'
import { useMinuteClock } from '../hooks/useMinuteClock'
import { getAssetStatusMeta } from '../utils/statusMeta'
import {
  CHAMBER_NAME_WIDTH_PX,
  DAY_WIDTH_PX,
  DEFAULT_SHIFT_START_MINUTES,
  MIN_ROW_HEIGHT_PX,
  assignTracksToLogs,
  calculateBarPositionAndWidth,
  classifyDay,
  formatVisibleMonthLabel,
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

const mixOpaqueRgb = (foreground: string, background: string, ratio: number): string => {
  try {
    const fg = decomposeColor(foreground)
    const bg = decomposeColor(background)
    const r = Math.round(fg.values[0] * ratio + bg.values[0] * (1 - ratio))
    const g = Math.round(fg.values[1] * ratio + bg.values[1] * (1 - ratio))
    const b = Math.round(fg.values[2] * ratio + bg.values[2] * (1 - ratio))
    return `rgb(${r}, ${g}, ${b})`
  } catch {
    return background
  }
}

const buildTimelineCssVars = (theme: Theme) => {
  const isDark = theme.palette.mode === 'dark'
  const paper = theme.palette.background.paper
  const primary = theme.palette.primary.main
  const error = theme.palette.error.main
  const textPrimary = theme.palette.text.primary

  const vars: Record<string, string> = {
    ['--timeline-bg']: paper,
    ['--timeline-header-bg']: paper,
    ['--timeline-header-today-bg']: mixOpaqueRgb(primary, paper, isDark ? 0.22 : 0.1),
    ['--timeline-header-weekend-bg']: mixOpaqueRgb(textPrimary, paper, isDark ? 0.06 : 0.025),
    ['--timeline-header-holiday-bg']: mixOpaqueRgb(error, paper, isDark ? 0.2 : 0.08),
    ['--timeline-sticky-bg']: paper,
    ['--timeline-sticky-hover-bg']: mixOpaqueRgb(primary, paper, isDark ? 0.14 : 0.05),
    ['--timeline-sticky-header-bg']: mixOpaqueRgb(textPrimary, paper, isDark ? 0.07 : 0.03),
    ['--timeline-input-bg']: paper,
    ['--timeline-badge-bg']: alpha(textPrimary, isDark ? 0.14 : 0.08),
    ['--timeline-shift-day-bg']: paper,
    ['--timeline-shift-night-bg']: mixOpaqueRgb(textPrimary, paper, isDark ? 0.06 : 0.025),
    ['--timeline-text-primary']: textPrimary,
    ['--timeline-text-muted']: theme.palette.text.secondary,
    ['--timeline-weekend-text']: isDark ? '#fb7185' : '#e11d48',
    ['--timeline-accent']: primary,
    ['--timeline-accent-soft']: alpha(primary, isDark ? 0.28 : 0.16),
    ['--timeline-border']: alpha(textPrimary, isDark ? 0.12 : 0.09),
    ['--timeline-border-strong']: alpha(textPrimary, isDark ? 0.18 : 0.14),
    ['--timeline-sticky-shadow']: isDark
      ? '4px 0 12px -4px rgba(0, 0, 0, 0.45)'
      : '4px 0 10px -4px rgba(15, 23, 42, 0.1)',
    ['--timeline-header-shadow']: isDark
      ? '0 2px 8px -2px rgba(0, 0, 0, 0.45)'
      : '0 2px 6px -2px rgba(15, 23, 42, 0.08)',
    ['--timeline-grid-line']: alpha(textPrimary, isDark ? 0.11 : 0.08),
    ['--timeline-grid-line-half']: alpha(textPrimary, isDark ? 0.07 : 0.05),
    ['--timeline-grid-line-soft']: alpha(textPrimary, isDark ? 0.08 : 0.06),
    ['--timeline-today-col-bg']: alpha(primary, isDark ? 0.08 : 0.045),
    ['--timeline-weekend-bg']: alpha(textPrimary, isDark ? 0.04 : 0.025),
    ['--timeline-holiday-bg']: alpha(error, isDark ? 0.12 : 0.06),
    ['--timeline-workday-override-bg']: alpha(textPrimary, 0.015),
    ['--timeline-now-line']: primary,
    ['--timeline-now-ring']: alpha(primary, isDark ? 0.35 : 0.22),
    ['--timeline-bar-shadow']: `0 1px 2px ${alpha(textPrimary, 0.18)}`,
    ['--timeline-bar-shadow-hover']: `0 6px 14px ${alpha(textPrimary, 0.22)}`,
    ['--timeline-scrollbar-thumb']: alpha(textPrimary, 0.32),
    ['--timeline-scrollbar-thumb-hover']: alpha(textPrimary, 0.44),
    ['--timeline-scrollbar-track']: alpha(textPrimary, 0.08),
  }
  return vars as unknown as React.CSSProperties
}

const MIN_THUMB_PX = 28
const RAIL_HIDE_MS = 800

type AxisMetrics = {
  length: number
  offset: number
  range: number
  movable: number
}

function measureAxis(content: number, viewport: number, scroll: number, track: number): AxisMetrics | null {
  const range = Math.max(0, content - viewport)
  if (range <= 1 || track <= 0) return null
  const length = Math.min(track, Math.max(MIN_THUMB_PX, (track * viewport) / content))
  const movable = Math.max(0, track - length)
  const offset = movable * Math.min(1, Math.max(0, scroll / range))
  return { length, offset, range, movable }
}

function wheelPixels(delta: number, mode: number, page: number) {
  if (mode === 1) return delta * 16
  if (mode === 2) return delta * page
  return delta
}

const TimelineOverlayRails: React.FC<{
  viewportRef: React.RefObject<HTMLDivElement>
}> = ({ viewportRef }) => {
  const yRailRef = useRef<HTMLDivElement>(null)
  const xRailRef = useRef<HTMLDivElement>(null)
  const yThumbRef = useRef<HTMLDivElement>(null)
  const xThumbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const shell = viewport?.parentElement
    const yRail = yRailRef.current
    const xRail = xRailRef.current
    const yThumb = yThumbRef.current
    const xThumb = xThumbRef.current
    if (!viewport || !shell || !yRail || !xRail || !yThumb || !xThumb) return

    const metrics: { x: AxisMetrics | null; y: AxisMetrics | null } = { x: null, y: null }
    let frame = 0
    let hideTimer = 0
    let inside = shell.matches(':hover')
    let focused = viewport.contains(document.activeElement)
    let dragging = false
    let scrollHold = false
    let drag: {
      pointerId: number
      axis: 'x' | 'y'
      startPointer: number
      startScroll: number
      range: number
      movable: number
    } | null = null

    const syncVisibility = () => {
      const active = (dragging || inside || focused || scrollHold) && Boolean(metrics.x || metrics.y)
      shell.classList.toggle(styles.railsVisible, active)
    }

    const apply = () => {
      const yOverflow = viewport.scrollHeight - viewport.clientHeight > 1
      const xOverflow = viewport.scrollWidth - viewport.clientWidth > 1
      shell.classList.toggle(styles.railsBoth, yOverflow && xOverflow)
      metrics.y = yOverflow
        ? measureAxis(viewport.scrollHeight, viewport.clientHeight, viewport.scrollTop, yRail.clientHeight)
        : null
      metrics.x = xOverflow
        ? measureAxis(viewport.scrollWidth, viewport.clientWidth, viewport.scrollLeft, xRail.clientWidth)
        : null
      yRail.classList.toggle(styles.railAxisHidden, !metrics.y)
      xRail.classList.toggle(styles.railAxisHidden, !metrics.x)
      if (metrics.y) {
        yThumb.style.height = `${metrics.y.length}px`
        yThumb.style.transform = `translate3d(0, ${metrics.y.offset}px, 0)`
      }
      if (metrics.x) {
        xThumb.style.width = `${metrics.x.length}px`
        xThumb.style.transform = `translate3d(${metrics.x.offset}px, 0, 0)`
      }
      syncVisibility()
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    }

    const revealFromScroll = () => {
      scrollHold = true
      window.clearTimeout(hideTimer)
      syncVisibility()
      hideTimer = window.setTimeout(() => {
        scrollHold = false
        syncVisibility()
      }, RAIL_HIDE_MS)
    }

    const onScroll = () => {
      revealFromScroll()
      schedule()
    }

    const endDrag = () => {
      drag = null
      dragging = false
      viewport.style.scrollBehavior = ''
      shell.classList.remove(styles.railsDragging)
      syncVisibility()
    }

    const onThumbDown = (axis: 'x' | 'y') => (event: PointerEvent) => {
      if (event.button !== 0) return
      const current = metrics[axis]
      if (!current || current.range <= 0 || current.movable <= 0) return
      event.preventDefault()
      event.stopPropagation()
      const thumb = axis === 'y' ? yThumb : xThumb
      drag = {
        pointerId: event.pointerId,
        axis,
        startPointer: axis === 'y' ? event.clientY : event.clientX,
        startScroll: axis === 'y' ? viewport.scrollTop : viewport.scrollLeft,
        range: current.range,
        movable: current.movable,
      }
      dragging = true
      viewport.style.scrollBehavior = 'auto'
      shell.classList.add(styles.railsDragging)
      thumb.setPointerCapture(event.pointerId)
      syncVisibility()
    }

    const onThumbMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      const delta = (drag.axis === 'y' ? event.clientY : event.clientX) - drag.startPointer
      const next = Math.min(drag.range, Math.max(0, drag.startScroll + (delta * drag.range) / drag.movable))
      if (drag.axis === 'y') viewport.scrollTop = next
      else viewport.scrollLeft = next
    }

    const onThumbUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return
      endDrag()
    }

    const jump = (axis: 'x' | 'y', client: number) => {
      const rail = axis === 'y' ? yRail : xRail
      const current = metrics[axis]
      if (!current) return
      const rect = rail.getBoundingClientRect()
      const local = axis === 'y' ? client - rect.top : client - rect.left
      const thumbStart = Math.min(current.movable, Math.max(0, local - current.length / 2))
      const next = current.movable === 0 ? 0 : (thumbStart / current.movable) * current.range
      viewport.style.scrollBehavior = 'auto'
      if (axis === 'y') viewport.scrollTop = next
      else viewport.scrollLeft = next
      viewport.style.scrollBehavior = ''
    }

    const onRailDown = (axis: 'x' | 'y') => (event: PointerEvent) => {
      if (event.button !== 0 || event.target !== event.currentTarget) return
      event.preventDefault()
      jump(axis, axis === 'y' ? event.clientY : event.clientX)
    }

    const onWheel = (axis: 'x' | 'y') => (event: WheelEvent) => {
      const useX = axis === 'x' || event.shiftKey
      const raw = useX ? event.deltaX || event.deltaY : event.deltaY || event.deltaX
      const page = useX ? viewport.clientWidth : viewport.clientHeight
      const delta = wheelPixels(raw, event.deltaMode, page)
      if (useX) viewport.scrollLeft += delta
      else viewport.scrollTop += delta
      event.preventDefault()
    }

    const yWheel = onWheel('y')
    const xWheel = onWheel('x')
    const yDown = onThumbDown('y')
    const xDown = onThumbDown('x')
    const yRailDown = onRailDown('y')
    const xRailDown = onRailDown('x')
    const onEnter = () => {
      inside = true
      syncVisibility()
    }
    const onLeave = () => {
      inside = false
      syncVisibility()
    }
    const onFocusIn = () => {
      focused = true
      syncVisibility()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && viewport.contains(event.relatedTarget)) return
      focused = false
      syncVisibility()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const pageY = Math.max(40, viewport.clientHeight * 0.9)
      const deltas: Record<string, [number, number]> = {
        ArrowDown: [0, 40],
        ArrowUp: [0, -40],
        ArrowRight: [40, 0],
        ArrowLeft: [-40, 0],
        PageDown: [0, pageY],
        PageUp: [0, -pageY],
        Home: [-viewport.scrollLeft, -viewport.scrollTop],
        End: [viewport.scrollWidth, viewport.scrollHeight],
      }
      const delta = deltas[event.key]
      if (!delta) return
      viewport.scrollBy({ left: delta[0], top: delta[1] })
      event.preventDefault()
    }

    viewport.addEventListener('scroll', onScroll, { passive: true })
    shell.addEventListener('pointerenter', onEnter)
    shell.addEventListener('pointerleave', onLeave)
    viewport.addEventListener('focusin', onFocusIn)
    viewport.addEventListener('focusout', onFocusOut)
    viewport.addEventListener('keydown', onKeyDown)
    yThumb.addEventListener('pointerdown', yDown)
    xThumb.addEventListener('pointerdown', xDown)
    yThumb.addEventListener('pointermove', onThumbMove)
    xThumb.addEventListener('pointermove', onThumbMove)
    yThumb.addEventListener('pointerup', onThumbUp)
    xThumb.addEventListener('pointerup', onThumbUp)
    yThumb.addEventListener('pointercancel', onThumbUp)
    xThumb.addEventListener('pointercancel', onThumbUp)
    yThumb.addEventListener('lostpointercapture', onThumbUp)
    xThumb.addEventListener('lostpointercapture', onThumbUp)
    yRail.addEventListener('pointerdown', yRailDown)
    xRail.addEventListener('pointerdown', xRailDown)
    yRail.addEventListener('wheel', yWheel, { passive: false })
    xRail.addEventListener('wheel', xWheel, { passive: false })

    const observer = new ResizeObserver(() => schedule())
    observer.observe(viewport)
    for (const child of Array.from(viewport.children)) observer.observe(child)
    schedule()

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(hideTimer)
      observer.disconnect()
      endDrag()
      viewport.removeEventListener('scroll', onScroll)
      shell.removeEventListener('pointerenter', onEnter)
      shell.removeEventListener('pointerleave', onLeave)
      viewport.removeEventListener('focusin', onFocusIn)
      viewport.removeEventListener('focusout', onFocusOut)
      viewport.removeEventListener('keydown', onKeyDown)
      yThumb.removeEventListener('pointerdown', yDown)
      xThumb.removeEventListener('pointerdown', xDown)
      yThumb.removeEventListener('pointermove', onThumbMove)
      xThumb.removeEventListener('pointermove', onThumbMove)
      yThumb.removeEventListener('pointerup', onThumbUp)
      xThumb.removeEventListener('pointerup', onThumbUp)
      yThumb.removeEventListener('pointercancel', onThumbUp)
      xThumb.removeEventListener('pointercancel', onThumbUp)
      yThumb.removeEventListener('lostpointercapture', onThumbUp)
      xThumb.removeEventListener('lostpointercapture', onThumbUp)
      yRail.removeEventListener('pointerdown', yRailDown)
      xRail.removeEventListener('pointerdown', xRailDown)
      yRail.removeEventListener('wheel', yWheel)
      xRail.removeEventListener('wheel', xWheel)
      shell.classList.remove(styles.railsVisible, styles.railsBoth, styles.railsDragging)
    }
  }, [viewportRef])

  return (
    <>
      <div ref={yRailRef} className={`${styles.timelineScrollRail} ${styles.timelineScrollRailY}`} aria-hidden="true">
        <div ref={yThumbRef} className={styles.timelineScrollThumb} />
      </div>
      <div ref={xRailRef} className={`${styles.timelineScrollRail} ${styles.timelineScrollRailX}`} aria-hidden="true">
        <div ref={xThumbRef} className={styles.timelineScrollThumb} />
      </div>
    </>
  )
}

interface ScrollingTimelineProps {
  usageLogs: UsageLog[]
  onViewUsageLog: (logId: string) => void
  onDeleteUsageLog?: (logId: string, configId: string) => void
  regionCode?: 'cn' | 'tw'
  dayWidthPx?: number
  scrollToTodaySignal?: number
  jumpToDate?: { date: Date; signal: number } | null
  minRowHeightPx?: number
  itemBarHeightPx?: number
  itemBarGapPx?: number
  getMinRowHeightPx?: (chamberId: string) => number
  showConfigCountBadge?: boolean
  onVisibleMonthChange?: (monthLabel: string) => void
}

const ScrollingTimeline: React.FC<ScrollingTimelineProps> = ({
  usageLogs: propsUsageLogs = [],
  onViewUsageLog,
  onDeleteUsageLog,
  regionCode = 'cn',
  dayWidthPx: propsDayWidthPx,
  scrollToTodaySignal,
  jumpToDate,
  minRowHeightPx: propsMinRowHeightPx,
  itemBarHeightPx: propsItemBarHeightPx,
  itemBarGapPx: propsItemBarGapPx,
  getMinRowHeightPx,
  showConfigCountBadge: propsShowConfigCountBadge,
  onVisibleMonthChange,
}) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const theme = useTheme()
  const { tr, language } = useI18n()
  const nowMinuteMs = useMinuteClock(true)

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
  const [chamberSearchQuery, setChamberSearchQuery] = useState('')
  const lastReportedMonthRef = useRef<string>('')

  const filteredChambers = useMemo(() => {
    const q = chamberSearchQuery.trim().toLowerCase()
    if (!q) return chambers
    return chambers.filter((c) => {
      const hay = [c.name, c.category ?? '', c.location ?? '', c.assetCode ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [chambers, chamberSearchQuery])

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
  const lastHandledJumpSignalRef = useRef(0)
  const pendingScrollTargetDateRef = useRef<{ date: Date; behavior: ScrollBehavior } | null>(null)
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

    if (onVisibleMonthChange) {
      const anchorIndex = Math.min(totalDays - 1, Math.max(0, Math.floor((gridScrollLeft + visibleGridWidth * 0.3) / dayWidthPx)))
      const anchorDate = dateHeaders[anchorIndex]
      if (anchorDate) {
        const nextLabel = formatVisibleMonthLabel(anchorDate, language)
        if (nextLabel !== lastReportedMonthRef.current) {
          lastReportedMonthRef.current = nextLabel
          onVisibleMonthChange(nextLabel)
        }
      }
    }

    setVisibleDayIndexRange((prev) => {
      if (prev.startIndex === startIndex && prev.endIndexExclusive === endIndexExclusive) return prev
      return { startIndex, endIndexExclusive }
    })
  }, [dateHeaders, dayWidthPx, language, onVisibleMonthChange])

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

  const scrollToTargetDate = useCallback(
    (rawDate: Date, behavior: ScrollBehavior = 'smooth') => {
      const container = timelineContainerRef.current
      const targetByShift = getTimelineBaseDate(rawDate, shiftStartMinutes)
      const targetIndex = dateHeaders.findIndex((d) => isEqual(d, targetByShift))
      const hasEnoughBuffer = targetIndex >= 4 && targetIndex <= dateHeaders.length - 5

      if (!container || dateHeaders.length === 0 || targetIndex < 0 || !hasEnoughBuffer) {
        pendingScrollTargetDateRef.current = { date: targetByShift, behavior }
        setRangeStart(addMonths(targetByShift, -1))
        setRangeEnd(addMonths(targetByShift, 1))
        return
      }

      const desiredCellOffset = 2
      const targetGridScrollLeft = Math.max(0, (targetIndex - desiredCellOffset) * dayWidthPx)
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
      const clampedScrollLeft = Math.min(targetGridScrollLeft, maxScroll)

      ;(container as any).scrollTo?.({ left: clampedScrollLeft, behavior })
      if (!(container as any).scrollTo) container.scrollLeft = clampedScrollLeft
    },
    [dateHeaders, dayWidthPx, shiftStartMinutes]
  )

  useEffect(() => {
    const pending = pendingScrollTargetDateRef.current
    const container = timelineContainerRef.current
    if (!pending || !container || dateHeaders.length === 0) return

    const targetIndex = dateHeaders.findIndex((d) => isEqual(d, pending.date))
    if (targetIndex < 0) return

    pendingScrollTargetDateRef.current = null
    const desiredCellOffset = 2
    const targetGridScrollLeft = Math.max(0, (targetIndex - desiredCellOffset) * dayWidthPx)
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
    const clampedScrollLeft = Math.min(targetGridScrollLeft, maxScroll)

    ;(container as any).scrollTo?.({ left: clampedScrollLeft, behavior: pending.behavior })
    if (!(container as any).scrollTo) container.scrollLeft = clampedScrollLeft
  }, [dateHeaders, dayWidthPx])

  useEffect(() => {
    if (!scrollToTodaySignal || scrollToTodaySignal === lastHandledTodaySignalRef.current) return
    lastHandledTodaySignalRef.current = scrollToTodaySignal
    scrollToTargetDate(new Date(), 'smooth')
  }, [scrollToTodaySignal, scrollToTargetDate])

  useEffect(() => {
    if (!jumpToDate || !jumpToDate.signal || jumpToDate.signal === lastHandledJumpSignalRef.current) return
    lastHandledJumpSignalRef.current = jumpToDate.signal
    scrollToTargetDate(jumpToDate.date, 'smooth')
  }, [jumpToDate, scrollToTargetDate])

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

  const chamberLayouts = useMemo(() => {
    const layouts = new Map<string, { logsWithTracks: (TimelineUsageLogDisplayData & { trackIndex: number })[]; maxTracks: number }>()
    if (chambers && chambers.length > 0) {
      chambers.forEach((chamber) => {
        const chamberLogs = timelineItemsByChamberId.get(chamber.id) || []
        const logsWithTracksData = assignTracksToLogs(chamberLogs)
        const maxTracks = logsWithTracksData.reduce((maxVal, log) => Math.max(maxVal, log.trackIndex + 1), 0)
        layouts.set(chamber.id, { logsWithTracks: logsWithTracksData, maxTracks })
      })
    }
    return layouts
  }, [chambers, timelineItemsByChamberId])

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

  const overdueChamberIds = useMemo(() => {
    const set = new Set<string>()
    timelineDisplayItems.forEach((item) => {
      if (item.effectiveStatus === 'overdue') set.add(item.chamberId)
    })
    return set
  }, [timelineDisplayItems])

  const totalTimelineGridHeight = useMemo(() => {
    if (!filteredChambers || filteredChambers.length === 0) return minRowHeightPx * 3
    return filteredChambers.reduce((sum, chamber) => sum + getChamberRowHeight(chamber.id), 0)
  }, [filteredChambers, getChamberRowHeight, minRowHeightPx])

  const chamberRowTopById = useMemo(() => {
    const map = new Map<string, number>()
    if (!filteredChambers || filteredChambers.length === 0) return map
    let topOffset = 0
    filteredChambers.forEach((chamber) => {
      map.set(chamber.id, topOffset)
      topOffset += getChamberRowHeight(chamber.id)
    })
    return map
  }, [filteredChambers, getChamberRowHeight])

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

  const nowDate = new Date(nowMinuteMs)
  const todayByShift = getTimelineBaseDate(nowDate, shiftStartMinutes)
  const dayLabels = { weekend: tr('周末', 'Weekend'), weekday: tr('工作日', 'Workday') }
  const visibleDays = dateHeaders.slice(visibleDayIndexRange.startIndex, visibleDayIndexRange.endIndexExclusive)
  const visibleDayClassifications = visibleDays.map((d) => classifyDay(d, processedHolidays, dayLabels))
  const visibleLeftPx = visibleDayIndexRange.startIndex * dayWidthPx
  const visibleRightPx = visibleDayIndexRange.endIndexExclusive * dayWidthPx

  const nowOffsetMinutes = differenceInMinutes(nowDate, timelineViewActualStart)
  const nowLineLeftPx = (nowOffsetMinutes / (24 * 60)) * dayWidthPx
  const showNowLine = nowLineLeftPx >= 0 && nowLineLeftPx <= totalTimelineWidth

  const getChamberStatusIndicator = (chamber: (typeof chambers)[number]) => {
    if (chamber.status === 'maintenance') {
      return { color: theme.palette.error.main, label: getAssetStatusMeta('maintenance', tr).label }
    }
    if (overdueChamberIds.has(chamber.id)) {
      return { color: theme.palette.error.main, label: tr('已超时', 'Overdue') }
    }
    if (chamber.status === 'in-use') {
      return { color: theme.palette.warning.main, label: getAssetStatusMeta('in-use', tr).label }
    }
    return { color: theme.palette.success.main, label: getAssetStatusMeta('available', tr).label }
  }

  return (
    <div className={styles.timelinePageContainer} style={timelineCssVars}>
      <div
        ref={timelineContainerRef}
        className={styles.timelineScrollContainer}
        tabIndex={0}
        aria-label={tr('设备排程', 'Occupancy schedule')}
        onScroll={handleTimelineScroll}
      >
        <TimelineHeader
          totalTimelineWidth={totalTimelineWidth}
          dayWidthPx={dayWidthPx}
          visibleDays={visibleDays}
          visibleStartIndex={visibleDayIndexRange.startIndex}
          visibleDayClassifications={visibleDayClassifications}
          todayByShift={todayByShift}
          shiftStartMinutes={shiftStartMinutes}
          searchQuery={chamberSearchQuery}
          onSearchQueryChange={setChamberSearchQuery}
          totalChamberCount={chambers.length}
          filteredChamberCount={filteredChambers.length}
        />

        <div className={styles.timelineBodyRow} style={{ width: `${CHAMBER_NAME_WIDTH_PX + totalTimelineWidth}px` }}>
          <div className={styles.timelineChamberColumn} style={{ width: `${CHAMBER_NAME_WIDTH_PX}px` }}>
            {filteredChambers.map((chamber) => {
              const statusIndicator = getChamberStatusIndicator(chamber)
              const metaText = chamber.category
                ? `${chamber.category} · ${statusIndicator.label}`
                : statusIndicator.label
              return (
                <div
                  key={chamber.id}
                  className={styles.chamberRowName}
                  style={{ height: `${getChamberRowHeight(chamber.id)}px` }}
                  role="button"
                  tabIndex={0}
                  title={`${chamber.name} (${metaText})`}
                  onClick={() => navigate(`/assets/${chamber.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/assets/${chamber.id}`)
                  }}
                >
                  <span className={styles.chamberStatusBar} style={{ backgroundColor: statusIndicator.color }} />
                  <span className={styles.chamberNamePrimary}>{chamber.name}</span>
                  <span className={styles.chamberNameMeta}>{metaText}</span>
                </div>
              )
            })}
            {filteredChambers.length === 0 && !chambersLoading && (
              <Box sx={{ height: '100%', minHeight: minRowHeightPx * 3, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="textSecondary">
                  {chamberSearchQuery.trim()
                    ? tr('未找到匹配设备', 'No matching assets')
                    : tr('暂无环境箱', 'No chambers')}
                </Typography>
              </Box>
            )}
          </div>

          <div className={styles.timelineGridContent} style={{ width: `${totalTimelineWidth}px`, minHeight: `${totalTimelineGridHeight}px` }}>
            {visibleDays.map((dayCellStartTime, offset) => {
              const dayIndex = visibleDayIndexRange.startIndex + offset
              const classification = visibleDayClassifications[offset]
              const isTodayCol = isEqual(dayCellStartTime, todayByShift)
              let dayBgClass = styles.timelineDayBackground
              if (isTodayCol) {
                dayBgClass += ` ${styles.todayColumnBackground}`
              } else if (classification.type === 'publicHolidayHighWage') {
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
                      nowDate
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

            {showNowLine && filteredChambers.length > 0 ? (
              <div
                className={styles.timelineNowLine}
                style={{ left: `${nowLineLeftPx}px`, height: `${totalTimelineGridHeight}px` }}
                aria-hidden="true"
              >
                <span className={styles.timelineNowDot} />
              </div>
            ) : null}

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
      <TimelineOverlayRails viewportRef={timelineContainerRef} />
    </div>
  )
}

export default ScrollingTimeline
