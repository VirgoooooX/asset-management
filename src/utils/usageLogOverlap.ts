import type { Locale } from 'date-fns'
import type { UsageLog } from '../types'
import { formatDateTimeShort } from './formatters'

export type UsageLogConflictReason = 'overlap' | 'active-unfinished'

export interface UsageLogConflictInfo {
  reason: UsageLogConflictReason
  conflictLog: Pick<UsageLog, 'id' | 'startTime' | 'endTime' | 'user' | 'status'>
}

const parseMs = (value?: string | Date | null): number | null => {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export const findUsageLogConflict = (params: {
  logs: UsageLog[]
  chamberId: string
  startTime: Date | string | null | undefined
  endTime: Date | string | null | undefined
  status: UsageLog['status']
  excludeLogId?: string
  nowMs?: number
}): UsageLogConflictInfo | null => {
  const { logs, chamberId, startTime, endTime, status, excludeLogId } = params
  if (!chamberId) return null

  const candStartMs = parseMs(startTime)
  if (candStartMs === null) return null

  const candExplicitEndMs = parseMs(endTime)
  const candEndMs =
    candExplicitEndMs !== null
      ? candExplicitEndMs
      : status === 'completed'
        ? candStartMs
        : Number.POSITIVE_INFINITY
  const nowMs = params.nowMs ?? Date.now()
  const candIsOccupyingNow =
    status !== 'completed' && (status === 'in-progress' || status === 'overdue' || candStartMs <= nowMs)

  for (const log of logs) {
    if (log.chamberId !== chamberId) continue
    if (excludeLogId && log.id === excludeLogId) continue

    const existStartMs = parseMs(log.startTime)
    if (existStartMs === null) continue
    const existExplicitEndMs = parseMs(log.endTime)
    const existEndMs =
      existExplicitEndMs !== null
        ? existExplicitEndMs
        : log.status === 'completed'
          ? existStartMs
          : Number.POSITIVE_INFINITY

    if (candStartMs < existEndMs && existStartMs < candEndMs) {
      return {
        reason: 'overlap',
        conflictLog: {
          id: log.id,
          startTime: log.startTime,
          endTime: log.endTime,
          user: log.user,
          status: log.status,
        },
      }
    }

    const existIsOccupyingNow =
      log.status !== 'completed' &&
      (log.status === 'in-progress' || log.status === 'overdue' || existStartMs <= nowMs)
    if (candIsOccupyingNow && existIsOccupyingNow) {
      return {
        reason: 'active-unfinished',
        conflictLog: {
          id: log.id,
          startTime: log.startTime,
          endTime: log.endTime,
          user: log.user,
          status: log.status,
        },
      }
    }
  }

  return null
}

export const formatUsageLogConflictMessage = (
  info: UsageLogConflictInfo,
  tr: (zh: string, en: string) => string,
  locale?: Locale
): string => {
  const { reason, conflictLog } = info
  const startLabel = formatDateTimeShort(conflictLog.startTime, { fallback: conflictLog.startTime, locale })
  const endLabel = conflictLog.endTime
    ? formatDateTimeShort(conflictLog.endTime, { fallback: conflictLog.endTime, locale })
    : tr('未结束', 'ongoing')
  const userPart = conflictLog.user ? tr(`（使用人：${conflictLog.user}）`, ` (User: ${conflictLog.user})`) : ''

  if (reason === 'active-unfinished') {
    return tr(
      `该环境箱尚有未结束的测试记录（${startLabel} → ${endLabel}）${userPart}，请先停止/标记完成后再开始下一条测试。`,
      `This chamber still has an unfinished test (${startLabel} → ${endLabel})${userPart}. Please stop/complete it before starting the next test.`
    )
  }

  return tr(
    `与该环境箱已有排程（${startLabel} → ${endLabel}）${userPart}时间重叠，同一设备不允许同时排程，请顺延开始时间或先结束上一条测试。`,
    `Time overlaps with an existing schedule on this chamber (${startLabel} → ${endLabel})${userPart}. Overlapping tests on the same chamber are not allowed.`
  )
}

export const parseUsageLogConflictApiError = (
  rawError: unknown,
  tr: (zh: string, en: string) => string,
  locale?: Locale
): string | null => {
  const rawMessage =
    typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object' && 'message' in rawError && typeof (rawError as any).message === 'string'
        ? (rawError as any).message
        : ''
  if (!rawMessage) return null

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: string
      conflict?: { id?: string; startTime?: string; endTime?: string | null; user?: string; status?: string }
    }
    if (parsed?.error === 'usage_log_overlap' || parsed?.error === 'usage_log_active_conflict') {
      const reason: UsageLogConflictReason =
        parsed.error === 'usage_log_active_conflict' ? 'active-unfinished' : 'overlap'
      if (parsed.conflict?.startTime) {
        return formatUsageLogConflictMessage(
          {
            reason,
            conflictLog: {
              id: parsed.conflict.id ?? '',
              startTime: parsed.conflict.startTime,
              endTime: parsed.conflict.endTime ?? undefined,
              user: parsed.conflict.user ?? '',
              status: (parsed.conflict.status as UsageLog['status']) ?? 'in-progress',
            },
          },
          tr,
          locale
        )
      }
      return reason === 'active-unfinished'
        ? tr('该环境箱尚有未结束的测试记录，请先停止/标记完成后再开始下一条测试。', 'This chamber still has an unfinished test. Please complete it first.')
        : tr('同一环境箱时间段重叠，请调整开始/结束时间或先结束上一条测试。', 'Schedule overlaps with an existing usage log on this chamber.')
    }
    if (parsed?.error === 'asset_in_maintenance') {
      return tr('该环境箱当前处于维修中，无法登记使用记录。', 'This chamber is currently in maintenance.')
    }
    if (parsed?.error === 'invalid_time_range') {
      return tr('时间范围无效，请检查开始和结束时间。', 'Invalid time range. Please check start and end times.')
    }
  } catch {
    return null
  }
  return null
}
