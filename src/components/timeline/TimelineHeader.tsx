import React from 'react'
import { isEqual } from 'date-fns'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import { useI18n } from '../../i18n'
import {
  CHAMBER_NAME_WIDTH_PX,
  HEADER_HEIGHT_PX,
  formatDateHeaderParts,
  formatShiftTimeLabels,
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
  shiftStartMinutes: number
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  totalChamberCount: number
  filteredChamberCount: number
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  totalTimelineWidth,
  dayWidthPx,
  visibleDays,
  visibleStartIndex,
  visibleDayClassifications,
  todayByShift,
  shiftStartMinutes,
  searchQuery,
  onSearchQueryChange,
  totalChamberCount,
  filteredChamberCount,
}) => {
  const { tr, language } = useI18n()
  const { dayTime, nightTime } = formatShiftTimeLabels(shiftStartMinutes)
  const hasFilter = searchQuery.trim().length > 0

  return (
    <div
      className={styles.timelineHeaderRow}
      style={{ width: `${CHAMBER_NAME_WIDTH_PX + totalTimelineWidth}px`, height: `${HEADER_HEIGHT_PX}px` }}
    >
      <div
        className={styles.timelineHeaderChamberCell}
        style={{ width: `${CHAMBER_NAME_WIDTH_PX}px`, height: `${HEADER_HEIGHT_PX}px` }}
      >
        <div className={styles.chamberSearchBox}>
          <SearchIcon className={styles.chamberSearchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={tr('筛选设备', 'Filter assets')}
            aria-label={tr('筛选设备', 'Filter assets')}
            className={styles.chamberSearchInput}
          />
          {hasFilter ? (
            <button
              type="button"
              className={styles.chamberSearchClear}
              onClick={() => onSearchQueryChange('')}
              aria-label={tr('清空筛选', 'Clear filter')}
              title={tr('清空筛选', 'Clear filter')}
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </button>
          ) : (
            <span className={styles.chamberCountBadge} title={tr(`共 ${totalChamberCount} 台设备`, `${totalChamberCount} assets`)}>
              {totalChamberCount}
            </span>
          )}
        </div>
        {hasFilter && (
          <div className={styles.chamberFilterMeta}>
            {tr(`${filteredChamberCount} / ${totalChamberCount} 台`, `${filteredChamberCount} / ${totalChamberCount}`)}
          </div>
        )}
      </div>

      <div className={styles.timelineHeaderDates} style={{ width: `${totalTimelineWidth}px` }}>
        {visibleDays.map((dateHeaderItem, offset) => {
          const index = visibleStartIndex + offset
          const classification = visibleDayClassifications[offset]
          const isToday = isEqual(dateHeaderItem, todayByShift)
          const isWeekendOrHoliday =
            classification.type === 'weekendRest' ||
            classification.type === 'publicHolidayLowWage' ||
            classification.type === 'publicHolidayHighWage'
          const { dateLabel, weekdayLabel } = formatDateHeaderParts(dateHeaderItem, language)

          let headerClassName = styles.timelineDateHeader
          if (classification.type === 'publicHolidayHighWage') {
            headerClassName += ` ${styles.publicHolidayHeader}`
          } else if (classification.type === 'publicHolidayLowWage') {
            headerClassName += ` ${styles.weekendHeader}`
          } else if (classification.type === 'weekendRest') {
            headerClassName += ` ${styles.weekendHeader}`
          } else if (classification.type === 'workdayOverride') {
            headerClassName += ` ${styles.workdayOnWeekendHeader}`
          }
          if (isToday) {
            headerClassName += ` ${styles.todayHeader}`
          }

          const holidayTag =
            classification.type === 'publicHolidayHighWage' || classification.type === 'publicHolidayLowWage'
              ? classification.name
              : undefined

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
                height: '100%',
              }}
              title={classification.name || ''}
            >
              {isToday ? <div className={styles.todayTopBar} /> : null}
              <div className={styles.dateTopRow}>
                <span className={styles.dateNumber}>{dateLabel}</span>
                <span
                  className={`${styles.dateWeekday} ${
                    isToday ? styles.dateWeekdayToday : isWeekendOrHoliday ? styles.dateWeekdayRest : ''
                  }`}
                >
                  {holidayTag ? `${weekdayLabel}·${holidayTag}` : weekdayLabel}
                </span>
              </div>
              <div className={styles.shiftContainer}>
                <div className={styles.dayShift}>
                  {tr('白', 'D')} {dayTime}
                </div>
                <div className={styles.nightShift}>
                  {tr('夜', 'N')} {nightTime}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TimelineHeader
