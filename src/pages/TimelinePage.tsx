// src/pages/TimelinePage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Button,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  Tooltip,
  Divider,
  Popover,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/ViewTimeline';
import TodayIcon from '@mui/icons-material/Today';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import ScrollingTimeline from '../components/ScrollingTimeline';
import UsageLogDetails from '../components/UsageLogDetails';
import UsageLogForm from '../components/UsageLogForm';
import ConfirmDialog from '../components/ConfirmDialog';
import AppCard from '../components/AppCard';
import { UsageLog } from '../types';
import { fetchUsageLogs, removeConfigFromUsageLog } from '../store/usageLogsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers';
import { alpha, useTheme } from '@mui/material/styles';
import TitleWithIcon from '../components/TitleWithIcon';
import { APP_PAGE_FRAME } from '../theme';
import { useI18n } from '../i18n';
import { getUsageLogStatusMeta } from '../utils/statusMeta';
import { formatVisibleMonthLabel } from '../utils/timelineLayout';

const TimelinePage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { tr, language } = useI18n();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dispatch = useAppDispatch();
  const { usageLogs, loading, error } = useAppSelector((state) => state.usageLogs);

  const initialFetchDoneRef = useRef(false);

  const [isUsageLogFormOpen, setIsUsageLogFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ logId: string; configId: string } | null>(null);
  const [dayWidthPx, setDayWidthPx] = useState<number>(200);
  const [scrollToTodaySignal, setScrollToTodaySignal] = useState(0);
  const [jumpDateAnchorEl, setJumpDateAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedJumpDate, setSelectedJumpDate] = useState<Date | null>(() => new Date());
  const [jumpToDate, setJumpToDate] = useState<{ date: Date; signal: number } | null>(null);
  const [visibleMonthLabel, setVisibleMonthLabel] = useState<string>(() =>
    formatVisibleMonthLabel(new Date(), language)
  );

  useEffect(() => {
    setVisibleMonthLabel(formatVisibleMonthLabel(new Date(), language));
  }, [language]);

  const overdueCount = useMemo(() => {
    return usageLogs.reduce((count, log) => {
      return getEffectiveUsageLogStatus(log) === 'overdue' ? count + 1 : count;
    }, 0);
  }, [usageLogs]);

  const legendItems = useMemo(() => {
    const statuses: UsageLog['status'][] = ['not-started', 'in-progress', 'completed', 'overdue'];
    return statuses.map((status) => {
      const meta = getUsageLogStatusMeta(status, tr);
      const color =
        meta.tone === 'success'
          ? theme.palette.success.main
          : meta.tone === 'warning'
            ? theme.palette.warning.main
            : meta.tone === 'error'
              ? theme.palette.error.main
              : meta.tone === 'info'
                ? theme.palette.info.main
                : theme.palette.text.secondary;
      return { status, label: meta.label, color };
    });
  }, [theme, tr]);

  const handleViewUsageLog = useCallback((logId: string) => {
    setSelectedLogId(logId);
    setDetailsOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailsOpen(false);
    setSelectedLogId(null);
  }, []);

  const handleDeleteLog = useCallback((logId: string, configId: string) => {
    setPendingDelete({ logId, configId });
  }, []);

  const handleCloseDelete = useCallback(() => setPendingDelete(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await dispatch(removeConfigFromUsageLog({ logId: pendingDelete.logId, configId: pendingDelete.configId })).unwrap();
    } catch (err) {
      console.error('Failed to remove config from log:', err);
    } finally {
      setPendingDelete(null);
    }
  }, [dispatch, pendingDelete]);

  useEffect(() => {
    if (!loading && !initialFetchDoneRef.current) {
      dispatch(fetchUsageLogs());
      initialFetchDoneRef.current = true;
    }
  }, [dispatch, loading]);

  const handleOpenNewUsageLogForm = useCallback(() => {
    setIsUsageLogFormOpen(true);
  }, []);

  const handleCloseUsageLogForm = useCallback(() => {
    setIsUsageLogFormOpen(false);
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <Container
        maxWidth={APP_PAGE_FRAME.maxWidth}
        disableGutters
        sx={{ pt: { xs: 3, sm: 4 }, pb: 3, flexShrink: 0, px: APP_PAGE_FRAME.px }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flexWrap: 'wrap' }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              <TitleWithIcon icon={<TimelineIcon />}>{tr('设备排程', 'Occupancy Schedule')}</TitleWithIcon>
            </Typography>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 26,
                px: 1.15,
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'text.secondary',
                backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.06),
                border: '1px solid',
                borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.08),
                whiteSpace: 'nowrap',
              }}
            >
              {visibleMonthLabel}
            </Box>
            {overdueCount > 0 ? (
              <Tooltip
                title={tr(
                  `当前有 ${overdueCount} 条超时未完成使用记录，请及时处理`,
                  `There are ${overdueCount} overdue usage logs. Please handle them.`
                )}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    height: 26,
                    px: 1.15,
                    borderRadius: 999,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    color: isDark ? theme.palette.error.light : theme.palette.error.dark,
                    backgroundColor: alpha(theme.palette.error.main, isDark ? 0.2 : 0.1),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.error.main, isDark ? 0.42 : 0.28),
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: theme.palette.error.main,
                      flexShrink: 0,
                      animation: 'timelineOverdueDotPulse 1.8s ease-in-out infinite',
                      '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none',
                      },
                      '@keyframes timelineOverdueDotPulse': {
                        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                        '50%': { opacity: 0.4, transform: 'scale(0.82)' },
                      },
                    }}
                  />
                  {tr(`${overdueCount} 条超时待处理`, `${overdueCount} overdue`)}
                </Box>
              </Tooltip>
            ) : null}
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              justifyContent: { xs: 'flex-start', lg: 'flex-end' },
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.25,
                px: 0.5,
              }}
              aria-label={tr('状态图例', 'Status legend')}
            >
              {legendItems.map((item) => (
                <Box
                  key={item.status}
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.6,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  {item.label}
                </Box>
              ))}
            </Box>

            <Divider orientation="vertical" flexItem sx={{ height: 18, alignSelf: 'center', display: { xs: 'none', sm: 'block' } }} />

            <Button
              variant="outlined"
              size="small"
              startIcon={<TodayIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                setSelectedJumpDate(new Date());
                setScrollToTodaySignal((n) => n + 1);
              }}
              sx={{
                whiteSpace: 'nowrap',
                minHeight: 32,
                px: 1.25,
                borderColor: alpha(theme.palette.primary.main, 0.38),
                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.04),
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.09),
                },
              }}
            >
              {tr('跳转今天', 'Today')}
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<CalendarMonthIcon sx={{ fontSize: 15 }} />}
              onClick={(e) => setJumpDateAnchorEl(e.currentTarget)}
              sx={{
                whiteSpace: 'nowrap',
                minHeight: 32,
                px: 1.25,
                borderColor: alpha(theme.palette.text.primary, isDark ? 0.24 : 0.18),
                color: 'text.primary',
                backgroundColor: 'background.paper',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.04),
                },
              }}
            >
              {tr('跳转日期', 'Go to date')}
            </Button>

            <Popover
              open={Boolean(jumpDateAnchorEl)}
              anchorEl={jumpDateAnchorEl}
              onClose={() => setJumpDateAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 0.75,
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'divider',
                  },
                },
              }}
            >
              <DateCalendar
                value={selectedJumpDate}
                onChange={(newDate) => {
                  if (!newDate || Number.isNaN(newDate.getTime())) return;
                  setSelectedJumpDate(newDate);
                  setJumpToDate((prev) => ({ date: newDate, signal: (prev?.signal ?? 0) + 1 }));
                  setJumpDateAnchorEl(null);
                }}
              />
            </Popover>

            <ToggleButtonGroup
              value={dayWidthPx}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (typeof value === 'number') setDayWidthPx(value);
              }}
              sx={{
                flexShrink: 0,
                backgroundColor: 'background.paper',
                '& .MuiToggleButton-root': {
                  minHeight: 32,
                  py: 0.25,
                  px: 1.15,
                  fontSize: '0.78rem',
                },
              }}
            >
              <ToggleButton value={140}>{tr('紧凑', 'Compact')}</ToggleButton>
              <ToggleButton value={200}>{tr('默认', 'Default')}</ToggleButton>
              <ToggleButton value={260}>{tr('宽松', 'Wide')}</ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleOpenNewUsageLogForm}
              sx={{ whiteSpace: 'nowrap', minHeight: 32, px: 1.5 }}
            >
              {tr('登记新使用记录', 'New usage log')}
            </Button>
          </Box>
        </Stack>
      </Container>

      <Container
        maxWidth={APP_PAGE_FRAME.maxWidth}
        disableGutters
        sx={{
          pb: { xs: 1.5, sm: 2 },
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          px: APP_PAGE_FRAME.px,
        }}
      >
        <AppCard
          sx={{
            p: 0,
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '14px',
            borderColor: alpha(theme.palette.text.primary, isDark ? 0.16 : 0.12),
            boxShadow: isDark
              ? '0 8px 28px -6px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3)'
              : '0 6px 24px -6px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
          contentSx={{ m: 0, display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}
        >
          <Box
            sx={{
              flexGrow: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              borderRadius: '13px',
              clipPath: 'inset(0 round 13px)',
            }}
          >
            {loading && usageLogs.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>{tr('加载中...', 'Loading...')}</Typography>
              </Box>
            ) : error ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', p: 2 }}>
                <Alert severity="error" sx={{ width: '100%', maxWidth: '600px', mb: 2 }}>
                  {tr(`加载时间轴数据失败: ${error}`, `Failed to load timeline: ${error}`)}
                </Alert>
                <Button
                  variant="outlined"
                  onClick={() => {
                    initialFetchDoneRef.current = false;
                    dispatch(fetchUsageLogs({ force: true }));
                  }}
                >
                  {tr('重试', 'Retry')}
                </Button>
              </Box>
            ) : (
              <ScrollingTimeline
                usageLogs={usageLogs}
                onViewUsageLog={handleViewUsageLog}
                onDeleteUsageLog={handleDeleteLog}
                dayWidthPx={dayWidthPx}
                scrollToTodaySignal={scrollToTodaySignal}
                jumpToDate={jumpToDate}
                minRowHeightPx={65}
                itemBarHeightPx={50}
                itemBarGapPx={2}
                onVisibleMonthChange={setVisibleMonthLabel}
              />
            )}
          </Box>
        </AppCard>

        {detailsOpen && selectedLogId && (
          <UsageLogDetails open={detailsOpen} onClose={handleCloseDetails} logId={selectedLogId} />
        )}

        {isUsageLogFormOpen && <UsageLogForm open={isUsageLogFormOpen} onClose={handleCloseUsageLogForm} />}

        <ConfirmDialog
          open={Boolean(pendingDelete)}
          title={tr('确认删除', 'Confirm deletion')}
          description={tr(
            '确定要删除此配置的使用记录吗？此操作无法撤销。',
            'Delete this config from the usage log? This action cannot be undone.'
          )}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
        />
      </Container>
    </Box>
  );
};

export default TimelinePage;
