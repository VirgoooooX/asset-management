// src/components/UsageLogDetails.tsx
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Divider, Chip, CircularProgress, List, ListItem, ListItemText as MuiListItemText,
  Paper, Tooltip, Alert,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { UsageLog, Project, TestProject, Config as ConfigType } from '../types';
import { useI18n } from '../i18n'
import StatusChip from './StatusChip';
import ConfirmDialog from './ConfirmDialog';
import { formatDateTimeShort } from '../utils/formatters';

import { fetchAssetsByType } from '../store/assetsSlice'
import { fetchProjects } from '../store/projectsSlice';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { fetchUsageLogs, markLogAsCompleted } from '../store/usageLogsSlice';
import { getEffectiveUsageLogStatus } from '../utils/statusHelpers';
import { useAppDispatch, useAppSelector } from '../store/hooks'

interface UsageLogDetailsProps {
  open: boolean;
  onClose: () => void;
  logId: string | null;
}

const UsageLogDetails: React.FC<UsageLogDetailsProps> = ({ open, onClose, logId }) => {
  const dispatch = useAppDispatch()
  const { tr, dateFnsLocale } = useI18n()
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)

  const { usageLogs, loading: loadingUsageLogsGlobal, error: errorUsageLogs } = useAppSelector((state) => state.usageLogs)
  const { assets: chambers, loading: loadingChambersGlobal, error: errorChambers } = useAppSelector((state) => state.assets)
  const { projects, loading: loadingProjectsGlobal, error: errorProjects } = useAppSelector((state) => state.projects)
  const { testProjects, loading: loadingTestProjectsGlobal, error: errorTestProjects } = useAppSelector((state) => state.testProjects)

  const [currentLog, setCurrentLog] = useState<UsageLog | null>(null);
  const [chamberName, setChamberName] = useState<string>('');
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);
  const [linkedTestProject, setLinkedTestProject] = useState<TestProject | null>(null);
  const [selectedConfigsDetails, setSelectedConfigsDetails] = useState<ConfigType[]>([]);
  const [internalProcessing, setInternalProcessing] = useState<boolean>(false);
  const [effectiveStatus, setEffectiveStatus] = useState<UsageLog['status'] | null>(null);
  const [displayError, setDisplayError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !logId) return
    dispatch(fetchUsageLogs())
    dispatch(fetchAssetsByType({ type: 'chamber' }))
    dispatch(fetchProjects())
    dispatch(fetchTestProjects())
  }, [open, logId, dispatch])

  // Effect 2: Process data and set local state
  useEffect(() => {
    if (!open || !logId) {
      // Reset states if dialog is closed or no logId
      setCurrentLog(null); setEffectiveStatus(null); setChamberName('');
      setLinkedProject(null); setLinkedTestProject(null); setSelectedConfigsDetails([]);
      setInternalProcessing(false); setDisplayError(null);
      return;
    }

    const anyGlobalDataLoading = loadingUsageLogsGlobal || loadingChambersGlobal || loadingProjectsGlobal || loadingTestProjectsGlobal;

    if (anyGlobalDataLoading) {
      setInternalProcessing(true);
      return;
    }

    // All global loads are false.
    setInternalProcessing(true);
    setDisplayError(null);

    const foundLog = usageLogs.find(l => l.id === logId);

    if (foundLog) {
      setCurrentLog(foundLog);
      setEffectiveStatus(getEffectiveUsageLogStatus(foundLog));
      // ... (rest of the logic to find chamber, project, testProject, configs)
        const foundChamber = chambers.find(c => c.id === foundLog.chamberId);
        setChamberName(foundChamber ? foundChamber.name : (foundLog.chamberId ? `ID: ${foundLog.chamberId}`: tr('未知', 'Unknown')));

        if (foundLog.projectId) {
            const foundProject = projects.find(p => p.id === foundLog.projectId);
            setLinkedProject(foundProject || null);
            if (foundProject && foundLog.selectedConfigIds && foundLog.selectedConfigIds.length > 0) {
                const configsFromProject = foundProject.configs || [];
                setSelectedConfigsDetails(
                    foundLog.selectedConfigIds
                        .map(configId => configsFromProject.find(c => c.id === configId))
                        .filter((c): c is ConfigType => c !== undefined)
                );
            } else {
                setSelectedConfigsDetails([]);
            }
        } else {
            setLinkedProject(null);
            setSelectedConfigsDetails([]);
        }

        if (foundLog.testProjectId) {
            const foundTestProject = testProjects.find(tp => tp.id === foundLog.testProjectId);
            setLinkedTestProject(foundTestProject || null);
        } else {
            setLinkedTestProject(null);
        }
    } else {
      // Log not found, but global loading is complete for usageLogs.
      if (!loadingUsageLogsGlobal) { // Double check usageLogs are not still loading
          setCurrentLog(null); setEffectiveStatus(null); setChamberName('');
          setLinkedProject(null); setLinkedTestProject(null); setSelectedConfigsDetails([]);
          setDisplayError(tr(`未找到记录 (ID: ${logId})。`, `Record not found (ID: ${logId}).`));
      } else {
          // This case implies usageLogs are still loading, so the outer 'anyGlobalDataLoading' should have caught it.
          // However, as a fallback, keep internalProcessing true.
          // console.log("[DetailsEffect2] Log not found, but usageLogsGlobal still loading? This shouldn't happen often here.");
      }
    }
    setInternalProcessing(false);

  }, [
    open, logId,
    usageLogs, chambers, projects, testProjects, // Data arrays themselves
    loadingUsageLogsGlobal, loadingChambersGlobal, loadingProjectsGlobal, loadingTestProjectsGlobal, tr
  ]);

  const handleMarkAsCompleted = () => {
    if (currentLog && currentLog.id) {
      setConfirmCompleteOpen(true);
    }
  };

  const handleConfirmComplete = () => {
    if (currentLog && currentLog.id) {
      dispatch(markLogAsCompleted(currentLog.id));
    }
    setConfirmCompleteOpen(false);
  };

  const anyGlobalError = errorUsageLogs || errorChambers || errorProjects || errorTestProjects;
  const showLoadingSpinner = open && (loadingUsageLogsGlobal || loadingChambersGlobal || loadingProjectsGlobal || loadingTestProjectsGlobal || internalProcessing);

  let dialogInnerContent;
   if (showLoadingSpinner) {
    dialogInnerContent = ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}> <CircularProgress /> <Typography sx={{ ml: 2 }}>{tr('正在加载详情...', 'Loading details...')}</Typography> </Box> );
  } else if (open && (anyGlobalError || displayError)) {
    dialogInnerContent = ( <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '300px', p:2, textAlign: 'center' }}> <Alert severity="error" sx={{mb: 2}}>{tr('加载详情时出错。', 'Failed to load details.')}</Alert> <Typography variant="body2" color="text.secondary"> {anyGlobalError || displayError} </Typography> </Box> );
  } else if (open && !currentLog && logId) {
    dialogInnerContent = ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}> <Typography color="text.secondary">{tr(`未找到指定的记录 (ID: ${logId})。`, `Record not found (ID: ${logId}).`)}</Typography> </Box> );
  } else if (currentLog && effectiveStatus) {
    dialogInnerContent = (
      <Box p={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h5" component="div">
            {chamberName}
          </Typography>
          <StatusChip kind="usage" status={effectiveStatus} size="medium" />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {tr('使用人', 'User')}
          </Typography>
          <Typography variant="body1">{currentLog?.user}</Typography>
          <Divider sx={{ my: 1.25 }} />
          <Typography variant="subtitle2" gutterBottom>
            {tr('使用时间', 'Time')}
          </Typography>
          <Typography variant="body1">
            {formatDateTimeShort(currentLog?.startTime, { fallback: 'N/A', locale: dateFnsLocale })} → {formatDateTimeShort(currentLog?.endTime, { fallback: 'N/A', locale: dateFnsLocale })}
          </Typography>
        </Paper>

        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {tr('关联项目', 'Project')}: {linkedProject ? linkedProject.name : (currentLog?.projectId ? `ID: ${currentLog?.projectId}` : tr('无', 'None'))}
          </Typography>
          {linkedProject?.customerName ? (
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {tr('客户', 'Customer')}: {linkedProject.customerName}
            </Typography>
          ) : null}
        </Paper>

        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {tr('使用的 Config(s)', 'Configs')}
          </Typography>
          {selectedConfigsDetails.length > 0 ? (
            <List dense disablePadding>
              {selectedConfigsDetails.map((config) => (
                <ListItem key={config.id} disableGutters dense sx={{ pt: 0, pb: 0.5 }}>
                  <MuiListItemText
                    primary={config.name}
                    secondary={config.remark || tr('无备注', 'No remark')}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {tr('此记录未指定 Config。', 'No configs selected.')}
            </Typography>
          )}
        </Paper>

        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {tr('使用的 WaterFall', 'Waterfall')}
          </Typography>
          {currentLog?.selectedWaterfall ? (
            <Chip label={currentLog.selectedWaterfall} size="small" color="secondary" variant="outlined" />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {tr('此记录未指定 WaterFall。', 'No waterfall selected.')}
            </Typography>
          )}
        </Paper>

        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {tr('关联测试项目', 'Test project')}: {linkedTestProject ? linkedTestProject.name : (currentLog?.testProjectId ? `ID: ${currentLog?.testProjectId}` : tr('无', 'None'))}
          </Typography>
          {linkedTestProject ? (
            <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flexBasis: 'calc(33.33% - 16px)' }}>
                <Typography variant="subtitle2">{tr('温度', 'Temperature')}:</Typography>
                <Typography variant="body1">{linkedTestProject.temperature}°C</Typography>
              </Box>
              <Box sx={{ flexBasis: 'calc(33.33% - 16px)' }}>
                <Typography variant="subtitle2">{tr('湿度', 'Humidity')}:</Typography>
                <Typography variant="body1">{linkedTestProject.humidity}%</Typography>
              </Box>
              <Box sx={{ flexBasis: 'calc(33.33% - 16px)' }}>
                <Typography variant="subtitle2">{tr('持续时间', 'Duration')}:</Typography>
                <Typography variant="body1">
                  {linkedTestProject.duration}
                  {tr('小时', 'h')}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </Paper>

        {currentLog?.notes ? (
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {tr('使用记录备注', 'Notes')}
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {currentLog.notes}
            </Typography>
          </Paper>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {tr('无使用记录备注。', 'No notes.')}
          </Typography>
        )}
      </Box>
    )
  } else {
    if (open && !logId) { dialogInnerContent = <Typography sx={{p:2}}>{tr('错误：未提供记录ID。', 'Error: missing log ID.')}</Typography>; }
    else if (open) { dialogInnerContent = <Typography sx={{p:2}}>{tr('数据准备中或记录不存在...', 'Preparing data or record not found...')}</Typography>; }
    else { dialogInnerContent = null; }
  }


  if (!open) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
         <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           {tr('使用记录详情', 'Usage log details')}
           {currentLog && (effectiveStatus === 'in-progress' || effectiveStatus === 'overdue') && (
              <Tooltip title={tr('标记为已完成', 'Mark as completed')}>
                <Button variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon />} onClick={handleMarkAsCompleted} size="small" >
                  {tr('标记完成', 'Complete')}
                </Button>
              </Tooltip>
            )}
         </DialogTitle>
         <DialogContent dividers>
           {dialogInnerContent}
         </DialogContent>
         <DialogActions>
           <Button onClick={onClose} color="primary">{tr('关闭', 'Close')}</Button>
         </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={confirmCompleteOpen}
        title={tr('确认完成', 'Mark completed')}
        description={tr('确定要将此记录标记为 "已完成" 吗？', 'Mark this log as "Completed"?')}
        confirmText={tr('确认完成', 'Complete')}
        confirmColor="success"
        onClose={() => setConfirmCompleteOpen(false)}
        onConfirm={handleConfirmComplete}
      />
    </>
  );
};

export default UsageLogDetails;
