// src/components/UsageLogList.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Tooltip, CircularProgress, Alert, Button, Chip, TextField, MenuItem,
  Stack, TablePagination,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // 新增图标

import { UsageLog, Project, Config as ConfigType } from '../types';
import { fetchUsageLogs, markLogAsCompleted } from '../store/usageLogsSlice'; // 导入 markLogAsCompleted
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'; // 导入辅助函数
import { formatDateTimeShort } from '../utils/formatters';
import { useAppDispatch, useAppSelector } from '../store/hooks'
import ConfirmDialog from './ConfirmDialog';
import AppCard from './AppCard';
import StatusChip from './StatusChip';
import { useI18n } from '../i18n'

interface UsageLogListProps {
  onViewDetails: (logId: string) => void;
  onEdit: (log: UsageLog) => void;
  onDelete: (logId: string) => void;
}

const UsageLogList: React.FC<UsageLogListProps> = ({ onViewDetails, onEdit, onDelete }) => {
  const dispatch = useAppDispatch()
  const [pendingCompleteLogId, setPendingCompleteLogId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UsageLog['status']>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { tr, dateFnsLocale } = useI18n()

  const { usageLogs, loading: loadingUsageLogs, error: usageLogsError } = useAppSelector((state) => state.usageLogs)
  const { assets: chambers, loading: loadingChambers, error: chambersError } = useAppSelector((state) => state.assets)
  const { projects, loading: loadingProjects, error: projectsError } = useAppSelector((state) => state.projects)
  const { testProjects, loading: loadingTestProjects, error: testProjectsError } = useAppSelector((state) => state.testProjects)

  useEffect(() => {
    dispatch(fetchUsageLogs());
    dispatch(fetchAssetsByType({ type: 'chamber' }));
    dispatch(fetchProjects());
    dispatch(fetchTestProjects());
  }, [dispatch]);

  const chamberNameById = useMemo(() => {
    const map = new Map<string, string>();
    chambers.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [chambers]);

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const testProjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    testProjects.forEach((tp) => map.set(tp.id, tp.name));
    return map;
  }, [testProjects]);

  const configByProjectId = useMemo(() => {
    const map = new Map<string, Map<string, ConfigType>>();
    projects.forEach((p) => {
      if (!p.configs || p.configs.length === 0) return;
      const configMap = new Map<string, ConfigType>();
      p.configs.forEach((c) => configMap.set(c.id, c));
      map.set(p.id, configMap);
    });
    return map;
  }, [projects]);

  const getChamberName = (chamberId: string): string => {
    return chamberNameById.get(chamberId) || chamberId;
  };

  const getProject = (projectId?: string): Project | null => {
    if (!projectId) return null;
    return projectById.get(projectId) || null;
  };

  const getTestProjectName = (testProjectId?: string): string => {
    if (!testProjectId) return tr('无', 'None');
    return testProjectNameById.get(testProjectId) || testProjectId;
  };

  const filteredLogs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return usageLogs.filter((log) => {
      if (statusFilter !== 'all' && getEffectiveUsageLogStatus(log) !== statusFilter) {
        return false;
      }
      if (!query) return true;
      const chamberName = chamberNameById.get(log.chamberId) ?? '';
      const project = log.projectId ? projectById.get(log.projectId) : undefined;
      const projectName = project?.name ?? '';
      const testProjectName = log.testProjectId ? (testProjectNameById.get(log.testProjectId) ?? '') : '';
      const configMap = log.projectId ? configByProjectId.get(log.projectId) : undefined;
      const configNames =
        log.selectedConfigIds?.map((cid) => configMap?.get(cid)?.name ?? '').join(' ') ?? '';
      const haystack = [
        chamberName,
        log.user,
        projectName,
        testProjectName,
        log.selectedWaterfall ?? '',
        log.notes ?? '',
        configNames,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [chamberNameById, configByProjectId, projectById, searchText, statusFilter, testProjectNameById, usageLogs]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredLogs.length / rowsPerPage) - 1));
  const paginatedLogs = useMemo(
    () => filteredLogs.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [filteredLogs, rowsPerPage, safePage]
  );

  const isLoading = loadingUsageLogs || loadingChambers || loadingProjects || loadingTestProjects;

  if (isLoading && usageLogs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{tr('正在加载使用记录列表...', 'Loading usage logs...')}</Typography>
      </Box>
    );
  }

  const combinedError = usageLogsError || chambersError || projectsError || testProjectsError;
  if (combinedError && !isLoading) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {tr(`加载数据失败: ${combinedError}`, `Failed to load data: ${combinedError}`)}
        <Button
            size="small"
            onClick={() => {
                dispatch(fetchUsageLogs({ force: true }));
                dispatch(fetchAssetsByType({ type: 'chamber', force: true }));
                dispatch(fetchProjects({ force: true }));
                dispatch(fetchTestProjects({ force: true }));
            }}
            sx={{ ml: 2 }}
        >
            {tr('重试', 'Retry')}
        </Button>
      </Alert>
    );
  }

  return (
    <>
      <AppCard contentSx={{ mt: 0 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ flex: 1 }}>
            <TextField
              size="small"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(0);
              }}
              placeholder={tr('搜索设备 / 使用人 / 项目 / 备注', 'Search asset / user / project / notes')}
              sx={{ minWidth: { sm: 260 }, flex: 1, maxWidth: { sm: 380 } }}
            />
            <TextField
              select
              size="small"
              label={tr('状态', 'Status')}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | UsageLog['status']);
                setPage(0);
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">{tr('全部状态', 'All')}</MenuItem>
              <MenuItem value="not-started">{tr('未开始', 'Not started')}</MenuItem>
              <MenuItem value="in-progress">{tr('进行中', 'In progress')}</MenuItem>
              <MenuItem value="completed">{tr('已完成', 'Completed')}</MenuItem>
              <MenuItem value="overdue">{tr('已逾期', 'Overdue')}</MenuItem>
            </TextField>
          </Stack>
          <Chip size="small" label={tr(`共 ${filteredLogs.length} 条`, `${filteredLogs.length} logs`)} sx={{ fontWeight: 650, alignSelf: { xs: 'flex-start', sm: 'center' } }} />
        </Stack>
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table aria-label={tr('使用记录列表', 'Usage log list')} size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{tr('环境箱', 'Asset')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('使用人', 'User')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('开始时间', 'Start time')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('结束时间', 'End time')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('状态', 'Status')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('关联项目', 'Project')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('已选Configs', 'Configs')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('已选WaterFall', 'Waterfall')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('关联测试项目', 'Test project')}</TableCell>
                <TableCell sx={{ fontWeight: 600, minWidth: '150px' }} align="center">
                  {tr('操作', 'Actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    {tr('没有找到使用记录数据。', 'No usage logs found.')}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => {
                  const linkedProject = getProject(log.projectId);
                  const configMap = log.projectId ? configByProjectId.get(log.projectId) : undefined;
                  const effectiveStatus = getEffectiveUsageLogStatus(log);

                  return (
                    <TableRow key={log.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{getChamberName(log.chamberId)}</TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>{formatDateTimeShort(log.startTime, { fallback: 'N/A', locale: dateFnsLocale })}</TableCell>
                      <TableCell>{formatDateTimeShort(log.endTime, { fallback: 'N/A', locale: dateFnsLocale })}</TableCell>
                      <TableCell>
                        <StatusChip kind="usage" status={effectiveStatus} />
                      </TableCell>
                      <TableCell>{linkedProject ? linkedProject.name : (log.projectId || tr('无', 'None'))}</TableCell>
                      <TableCell>
                        {(() => {
                          if (log.selectedConfigIds && log.selectedConfigIds.length > 0) {
                            const maxShow = 4
                            const displayIds = log.selectedConfigIds.slice(0, maxShow)
                            const remaining = Math.max(0, log.selectedConfigIds.length - displayIds.length)
                            if (linkedProject && linkedProject.configs) {
                              return (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
                                  {displayIds.map((configId) => {
                                    const config = configMap?.get(configId);
                                    return (
                                      <Tooltip key={configId} title={config?.remark || config?.name || `Config ID: ${configId}`}>
                                        <Chip label={config?.name || `ID: ${configId.substring(0, 6)}`} size="small" variant="outlined" />
                                      </Tooltip>
                                    );
                                  })}
                                  {remaining > 0 ? <Chip label={`+${remaining}`} size="small" variant="outlined" /> : null}
                                </Box>
                              );
                            }
                            if (log.projectId && !linkedProject && loadingProjects) {
                              return tr('加载中...', 'Loading...');
                            }
                            return (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
                                {displayIds.map((configId) => (
                                  <Tooltip key={configId} title={`Config ID: ${configId}`}>
                                    <Chip label={`ID: ${configId.substring(0, 6)}`} size="small" variant="outlined" />
                                  </Tooltip>
                                ))}
                                {remaining > 0 ? <Chip label={`+${remaining}`} size="small" variant="outlined" /> : null}
                              </Box>
                            );
                          }
                          return tr('无', 'None');
                        })()}
                      </TableCell>
                      <TableCell>
                        {log.selectedWaterfall ? (
                          <Chip label={log.selectedWaterfall} size="small" variant="outlined" color="secondary" />
                        ) : tr('无', 'None')}
                      </TableCell>
                      <TableCell>{getTestProjectName(log.testProjectId)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={tr('查看详情', 'View details')}>
                          <IconButton onClick={() => onViewDetails(log.id)} size="small" color="info" sx={{ p: 0.5 }}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={tr('编辑', 'Edit')}>
                          <IconButton onClick={() => onEdit(log)} size="small" color="primary" sx={{ p: 0.5 }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {(effectiveStatus === 'in-progress' || effectiveStatus === 'overdue') && (
                          <Tooltip title={tr('标记为已完成', 'Mark as completed')}>
                            <IconButton onClick={() => setPendingCompleteLogId(log.id)} size="small" color="success" sx={{ p: 0.5 }}>
                              <CheckCircleOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={tr('删除', 'Delete')}>
                          <IconButton onClick={() => onDelete(log.id)} size="small" color="error" sx={{ p: 0.5 }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredLogs.length}
          page={safePage}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage={tr('每页行数', 'Rows per page')}
        />
      </AppCard>
      <ConfirmDialog
        open={Boolean(pendingCompleteLogId)}
        title={tr('确认标记完成', 'Confirm completion')}
        description={tr('确定要将该记录标记为“已完成”吗？', 'Mark this log as completed?')}
        confirmText={tr('标记完成', 'Mark completed')}
        confirmColor="success"
        onClose={() => setPendingCompleteLogId(null)}
        onConfirm={() => {
          if (!pendingCompleteLogId) return;
          dispatch(markLogAsCompleted(pendingCompleteLogId));
          setPendingCompleteLogId(null);
        }}
      />
    </>
  );
};

export default UsageLogList;
