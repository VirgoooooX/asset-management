// src/pages/TimelinePage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Container, Box, Typography, CircularProgress, Button, Alert, Chip, ToggleButtonGroup, ToggleButton, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/ViewTimeline'
import ScrollingTimeline from '../components/ScrollingTimeline';
import UsageLogDetails from '../components/UsageLogDetails';
import UsageLogForm from '../components/UsageLogForm';
import ConfirmDialog from '../components/ConfirmDialog';
import AppCard from '../components/AppCard';
import { UsageLog } from '../types';
import { fetchUsageLogs, removeConfigFromUsageLog } from '../store/usageLogsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'
import { alpha, useTheme } from '@mui/material/styles';
import TitleWithIcon from '../components/TitleWithIcon'
import { APP_PAGE_FRAME } from '../theme'
import { useI18n } from '../i18n'

const TimelinePage: React.FC = () => {
    const theme = useTheme();
    const { tr } = useI18n()
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const dispatch = useAppDispatch()
    const { usageLogs, loading, error } = useAppSelector((state) => state.usageLogs)

    const initialFetchDoneRef = useRef(false);

    const [isUsageLogFormOpen, setIsUsageLogFormOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<UsageLog | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ logId: string; configId: string } | null>(null);
    const [dayWidthPx, setDayWidthPx] = useState<number>(200);
    const [scrollToTodaySignal, setScrollToTodaySignal] = useState(0);

    const overdueCount = useMemo(() => {
        return usageLogs.reduce((count, log) => {
            return getEffectiveUsageLogStatus(log) === 'overdue' ? count + 1 : count
        }, 0)
    }, [usageLogs])

    const legendChipSx = useCallback((status: UsageLog['status']) => {
        const main =
            status === 'completed' ? theme.palette.success.main :
            status === 'in-progress' ? theme.palette.warning.main :
            status === 'not-started' ? theme.palette.info.main :
            status === 'overdue' ? theme.palette.error.main :
            theme.palette.text.secondary;

        const dark =
            status === 'completed' ? theme.palette.success.dark :
            status === 'in-progress' ? theme.palette.warning.dark :
            status === 'not-started' ? theme.palette.info.dark :
            status === 'overdue' ? theme.palette.error.dark :
            theme.palette.text.primary;

        return {
            backgroundColor: alpha(main, 0.16),
            border: '1px solid',
            borderColor: alpha(main, 0.32),
            color: dark,
            fontWeight: 650,
        } as const;
    }, [theme]);

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
        } catch (error) {
            console.error('Failed to remove config from log:', error);
        } finally {
            setPendingDelete(null);
        }
    }, [dispatch, pendingDelete]);

    useEffect(() => {
        // 只有在非加载状态且首次获取未完成时才 dispatch
        if (!loading && !initialFetchDoneRef.current) {
            dispatch(fetchUsageLogs());
            initialFetchDoneRef.current = true;
        }
    }, [dispatch, loading]); // 依赖 dispatch 和 loading 状态

    const handleOpenNewUsageLogForm = useCallback(() => {
        setEditingLog(null); // 确保是新建模式
        setIsUsageLogFormOpen(true);
    }, []);

    const handleCloseUsageLogForm = useCallback((success?: boolean) => {
        setIsUsageLogFormOpen(false);
        setEditingLog(null); // 清除编辑状态
        if (success) {
            // 登记/编辑成功后的操作，例如显示提示或刷新列表
            // 如果 Redux slice 能正确更新列表，通常不需要手动再次 fetchUsageLogs
            // dispatch(fetchUsageLogs()); 
        }
    }, []);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <Container maxWidth={APP_PAGE_FRAME.maxWidth} disableGutters sx={{ pt: { xs: 3, sm: 4 }, pb: 2, flexShrink: 0, px: APP_PAGE_FRAME.px }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flexWrap: 'nowrap' }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 850, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                            <TitleWithIcon icon={<TimelineIcon />}>{tr('设备排程', 'Occupancy Schedule')}</TitleWithIcon>
                        </Typography>
                        {overdueCount > 0 ? (
                            <Chip
                                color="error"
                                size="small"
                                label={tr(
                                    `当前有 ${overdueCount} 条超时未完成使用记录，请及时处理`,
                                    `There are ${overdueCount} overdue usage logs. Please handle them.`
                                )}
                                sx={{
                                    fontWeight: 750,
                                    borderRadius: 999,
                                    fontSize: '1.2rem',
                                    height: 40,
                                    whiteSpace: 'nowrap',
                                    animation: 'timelineOverduePulse 1.15s ease-in-out infinite',
                                    '@media (prefers-reduced-motion: reduce)': {
                                        animation: 'none',
                                    },
                                    '@keyframes timelineOverduePulse': {
                                        '0%': { opacity: 1, filter: 'saturate(1)' },
                                        '55%': { opacity: 0.55, filter: 'saturate(1.15)' },
                                        '100%': { opacity: 1, filter: 'saturate(1)' },
                                    },
                                    '& .MuiChip-label': {
                                        whiteSpace: 'nowrap',
                                        px: 1.25,
                                        lineHeight: 1.15,
                                    },
                                }}
                            />
                        ) : null}
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1,
                            alignItems: 'center',
                            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                        }}
                    >
                        <Button variant="outlined" size="small" onClick={() => setScrollToTodaySignal((n) => n + 1)} sx={{ whiteSpace: 'nowrap' }}>
                            {tr('跳转今天', 'Today')}
                        </Button>
                        <ToggleButtonGroup
                            value={dayWidthPx}
                            exclusive
                            size="small"
                            onChange={(_, value) => {
                                if (typeof value === 'number') setDayWidthPx(value);
                            }}
                            sx={{ flexShrink: 0 }}
                        >
                            <ToggleButton value={140} sx={{ px: 1.25 }}>{tr('紧凑', 'Compact')}</ToggleButton>
                            <ToggleButton value={200} sx={{ px: 1.25 }}>{tr('默认', 'Default')}</ToggleButton>
                            <ToggleButton value={260} sx={{ px: 1.25 }}>{tr('宽松', 'Wide')}</ToggleButton>
                        </ToggleButtonGroup>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            <Chip label={tr('未开始', 'Not started')} size="small" sx={legendChipSx('not-started')} />
                            <Chip label={tr('进行中', 'In progress')} size="small" sx={legendChipSx('in-progress')} />
                            <Chip label={tr('已完成', 'Completed')} size="small" sx={legendChipSx('completed')} />
                            <Chip label={tr('已超时', 'Overdue')} size="small" sx={legendChipSx('overdue')} />
                        </Box>
                        <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleOpenNewUsageLogForm}
                            sx={{ whiteSpace: 'nowrap' }}
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
                    pb: 0,
                    flexGrow: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    px: APP_PAGE_FRAME.px,
                }}
            >
                <AppCard
                    sx={{ p: 0, flexGrow: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                    contentSx={{ m: 0, display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}
                >
                    <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
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
                                <Button variant="outlined" onClick={() => { initialFetchDoneRef.current = false; dispatch(fetchUsageLogs({ force: true })); }}>
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
                                minRowHeightPx={65}
                                itemBarHeightPx={50}
                                itemBarGapPx={2}
                            />
                        )}
                    </Box>
                </AppCard>

                {/* 使用记录详情对话框 */}
                {detailsOpen && selectedLogId && (
                    <UsageLogDetails
                        open={detailsOpen}
                        onClose={handleCloseDetails}
                        logId={selectedLogId}
                    />
                )}

                {/* 登记/编辑使用记录表单对话框 */}
                {isUsageLogFormOpen && (
                    <UsageLogForm
                        open={isUsageLogFormOpen}
                        onClose={handleCloseUsageLogForm}
                        log={editingLog || undefined} // 传递正在编辑的记录或undefined (新建)
                    />
                )}
                <ConfirmDialog
                    open={Boolean(pendingDelete)}
                    title={tr('确认删除', 'Confirm deletion')}
                    description={tr('确定要删除此配置的使用记录吗？此操作无法撤销。', 'Delete this config from the usage log? This action cannot be undone.')}
                    onClose={handleCloseDelete}
                    onConfirm={handleConfirmDelete}
                />
            </Container>
        </Box>
    );
};

export default TimelinePage;
