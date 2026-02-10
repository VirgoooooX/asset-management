// src/pages/UsageLogPage.tsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Snackbar, // 用于显示操作结果
  Alert,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ListAltIcon from '@mui/icons-material/ListAlt'
import UsageLogForm from '../components/UsageLogForm';
import UsageLogDetails from '../components/UsageLogDetails';
import UsageLogList from '../components/UsageLogList'; // 1. 导入 UsageLogList
import { UsageLog } from '../types'; // 导入 UsageLog 类型
import { deleteUsageLog } from '../store/usageLogsSlice'; // 导入 deleteUsageLog
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { exportUsageLogsToXlsx } from '../utils/exportUsageLogsToXlsx'
import PageShell from '../components/PageShell'
import ConfirmDialog from '../components/ConfirmDialog'
import TitleWithIcon from '../components/TitleWithIcon'
import { useI18n } from '../i18n'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers'

const UsageLogPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { usageLogs, loading: loadingUsageLogs } = useAppSelector((state) => state.usageLogs)
  const { assets: chambers, loading: loadingChambers } = useAppSelector((state) => state.assets)
  const { projects, loading: loadingProjects } = useAppSelector((state) => state.projects)
  const { testProjects, loading: loadingTestProjects } = useAppSelector((state) => state.testProjects)
  const { tr, language, dateFnsLocale } = useI18n()

  // --- State Management ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<UsageLog | null>(null); // 用于编辑

  const [selectedLogIdForDetails, setSelectedLogIdForDetails] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportMode, setExportMode] = useState<'year' | 'month' | 'custom'>('month')
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [exportYear, setExportYear] = useState<number>(now.getFullYear())
  const [exportMonth, setExportMonth] = useState<string>(defaultMonth)
  const [exportCustomStart, setExportCustomStart] = useState<Date | null>(null)
  const [exportCustomEnd, setExportCustomEnd] = useState<Date | null>(null)
  const [exportAssetIds, setExportAssetIds] = useState<string[]>([])
  const [exportIncludeInProgress, setExportIncludeInProgress] = useState(true)

  // --- Handlers ---
  const handleOpenForm = useCallback((logToEdit?: UsageLog) => {
    setEditingLog(logToEdit || null); // 如果传入 logToEdit，则为编辑模式
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback((success?: boolean) => {
    setIsFormOpen(false);
    setEditingLog(null);
    if (success) {
      setSnackbarMessage(
        editingLog ? tr('使用记录更新成功！', 'Usage log updated.') : tr('新的使用记录已登记！', 'Usage log created.')
      );
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      // 列表会自动因 Redux state 更新而刷新，通常不需要手动 dispatch fetchUsageLogs
    }
  }, [editingLog, tr /*, dispatch */]);

  const handleViewDetails = useCallback((logId: string) => {
    setSelectedLogIdForDetails(logId);
    setIsDetailsOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setSelectedLogIdForDetails(null);
  }, []);

  const handleDeleteClick = useCallback((logId: string) => {
    setDeletingLogId(logId);
    setIsConfirmDeleteDialogOpen(true);
  }, []);

  const handleCloseConfirmDelete = useCallback(() => {
    setIsConfirmDeleteDialogOpen(false);
    setDeletingLogId(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deletingLogId) {
      try {
        await dispatch(deleteUsageLog(deletingLogId)).unwrap();
        setSnackbarMessage(tr('使用记录删除成功', 'Usage log deleted.'));
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } catch (error: any) {
        setSnackbarMessage(
          tr(`删除失败: ${error.message || '未知错误'}`, `Delete failed: ${error.message || 'Unknown error'}`)
        );
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } finally {
        handleCloseConfirmDelete();
      }
    }
  }, [dispatch, deletingLogId, handleCloseConfirmDelete]);

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleOpenExport = useCallback(() => {
    const anyLoading = loadingUsageLogs || loadingChambers || loadingProjects || loadingTestProjects
    if (anyLoading) {
      setSnackbarMessage(tr('数据加载中，稍后再试', 'Data is loading. Please try again later.'))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
      return
    }
    if (usageLogs.length === 0) {
      setSnackbarMessage(tr('暂无使用记录可导出', 'No usage logs to export.'))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
      return
    }
    setExportDialogOpen(true)
  }, [loadingChambers, loadingProjects, loadingTestProjects, loadingUsageLogs, tr, usageLogs.length])

  const parseMs = (value: string | undefined) => {
    if (!value) return Number.NaN
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : Number.NaN
  }

  const computeRange = () => {
    if (exportMode === 'year') {
      const start = new Date(exportYear, 0, 1, 0, 0, 0, 0)
      const end = new Date(exportYear + 1, 0, 1, 0, 0, 0, 0)
      return { start, end }
    }
    if (exportMode === 'month') {
      const [yStr, mStr] = exportMonth.split('-')
      const y = Number(yStr)
      const m = Number(mStr)
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
      const end = new Date(y, m, 1, 0, 0, 0, 0)
      return { start, end }
    }
    if (!exportCustomStart || !exportCustomEnd) return null
    return { start: exportCustomStart, end: exportCustomEnd }
  }

  const handleExport = useCallback(() => {
    const anyLoading = loadingUsageLogs || loadingChambers || loadingProjects || loadingTestProjects
    if (anyLoading) return
    const range = computeRange()
    if (!range) {
      setSnackbarMessage(tr('请填写正确的导出时间范围', 'Please provide a valid time range.'))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
      return
    }
    const startMs = range.start.getTime()
    const endMs = range.end.getTime()
    if (!(endMs > startMs)) {
      setSnackbarMessage(tr('结束时间必须晚于开始时间', 'End time must be after start time.'))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
      return
    }

    const selectedSet = new Set(exportAssetIds)
    const nowMs = Date.now()
    const filtered = usageLogs.filter((log) => {
      if (selectedSet.size > 0 && !selectedSet.has(log.chamberId)) return false
      const s = parseMs(log.startTime)
      if (!Number.isFinite(s)) return false
      const rawEnd = parseMs(log.endTime)
      const e = Number.isFinite(rawEnd) ? rawEnd : exportIncludeInProgress ? nowMs : Number.NaN
      if (!Number.isFinite(e)) return false
      return s < endMs && e > startMs
    })

    if (filtered.length === 0) {
      setSnackbarMessage(tr('该筛选条件下没有可导出的使用记录', 'No usage logs match the filters.'))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
      return
    }

    try {
      const fileNamePrefix =
        exportMode === 'year'
          ? `usage-logs_${exportYear}`
          : exportMode === 'month'
            ? `usage-logs_${exportMonth}`
            : 'usage-logs_custom'
      exportUsageLogsToXlsx({
        usageLogs: filtered,
        chambers,
        projects,
        testProjects,
        language,
        fileNamePrefix,
        range: { start: range.start.toISOString(), end: range.end.toISOString() },
        includeInProgress: exportIncludeInProgress,
      })
      setExportDialogOpen(false)
      setSnackbarMessage(tr('已开始导出 Excel', 'Export started.'))
      setSnackbarSeverity('success')
      setSnackbarOpen(true)
    } catch (error: any) {
      setSnackbarMessage(tr(`导出失败: ${error?.message || '未知错误'}`, `Export failed: ${error?.message || 'Unknown error'}`))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
    }
  }, [
    chambers,
    exportAssetIds,
    exportIncludeInProgress,
    exportMode,
    exportMonth,
    exportYear,
    language,
    loadingChambers,
    loadingProjects,
    loadingTestProjects,
    loadingUsageLogs,
    projects,
    testProjects,
    tr,
    usageLogs,
  ])

  return (
    <PageShell
      title={<TitleWithIcon icon={<ListAltIcon />}>{tr('使用记录', 'Usage logs')}</TitleWithIcon>}
      actions={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleOpenExport} sx={{ whiteSpace: 'nowrap' }}>
            {tr('导出/统计', 'Export')}
          </Button>
          <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenForm()} sx={{ whiteSpace: 'nowrap' }}>
            {tr('登记新使用记录', 'New usage log')}
          </Button>
        </Box>
      }
    >
        {/* 2. 渲染 UsageLogList 组件并传递 props */}
        <UsageLogList
          onViewDetails={handleViewDetails}
          onEdit={handleOpenForm} // 编辑操作也打开同一个表单，但会传入 log 对象
          onDelete={handleDeleteClick}
        />

        {/* 表单对话框 */}
        {isFormOpen && (
          <UsageLogForm
            open={isFormOpen}
            onClose={handleCloseForm}
            log={editingLog || undefined} // 传递正在编辑的 log 或 undefined (新建)
          />
        )}

        {/* 详情对话框 */}
        {isDetailsOpen && selectedLogIdForDetails && (
          <UsageLogDetails
            open={isDetailsOpen}
            onClose={handleCloseDetails}
            logId={selectedLogIdForDetails}
          />
        )}

        <ConfirmDialog
          open={isConfirmDeleteDialogOpen}
          title={tr('确认删除', 'Confirm deletion')}
          description={tr('您确定要删除这条使用记录吗？此操作无法撤销。', 'Delete this usage log? This action cannot be undone.')}
          onClose={handleCloseConfirmDelete}
          onConfirm={handleConfirmDelete}
        />

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateFnsLocale}>
          <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>{tr('导出与统计', 'Export')}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <FormControl>
                  <FormLabel>{tr('时间范围', 'Time range')}</FormLabel>
                  <RadioGroup
                    row
                    value={exportMode}
                    onChange={(e) => setExportMode(e.target.value as any)}
                  >
                    <FormControlLabel value="month" control={<Radio />} label={tr('按月', 'Month')} />
                    <FormControlLabel value="year" control={<Radio />} label={tr('按年', 'Year')} />
                    <FormControlLabel value="custom" control={<Radio />} label={tr('自定义', 'Custom')} />
                  </RadioGroup>
                </FormControl>

                {exportMode === 'year' ? (
                  <TextField
                    type="number"
                    label={tr('年份', 'Year')}
                    value={exportYear}
                    onChange={(e) => setExportYear(Number(e.target.value))}
                    inputProps={{ min: 2000, max: 2100, step: 1 }}
                    fullWidth
                  />
                ) : exportMode === 'month' ? (
                  <TextField
                    type="month"
                    label={tr('月份', 'Month')}
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    fullWidth
                  />
                ) : (
                  <Stack spacing={2}>
                    <DateTimePicker
                      label={tr('开始时间', 'Start')}
                      value={exportCustomStart}
                      onChange={(v) => setExportCustomStart(v)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                    <DateTimePicker
                      label={tr('结束时间', 'End')}
                      value={exportCustomEnd}
                      onChange={(v) => setExportCustomEnd(v)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Stack>
                )}

                <FormControl fullWidth>
                  <InputLabel id="export-assets-label">{tr('设备（可选）', 'Assets (optional)')}</InputLabel>
                  <Select
                    labelId="export-assets-label"
                    multiple
                    value={exportAssetIds}
                    label={tr('设备（可选）', 'Assets (optional)')}
                    onChange={(e) => setExportAssetIds(e.target.value as string[])}
                    input={<OutlinedInput label={tr('设备（可选）', 'Assets (optional)')} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((id) => (
                          <Chip key={id} size="small" label={chambers.find((c) => c.id === id)?.name || id} />
                        ))}
                      </Box>
                    )}
                  >
                    {chambers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{tr('不选则导出全部设备', 'Leave empty to export all assets')}</FormHelperText>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={exportIncludeInProgress}
                      onChange={(e) => setExportIncludeInProgress(e.target.checked)}
                    />
                  }
                  label={tr('包含进行中的记录（按导出时刻截断）', 'Include in-progress logs (clipped to now)')}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setExportDialogOpen(false)}>{tr('取消', 'Cancel')}</Button>
              <Button variant="contained" onClick={handleExport} disabled={loadingUsageLogs || loadingChambers || loadingProjects || loadingTestProjects}>
                {tr('导出 Excel', 'Export Excel')}
              </Button>
            </DialogActions>
          </Dialog>
        </LocalizationProvider>

        {/* 操作结果提示 */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
            {snackbarMessage}
          </Alert>
        </Snackbar>
    </PageShell>
  );
};

export default UsageLogPage;
