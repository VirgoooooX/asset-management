import type { ChipProps } from '@mui/material'
import type { AssetStatus, RepairStatus, UsageLog } from '../types'

export type TranslateFn = (zh: string, en: string) => string

export type StatusMeta = {
  label: string
  color: ChipProps['color']
  tone: 'success' | 'warning' | 'info' | 'error' | 'default'
}

export const getAssetStatusMeta = (status: AssetStatus | string, tr: TranslateFn): StatusMeta => {
  if (status === 'available') return { label: tr('可用', 'Available'), color: 'success', tone: 'success' }
  if (status === 'in-use') return { label: tr('使用中', 'In use'), color: 'warning', tone: 'warning' }
  if (status === 'maintenance') return { label: tr('维修中', 'Maintenance'), color: 'error', tone: 'error' }
  return { label: String(status), color: 'default', tone: 'default' }
}

export const getUsageLogStatusMeta = (status: UsageLog['status'] | string, tr: TranslateFn): StatusMeta => {
  if (status === 'completed') return { label: tr('已完成', 'Completed'), color: 'success', tone: 'success' }
  if (status === 'in-progress') return { label: tr('进行中', 'In progress'), color: 'warning', tone: 'warning' }
  if (status === 'not-started') return { label: tr('未开始', 'Not started'), color: 'primary', tone: 'info' }
  if (status === 'overdue') return { label: tr('已超时', 'Overdue'), color: 'error', tone: 'error' }
  return { label: tr('未知', 'Unknown'), color: 'default', tone: 'default' }
}

export const getRepairStatusMeta = (status: RepairStatus | string, tr: TranslateFn): StatusMeta => {
  if (status === 'quote-pending') return { label: tr('未询价', 'Quote pending'), color: 'warning', tone: 'warning' }
  if (status === 'repair-pending') return { label: tr('待维修', 'Repair pending'), color: 'info', tone: 'info' }
  if (status === 'completed') return { label: tr('已完成', 'Completed'), color: 'success', tone: 'success' }
  return { label: String(status), color: 'default', tone: 'default' }
}
