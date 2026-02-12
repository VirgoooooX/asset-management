import * as XLSX from 'xlsx'
import { format, isValid, parseISO } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { Language } from '../store/settingsSlice'

const formatDateTime = (value: string | undefined, language: Language) => {
  if (!value) return ''
  const date = parseISO(value)
  if (!isValid(date)) return value
  return format(date, 'yyyy-MM-dd HH:mm', { locale: language === 'en' ? enUS : zhCN })
}

export type ProjectCostSummary = {
  projectName: string
  range?: { start: string; end: string }
  totalCostYuan: number
  totalBillableHours: number
  assetCount: number
  logCount: number
}

export type ProjectCostLine = {
  logId: string
  projectName: string
  assetName: string
  startTime?: string
  endTime?: string
  billableHours: number
  hourlyRateYuan: number
  costYuan: number
  rateSource?: 'snapshot' | 'category' | 'asset'
  estimated?: boolean
  user: string
  notes?: string
}

export const exportProjectCostToXlsx = (params: {
  summary: ProjectCostSummary
  lines: ProjectCostLine[]
  fileNamePrefix?: string
  language?: Language
}) => {
  const { summary, lines, fileNamePrefix = 'project-cost', language = 'zh' } = params

  const summaryRows =
    language === 'en'
      ? [
          {
            Project: summary.projectName,
            'Range Start': summary.range ? formatDateTime(summary.range.start, language) : '',
            'Range End': summary.range ? formatDateTime(summary.range.end, language) : '',
            'Total Billable Hours': summary.totalBillableHours,
            'Total Cost (CNY)': summary.totalCostYuan,
            'Asset Count': summary.assetCount,
            'Log Count': summary.logCount,
          },
        ]
      : [
          {
            项目: summary.projectName,
            开始时间: summary.range ? formatDateTime(summary.range.start, language) : '',
            结束时间: summary.range ? formatDateTime(summary.range.end, language) : '',
            计费小时: summary.totalBillableHours,
            总费用元: summary.totalCostYuan,
            设备数: summary.assetCount,
            记录数: summary.logCount,
          },
        ]

  const lineRows = lines.map((l) => {
    if (language === 'en') {
      return {
        'Log ID': l.logId,
        Project: l.projectName,
        Asset: l.assetName,
        'Start Time': formatDateTime(l.startTime, language),
        'End Time': formatDateTime(l.endTime, language),
        'Billable Hours': l.billableHours,
        'Hourly Rate (CNY)': l.hourlyRateYuan,
        'Cost (CNY)': l.costYuan,
        'Rate Source': l.rateSource || '',
        Estimated: l.estimated ? 'yes' : '',
        User: l.user,
        Notes: l.notes || '',
      }
    }

    return {
      使用记录ID: l.logId,
      项目: l.projectName,
      设备: l.assetName,
      开始时间: formatDateTime(l.startTime, language),
      结束时间: formatDateTime(l.endTime, language),
      计费小时: l.billableHours,
      小时费率元: l.hourlyRateYuan,
      费用元: l.costYuan,
      费率来源: l.rateSource || '',
      是否估算: l.estimated ? '是' : '',
      用户: l.user,
      备注: l.notes || '',
    }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), language === 'en' ? 'Summary' : '汇总')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lineRows), language === 'en' ? 'Lines' : '明细')

  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const fileName = `${fileNamePrefix}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
