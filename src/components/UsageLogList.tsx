// src/components/UsageLogList.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Tooltip, CircularProgress, Alert, Button, Chip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // 新增图标
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import type { ChipProps } from '@mui/material';

import { UsageLog, Project, Config as ConfigType } from '../types';
import { fetchUsageLogs, markLogAsCompleted } from '../store/usageLogsSlice'; // 导入 markLogAsCompleted
import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers'; // 导入辅助函数
import { useAppDispatch, useAppSelector } from '../store/hooks'
import ConfirmDialog from './ConfirmDialog';
import AppCard from './AppCard';
import { useI18n } from '../i18n'

interface UsageLogListProps {
  onViewDetails: (logId: string) => void;
  onEdit: (log: UsageLog) => void;
  onDelete: (logId: string) => void;
}

const UsageLogList: React.FC<UsageLogListProps> = ({ onViewDetails, onEdit, onDelete }) => {
  const dispatch = useAppDispatch()
  const [pendingCompleteLogId, setPendingCompleteLogId] = useState<string | null>(null);
  const { tr, dateFnsLocale } = useI18n()

  const { usageLogs, loading: loadingUsageLogs, error: usageLogsError } = useAppSelector((state) => state.usageLogs)
  const { assets: chambers, loading: loadingChambers, error: chambersError } = useAppSelector((state) => state.assets)
  const { projects, loading: loadingProjects, error: projectsError } = useAppSelector((state) => state.projects)
  const { testProjects, loading: loadingTestProjects, error: testProjectsError } = useAppSelector((state) => state.testProjects)

  const dataFetchedRef = useRef({
    usageLogs: false, chambers: false, projects: false, testProjects: false,
  });

  useEffect(() => {
    if (!dataFetchedRef.current.usageLogs) {
      if (usageLogs.length > 0) {
        dataFetchedRef.current.usageLogs = true;
      } else if (!loadingUsageLogs) {
        dispatch(fetchUsageLogs()).finally(() => { dataFetchedRef.current.usageLogs = true; });
      }
    }
    if (!dataFetchedRef.current.chambers) {
      if (chambers.length > 0) {
        dataFetchedRef.current.chambers = true;
      } else if (!loadingChambers) {
        dispatch(fetchAssetsByType('chamber')).finally(() => {
          dataFetchedRef.current.chambers = true
        })
      }
    }
    if (!dataFetchedRef.current.projects) {
      if (projects.length > 0) {
        dataFetchedRef.current.projects = true;
      } else if (!loadingProjects) {
        dispatch(fetchProjects()).finally(() => { dataFetchedRef.current.projects = true; });
      }
    }
    if (!dataFetchedRef.current.testProjects) {
      if (testProjects.length > 0) {
        dataFetchedRef.current.testProjects = true;
      } else if (!loadingTestProjects) {
        dispatch(fetchTestProjects()).finally(() => { dataFetchedRef.current.testProjects = true; });
      }
    }
  }, [
    dispatch,
    usageLogs.length,
    chambers.length,
    projects.length,
    testProjects.length,
    loadingUsageLogs,
    loadingChambers,
    loadingProjects,
    loadingTestProjects,
  ]);

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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValidDate(date) ? format(date, 'yyyy-MM-dd HH:mm', { locale: dateFnsLocale }) : tr('无效日期', 'Invalid date');
  };

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

  // 修改 getStatusChipProps 以使用 getEffectiveUsageLogStatus
  const getStatusChipProperties = (log: UsageLog): { label: string; color: ChipProps['color'] } => {
    const effectiveStatus = getEffectiveUsageLogStatus(log);
    switch (effectiveStatus) {
      case 'completed': return { label: tr('已完成', 'Completed'), color: 'success' };
      case 'in-progress': return { label: tr('进行中', 'In progress'), color: 'warning' };
      case 'not-started': return { label: tr('未开始', 'Not started'), color: 'primary' };
      case 'overdue': return { label: tr('已超时', 'Overdue'), color: 'error' };
      default: return { label: tr('未知', 'Unknown'), color: 'default' };
    }
  };

  const isLoading = loadingUsageLogs || loadingChambers || loadingProjects || loadingTestProjects;
  const initialLoadDone = dataFetchedRef.current.usageLogs && dataFetchedRef.current.chambers && dataFetchedRef.current.projects && dataFetchedRef.current.testProjects;

  if (isLoading && !initialLoadDone) {
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
                dataFetchedRef.current = { usageLogs: false, chambers: false, projects: false, testProjects: false };
                dispatch(fetchUsageLogs());
                dispatch(fetchAssetsByType('chamber'));
                dispatch(fetchProjects());
                dispatch(fetchTestProjects());
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
      <AppCard contentSx={{ mx: -2.5, mb: -2.5 }}>
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table sx={{ minWidth: 900 }} aria-label={tr('使用记录列表', 'Usage log list')} size="small">
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
              {usageLogs.length === 0 && !isLoading && initialLoadDone ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    {tr('没有找到使用记录数据。', 'No usage logs found.')}
                  </TableCell>
                </TableRow>
              ) : (
                usageLogs.map((log) => {
                  const linkedProject = getProject(log.projectId);
                  const configMap = log.projectId ? configByProjectId.get(log.projectId) : undefined;
                  const statusProps = getStatusChipProperties(log);
                  const effectiveStatus = getEffectiveUsageLogStatus(log);

                  return (
                    <TableRow key={log.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{getChamberName(log.chamberId)}</TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>{formatDate(log.startTime)}</TableCell>
                      <TableCell>{formatDate(log.endTime)}</TableCell>
                      <TableCell>
                        <Chip label={statusProps.label} color={statusProps.color} size="small" />
                      </TableCell>
                      <TableCell>{linkedProject ? linkedProject.name : (log.projectId || tr('无', 'None'))}</TableCell>
                      <TableCell>
                        {(() => {
                          if (log.selectedConfigIds && log.selectedConfigIds.length > 0) {
                            if (linkedProject && linkedProject.configs) {
                              return (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '200px', maxHeight: '70px', overflowY: 'auto' }}>
                                  {log.selectedConfigIds.map((configId) => {
                                    const config = configMap?.get(configId);
                                    return (
                                      <Tooltip key={configId} title={config?.remark || config?.name || `Config ID: ${configId}`}>
                                        <Chip label={config?.name || `ID: ${configId.substring(0, 6)}`} size="small" variant="outlined" />
                                      </Tooltip>
                                    );
                                  })}
                                </Box>
                              );
                            }
                            if (log.projectId && !linkedProject && loadingProjects) {
                              return tr('加载中...', 'Loading...');
                            }
                            return (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '200px', maxHeight: '70px', overflowY: 'auto' }}>
                                {log.selectedConfigIds.map((configId) => (
                                  <Tooltip key={configId} title={`Config ID: ${configId}`}>
                                    <Chip label={`ID: ${configId.substring(0, 6)}`} size="small" variant="outlined" />
                                  </Tooltip>
                                ))}
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
