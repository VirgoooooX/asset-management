// src/pages/UsageLogPage.tsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Snackbar, // 用于显示操作结果
  Alert
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

const UsageLogPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { usageLogs, loading: loadingUsageLogs } = useAppSelector((state) => state.usageLogs)
  const { assets: chambers, loading: loadingChambers } = useAppSelector((state) => state.assets)
  const { projects, loading: loadingProjects } = useAppSelector((state) => state.projects)
  const { testProjects, loading: loadingTestProjects } = useAppSelector((state) => state.testProjects)
  const { tr, language } = useI18n()

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

  const handleExportAll = useCallback(() => {
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
    try {
      exportUsageLogsToXlsx({ usageLogs, chambers, projects, testProjects, language })
      setSnackbarMessage(tr('已开始导出 Excel', 'Export started.'))
      setSnackbarSeverity('success')
      setSnackbarOpen(true)
    } catch (error: any) {
      setSnackbarMessage(tr(`导出失败: ${error?.message || '未知错误'}`, `Export failed: ${error?.message || 'Unknown error'}`))
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
    }
  }, [chambers, language, loadingChambers, loadingProjects, loadingTestProjects, loadingUsageLogs, projects, testProjects, tr, usageLogs])

  return (
    <PageShell
      title={<TitleWithIcon icon={<ListAltIcon />}>{tr('使用记录', 'Usage logs')}</TitleWithIcon>}
      maxWidth="xl"
      actions={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportAll} sx={{ whiteSpace: 'nowrap' }}>
            {tr('导出Excel', 'Export Excel')}
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
