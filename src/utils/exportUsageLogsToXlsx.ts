import * as XLSX from 'xlsx'
import { format, isValid, parseISO } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { Asset, Project, TestProject, UsageLog } from '../types'
import { getEffectiveUsageLogStatus } from './statusHelpers'
import type { Language } from '../store/settingsSlice'

const formatDateTime = (value: string | undefined, language: Language) => {
  if (!value) return ''
  const date = parseISO(value)
  if (!isValid(date)) return value
  return format(date, 'yyyy-MM-dd HH:mm', { locale: language === 'en' ? enUS : zhCN })
}

const buildConfigNameMapByProjectId = (projects: Project[]) => {
  const map = new Map<string, Map<string, string>>()
  projects.forEach((p) => {
    const configMap = new Map<string, string>()
    ;(p.configs || []).forEach((c) => configMap.set(c.id, c.name))
    map.set(p.id, configMap)
  })
  return map
}

export const exportUsageLogsToXlsx = (params: {
  usageLogs: UsageLog[]
  chambers: Asset[]
  projects: Project[]
  testProjects: TestProject[]
  fileNamePrefix?: string
  language?: Language
}) => {
  const { usageLogs, chambers, projects, testProjects, fileNamePrefix = 'usage-logs', language = 'zh' } = params

  const chamberNameById = new Map(chambers.map((c) => [c.id, c.name] as const))
  const projectById = new Map(projects.map((p) => [p.id, p] as const))
  const testProjectNameById = new Map(testProjects.map((tp) => [tp.id, tp.name] as const))
  const configNameByProjectId = buildConfigNameMapByProjectId(projects)

  const rows = usageLogs.map((log) => {
    const effectiveStatus = getEffectiveUsageLogStatus(log)
    const chamberName = chamberNameById.get(log.chamberId) || log.chamberId
    const project = log.projectId ? projectById.get(log.projectId) : undefined
    const projectName = project?.name || (log.projectId || '')
    const testProjectName = log.testProjectId ? (testProjectNameById.get(log.testProjectId) || log.testProjectId) : ''

    const configNames =
      log.projectId && log.selectedConfigIds && log.selectedConfigIds.length > 0
        ? log.selectedConfigIds
            .map((id) => configNameByProjectId.get(log.projectId!)?.get(id) || id)
            .join(language === 'en' ? ', ' : '，')
        : ''

    if (language === 'en') {
      return {
        'Log ID': log.id,
        Asset: chamberName,
        Project: projectName,
        'Test Project': testProjectName,
        Configs: configNames,
        WF: log.selectedWaterfall || '',
        User: log.user,
        'Start Time': formatDateTime(log.startTime, language),
        'End Time': formatDateTime(log.endTime, language),
        'Stored Status': log.status,
        'Effective Status': effectiveStatus,
        Notes: log.notes || '',
        'Created At': formatDateTime(log.createdAt, language),
      }
    }

    return {
      使用记录ID: log.id,
      环境箱: chamberName,
      项目: projectName,
      测试项目: testProjectName,
      配置: configNames,
      WF: log.selectedWaterfall || '',
      用户: log.user,
      开始时间: formatDateTime(log.startTime, language),
      结束时间: formatDateTime(log.endTime, language),
      存储状态: log.status,
      有效状态: effectiveStatus,
      备注: log.notes || '',
      创建时间: formatDateTime(log.createdAt, language),
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, language === 'en' ? 'Usage Logs' : '使用记录')

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
