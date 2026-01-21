// src/utils/statusHelpers.ts
import { parseISO, isValid } from 'date-fns';
import { UsageLog } from '../types';

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
  if (!log) return 'not-started'; // Fallback for safety

  const storedStatus = log.status;
  const startTime = log.startTime ? parseISO(log.startTime) : null;
  const endTime = log.endTime ? parseISO(log.endTime) : null;

  if (storedStatus === 'completed') {
    return 'completed';
  }

  // 检查是否已超时
  if (endTime && isValid(endTime) && endTime < currentTime) {
    return 'overdue';
  }

  // 检查是否正在进行中
  if (startTime && isValid(startTime) && startTime <= currentTime) {
    // 如果 endTime 存在且在将来，或者 endTime 不存在，则认为是 'in-progress'
    if (!endTime || (isValid(endTime) && endTime > currentTime)) {
      return 'in-progress';
    }
    // 如果 startTime <= currentTime，但 endTime 也 <= currentTime (上面已处理 overdue)
    // 这种情况理论上应该已经是 overdue，但如果 storedStatus 是 not-started，则按 not-started
  }

  // 如果没有明确进入 'in-progress' 或 'overdue'，并且不是 'completed'
  // 则返回其存储的状态（通常是 'not-started'，或一个尚未开始的 'in-progress'）
  return storedStatus;
};

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
    return false;
  }
  const startTime = log.startTime ? parseISO(log.startTime) : null;
  const endTime = log.endTime ? parseISO(log.endTime) : null;

  if (startTime && isValid(startTime) && startTime <= currentTime) {
    if (!endTime || (isValid(endTime) && endTime > currentTime)) {
      return true; // 开始了，且尚未结束
    }
  }
  return false;
};

export const isUsageLogOccupyingAsset = (log: UsageLog, currentTime: Date = new Date()): boolean => {
  if (!log) return false
  if (log.status === 'completed') return false

  const startTime = log.startTime ? parseISO(log.startTime) : null
  const endTime = log.endTime ? parseISO(log.endTime) : null

  if (startTime && isValid(startTime) && startTime <= currentTime) {
    if (!endTime || (isValid(endTime) && endTime > currentTime)) {
      return true
    }
  }
  return false
}
