import React from 'react'
import { isEqual } from 'date-fns'
import { useI18n } from '../../i18n'
import {
  CHAMBER_NAME_WIDTH_PX,
  HEADER_HEIGHT_PX,
  formatDateHeader,
  type DayClassification,
} from '../../utils/timelineLayout'
import styles from '../ScrollingTimeline.module.css'

interface TimelineHeaderProps {
  totalTimelineWidth: number
  dayWidthPx: number
  visibleDays: Date[]
  visibleStartIndex: number
  visibleDayClassifications: DayClassification[]
  todayByShift: Date
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  totalTimelineWidth,
  dayWidthPx,
  visibleDays,
  visibleStartIndex,
  visibleDayClassifications,
  todayByShift,
}) => {
  const { tr, language } = useI18n()

  return (
    <div
      className={styles.timelineHeaderRow}
      style={{ width: `${CHAMBER_NAME_WIDTH_PX + totalTimelineWidth}px`, height: `${HEADER_HEIGHT_PX}px` }}
    >
      <div
        className={styles.timelineHeaderChamberCell}
        style={{ width: `${CHAMBER_NAME_WIDTH_PX}px`, height: `${HEADER_HEIGHT_PX}px` }}
      >
        {tr('环境箱', 'Chamber')}
      </div>
      <div className={styles.timelineHeaderDates} style={{ width: `${totalTimelineWidth}px` }}>
        {visibleDays.map((dateHeaderItem, offset) => {
          const index = visibleStartIndex + offset
          const classification = visibleDayClassifications[offset]
          let headerClassName = styles.timelineDateHeader
          if (classification.type === 'publicHolidayHighWage') {
            headerClassName += ` ${styles.publicHolidayStrongRedBackground}`
          } else if (classification.type === 'publicHolidayLowWage') {
            headerClassName += ` ${styles.weekendSoftRedBackground}`
          } else if (classification.type === 'weekendRest') {
            headerClassName += ` ${styles.weekendHeader}`
          } else if (classification.type === 'workdayOverride') {
            headerClassName += ` ${styles.workdayOnWeekendHeader}`
          }
          if (isEqual(dateHeaderItem, todayByShift)) {
            headerClassName += ` ${styles.todayHeader}`
          }

          return (
            <div
              key={index}
              className={headerClassName}
              style={{
                left: `${index * dayWidthPx}px`,
                minWidth: `${dayWidthPx}px`,
                width: `${dayWidthPx}px`,
                position: 'absolute',
                top: 0,
              }}
              title={classification.name || ''}
            >
              <div className={styles.dateDisplay}>{formatDateHeader(dateHeaderItem, language)}</div>
              <div className={styles.shiftContainer}>
                <div className={styles.dayShift}>{tr('白班', 'Day')}</div>
                <div className={styles.nightShift}>{tr('夜班', 'Night')}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TimelineHeader
