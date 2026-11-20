import {
  addDays,
  addHours,
  differenceInMinutes,
  eachDayOfInterval,
  format,
  getDay,
  max,
  min,
  parseISO,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay as dateFnsStartOfDay,
} from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { Language } from '../store/settingsSlice'
import type { Project, TestProject, UsageLog } from '../types'
import { getEffectiveUsageLogStatus } from './statusHelpers'
import type { HolidayDetail } from '../services/holidayService'

export const CUSTOM_DAY_START_HOUR = 7
export const DEFAULT_SHIFT_START_MINUTES = CUSTOM_DAY_START_HOUR * 60
export const DAY_WIDTH_PX = 200
export const MIN_ROW_HEIGHT_PX = 80
export const HEADER_HEIGHT_PX = 70
export const CHAMBER_NAME_WIDTH_PX = 150

export interface TimelineUsageLogDisplayData extends Omit<UsageLog, 'id' | 'selectedConfigIds'> {
  displayId: string
  originalLogId: string
  projectName?: string
  testProjectName?: string
  configIds: string[]
  configNames: string[]
  effectiveStatus: UsageLog['status']
}

export type DayClassification = {
  type: 'weekday' | 'weekendRest' | 'publicHolidayLowWage' | 'publicHolidayHighWage' | 'workdayOverride'
  name?: string
}

export const getTimelineBaseDate = (currentDate: Date, shiftStartMinutes: number): Date => {
  const h = Math.floor(shiftStartMinutes / 60)
  const m = shiftStartMinutes % 60
  const base = setMilliseconds(setSeconds(setMinutes(setHours(dateFnsStartOfDay(currentDate), h), m), 0), 0)
  const minutesIntoDay = currentDate.getHours() * 60 + currentDate.getMinutes()
  return minutesIntoDay < shiftStartMinutes ? addDays(base, -1) : base
}

export const generateDateHeadersFromRange = (
  rangeStart: Date,
  rangeEnd: Date,
  shiftStartMinutes: number
): Date[] => {
  const h = Math.floor(shiftStartMinutes / 60)
  const m = shiftStartMinutes % 60
  const days = eachDayOfInterval({
    start: dateFnsStartOfDay(rangeStart),
    end: dateFnsStartOfDay(rangeEnd),
  })
  return days.map((calendarDay) =>
    setMilliseconds(setSeconds(setMinutes(setHours(calendarDay, h), m), 0), 0)
  )
}

export const calculateBarPositionAndWidth = (
  log: UsageLog,
  timelineViewActualStart: Date,
  timelineViewActualEnd: Date,
  effectiveStatus: UsageLog['status'],
  dayWidthPx: number,
  nowDate: Date = new Date()
) => {
  const logStartTime = parseISO(log.startTime)
  let logEndTimeDate: Date

  if (log.endTime) {
    logEndTimeDate = parseISO(log.endTime)
  } else if (effectiveStatus === 'in-progress' || effectiveStatus === 'overdue') {
    logEndTimeDate = nowDate
  } else {
    logEndTimeDate = addHours(logStartTime, 1)
  }
  if (!logEndTimeDate || Number.isNaN(logEndTimeDate.valueOf())) {
    logEndTimeDate = addHours(logStartTime, 1)
  }

  if (logEndTimeDate <= timelineViewActualStart || logStartTime >= timelineViewActualEnd) {
    return { left: 0, width: 0, display: false }
  }

  const displayStartTime = max([logStartTime, timelineViewActualStart])
  const displayEndTime = min([logEndTimeDate, timelineViewActualEnd])
  if (displayStartTime >= displayEndTime) {
    return { left: 0, width: 0, display: false }
  }

  const leftOffsetMinutes = differenceInMinutes(displayStartTime, timelineViewActualStart)
  const displayDurationMinutes = differenceInMinutes(displayEndTime, displayStartTime)
  const minutesInDay = 24 * 60
  const finalLeft = (leftOffsetMinutes / minutesInDay) * dayWidthPx
  const finalWidth = (displayDurationMinutes / minutesInDay) * dayWidthPx

  return { left: finalLeft, width: Math.max(finalWidth, 2), display: true }
}

const ZH_DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const formatDateHeader = (date: Date, language: Language = 'zh'): string => {
  if (language === 'en') {
    return format(date, 'M/d EEE', { locale: enUS })
  }
  return `${format(date, 'M/d', { locale: zhCN })} ${ZH_DAY_NAMES[getDay(date)]}`
}

export const isWeekend = (date: Date): boolean => {
  const dayOfWeek = getDay(date)
  return dayOfWeek === 0 || dayOfWeek === 6
}

export const classifyDay = (
  date: Date,
  processedHolidays: Map<string, HolidayDetail>,
  labels?: { weekend?: string; weekday?: string }
): DayClassification => {
  const dateStr = format(date, 'yyyy-MM-dd')
  const holidayInfo = processedHolidays.get(dateStr)

  if (holidayInfo) {
    if (holidayInfo.holiday) {
      if (holidayInfo.wage === 3) {
        return { type: 'publicHolidayHighWage', name: holidayInfo.name }
      }
      return { type: 'publicHolidayLowWage', name: holidayInfo.name }
    }
    return { type: 'workdayOverride', name: holidayInfo.name }
  }
  if (isWeekend(date)) {
    return { type: 'weekendRest', name: labels?.weekend ?? '周末' }
  }
  return { type: 'weekday', name: labels?.weekday ?? '工作日' }
}

export const getTimelineDisplayData = (
  passedUsageLogs: UsageLog[] = [],
  projectsFromStore: Project[] = [],
  testProjectsFromStore: TestProject[] = [],
  now: Date = new Date()
): TimelineUsageLogDisplayData[] => {
  if (!passedUsageLogs || passedUsageLogs.length === 0) return []
  const displayDataList: TimelineUsageLogDisplayData[] = []

  const projectById = new Map<string, Project>()
  projectsFromStore.forEach((p) => projectById.set(p.id, p))
  const testProjectById = new Map<string, TestProject>()
  testProjectsFromStore.forEach((tp) => testProjectById.set(tp.id, tp))
  const projectConfigByIdCache = new Map<string, Map<string, { name: string }>>()

  passedUsageLogs.forEach((log) => {
    const project = log.projectId ? projectById.get(log.projectId) : undefined
    const testProject = log.testProjectId ? testProjectById.get(log.testProjectId) : undefined
    const effectiveStatus = getEffectiveUsageLogStatus(log, now)

    const { id: originalLogIdFromLog, selectedConfigIds, ...restOfLog } = log
    const configIds = selectedConfigIds ?? []
    let configNames: string[] = []
    if (configIds.length > 0) {
      let configById: Map<string, { name: string }> | undefined
      if (project) {
        configById = projectConfigByIdCache.get(project.id)
        if (!configById) {
          configById = new Map<string, { name: string }>()
          project.configs?.forEach((c) => configById!.set(c.id, { name: c.name }))
          projectConfigByIdCache.set(project.id, configById)
        }
      }
      configNames = configIds.map((configId) => configById?.get(configId)?.name || configId)
    }

    displayDataList.push({
      ...restOfLog,
      chamberId: log.chamberId,
      user: log.user,
      startTime: log.startTime,
      endTime: log.endTime,
      status: log.status,
      notes: log.notes,
      projectId: log.projectId,
      testProjectId: log.testProjectId,
      createdAt: log.createdAt,
      selectedWaterfall: log.selectedWaterfall,
      displayId: originalLogIdFromLog,
      originalLogId: originalLogIdFromLog,
      projectName: project?.name,
      testProjectName: testProject?.name,
      configIds,
      configNames,
      effectiveStatus,
    })
  })
  return displayDataList
}

export const assignTracksToLogs = (
  logs: TimelineUsageLogDisplayData[],
  nowMs: number = Date.now()
): (TimelineUsageLogDisplayData & { trackIndex: number })[] => {
  if (!logs || logs.length === 0) return []

  const DAY_MS = 24 * 60 * 60 * 1000
  const prepared = logs.map((log) => {
    const startMs = parseISO(log.startTime).getTime()
    let endMs = log.endTime
      ? parseISO(log.endTime).getTime()
      : log.effectiveStatus === 'in-progress' || log.effectiveStatus === 'overdue'
        ? nowMs
        : startMs + DAY_MS
    if (!Number.isFinite(endMs)) endMs = startMs + DAY_MS
    return { log, startMs, endMs }
  })

  prepared.sort((a, b) => {
    const startDiff = a.startMs - b.startMs
    if (startDiff !== 0) return startDiff
    return a.endMs - a.startMs - (b.endMs - b.startMs)
  })

  const layout: (TimelineUsageLogDisplayData & { trackIndex: number })[] = []
  const trackEndMs: number[] = []

  for (const item of prepared) {
    let assignedTrackIndex = -1
    for (let i = 0; i < trackEndMs.length; i++) {
      if (trackEndMs[i] <= item.startMs) {
        assignedTrackIndex = i
        break
      }
    }
    if (assignedTrackIndex === -1) {
      assignedTrackIndex = trackEndMs.length
      trackEndMs.push(item.endMs)
    } else if (item.endMs > trackEndMs[assignedTrackIndex]) {
      trackEndMs[assignedTrackIndex] = item.endMs
    }
    layout.push({ ...item.log, trackIndex: assignedTrackIndex })
  }
  return layout
}
