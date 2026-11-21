import React from 'react'
import { Tooltip, Typography } from '@mui/material'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import type { UsageLog } from '../../types'
import { formatDateTimeShort } from '../../utils/formatters'
import { getUsageLogStatusMeta } from '../../utils/statusMeta'
import type { TimelineUsageLogDisplayData } from '../../utils/timelineLayout'
import { useI18n } from '../../i18n'
import styles from '../ScrollingTimeline.module.css'

const MAX_CONFIG_PILLS = 4

const DeleteIconSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const getBarStylingByEffectiveStatus = (theme: Theme, status: UsageLog['status']) => {
  const isDark = theme.palette.mode === 'dark'
  const main =
    status === 'completed'
      ? theme.palette.success.main
      : status === 'in-progress'
        ? theme.palette.warning.main
        : status === 'not-started'
          ? theme.palette.info.main
          : status === 'overdue'
            ? theme.palette.error.main
            : alpha(theme.palette.text.primary, 0.32)

  const contrast =
    status === 'completed'
      ? isDark
        ? theme.palette.success.light
        : theme.palette.success.dark
      : status === 'in-progress'
        ? isDark
          ? theme.palette.warning.light
          : theme.palette.warning.dark
        : status === 'not-started'
          ? isDark
            ? theme.palette.info.light
            : theme.palette.info.dark
          : status === 'overdue'
            ? isDark
              ? theme.palette.error.light
              : theme.palette.error.dark
            : theme.palette.text.primary

  return {
    backgroundColor: alpha(main, isDark ? 0.24 : 0.14),
    borderColor: alpha(main, isDark ? 0.48 : 0.34),
    textColor: contrast,
  }
}

interface TimelineBarProps {
  logDisplayItem: TimelineUsageLogDisplayData & { trackIndex: number }
  originalLog: UsageLog
  left: number
  width: number
  height: number
  top: number
  showConfigCountBadge: boolean
  canDeleteConfig: boolean
  onViewUsageLog: (logId: string) => void
  onDeleteConfig?: (anchorEl: HTMLElement, logDisplayItem: TimelineUsageLogDisplayData) => void
}

const TimelineBar: React.FC<TimelineBarProps> = ({
  logDisplayItem,
  originalLog,
  left,
  width,
  height,
  top,
  showConfigCountBadge,
  canDeleteConfig,
  onViewUsageLog,
  onDeleteConfig,
}) => {
  const theme = useTheme()
  const { tr, dateFnsLocale } = useI18n()

  const styling = getBarStylingByEffectiveStatus(theme, logDisplayItem.effectiveStatus)
  const configNames = logDisplayItem.configNames ?? []
  const hasConfigs = configNames.length > 0
  const isMultiConfig = configNames.length > 1
  const configText = hasConfigs ? configNames.join(', ') : ''
  const notesText = (originalLog.notes ?? '').trim().replace(/\s+/g, ' ')
  const hasNotes = notesText.length > 0

  const barTextParts: string[] = []
  if (logDisplayItem.projectName) barTextParts.push(logDisplayItem.projectName)
  if (hasConfigs) barTextParts.push(configText)
  if (originalLog.selectedWaterfall) barTextParts.push(`WF:${originalLog.selectedWaterfall}`)
  if (logDisplayItem.testProjectName) barTextParts.push(logDisplayItem.testProjectName)
  const barText = barTextParts.length > 0 ? barTextParts.join(' - ') : originalLog.user || tr('使用记录', 'Usage log')

  const barSegments: Array<{ text: string; tone: 'primary' | 'secondary' }> = []
  if (logDisplayItem.projectName) barSegments.push({ text: logDisplayItem.projectName, tone: 'primary' })
  if (originalLog.selectedWaterfall) barSegments.push({ text: `WF:${originalLog.selectedWaterfall}`, tone: 'secondary' })
  if (logDisplayItem.testProjectName) barSegments.push({ text: logDisplayItem.testProjectName, tone: 'secondary' })

  const configPills = hasConfigs ? configNames.slice(0, MAX_CONFIG_PILLS) : []
  const remainingConfigCount = hasConfigs ? Math.max(0, configNames.length - configPills.length) : 0
  const statusLabel = getUsageLogStatusMeta(logDisplayItem.effectiveStatus, tr).label

  const endDisplay = originalLog.endTime
    ? formatDateTimeShort(originalLog.endTime, { fallback: '-', locale: dateFnsLocale })
    : logDisplayItem.effectiveStatus === 'in-progress' || logDisplayItem.effectiveStatus === 'overdue'
      ? tr('进行中/已超时', 'In progress / Overdue')
      : tr('未设定', 'Not set')

  return (
    <Tooltip
      title={
        <React.Fragment>
          <Typography variant="subtitle2" gutterBottom>
            {barText}
          </Typography>
          <Typography variant="caption">
            {tr('用户', 'User')}: {originalLog.user}
            <br />
            {tr('开始', 'Start')}: {formatDateTimeShort(originalLog.startTime, { fallback: '-', locale: dateFnsLocale })}
            <br />
            {tr('结束', 'End')}: {endDisplay}
            <br />
            {tr('状态', 'Status')}: {statusLabel}
            <br />
            Configs: {hasConfigs ? configText : tr('未选配置', 'No config')}
            {originalLog.notes ? (
              <>
                <br />
                {tr('备注', 'Notes')}: {originalLog.notes.substring(0, 500)}
                {originalLog.notes.length > 500 ? '...' : ''}
              </>
            ) : null}
          </Typography>
        </React.Fragment>
      }
      placement="top"
      arrow
    >
      <div
        className={styles.timelineBar}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: styling.backgroundColor,
          borderColor: styling.borderColor,
          color: styling.textColor,
          height: `${height}px`,
          top: `${top}px`,
          ['--timeline-pill-bg' as any]: alpha(styling.textColor, 0.1),
          ['--timeline-pill-border' as any]: alpha(styling.textColor, 0.18),
          ['--timeline-pill-empty-bg' as any]: alpha(styling.textColor, 0.06),
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest(`.${styles.timelineBarDeleteButton}`)) return
          onViewUsageLog(logDisplayItem.originalLogId)
        }}
      >
        <div className={styles.timelineBarContent}>
          <div className={styles.timelineBarLine1}>
            {barSegments.length > 0
              ? barSegments.map((seg, idx) => (
                  <React.Fragment key={`${logDisplayItem.displayId}-seg-${idx}`}>
                    {idx > 0 ? <span className={styles.timelineBarTextSeparator}> · </span> : null}
                    <span className={seg.tone === 'primary' ? styles.timelineBarTextPrimary : styles.timelineBarTextSecondary}>
                      {seg.text}
                    </span>
                  </React.Fragment>
                ))
              : originalLog.user || tr('使用记录', 'Usage log')}
          </div>
          <div className={styles.timelineBarLine2}>
            {hasConfigs ? (
              <React.Fragment>
                {configPills.map((name, idx) => (
                  <span key={`${logDisplayItem.displayId}-cfg-${idx}`} className={styles.timelineConfigPill}>
                    {name}
                  </span>
                ))}
                {remainingConfigCount > 0 ? (
                  showConfigCountBadge ? (
                    <span className={styles.timelineConfigCountPill}>CFG×{configNames.length}</span>
                  ) : (
                    <span className={styles.timelineConfigPillMore}>+{remainingConfigCount}</span>
                  )
                ) : null}
              </React.Fragment>
            ) : (
              <span className={styles.timelineConfigPillEmpty} style={{ maxWidth: `${width * 0.8}px` }}>
                {hasNotes ? notesText : tr('未选配置', 'No config')}
              </span>
            )}
          </div>
        </div>
        {canDeleteConfig && onDeleteConfig && logDisplayItem.configIds.length > 0 ? (
          <button
            className={styles.timelineBarDeleteButton}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteConfig(e.currentTarget, logDisplayItem)
            }}
            title={isMultiConfig ? tr('删除某个配置', 'Remove a config') : tr('删除此配置', 'Remove this config')}
          >
            <DeleteIconSvg />
          </button>
        ) : null}
      </div>
    </Tooltip>
  )
}

export default TimelineBar
