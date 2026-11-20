import type { DerivedAlert } from '../store/alertsSelectors'

export type TranslateFn = (zh: string, en: string) => string

export const getLocalizedAlertContent = (
  alert: DerivedAlert,
  tr: TranslateFn
): { title: string; detail: string } => {
  if (alert.type === 'calibration-due') {
    const dueMatch = alert.detail.match(/^到期时间:\s*(.+)$/)
    const dueValue = dueMatch?.[1] ?? new Date(alert.occurredAtMs).toLocaleString()
    return {
      title: tr('校准即将到期', 'Calibration due soon'),
      detail: tr(`到期时间: ${dueValue}`, `Due: ${dueValue}`),
    }
  }

  if (alert.type === 'usage-overdue') {
    const match = alert.detail.match(/^开始:\s*(.+?)，当前状态:\s*(.+)$/)
    if (match) {
      return {
        title: tr('使用记录已逾期', 'Usage log overdue'),
        detail: tr(
          `开始: ${match[1]}，当前状态: ${match[2] === 'overdue' ? '已逾期' : match[2]}`,
          `Start: ${match[1]}, status: ${match[2]}`
        ),
      }
    }
    return {
      title: tr('使用记录已逾期', 'Usage log overdue'),
      detail: alert.detail,
    }
  }

  if (alert.type === 'usage-long') {
    const match = alert.detail.match(/已持续\s*(\d+)\s*小时（阈值\s*(\d+)\s*小时）/)
    if (match) {
      return {
        title: tr('长时间占用', 'Long occupancy'),
        detail: tr(
          `已持续 ${match[1]} 小时（阈值 ${match[2]} 小时）`,
          `Ongoing for ${match[1]}h (threshold ${match[2]}h)`
        ),
      }
    }
    return {
      title: tr('长时间占用', 'Long occupancy'),
      detail: alert.detail,
    }
  }

  return { title: alert.title, detail: alert.detail }
}
