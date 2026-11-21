// src/pages/TimelinePage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Button,
  Alert,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  TextField,
  MenuItem,
  InputAdornment,
  IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import TodayIcon from '@mui/icons-material/Today'
import TimelineIcon from '@mui/icons-material/ViewTimeline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ScrollingTimeline from '../components/ScrollingTimeline'
import UsageLogDetails from '../components/UsageLogDetails'
import UsageLogForm from '../components/UsageLogForm'
import ConfirmDialog from '../components/ConfirmDialog'
import AppCard from '../components/AppCard'
import { useToast } from '../components/ToastProvider'
import type { AssetStatus, UsageLog } from '../types'
import { fetchUsageLogs, removeConfigFromUsageLog } from '../store/usageLogsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'
import { alpha, useTheme } from '@mui/material/styles'
import TitleWithIcon from '../components/TitleWithIcon'
import { APP_PAGE_FRAME } from '../theme'
import { useI18n } from '../i18n'
import { getUsageLogStatusMeta } from '../utils/statusMeta'

const TimelinePage: React.FC = () => {
  const theme = useTheme()
  const navigate = useNavigate()
  const { tr } = useI18n()
  const toast = useToast()
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const dispatch = useAppDispatch()
  const { usageLogs, loading, error } = useAppSelector((state) => state.usageLogs)

  const initialFetchDoneRef = useRef(false)

  const [isUsageLogFormOpen, setIsUsageLogFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ logId: string; configId: string } | null>(null)
  const [dayWidthPx, setDayWidthPx] = useState<number>(200)
  const [scrollToTodaySignal, setScrollToTodaySignal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all')

  const overdueCount = useMemo(() => {
    return usageLogs.reduce((count, log) => {
      return getEffectiveUsageLogStatus(log) === 'overdue' ? count + 1 : count
    }, 0)
  }, [usageLogs])

  const legendChipSx = useCallback(
    (status: UsageLog['status']) => {
      const isDark = theme.palette.mode === 'dark'
      const tone = getUsageLogStatusMeta(status, tr).tone
      const paletteEntry =
        tone === 'success'
          ? theme.palette.success
          : tone === 'warning'
            ? theme.palette.warning
            : tone === 'error'
              ? theme.palette.error
              : tone === 'info'
                ? theme.palette.info
                : null
      const main = paletteEntry?.main ?? theme.palette.text.secondary
      const textColor = isDark
        ? paletteEntry?.light ?? theme.palette.text.primary
        : paletteEntry?.dark ?? theme.palette.text.primary

      return {
        backgroundColor: alpha(main, isDark ? 0.24 : 0.14),
        border: '1px solid',
        borderColor: alpha(main, isDark ? 0.48 : 0.32),
        color: textColor,
        fontWeight: 600,
      } as const
    },
    [theme, tr]
  )

  const handleViewUsageLog = useCallback((logId: string) => {
    setSelectedLogId(logId)
    setDetailsOpen(true)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setDetailsOpen(false)
    setSelectedLogId(null)
  }, [])

  const handleDeleteLog = useCallback((logId: string, configId: string) => {
    setPendingDelete({ logId, configId })
  }, [])

  const handleCloseDelete = useCallback(() => setPendingDelete(null), [])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    try {
      await dispatch(
        removeConfigFromUsageLog({ logId: pendingDelete.logId, configId: pendingDelete.configId })
      ).unwrap()
      toast.success(tr('已从使用记录中移除该配置', 'Config removed from usage log.'))
    } catch (err: any) {
      toast.error(err?.message || tr('移除配置失败', 'Failed to remove config'))
    } finally {
      setPendingDelete(null)
    }
  }, [dispatch, pendingDelete, toast, tr])

  useEffect(() => {
    if (!loading && !initialFetchDoneRef.current) {
      dispatch(fetchUsageLogs())
      initialFetchDoneRef.current = true
    }
  }, [dispatch, loading])

  const handleOpenNewUsageLogForm = useCallback(() => {
    setIsUsageLogFormOpen(true)
  }, [])

  const handleCloseUsageLogForm = useCallback(
    (success?: boolean) => {
      setIsUsageLogFormOpen(false)
      if (success) {
        toast.success(tr('使用记录已登记', 'Usage log created.'))
      }
    },
    [toast, tr]
  )

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
  }, [])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <Container
        maxWidth={APP_PAGE_FRAME.maxWidth}
        disableGutters
        sx={{ pt: { xs: 2.5, sm: 3.5 }, pb: 1.5, flexShrink: 0, px: APP_PAGE_FRAME.px }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                <TitleWithIcon icon={<TimelineIcon />}>{tr('设备排程', 'Occupancy Schedule')}</TitleWithIcon>
              </Typography>
              {overdueCount > 0 ? (
                <Chip
                  color="error"
                  size="small"
                  icon={<WarningAmberIcon />}
                  clickable
                  onClick={() => navigate('/alerts')}
                  label={tr(`${overdueCount} 条逾期未完成`, `${overdueCount} overdue`)}
                  sx={{ fontWeight: 600 }}
                />
              ) : null}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
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
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            spacing={1.25}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                size="small"
                margin="none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('搜索设备/编号/类别', 'Search asset / code / category')}
                sx={{ minWidth: { sm: 210 }, maxWidth: { sm: 260 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery('')}
                        aria-label={tr('清空搜索', 'Clear search')}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              <TextField
                select
                size="small"
                margin="none"
                label={tr('设备状态', 'Asset status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | AssetStatus)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="all">{tr('全部状态', 'All')}</MenuItem>
                <MenuItem value="available">{tr('可用', 'Available')}</MenuItem>
                <MenuItem value="in-use">{tr('使用中', 'In use')}</MenuItem>
                <MenuItem value="maintenance">{tr('维护中', 'Maintenance')}</MenuItem>
              </TextField>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            >
              <Button
                variant="outlined"
                size="small"
                startIcon={<TodayIcon />}
                onClick={() => setScrollToTodaySignal((n) => n + 1)}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {tr('跳转今天', 'Today')}
              </Button>
              <ToggleButtonGroup
                value={dayWidthPx}
                exclusive
                size="small"
                onChange={(_, value) => {
                  if (typeof value === 'number') setDayWidthPx(value)
                }}
                sx={{ flexShrink: 0 }}
              >
                <ToggleButton value={140} sx={{ px: 1.25 }}>
                  {tr('紧凑', 'Compact')}
                </ToggleButton>
                <ToggleButton value={200} sx={{ px: 1.25 }}>
                  {tr('默认', 'Default')}
                </ToggleButton>
                <ToggleButton value={260} sx={{ px: 1.25 }}>
                  {tr('宽松', 'Wide')}
                </ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                <Chip label={tr('未开始', 'Not started')} size="small" sx={legendChipSx('not-started')} />
                <Chip label={tr('进行中', 'In progress')} size="small" sx={legendChipSx('in-progress')} />
                <Chip label={tr('已完成', 'Completed')} size="small" sx={legendChipSx('completed')} />
                <Chip label={tr('已超时', 'Overdue')} size="small" sx={legendChipSx('overdue')} />
              </Box>
            </Stack>
          </Stack>
        </Stack>
      </Container>

      <Container
        maxWidth={APP_PAGE_FRAME.maxWidth}
        disableGutters
        sx={{
          pb: 1,
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
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  p: 2,
                }}
              >
                <Alert severity="error" sx={{ width: '100%', maxWidth: '600px', mb: 2 }}>
                  {tr(`加载时间轴数据失败: ${error}`, `Failed to load timeline: ${error}`)}
                </Alert>
                <Button
                  variant="outlined"
                  onClick={() => {
                    initialFetchDoneRef.current = false
                    dispatch(fetchUsageLogs({ force: true }))
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
                minRowHeightPx={65}
                itemBarHeightPx={50}
                itemBarGapPx={2}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onResetFilters={handleResetFilters}
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
  )
}

export default TimelinePage
