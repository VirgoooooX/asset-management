import { parseISO, isValid } from 'date-fns'
import { UsageLog } from '../types'

/**
 * 计算并返回使用记录的有效状态。
 * @param log - The UsageLog object.
 * @param currentTime - Optional current time, defaults to new Date().
 * @returns The effective status of the usage log.
 */
export const getEffectiveUsageLogStatus = (
  log: UsageLog,
  currentTime: Date = new Date()
): UsageLog['status'] => {
  if (!log) return 'not-started'

  const storedStatus = log.status
  const startTime = log.startTime ? parseISO(log.startTime) : null
  const endTime = log.endTime ? parseISO(log.endTime) : null

  if (storedStatus === 'completed') {
    return 'completed'
  }

  // 检查是否已超时
  if (endTime && isValid(endTime) && endTime < currentTime) {
    return 'overdue'
  }

  // 检查是否正在进行中
  if (startTime && isValid(startTime) && startTime <= currentTime) {
    if (!endTime || (isValid(endTime) && endTime > currentTime)) {
      return 'in-progress'
    }
  }

  return storedStatus
}

/**
 * 检查使用记录当前是否应被视为活跃占用环境箱。
 * @param log - The UsageLog object.
 * @param currentTime - Optional current time, defaults to new Date().
 * @returns True if the log is currently active and in-progress.
 */
export const isUsageLogCurrentlyActive = (
  log: UsageLog,
  currentTime: Date = new Date()
): boolean => {
  if (!log || log.status !== 'in-progress') {
    return false
  }
  const startTime = log.startTime ? parseISO(log.startTime) : null
  const endTime = log.endTime ? parseISO(log.endTime) : null

  if (startTime && isValid(startTime) && startTime <= currentTime) {
    if (!endTime || (isValid(endTime) && endTime > currentTime)) {
      return true
    }
  }
  return false
}

export const isUsageLogOccupyingAsset = (log: UsageLog, currentTime: Date = new Date()): boolean => {
  if (!log) return false
  if (log.status === 'completed') return false

  const startTime = log.startTime ? parseISO(log.startTime) : null

  if (startTime && isValid(startTime) && startTime <= currentTime) {
    return true
  }
  return false
}

export const getUsageLogEndMs = (log: UsageLog, effective: UsageLog['status'], nowMs: number): number => {
  if (log.endTime) {
    const end = Date.parse(log.endTime)
    if (!Number.isNaN(end)) return end
  }
  if (effective === 'in-progress' || effective === 'overdue') return nowMs
  const start = Date.parse(log.startTime)
  if (Number.isNaN(start)) return nowMs
  return start + 60 * 60 * 1000
}
