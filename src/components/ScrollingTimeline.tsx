// src/components/ScrollingTimeline.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect, useTransition } from 'react';
import { UsageLog, Project, TestProject } from '../types';
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks'
import styles from './ScrollingTimeline.module.css';
import { alpha, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import {
  format, addDays, eachDayOfInterval, startOfDay as dateFnsStartOfDay,
  differenceInMinutes, max, min, getDay, parseISO, isEqual, getYear, differenceInCalendarDays,
  setHours, setMinutes, setSeconds, setMilliseconds, addHours, addMonths,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers';
import { Box, Typography, Tooltip, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom'

export const CUSTOM_DAY_START_HOUR = 7;

interface HolidayDetail {
  holiday: boolean;
  name: string;
  wage: number;
  date: string;
  rest?: number;
  after?: boolean;
  target?: string;
}

interface ApiHolidayResponse {
  code: number;
  holiday?: {
    [monthDayOrFullDate: string]: HolidayDetail;
  };
}

interface ScrollingTimelineProps {
  usageLogs: UsageLog[];
  onViewUsageLog: (logId: string) => void;
  onDeleteUsageLog?: (logId: string, configId: string) => void;
  regionCode?: 'cn' | 'tw';
  dayWidthPx?: number;
  scrollToTodaySignal?: number;
}

export const DAY_WIDTH_PX = 200;
export const MIN_ROW_HEIGHT_PX = 50;
export const HEADER_HEIGHT_PX = 70;
export const CHAMBER_NAME_WIDTH_PX = 150;

const ITEM_BAR_HEIGHT = 24;
const ITEM_BAR_VERTICAL_MARGIN = 5;
const ITEM_BAR_TOTAL_HEIGHT = ITEM_BAR_HEIGHT + ITEM_BAR_VERTICAL_MARGIN;

export interface TimelineUsageLogDisplayData extends Omit<UsageLog, 'id' | 'selectedConfigIds'> {
  displayId: string;
  originalLogId: string;
  configId?: string;
  projectName?: string;
  testProjectName?: string;
  configName?: string;
  effectiveStatus: UsageLog['status'];
}

interface StatusStyling {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

const getBarStylingByEffectiveStatus = (theme: Theme, status: UsageLog['status']): StatusStyling => {
  const main =
    status === 'completed' ? theme.palette.success.main :
    status === 'in-progress' ? theme.palette.warning.main :
    status === 'not-started' ? theme.palette.info.main :
    status === 'overdue' ? theme.palette.error.main :
    alpha(theme.palette.text.primary, 0.32);

  const dark =
    status === 'completed' ? theme.palette.success.dark :
    status === 'in-progress' ? theme.palette.warning.dark :
    status === 'not-started' ? theme.palette.info.dark :
    status === 'overdue' ? theme.palette.error.dark :
    main;

  return {
    backgroundColor: alpha(main, 0.16),
    borderColor: alpha(main, 0.32),
    textColor: dark,
  };
};

const buildTimelineCssVars = (theme: Theme) => {
  const headerGlass = `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%), ${alpha(theme.palette.background.paper, 0.58)}`;
  const stickyGlass = `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.16)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%), ${alpha(theme.palette.background.paper, 0.62)}`;
  const vars: Record<string, string> = {
    ['--timeline-bg']: alpha(theme.palette.background.paper, 0.95),
    ['--timeline-header-bg']: headerGlass,
    ['--timeline-sticky-bg']: stickyGlass,
    ['--timeline-border']: theme.palette.divider,
    ['--timeline-grid-line']: alpha(theme.palette.text.primary, 0.08),
    ['--timeline-grid-line-soft']: alpha(theme.palette.text.primary, 0.06),
    ['--timeline-weekend-bg']: alpha(theme.palette.text.primary, 0.03),
    ['--timeline-holiday-bg']: alpha(theme.palette.error.main, 0.08),
    ['--timeline-workday-override-bg']: alpha(theme.palette.text.primary, 0.02),
    ['--timeline-today-bg']: alpha(theme.palette.info.main, 0.10),
    ['--timeline-today-text']: theme.palette.info.main,
    ['--timeline-bar-shadow']: `0 1px 2px ${alpha(theme.palette.text.primary, 0.18)}`,
    ['--timeline-bar-shadow-hover']: `0 6px 14px ${alpha(theme.palette.text.primary, 0.22)}`,
  };
  return vars as unknown as React.CSSProperties;
};

export const generateDateHeaders = (currentDate: Date, monthsBefore: number, monthsAfter: number) => {
  let baseDateForCurrentView = setMilliseconds(setSeconds(setMinutes(setHours(dateFnsStartOfDay(currentDate), CUSTOM_DAY_START_HOUR), 0), 0), 0);

  if (currentDate.getHours() < CUSTOM_DAY_START_HOUR) {
    baseDateForCurrentView = addDays(baseDateForCurrentView, -1);
  }
  
  const viewStartDate = addMonths(baseDateForCurrentView, -monthsBefore);
  const viewEndDate = addMonths(baseDateForCurrentView, monthsAfter);
  
  const intervalCalendarDays = eachDayOfInterval({ 
    start: dateFnsStartOfDay(viewStartDate),
    end: dateFnsStartOfDay(viewEndDate)
  });
  
  return intervalCalendarDays.map(calendarDay => {
    return setMilliseconds(setSeconds(setMinutes(setHours(calendarDay, CUSTOM_DAY_START_HOUR), 0), 0), 0);
  });
};

const getTimelineBaseDate = (currentDate: Date) => {
  let baseDate = setMilliseconds(setSeconds(setMinutes(setHours(dateFnsStartOfDay(currentDate), CUSTOM_DAY_START_HOUR), 0), 0), 0);
  if (currentDate.getHours() < CUSTOM_DAY_START_HOUR) {
    baseDate = addDays(baseDate, -1);
  }
  return baseDate;
};

const generateDateHeadersFromRange = (rangeStart: Date, rangeEnd: Date) => {
  const intervalCalendarDays = eachDayOfInterval({
    start: dateFnsStartOfDay(rangeStart),
    end: dateFnsStartOfDay(rangeEnd),
  });

  return intervalCalendarDays.map((calendarDay) => {
    return setMilliseconds(setSeconds(setMinutes(setHours(calendarDay, CUSTOM_DAY_START_HOUR), 0), 0), 0);
  });
};

// --- calculateBarPositionAndWidth (修改为计算单个连续条) ---
const calculateBarPositionAndWidth = (
  log: UsageLog,
  timelineViewActualStart: Date, // 整个可见时间轴的起始点 (例如 dateHeaders[0])
  timelineViewActualEnd: Date,   // 整个可见时间轴的结束点 (例如 addDays(dateHeaders[last], 1))
  effectiveStatus: UsageLog['status'],
  dayWidthPx: number
) => {
  const logStartTime = parseISO(log.startTime);
  let logEndTimeDate;

  if (log.endTime) {
    logEndTimeDate = parseISO(log.endTime);
  } else {
    if (effectiveStatus === 'in-progress' || effectiveStatus === 'overdue') {
      logEndTimeDate = new Date();
    } else {
      logEndTimeDate = addHours(logStartTime, 1); // 默认1小时，以便显示
    }
  }
  if (!logEndTimeDate || isNaN(logEndTimeDate.valueOf())) {
    logEndTimeDate = addHours(logStartTime, 1);
  }

  // 检查日志是否在整个可见时间轴范围之外
  if (logEndTimeDate <= timelineViewActualStart || logStartTime >= timelineViewActualEnd) {
    return { left: 0, width: 0, display: false };
  }

  // 确定条在屏幕上的实际显示开始和结束时间
  const displayStartTime = max([logStartTime, timelineViewActualStart]);
  const displayEndTime = min([logEndTimeDate, timelineViewActualEnd]);

  if (displayStartTime >= displayEndTime) {
    return { left: 0, width: 0, display: false };
  }

  // left: 是 displayStartTime 相对于 timelineViewActualStart (7点) 的偏移
  const leftOffsetMinutes = differenceInMinutes(displayStartTime, timelineViewActualStart);
  // width: 是 displayEndTime 和 displayStartTime 之间的时长
  const displayDurationMinutes = differenceInMinutes(displayEndTime, displayStartTime);

  const minutesInDay = 24 * 60; // DAY_WIDTH_PX 代表的是24小时
  const finalLeft = (leftOffsetMinutes / minutesInDay) * dayWidthPx;
  const finalWidth = (displayDurationMinutes / minutesInDay) * dayWidthPx;
  
  return { left: finalLeft, width: Math.max(finalWidth, 2), display: true };
};


export const formatDateHeader = (date: Date): string => {
  const dayOfWeekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${format(date, 'M/d', { locale: zhCN })} ${dayOfWeekNames[getDay(date)]}`;
};

const isWeekend = (date: Date): boolean => {
  const dayOfWeek = getDay(date);
  return dayOfWeek === 0 || dayOfWeek === 6;
};

export const getTimelineDisplayData = ( /* ... (保持不变) ... */
    passedUsageLogs: UsageLog[] = [],
    projectsFromStore: Project[] = [],
    testProjectsFromStore: TestProject[] = [],
): TimelineUsageLogDisplayData[] => {
    const displayDataList: TimelineUsageLogDisplayData[] = [];
    const now = new Date();
    if (!passedUsageLogs) return [];

    const projectById = new Map<string, Project>();
    projectsFromStore.forEach((p) => projectById.set(p.id, p));
    const testProjectById = new Map<string, TestProject>();
    testProjectsFromStore.forEach((tp) => testProjectById.set(tp.id, tp));
    const projectConfigByIdCache = new Map<string, Map<string, { name: string }>>();

    passedUsageLogs.forEach(log => {
        const project = log.projectId ? projectById.get(log.projectId) : undefined;
        const testProject = log.testProjectId ? testProjectById.get(log.testProjectId) : undefined;
        const effectiveStatus = getEffectiveUsageLogStatus(log, now);
        
        const { id: originalLogIdFromLog, selectedConfigIds: logSelectedConfigIds, ...restOfLogBase } = log;
        const restOfLog = restOfLogBase as Omit<UsageLog, 'id' | 'selectedConfigIds'>;

        if (logSelectedConfigIds && logSelectedConfigIds.length > 0) {
            let configById: Map<string, { name: string }> | undefined;
            if (project) {
                configById = projectConfigByIdCache.get(project.id);
                if (!configById) {
                    configById = new Map<string, { name: string }>();
                    project.configs?.forEach((c) => configById!.set(c.id, { name: c.name }));
                    projectConfigByIdCache.set(project.id, configById);
                }
            }

            logSelectedConfigIds.forEach(configId => {
                const config = configById?.get(configId);
                displayDataList.push({
                    ...restOfLog,
                    chamberId: log.chamberId,
                    user: log.user,
                    startTime: log.startTime,
                    endTime: log.endTime,
                    status: log.status,
                    notes: log.notes,
                    projectId: log.projectId,
                    testProjectId: log.testProjectId,
                    createdAt: log.createdAt,
                    selectedWaterfall: log.selectedWaterfall,
                    displayId: `${originalLogIdFromLog}-${configId}`,
                    originalLogId: originalLogIdFromLog,
                    configId: configId,
                    projectName: project?.name,
                    testProjectName: testProject?.name,
                    configName: config?.name || '未知配置',
                    effectiveStatus: effectiveStatus,
                });
            });
        } else {
            displayDataList.push({
                ...restOfLog,
                chamberId: log.chamberId,
                user: log.user,
                startTime: log.startTime,
                endTime: log.endTime,
                status: log.status,
                notes: log.notes,
                projectId: log.projectId,
                testProjectId: log.testProjectId,
                createdAt: log.createdAt,
                selectedWaterfall: log.selectedWaterfall,
                displayId: originalLogIdFromLog,
                originalLogId: originalLogIdFromLog,
                projectName: project?.name,
                testProjectName: testProject?.name,
                configName: '无特定配置',
                effectiveStatus: effectiveStatus,
            });
        }
    });
    return displayDataList;
};
const assignTracksToLogs = (logs: TimelineUsageLogDisplayData[]): (TimelineUsageLogDisplayData & { trackIndex: number })[] => { /* ... (保持不变) ... */
    if (!logs || logs.length === 0) return [];

    const sortedLogs = [...logs].sort((a, b) => {
        const aStartTime = parseISO(a.startTime);
        const bStartTime = parseISO(b.startTime);
        const startTimeDiff = aStartTime.getTime() - bStartTime.getTime();
        if (startTimeDiff !== 0) return startTimeDiff;

        const aEndTimeVal = a.endTime ? parseISO(a.endTime).getTime() : addDays(aStartTime, 1).getTime();
        const bEndTimeVal = b.endTime ? parseISO(b.endTime).getTime() : addDays(bStartTime, 1).getTime();
        
        const aDuration = aEndTimeVal - aStartTime.getTime();
        const bDuration = bEndTimeVal - bStartTime.getTime();
        return aDuration - bDuration;
    });

    const layout: (TimelineUsageLogDisplayData & { trackIndex: number })[] = [];
    const tracks: { logs: TimelineUsageLogDisplayData[] }[] = [];

    for (const log of sortedLogs) {
        let assignedTrackIndex = -1;
        const logStartTimeDt = parseISO(log.startTime);
        let logEndTimeDt: Date;
        if (log.endTime) {
            logEndTimeDt = parseISO(log.endTime);
        } else {
            if (log.effectiveStatus === 'in-progress' || log.effectiveStatus === 'overdue') {
                logEndTimeDt = new Date();
            } else {
                logEndTimeDt = addDays(logStartTimeDt, 1);
            }
        }
        if (isNaN(logEndTimeDt.valueOf())) logEndTimeDt = addDays(logStartTimeDt, 1);

        for (let i = 0; i < tracks.length; i++) {
            const overlaps = tracks[i].logs.some(existingLog => {
                const existingLogStartTimeDt = parseISO(existingLog.startTime);
                let existingLogEndTimeDt: Date;
                if (existingLog.endTime) {
                    existingLogEndTimeDt = parseISO(existingLog.endTime);
                } else {
                    if (existingLog.effectiveStatus === 'in-progress' || existingLog.effectiveStatus === 'overdue') {
                        existingLogEndTimeDt = new Date();
                    } else {
                        existingLogEndTimeDt = addDays(existingLogStartTimeDt, 1);
                    }
                }
                if (isNaN(existingLogEndTimeDt.valueOf())) existingLogEndTimeDt = addDays(existingLogStartTimeDt, 1);

                return logStartTimeDt < existingLogEndTimeDt && existingLogStartTimeDt < logEndTimeDt;
            });

            if (!overlaps) {
                assignedTrackIndex = i;
                break;
            }
        }

        if (assignedTrackIndex === -1) {
            assignedTrackIndex = tracks.length;
            tracks.push({ logs: [] });
        }

        tracks[assignedTrackIndex].logs.push(log);
        layout.push({ ...log, trackIndex: assignedTrackIndex });
    }
    return layout;
};

const DeleteIconSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => ( /* ... (保持不变) ... */
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const ScrollingTimeline: React.FC<ScrollingTimelineProps> = ({
  usageLogs: propsUsageLogs = [],
  onViewUsageLog,
  onDeleteUsageLog,
  regionCode = 'cn',
  dayWidthPx: propsDayWidthPx,
  scrollToTodaySignal,
}) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const theme = useTheme();
  const timelineCssVars = useMemo(() => buildTimelineCssVars(theme), [theme]);
  const dayWidthPx = propsDayWidthPx ?? DAY_WIDTH_PX;
  const { assets: chambers, loading: chambersLoading, error: chambersError } = useAppSelector((state) => state.assets)
  const { projects, loading: projectsLoading, error: projectsError } = useAppSelector((state) => state.projects)
  const { testProjects, loading: testProjectsLoading, error: testProjectsError } = useAppSelector((state) => state.testProjects)
  const { loading: usageLogsDataLoading } = useAppSelector((state) => state.usageLogs)

  const initialTimelineBaseDate = useMemo(() => getTimelineBaseDate(new Date()), []);
  const [rangeStart, setRangeStart] = useState(() => addMonths(initialTimelineBaseDate, -1));
  const [rangeEnd, setRangeEnd] = useState(() => addMonths(initialTimelineBaseDate, 1));

  const [processedHolidays, setProcessedHolidays] = useState<Map<string, HolidayDetail>>(new Map());
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const loadedHolidayYearsRef = useRef<Set<number>>(new Set());

  const dateHeaders = useMemo(() => generateDateHeadersFromRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const totalTimelineWidth = useMemo(() => dateHeaders.length * dayWidthPx, [dateHeaders.length, dayWidthPx]);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollPerformedForCurrentViewRef = useRef(false);
  const desiredScrollLeftAfterPrependRef = useRef<number | null>(null);
  const isExtendingLeftRef = useRef(false);
  const isExtendingRightRef = useRef(false);
  const [, startTransition] = useTransition();
  const [visibleDayIndexRange, setVisibleDayIndexRange] = useState<{ startIndex: number; endIndexExclusive: number }>({
    startIndex: 0,
    endIndexExclusive: 0,
  });
  const rafUpdateVisibleRangeRef = useRef<number | null>(null);

  const updateVisibleDayIndexRange = useCallback(() => {
    const container = timelineContainerRef.current;
    const totalDays = dateHeaders.length;
    if (!container || totalDays === 0) {
      setVisibleDayIndexRange({ startIndex: 0, endIndexExclusive: 0 });
      return;
    }

    const visibleGridWidth = Math.max(0, container.clientWidth - CHAMBER_NAME_WIDTH_PX);
    const gridScrollLeft = Math.max(0, container.scrollLeft - CHAMBER_NAME_WIDTH_PX);

    const overscanDays = 20;
    const startIndex = Math.max(0, Math.floor(gridScrollLeft / dayWidthPx) - overscanDays);
    const endIndexExclusive = Math.min(
      totalDays,
      Math.ceil((gridScrollLeft + visibleGridWidth) / dayWidthPx) + overscanDays
    );

    setVisibleDayIndexRange((prev) => {
      if (prev.startIndex === startIndex && prev.endIndexExclusive === endIndexExclusive) return prev;
      return { startIndex, endIndexExclusive };
    });
  }, [dateHeaders.length, dayWidthPx]);

  const handleTimelineScroll = useCallback(() => {
    const container = timelineContainerRef.current;
    if (!container) return;

    const thresholdPx = dayWidthPx * 10;
    if (container.scrollLeft < thresholdPx && !isExtendingLeftRef.current) {
      isExtendingLeftRef.current = true;
      const beforeExtendScrollLeft = container.scrollLeft;
      startTransition(() => {
        setRangeStart((prevStart) => {
          const nextStart = addMonths(prevStart, -1);
          const addedDays = differenceInCalendarDays(prevStart, nextStart);
          desiredScrollLeftAfterPrependRef.current = beforeExtendScrollLeft + addedDays * dayWidthPx;
          return nextStart;
        });
      });
    }

    if (
      container.scrollLeft + container.clientWidth > container.scrollWidth - thresholdPx &&
      !isExtendingRightRef.current
    ) {
      isExtendingRightRef.current = true;
      startTransition(() => {
        setRangeEnd((prevEnd) => addMonths(prevEnd, 1));
      });
    }

    if (rafUpdateVisibleRangeRef.current === null) {
      rafUpdateVisibleRangeRef.current = window.requestAnimationFrame(() => {
        rafUpdateVisibleRangeRef.current = null;
        updateVisibleDayIndexRange();
      });
    }
  }, [dayWidthPx, startTransition, updateVisibleDayIndexRange]);

  useLayoutEffect(() => {
    const container = timelineContainerRef.current;
    if (container && desiredScrollLeftAfterPrependRef.current !== null) {
      container.scrollLeft = desiredScrollLeftAfterPrependRef.current;
      desiredScrollLeftAfterPrependRef.current = null;
    }
    isExtendingLeftRef.current = false;
    isExtendingRightRef.current = false;
    updateVisibleDayIndexRange();
  }, [dateHeaders.length, updateVisibleDayIndexRange]);

  useEffect(() => {
    if (!scrollToTodaySignal) return;
    const container = timelineContainerRef.current;
    if (!container || dateHeaders.length === 0) return;

    const todayBase = getTimelineBaseDate(new Date());
    const todayIndex = dateHeaders.findIndex((d) => isEqual(dateFnsStartOfDay(d), dateFnsStartOfDay(todayBase)));
    if (todayIndex < 0) return;

    const visibleGridWidth = Math.max(0, container.clientWidth - CHAMBER_NAME_WIDTH_PX);
    const targetGridLeft = todayIndex * dayWidthPx - Math.max(0, (visibleGridWidth - dayWidthPx) / 2);
    const targetScrollLeft = Math.max(0, targetGridLeft + CHAMBER_NAME_WIDTH_PX);

    (container as any).scrollTo?.({ left: targetScrollLeft, behavior: 'smooth' });
    if (!(container as any).scrollTo) container.scrollLeft = targetScrollLeft;
  }, [dateHeaders, dayWidthPx, scrollToTodaySignal]);

  const fetchAndProcessHolidaysForYearInternal = useCallback(async (year: number, region: string): Promise<Map<string, HolidayDetail>> => { /* ... (保持不变) ... */
    const yearHolidaysMap = new Map<string, HolidayDetail>();
    if (year === 2025 && region === 'cn') {
      const apiResponse: ApiHolidayResponse = {"code":0,"holiday":{"01-01":{"holiday":true,"name":"元旦","wage":3,"date":"2025-01-01","rest":17},"01-26":{"holiday":false,"name":"春节前补班","wage":1,"after":false,"target":"春节","date":"2025-01-26","rest":7},"01-28":{"holiday":true,"name":"除夕","wage":2,"date":"2025-01-28","rest":9},"01-29":{"holiday":true,"name":"初一","wage":3,"date":"2025-01-29","rest":1},"01-30":{"holiday":true,"name":"初二","wage":3,"date":"2025-01-30","rest":1},"01-31":{"holiday":true,"name":"初三","wage":3,"date":"2025-01-31","rest":1},"02-01":{"holiday":true,"name":"初四","wage":2,"date":"2025-02-01","rest":1},"02-02":{"holiday":true,"name":"初五","wage":2,"date":"2025-02-02","rest":1},"02-03":{"holiday":true,"name":"初六","wage":2,"date":"2025-02-03","rest":1},"02-04":{"holiday":true,"name":"初七","wage":2,"date":"2025-02-04","rest":1},"02-08":{"holiday":false,"name":"春节后补班","wage":1,"target":"春节","after":true,"date":"2025-02-08","rest":4},"04-04":{"holiday":true,"name":"清明节","wage":3,"date":"2025-04-04","rest":19},"04-05":{"holiday":true,"name":"清明节","wage":2,"date":"2025-04-05","rest":1},"04-06":{"holiday":true,"name":"清明节","wage":2,"date":"2025-04-06","rest":1},"04-27":{"holiday":false,"name":"劳动节前补班","wage":1,"target":"劳动节","after":false,"date":"2025-04-27","rest":17},"05-01":{"holiday":true,"name":"劳动节","wage":3,"date":"2025-05-01","rest":4},"05-02":{"holiday":true,"name":"劳动节","wage":2,"date":"2025-05-02","rest":1},"05-03":{"holiday":true,"name":"劳动节","wage":3,"date":"2025-05-03","rest":1},"05-04":{"holiday":true,"name":"劳动节","wage":3,"date":"2025-05-04","rest":1},"05-05":{"holiday":true,"name":"劳动节","wage":3,"date":"2025-05-05","rest":1},"05-31":{"holiday":true,"name":"端午节","wage":3,"date":"2025-05-31","rest":23},"06-01":{"holiday":true,"name":"端午节","wage":2,"date":"2025-06-01","rest":1},"06-02":{"holiday":true,"name":"端午节","wage":2,"date":"2025-06-02","rest":1},"09-28":{"holiday":false,"name":"国庆节前补班","after":false,"wage":1,"target":"国庆节","date":"2025-09-28","rest":89},"10-01":{"holiday":true,"name":"国庆节","wage":3,"date":"2025-10-01","rest":92},"10-02":{"holiday":true,"name":"国庆节","wage":3,"date":"2025-10-02","rest":1},"10-03":{"holiday":true,"name":"国庆节","wage":3,"date":"2025-10-03","rest":1},"10-04":{"holiday":true,"name":"国庆节","wage":2,"date":"2025-10-04","rest":1},"10-05":{"holiday":true,"name":"国庆节","wage":2,"date":"2025-10-05","rest":1},"10-06":{"holiday":true,"name":"中秋节","wage":2,"date":"2025-10-06","rest":1},"10-07":{"holiday":true,"name":"国庆节","wage":2,"date":"2025-10-07","rest":1},"10-08":{"holiday":true,"name":"国庆节","wage":2,"date":"2025-10-08","rest":1},"10-11":{"holiday":false,"after":true,"wage":1,"name":"国庆节后补班","target":"国庆节","date":"2025-10-11"}}};
      const holidayData = apiResponse.holiday;
      if (apiResponse.code === 0 && holidayData !== undefined) {
        Object.values(holidayData!).forEach(detail => {
          yearHolidaysMap.set(detail.date, detail);
        });
      } else {
         console.warn(`Hardcoded holiday data for ${year} (${region}) issue or no holiday object.`);
      }
      return yearHolidaysMap;
    }
    try {
      const response = await fetch(`/holidays/${region.toLowerCase()}/${year}.json`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Holiday data file not found for year ${year}, region ${region}.`);
          return yearHolidaysMap;
        }
        throw new Error(`Failed to fetch holiday data for ${year} (${region}): ${response.statusText}`);
      }
      const fetchedData: ApiHolidayResponse = await response.json();
      const holidayData = fetchedData.holiday;
      if (fetchedData.code === 0 && holidayData !== undefined) {
        Object.values(holidayData).forEach(detail => {
          yearHolidaysMap.set(detail.date, detail);
        });
      } else {
        console.warn(`Invalid data format or error code in holiday data for ${year} (${region}).`);
      }
    } catch (err: any) {
      console.error(`Error fetching or processing holiday data for ${year} (${region}):`, err);
      throw err;
    }
    return yearHolidaysMap;
  }, []);
  useEffect(() => {
    loadedHolidayYearsRef.current = new Set();
    setProcessedHolidays(new Map());
    setHolidaysLoading(true);
    setHolidaysError(null);
  }, [regionCode]);

  useEffect(() => {
    if (dateHeaders.length === 0) {
      setHolidaysLoading(false);
      return;
    }

    const yearsInView: number[] = [];
    const startYear = getYear(dateHeaders[0]);
    const endYear = getYear(dateHeaders[dateHeaders.length - 1]);
    for (let y = startYear; y <= endYear; y++) yearsInView.push(y);

    const missingYears = yearsInView.filter((y) => !loadedHolidayYearsRef.current.has(y));
    if (missingYears.length === 0) {
      if (processedHolidays.size === 0) setHolidaysLoading(false);
      return;
    }

    const shouldToggleLoading = processedHolidays.size === 0;
    if (shouldToggleLoading) {
      setHolidaysLoading(true);
      setHolidaysError(null);
    }

    const loadMissingYears = async () => {
      try {
        for (const year of missingYears) {
          try {
            const yearDataMap = await fetchAndProcessHolidaysForYearInternal(year, regionCode);
            loadedHolidayYearsRef.current.add(year);
            if (yearDataMap.size > 0) {
              setProcessedHolidays((prev) => {
                const next = new Map(prev);
                yearDataMap.forEach((value, key) => next.set(key, value));
                return next;
              });
            }
          } catch (err: any) {
            console.error(`Error processing holidays for year ${year}:`, err);
            setHolidaysError((prev) => prev ?? (err.message || `Failed to load holiday data for ${year}.`));
          }
        }
      } finally {
        if (shouldToggleLoading) setHolidaysLoading(false);
      }
    };

    loadMissingYears();
  }, [dateHeaders, regionCode, fetchAndProcessHolidaysForYearInternal, processedHolidays.size]);

  const getDayClassification = useCallback((date: Date): { /* ... (保持不变) ... */
    type: 'weekday' | 'weekendRest' | 'publicHolidayLowWage' | 'publicHolidayHighWage' | 'workdayOverride',
    name?: string
  } => {
    if (holidaysLoading && processedHolidays.size === 0 && dateHeaders.length > 0) {
        return { type: 'weekday' };
    }
    const dateStr = format(date, 'yyyy-MM-dd'); 
    const holidayInfo = processedHolidays.get(dateStr);

    if (holidayInfo) {
      if (holidayInfo.holiday) {
        if (holidayInfo.wage === 3) {
          return { type: 'publicHolidayHighWage', name: holidayInfo.name };
        }
        return { type: 'publicHolidayLowWage', name: holidayInfo.name };
      } else {
        return { type: 'workdayOverride', name: holidayInfo.name };
      }
    }
    if (isWeekend(date)) {
      return { type: 'weekendRest', name: '周末' };
    }
    return { type: 'weekday', name: '工作日' };
  }, [processedHolidays, holidaysLoading, dateHeaders.length]);

  useEffect(() => { /* ... (data fetching useEffect - 保持不变) ... */
    if (!chambersLoading && (!chambers || chambers.length === 0)) {
        dispatch(fetchAssetsByType('chamber'));
    }
    if (!projectsLoading && (!projects || projects.length === 0)) {
        dispatch(fetchProjects());
    }
    if (!testProjectsLoading && (!testProjects || testProjects.length === 0)) {
        dispatch(fetchTestProjects());
    }
  }, [
    dispatch,
    chambers, projects, testProjects,
    chambersLoading, projectsLoading, testProjectsLoading,
  ]);

  // 定义整个可见时间轴的开始和结束 (都是7AM的标记)
  const timelineViewActualStart = useMemo(() => {
    return dateHeaders.length > 0 ? dateHeaders[0] : setMilliseconds(setSeconds(setMinutes(setHours(dateFnsStartOfDay(new Date()), CUSTOM_DAY_START_HOUR),0),0),0);
  }, [dateHeaders]);

  const timelineViewActualEnd = useMemo(() => {
    return dateHeaders.length > 0 ? addDays(dateHeaders[dateHeaders.length - 1], 1) : addDays(setMilliseconds(setSeconds(setMinutes(setHours(dateFnsStartOfDay(new Date()), CUSTOM_DAY_START_HOUR),0),0),0), 1);
  }, [dateHeaders]);

  const usageLogById = useMemo(() => {
    const map = new Map<string, UsageLog>();
    (propsUsageLogs || []).forEach((l) => map.set(l.id, l));
    return map;
  }, [propsUsageLogs]);

  const timelineDisplayItems = useMemo(() => { /* ... (保持不变) ... */
      if (propsUsageLogs && projects && testProjects) {
          return getTimelineDisplayData(propsUsageLogs, projects, testProjects);
      }
      return [];
  }, [propsUsageLogs, projects, testProjects]);

  const timelineItemsByChamberId = useMemo(() => {
    const map = new Map<string, TimelineUsageLogDisplayData[]>();
    timelineDisplayItems.forEach((item) => {
      const existing = map.get(item.chamberId);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.chamberId, [item]);
      }
    });
    return map;
  }, [timelineDisplayItems]);

  const chamberLayouts = useMemo(() => { /* ... (保持不变) ... */
    const layouts = new Map<string, { logsWithTracks: (TimelineUsageLogDisplayData & { trackIndex: number })[], maxTracks: number }>();
    if (chambers && chambers.length > 0 && timelineDisplayItems) {
        chambers.forEach(chamber => {
            const chamberLogs = timelineItemsByChamberId.get(chamber.id) || [];
            const logsWithTracksData = assignTracksToLogs(chamberLogs);
            const maxTracks = logsWithTracksData.reduce((maxVal, log) => Math.max(maxVal, log.trackIndex + 1), 0);
            layouts.set(chamber.id, { logsWithTracks: logsWithTracksData, maxTracks });
        });
    }
    return layouts;
  }, [chambers, timelineDisplayItems, timelineItemsByChamberId]);
  const getChamberRowHeight = useCallback((chamberId: string): number => { /* ... (保持不变) ... */
      const layout = chamberLayouts.get(chamberId);
      if (layout && layout.maxTracks > 0) {
          return Math.max(MIN_ROW_HEIGHT_PX, layout.maxTracks * ITEM_BAR_TOTAL_HEIGHT + ITEM_BAR_VERTICAL_MARGIN * 2);
      }
      return MIN_ROW_HEIGHT_PX;
  }, [chamberLayouts]);
  const totalTimelineGridHeight = useMemo(() => { /* ... (保持不变) ... */
    if (!chambers || chambers.length === 0) return MIN_ROW_HEIGHT_PX * 3;
    return chambers.reduce((sum, chamber) => sum + getChamberRowHeight(chamber.id), 0);
  }, [chambers, getChamberRowHeight]);

  const chamberRowTopById = useMemo(() => {
    const map = new Map<string, number>();
    if (!chambers || chambers.length === 0) return map;
    let topOffset = 0;
    chambers.forEach((chamber) => {
      map.set(chamber.id, topOffset);
      topOffset += getChamberRowHeight(chamber.id);
    });
    return map;
  }, [chambers, getChamberRowHeight]);

  useEffect(() => {
    const container = timelineContainerRef.current;
    const allDataLoaded = !chambersLoading && !projectsLoading && !testProjectsLoading && !usageLogsDataLoading && !holidaysLoading;

    if (!container || !allDataLoaded || !(dateHeaders.length > 0) || !(totalTimelineWidth > 0) || !(container.offsetWidth > 0)) {
      return;
    }

    let targetScrollPosition = 0;
    const todayForScroll = new Date();
    let todayCellDate = setMilliseconds(setSeconds(setMinutes(setHours(dateFnsStartOfDay(todayForScroll), CUSTOM_DAY_START_HOUR),0),0),0);
    if (todayForScroll.getHours() < CUSTOM_DAY_START_HOUR) {
        todayCellDate = addDays(todayCellDate, -1);
    }
    const todayIndex = dateHeaders.findIndex(dh => isEqual(dh, todayCellDate));

    if (todayIndex !== -1) {
      const containerWidth = container.offsetWidth;
      const visibleGridWidth = Math.max(0, containerWidth - CHAMBER_NAME_WIDTH_PX);
      const cellsThatFit = Math.floor(visibleGridWidth / dayWidthPx);
      const desiredTodayCellOffset = cellsThatFit > 2 ? 1 : (cellsThatFit > 1 ? 0 : 0); 
      targetScrollPosition = CHAMBER_NAME_WIDTH_PX + (todayIndex - desiredTodayCellOffset) * dayWidthPx;
      targetScrollPosition = Math.max(0, targetScrollPosition);
      const maxScroll = (CHAMBER_NAME_WIDTH_PX + totalTimelineWidth) - containerWidth;
      targetScrollPosition = Math.min(targetScrollPosition, maxScroll > 0 ? maxScroll : 0);
    } else {
      targetScrollPosition = (CHAMBER_NAME_WIDTH_PX + (totalTimelineWidth / 2)) - (container.offsetWidth / 2);
      targetScrollPosition = Math.max(0, targetScrollPosition);
      const maxScroll = (CHAMBER_NAME_WIDTH_PX + totalTimelineWidth) - container.offsetWidth;
      targetScrollPosition = Math.min(targetScrollPosition, maxScroll > 0 ? maxScroll : 0);
    }

    if (!initialScrollPerformedForCurrentViewRef.current) {
      if (container.scrollLeft !== targetScrollPosition) {
        container.scrollLeft = targetScrollPosition;
      }
      initialScrollPerformedForCurrentViewRef.current = true;
    }
  }, [
    dateHeaders, 
    totalTimelineWidth, 
    dayWidthPx,
    chambersLoading, projectsLoading, testProjectsLoading, usageLogsDataLoading, holidaysLoading,
  ]);
  // *** SCROLL LOGIC END ***

  const shouldBlockOnPrimaryLoading =
    (chambersLoading && chambers.length === 0) ||
    (projectsLoading && projects.length === 0) ||
    (testProjectsLoading && testProjects.length === 0) ||
    (usageLogsDataLoading && propsUsageLogs.length === 0);

  if (shouldBlockOnPrimaryLoading || (holidaysLoading && processedHolidays.size === 0 && dateHeaders.length > 0) ) {
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', p: 3}}>
            <CircularProgress />
            <Typography sx={{ml: 2}}>加载数据中，请稍候...</Typography>
        </Box>
    );
  }
  const anyCoreDataError = chambersError || projectsError || testProjectsError;
  if (anyCoreDataError) {
    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', p: 3}}>
            <Alert severity="error" sx={{width: '100%', maxWidth: '600px'}}>
                加载核心依赖数据失败: {anyCoreDataError}
            </Alert>
        </Box>
    );
  }
  if (holidaysError && processedHolidays.size === 0 && dateHeaders.length > 0) {
      return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)', p: 3}}>
            <Alert severity="warning" sx={{width: '100%', maxWidth: '600px'}}>
                加载节假日数据失败: {holidaysError} (时间轴背景可能不准确)
            </Alert>
        </Box>
      );
  }

  return (
    <div className={styles.timelinePageContainer} style={timelineCssVars}>
      <div
        ref={timelineContainerRef}
        className={styles.timelineScrollContainer}
        onScroll={handleTimelineScroll}
      >
        <div
          className={styles.timelineHeaderRow}
          style={{ width: `${CHAMBER_NAME_WIDTH_PX + totalTimelineWidth}px`, height: `${HEADER_HEIGHT_PX}px` }}
        >
          <div
            className={styles.timelineHeaderChamberCell}
            style={{ width: `${CHAMBER_NAME_WIDTH_PX}px`, height: `${HEADER_HEIGHT_PX}px` }}
          >
            环境箱
          </div>
          <div className={styles.timelineHeaderDates} style={{ width: `${totalTimelineWidth}px` }}>
            {dateHeaders
              .slice(visibleDayIndexRange.startIndex, visibleDayIndexRange.endIndexExclusive)
              .map((dateHeaderItem, offset) => {
              const index = visibleDayIndexRange.startIndex + offset;
              const classification = getDayClassification(dateHeaderItem);
              let headerClassName = styles.timelineDateHeader;
              if (classification.type === 'publicHolidayHighWage') { headerClassName += ` ${styles.publicHolidayStrongRedHeader}`; }
              else if (classification.type === 'publicHolidayLowWage') { headerClassName += ` ${styles.publicHolidaySoftRedHeader}`; }
              else if (classification.type === 'weekendRest') { headerClassName += ` ${styles.weekendHeader}`; }
              else if (classification.type === 'workdayOverride') { headerClassName += ` ${styles.workdayOnWeekendHeader}`; }
              if (isEqual(dateFnsStartOfDay(dateHeaderItem), dateFnsStartOfDay(new Date()))) {
                headerClassName += ` ${styles.todayHeader}`;
              }
              return (
                <div
                  key={index}
                  className={headerClassName}
                  style={{ left: `${index * dayWidthPx}px`, minWidth: `${dayWidthPx}px`, width: `${dayWidthPx}px`, position: 'absolute', top: 0 }}
                  title={classification.name || ''}
                >
                  <div className={styles.dateDisplay}>{formatDateHeader(dateHeaderItem)}</div>
                  <div className={styles.shiftContainer}>
                    <div className={styles.dayShift}>白班</div>
                    <div className={styles.nightShift}>夜班</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.timelineBodyRow} style={{ width: `${CHAMBER_NAME_WIDTH_PX + totalTimelineWidth}px` }}>
          <div className={styles.timelineChamberColumn} style={{ width: `${CHAMBER_NAME_WIDTH_PX}px` }}>
            {chambers && chambers.map((chamber) => (
              <div
                key={chamber.id}
                className={styles.chamberRowName}
                style={{ height: `${getChamberRowHeight(chamber.id)}px`, cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/assets/${chamber.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') navigate(`/assets/${chamber.id}`)
                }}
              >
                {chamber.name}
              </div>
            ))}
            {(!chambers || chambers.length === 0) && !chambersLoading && (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="textSecondary">暂无环境箱</Typography>
              </Box>
            )}
          </div>

          <div className={styles.timelineGridContent} style={{ width: `${totalTimelineWidth}px`, minHeight: `${totalTimelineGridHeight}px` }}>
            {dateHeaders
              .slice(visibleDayIndexRange.startIndex, visibleDayIndexRange.endIndexExclusive)
              .map((dayCellStartTime, offset) => {
              const dayIndex = visibleDayIndexRange.startIndex + offset;
              const classification = getDayClassification(dayCellStartTime);
              let dayBgClass = styles.timelineDayBackground;
              if (classification.type === 'publicHolidayHighWage') {
                dayBgClass += ` ${styles.publicHolidayStrongRedBackground}`;
              } else if (classification.type === 'publicHolidayLowWage' || classification.type === 'weekendRest') {
                dayBgClass += ` ${styles.weekendSoftRedBackground}`;
              } else if (classification.type === 'workdayOverride') {
                dayBgClass += ` ${styles.workdayOnWeekendBackground}`;
              }
              return (
                <div
                  key={`day-bg-${dayIndex}`}
                  className={dayBgClass}
                  style={{
                    left: `${dayIndex * dayWidthPx}px`,
                    width: `${dayWidthPx}px`,
                    height: `${totalTimelineGridHeight}px`,
                  }}
                  title={classification.name || ''}
                />
              );
            })}

            {chambers && chambers.map((chamber) => {
              const topOffset = chamberRowTopById.get(chamber.id) || 0;
              return (
                <div
                  key={`row-bg-${chamber.id}`}
                  className={styles.timelineRowBackground}
                  style={{ top: `${topOffset}px`, height: `${getChamberRowHeight(chamber.id)}px`, width: `${totalTimelineWidth}px` }}
                />
              );
            })}

            {chambers && chambers.map((chamber) => {
              const layoutInfo = chamberLayouts.get(chamber.id);
              const logsToRender = layoutInfo ? layoutInfo.logsWithTracks : [];
              const rowTopOffset = chamberRowTopById.get(chamber.id) || 0;
              const visibleLeftPx = visibleDayIndexRange.startIndex * dayWidthPx;
              const visibleRightPx = visibleDayIndexRange.endIndexExclusive * dayWidthPx;
              const rowHeight = getChamberRowHeight(chamber.id);
              const totalTracks = layoutInfo ? layoutInfo.maxTracks : 0;
              const tracksHeight = totalTracks > 0 ? totalTracks * ITEM_BAR_TOTAL_HEIGHT : 0;
              const baseTrackOffset = Math.max(ITEM_BAR_VERTICAL_MARGIN, Math.floor((rowHeight - tracksHeight) / 2));

              return (
                <div key={chamber.id} className={styles.timelineRow} style={{ position: 'absolute', top: `${rowTopOffset}px`, height: `${rowHeight}px`, width: `${totalTimelineWidth}px` }}>
                  {logsToRender.map((logDisplayItem) => {
                    const originalLog = usageLogById.get(logDisplayItem.originalLogId);
                    if (!originalLog) return null;

                    const { left, width, display } = calculateBarPositionAndWidth(
                      originalLog,
                      timelineViewActualStart,
                      timelineViewActualEnd,
                      logDisplayItem.effectiveStatus,
                      dayWidthPx
                    );

                    if (!display || width <= 0) return null;
                    if (left + width < visibleLeftPx || left > visibleRightPx) return null;

                    const styling = getBarStylingByEffectiveStatus(theme, logDisplayItem.effectiveStatus);
                    const barTextParts: string[] = [];
                    if (logDisplayItem.projectName) barTextParts.push(logDisplayItem.projectName);
                    if (logDisplayItem.configName && logDisplayItem.configName !== '无特定配置' && logDisplayItem.configName !== '未知配置') {
                      barTextParts.push(logDisplayItem.configName);
                    }
                    if (originalLog.selectedWaterfall) {
                      barTextParts.push(`WF:${originalLog.selectedWaterfall}`);
                    }
                    if (logDisplayItem.testProjectName) {
                      barTextParts.push(logDisplayItem.testProjectName);
                    }
                    const barText = barTextParts.length > 0 ? barTextParts.join(' - ') : (originalLog.user || '使用记录');
                    const barSegments: Array<{ text: string; tone: 'primary' | 'secondary' }> = [];
                    if (logDisplayItem.projectName) barSegments.push({ text: logDisplayItem.projectName, tone: 'primary' });
                    if (logDisplayItem.configName && logDisplayItem.configName !== '无特定配置' && logDisplayItem.configName !== '未知配置') {
                      barSegments.push({ text: logDisplayItem.configName, tone: 'primary' });
                    }
                    if (originalLog.selectedWaterfall) barSegments.push({ text: `WF:${originalLog.selectedWaterfall}`, tone: 'secondary' });
                    if (logDisplayItem.testProjectName) barSegments.push({ text: logDisplayItem.testProjectName, tone: 'secondary' });
                    const barTopPosition = baseTrackOffset + logDisplayItem.trackIndex * ITEM_BAR_TOTAL_HEIGHT;

                    return (
                      <Tooltip
                        key={logDisplayItem.displayId}
                        title={
                          <React.Fragment>
                            <Typography variant="subtitle2" gutterBottom>{barText}</Typography>
                            <Typography variant="caption">
                              用户: {originalLog.user}<br />
                              开始: {format(parseISO(originalLog.startTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}<br />
                              结束: {originalLog.endTime ? format(parseISO(originalLog.endTime), 'yyyy-MM-dd HH:mm', { locale: zhCN }) : (logDisplayItem.effectiveStatus === 'in-progress' || logDisplayItem.effectiveStatus === 'overdue' ? '进行中/已超时' : '未设定')}<br />
                              状态: {logDisplayItem.effectiveStatus}
                              {originalLog.notes && <><br />备注: {originalLog.notes.substring(0, 100)}{originalLog.notes.length > 100 && '...'}</>}
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
                            height: `${ITEM_BAR_HEIGHT}px`,
                            top: `${barTopPosition}px`,
                          }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest(`.${styles.timelineBarDeleteButton}`)) return;
                            onViewUsageLog(logDisplayItem.originalLogId);
                          }}
                        >
                          <span className={styles.timelineBarText}>
                            {barSegments.length > 0
                              ? barSegments.map((seg, idx) => (
                                  <React.Fragment key={`${logDisplayItem.displayId}-seg-${idx}`}>
                                    {idx > 0 ? <span className={styles.timelineBarTextSeparator}> · </span> : null}
                                    <span className={seg.tone === 'primary' ? styles.timelineBarTextPrimary : styles.timelineBarTextSecondary}>
                                      {seg.text}
                                    </span>
                                  </React.Fragment>
                                ))
                              : (originalLog.user || '使用记录')}
                          </span>
                          {onDeleteUsageLog && (
                            <button
                              className={styles.timelineBarDeleteButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onDeleteUsageLog && logDisplayItem.configId) {
                                  onDeleteUsageLog(logDisplayItem.originalLogId, logDisplayItem.configId);
                                }
                              }}
                              title="删除此记录"
                            >
                              <DeleteIconSvg />
                            </button>
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}

            {(!propsUsageLogs || propsUsageLogs.length === 0) && chambers && chambers.length > 0 && !shouldBlockOnPrimaryLoading && !holidaysLoading && (
              <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">当前时间范围无使用记录。</Typography>
              </Box>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScrollingTimeline;
