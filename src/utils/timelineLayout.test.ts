import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHIFT_START_MINUTES,
  assignTracksToLogs,
  calculateBarPositionAndWidth,
  classifyDay,
  formatDateHeaderParts,
  formatShiftTimeLabels,
  formatVisibleMonthLabel,
  generateDateHeadersFromRange,
  getTimelineBaseDate,
  getTimelineDisplayData,
  type TimelineUsageLogDisplayData,
} from './timelineLayout'
import type { HolidayDetail } from '../services/holidayService'
import type { UsageLog } from '../types'

describe('timelineLayout', () => {
  it('computes base date before and after shift start', () => {
    const beforeShift = new Date(2026, 4, 10, 6, 30, 0)
    const baseBefore = getTimelineBaseDate(beforeShift, DEFAULT_SHIFT_START_MINUTES)
    expect(baseBefore.getDate()).toBe(9)
    expect(baseBefore.getHours()).toBe(7)

    const afterShift = new Date(2026, 4, 10, 8, 15, 0)
    const baseAfter = getTimelineBaseDate(afterShift, DEFAULT_SHIFT_START_MINUTES)
    expect(baseAfter.getDate()).toBe(10)
    expect(baseAfter.getHours()).toBe(7)
  })

  it('generates inclusive date headers aligned to shift start', () => {
    const start = new Date(2026, 4, 10, 12, 0, 0)
    const end = new Date(2026, 4, 12, 18, 0, 0)
    const headers = generateDateHeadersFromRange(start, end, DEFAULT_SHIFT_START_MINUTES)
    expect(headers).toHaveLength(3)
    expect(headers.map((d) => d.getDate())).toEqual([10, 11, 12])
    expect(headers.every((d) => d.getHours() === 7 && d.getMinutes() === 0)).toBe(true)
  })

  it('calculates bar left and width clamped to view bounds', () => {
    const viewStart = new Date(2026, 4, 10, 7, 0, 0)
    const viewEnd = new Date(2026, 4, 12, 7, 0, 0)
    const log: UsageLog = {
      id: 'l1',
      chamberId: 'c1',
      user: 'alice',
      startTime: new Date(2026, 4, 10, 19, 0, 0).toISOString(),
      endTime: new Date(2026, 4, 11, 7, 0, 0).toISOString(),
      status: 'completed',
      createdAt: new Date(2026, 4, 10, 0, 0, 0).toISOString(),
    }
    const pos = calculateBarPositionAndWidth(log, viewStart, viewEnd, 'completed', 200)
    expect(pos.display).toBe(true)
    expect(pos.left).toBe(100)
    expect(pos.width).toBe(100)

    const outOfRange: UsageLog = {
      ...log,
      startTime: new Date(2026, 4, 13, 0, 0, 0).toISOString(),
      endTime: new Date(2026, 4, 13, 6, 0, 0).toISOString(),
    }
    expect(calculateBarPositionAndWidth(outOfRange, viewStart, viewEnd, 'completed', 200)).toEqual({
      left: 0,
      width: 0,
      display: false,
    })
  })

  it('classifies weekdays, weekends, holidays, and workday overrides', () => {
    const map = new Map<string, HolidayDetail>([
      ['2026-05-01', { holiday: true, name: 'Labor Day', wage: 3, date: '2026-05-01' }],
      ['2026-05-04', { holiday: true, name: 'Holiday', wage: 2, date: '2026-05-04' }],
      ['2026-05-09', { holiday: false, name: 'Makeup Workday', after: true, target: '2026-05-01', date: '2026-05-09' }],
    ])
    expect(classifyDay(new Date(2026, 4, 1), map)).toEqual({ type: 'publicHolidayHighWage', name: 'Labor Day' })
    expect(classifyDay(new Date(2026, 4, 4), map)).toEqual({ type: 'publicHolidayLowWage', name: 'Holiday' })
    expect(classifyDay(new Date(2026, 4, 9), map)).toEqual({ type: 'workdayOverride', name: 'Makeup Workday' })
    expect(classifyDay(new Date(2026, 4, 10), map, { weekend: 'Weekend', weekday: 'Workday' })).toEqual({
      type: 'weekendRest',
      name: 'Weekend',
    })
    expect(classifyDay(new Date(2026, 4, 11), map, { weekend: 'Weekend', weekday: 'Workday' })).toEqual({
      type: 'weekday',
      name: 'Workday',
    })
  })

  it('enriches display data and packs overlapping intervals into separate tracks', () => {
    const baseLogs: UsageLog[] = [
      {
        id: '1',
        chamberId: 'c1',
        projectId: 'p1',
        testProjectId: 'tp1',
        selectedConfigIds: ['cfg1'],
        user: 'u1',
        startTime: '2026-05-10T08:00:00.000Z',
        endTime: '2026-05-10T12:00:00.000Z',
        status: 'completed',
        createdAt: '2026-05-10T07:00:00.000Z',
      },
      {
        id: '2',
        chamberId: 'c1',
        user: 'u2',
        startTime: '2026-05-10T10:00:00.000Z',
        endTime: '2026-05-10T14:00:00.000Z',
        status: 'completed',
        createdAt: '2026-05-10T09:00:00.000Z',
      },
      {
        id: '3',
        chamberId: 'c1',
        user: 'u3',
        startTime: '2026-05-10T12:00:00.000Z',
        endTime: '2026-05-10T15:00:00.000Z',
        status: 'completed',
        createdAt: '2026-05-10T11:00:00.000Z',
      },
    ]
    const display: TimelineUsageLogDisplayData[] = getTimelineDisplayData(
      baseLogs,
      [{ id: 'p1', name: 'Proj', createdAt: '2026-05-01T00:00:00.000Z', configs: [{ id: 'cfg1', name: 'C-Fast' }] }],
      [{ id: 'tp1', name: 'ThermalTest', temperature: 85, humidity: 85, duration: 4, createdAt: '2026-05-01T00:00:00.000Z' }]
    )
    expect(display[0].projectName).toBe('Proj')
    expect(display[0].testProjectName).toBe('ThermalTest')
    expect(display[0].configNames).toEqual(['C-Fast'])

    const tracks = assignTracksToLogs(display)
    const trackById = new Map(tracks.map((t) => [t.originalLogId, t.trackIndex]))
    expect(trackById.get('1')).toBe(0)
    expect(trackById.get('2')).toBe(1)
    expect(trackById.get('3')).toBe(0)
  })

  it('formats date header parts, shift times, and visible month labels', () => {
    const sampleDate = new Date(2026, 10, 21, 7, 0, 0) // 2026-11-21 Saturday
    expect(formatDateHeaderParts(sampleDate, 'zh')).toEqual({ dateLabel: '11/21', weekdayLabel: '周六' })
    expect(formatDateHeaderParts(sampleDate, 'en')).toEqual({ dateLabel: '11/21', weekdayLabel: 'Sat' })
    expect(formatVisibleMonthLabel(sampleDate, 'zh')).toBe('2026年11月')
    expect(formatVisibleMonthLabel(sampleDate, 'en')).toBe('Nov 2026')
    expect(formatShiftTimeLabels(7 * 60)).toEqual({ dayTime: '07:00', nightTime: '19:00' })
    expect(formatShiftTimeLabels(8 * 60 + 30)).toEqual({ dayTime: '08:30', nightTime: '20:30' })
  })
})
