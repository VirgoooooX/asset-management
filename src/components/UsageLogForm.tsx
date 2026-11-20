// src/components/UsageLogForm.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Box,
  FormHelperText, CircularProgress, Alert, Chip, OutlinedInput, Checkbox,
  ListItemText as MuiListItemText,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { addHours, parseISO } from 'date-fns';

import { UsageLog, Config as ConfigType } from '../types';
import { addUsageLog, updateUsageLog } from '../store/usageLogsSlice';
import { fetchProjects } from '../store/projectsSlice';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { fetchAssetsByType } from '../store/assetsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useI18n } from '../i18n';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

interface UsageLogFormProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  log?: UsageLog;
}

const UsageLogForm: React.FC<UsageLogFormProps> = ({ open, onClose, log }) => {
  const dispatch = useAppDispatch();
  const { tr } = useI18n();

  const { projects, loading: loadingProjects, error: projectsError } = useAppSelector((state) => state.projects);
  const { testProjects, loading: loadingAllTestProjects, error: testProjectsError } = useAppSelector((state) => state.testProjects);
  const { assets: chambers, loading: loadingChambers, error: chambersError } = useAppSelector((state) => state.assets);

  const [selectedChamberId, setSelectedChamberId] = useState<string>('');
  const [actualProjectId, setActualProjectId] = useState<string>('');
  const [actualTestProjectId, setActualTestProjectId] = useState<string>('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [user, setUser] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<UsageLog['status']>('not-started');
  const [tempSelectedProjectIdForCascading, setTempSelectedProjectIdForCascading] = useState<string>('');
  const [tempSelectedConfigs, setTempSelectedConfigs] = useState<string[]>([]);
  const [tempSelectedWaterfall, setTempSelectedWaterfall] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  const [availableConfigs, setAvailableConfigs] = useState<ConfigType[]>([]);
  const [availableWaterfalls, setAvailableWaterfalls] = useState<string[]>([]);
  const initializedKeyRef = useRef<string | null>(null);

  const selectedChamberCategory = useMemo(() => {
    const chamber = chambers.find((c) => c.id === selectedChamberId);
    return chamber?.category?.trim() || '';
  }, [chambers, selectedChamberId]);

  const filteredTestProjects = useMemo(() => {
    if (!selectedChamberCategory) return testProjects;
    return testProjects.filter((tp) => {
      const categories = tp.assetCategories || [];
      if (categories.length === 0) return true;
      return categories.includes(selectedChamberCategory);
    });
  }, [selectedChamberCategory, testProjects]);

  useEffect(() => {
    if (open) {
      dispatch(fetchAssetsByType({ type: 'chamber' }));
      dispatch(fetchProjects());
      dispatch(fetchTestProjects());
    }
  }, [open, dispatch]);

  useEffect(() => {
    if (!open) {
      initializedKeyRef.current = null;
      return;
    }
    const initKey = log?.id ? `edit:${log.id}` : 'create';
    if (initializedKeyRef.current === initKey) return;
    initializedKeyRef.current = initKey;

    setFormSubmitError(null);
    setErrors({});
    if (log) {
      setSelectedChamberId(log.chamberId || (chambers.length > 0 ? chambers[0].id : ''));
      setTempSelectedProjectIdForCascading(log.projectId || '');
      setActualProjectId(log.projectId || '');
      setActualTestProjectId(log.testProjectId || '');
      setTempSelectedConfigs(Array.isArray(log.selectedConfigIds) ? log.selectedConfigIds : []);
      setTempSelectedWaterfall(log.selectedWaterfall || '');
      setStartTime(log.startTime ? parseISO(log.startTime) : new Date());
      setEndTime(log.endTime ? parseISO(log.endTime) : null);
      setUser(log.user || '');
      setNotes(log.notes || '');
      setStatus(log.status || 'not-started');
    } else {
      setSelectedChamberId(chambers.length > 0 ? chambers[0].id : '');
      setTempSelectedProjectIdForCascading('');
      setActualProjectId('');
      setActualTestProjectId('');
      setTempSelectedConfigs([]);
      setTempSelectedWaterfall('');
      setStartTime(new Date());
      setEndTime(null);
      setUser('');
      setNotes('');
      setStatus('not-started');
    }
  }, [log, open, chambers]);

  useEffect(() => {
    if (open && !log && !selectedChamberId && chambers.length > 0) {
      setSelectedChamberId(chambers[0].id);
    }
  }, [open, log, selectedChamberId, chambers]);

  useEffect(() => {
    if (tempSelectedProjectIdForCascading) {
      const currentProject = projects.find((p) => p.id === tempSelectedProjectIdForCascading);
      if (currentProject) {
        setAvailableConfigs(currentProject.configs || []);
        setAvailableWaterfalls(currentProject.wfs || []);
      } else {
        setAvailableConfigs([]);
        setAvailableWaterfalls([]);
      }
    } else {
      setAvailableConfigs([]);
      setAvailableWaterfalls([]);
    }
  }, [tempSelectedProjectIdForCascading, projects]);

  useEffect(() => {
    if (!actualTestProjectId) return;
    const stillAllowed = filteredTestProjects.some((tp) => tp.id === actualTestProjectId);
    if (!stillAllowed) setActualTestProjectId('');
  }, [actualTestProjectId, filteredTestProjects]);

  useEffect(() => {
    if (startTime && actualTestProjectId) {
      const testProject = testProjects.find((tp) => tp.id === actualTestProjectId);
      if (testProject && typeof testProject.duration === 'number' && testProject.duration > 0) {
        setEndTime(addHours(startTime, testProject.duration));
      } else {
        setEndTime(null);
      }
    } else if (!actualTestProjectId && startTime) {
      setEndTime(null);
    }
  }, [startTime, actualTestProjectId, testProjects]);

  const handleProjectDropdownChange = (event: SelectChangeEvent<string>) => {
    const newProjectId = event.target.value;
    setTempSelectedProjectIdForCascading(newProjectId);
    setActualProjectId(newProjectId);
    setActualTestProjectId('');
    setTempSelectedConfigs([]);
    setTempSelectedWaterfall('');
    setEndTime(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedChamberId) newErrors.chamberId = tr('请选择环境箱', 'Please select an asset');
    if (!actualProjectId) newErrors.project = tr('请选择项目名（用于关联）', 'Please select a project');
    if (!startTime) newErrors.startTime = tr('请选择开始时间', 'Please select a start time');
    if (!endTime) newErrors.endTime = tr('请选择或等待自动计算结束时间', 'Please select or wait for auto-calculated end time');
    if (startTime && endTime && endTime < startTime) newErrors.endTime = tr('结束时间不能早于开始时间', 'End time cannot be earlier than start time');
    if (!user.trim()) newErrors.user = tr('请输入使用人', 'Please enter user name');
    if (!status) newErrors.status = tr('请选择状态', 'Please select status');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    if (!validateForm()) return;

    const usageLogPayload: Omit<UsageLog, 'id' | 'createdAt'> = {
      chamberId: selectedChamberId,
      projectId: actualProjectId || undefined,
      testProjectId: actualTestProjectId || undefined,
      startTime: startTime!.toISOString(),
      endTime: endTime ? endTime.toISOString() : undefined,
      user: user.trim(),
      status,
      notes: notes.trim() || undefined,
      selectedConfigIds: tempSelectedConfigs.length > 0 ? tempSelectedConfigs : undefined,
      selectedWaterfall: tempSelectedWaterfall || undefined,
    };

    try {
      if (log && log.id) {
        await dispatch(updateUsageLog({ id: log.id, log: usageLogPayload })).unwrap();
      } else {
        await dispatch(addUsageLog(usageLogPayload)).unwrap();
      }
      onClose(true);
    } catch (error: any) {
      console.error('提交使用记录失败:', error);
      setFormSubmitError(error.message || tr('操作失败，请稍后再试。', 'Operation failed. Please try again later.'));
    }
  };

  const isLoadingInitialData = loadingChambers || loadingProjects || loadingAllTestProjects;

  return (
    <Dialog open={open} onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{log ? tr('编辑使用记录', 'Edit usage log') : tr('登记使用记录', 'New usage log')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {isLoadingInitialData && open && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} /> {tr('加载选项...', 'Loading options...')}
            </Box>
          )}
          <Box display="flex" flexDirection="column" gap={2.5} paddingTop={1}>
            <FormControl fullWidth required error={!!errors.chamberId} disabled={isLoadingInitialData}>
              <InputLabel id="chamber-select-label">{tr('环境箱', 'Asset')}</InputLabel>
              <Select
                labelId="chamber-select-label"
                value={selectedChamberId}
                label={tr('环境箱', 'Asset')}
                onChange={(e) => setSelectedChamberId(e.target.value)}
              >
                {chambers.length === 0 && <MenuItem disabled>{tr('暂无环境箱', 'No assets')}</MenuItem>}
                {chambers.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>))}
              </Select>
              {errors.chamberId && <FormHelperText>{errors.chamberId}</FormHelperText>}
              {chambersError && <FormHelperText error>{tr(`加载环境箱失败: ${chambersError}`, `Failed to load assets: ${chambersError}`)}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth required error={!!errors.project} disabled={isLoadingInitialData}>
              <InputLabel id="project-name-label">{tr('项目名 (用于关联)', 'Project (required)')}</InputLabel>
              <Select
                labelId="project-name-label"
                value={actualProjectId}
                label={tr('项目名 (用于关联)', 'Project (required)')}
                onChange={handleProjectDropdownChange}
              >
                <MenuItem value=""><em>{tr('请选择项目', 'Select a project')}</em></MenuItem>
                {projects.map((p) => (<MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>))}
              </Select>
              {errors.project && <FormHelperText>{errors.project}</FormHelperText>}
              {projectsError && <FormHelperText error>{tr(`加载项目失败: ${projectsError}`, `Failed to load projects: ${projectsError}`)}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth disabled={isLoadingInitialData || filteredTestProjects.length === 0}>
              <InputLabel id="test-project-name-label">{tr('测试项目名 (可选)', 'Test project (optional)')}</InputLabel>
              <Select
                labelId="test-project-name-label"
                value={actualTestProjectId}
                label={tr('测试项目名 (可选)', 'Test project (optional)')}
                onChange={(e) => setActualTestProjectId(e.target.value)}
              >
                <MenuItem value=""><em>{tr('无', 'None')}</em></MenuItem>
                {filteredTestProjects.map((tp) => (<MenuItem key={tp.id} value={tp.id}>{tp.name}</MenuItem>))}
              </Select>
              {testProjectsError && <FormHelperText error>{tr(`加载测试项目失败: ${testProjectsError}`, `Failed to load test projects: ${testProjectsError}`)}</FormHelperText>}
              {filteredTestProjects.length === 0 && !loadingAllTestProjects && <FormHelperText>{tr('暂无可用测试项目', 'No test projects')}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth disabled={isLoadingInitialData || !tempSelectedProjectIdForCascading || availableConfigs.length === 0}>
              <InputLabel id="config-multiselect-label">{tr('Config (可选, 辅助信息)', 'Config (optional)')}</InputLabel>
              <Select
                labelId="config-multiselect-label"
                multiple
                value={tempSelectedConfigs}
                onChange={(e) => setTempSelectedConfigs(e.target.value as string[])}
                input={<OutlinedInput label={tr('Config (可选, 辅助信息)', 'Config (optional)')} />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const config = availableConfigs.find((c) => c.id === value);
                      return <Chip key={value} label={config?.name || value} size="small" />;
                    })}
                  </Box>
                )}
                MenuProps={MenuProps}
              >
                {availableConfigs.length === 0 && tempSelectedProjectIdForCascading && <MenuItem disabled>{tr('此项目无可用Config', 'No configs for this project')}</MenuItem>}
                {availableConfigs.map((config) => (
                  <MenuItem key={config.id} value={config.id}>
                    <Checkbox checked={tempSelectedConfigs.indexOf(config.id) > -1} />
                    <MuiListItemText primary={config.name} secondary={config.remark} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth disabled={isLoadingInitialData || !tempSelectedProjectIdForCascading || availableWaterfalls.length === 0}>
              <InputLabel id="waterfall-select-label">{tr('WaterFall (可选, 辅助信息)', 'WaterFall (optional)')}</InputLabel>
              <Select
                labelId="waterfall-select-label"
                value={tempSelectedWaterfall}
                label={tr('WaterFall (可选, 辅助信息)', 'WaterFall (optional)')}
                onChange={(e) => setTempSelectedWaterfall(e.target.value)}
              >
                <MenuItem value=""><em>{tr('无', 'None')}</em></MenuItem>
                {availableWaterfalls.length === 0 && tempSelectedProjectIdForCascading && <MenuItem disabled>{tr('此项目无可用WaterFall', 'No waterfalls for this project')}</MenuItem>}
                {availableWaterfalls.map((wf) => (<MenuItem key={wf} value={wf}>{wf}</MenuItem>))}
              </Select>
            </FormControl>

            <DateTimePicker
              label={tr('开始时间', 'Start time')}
              value={startTime}
              onChange={(newValue) => setStartTime(newValue)}
              slotProps={{ textField: { fullWidth: true, required: true, error: !!errors.startTime, helperText: errors.startTime } }}
            />
            <DateTimePicker
              label={tr('结束时间', 'End time')}
              value={endTime}
              onChange={(newValue) => setEndTime(newValue)}
              minDateTime={startTime || undefined}
              slotProps={{ textField: { fullWidth: true, required: true, error: !!errors.endTime, helperText: errors.endTime } }}
            />

            <TextField
              label={tr('使用人', 'User')}
              value={user}
              onChange={(e) => setUser(e.target.value)}
              fullWidth
              required
              error={!!errors.user}
              helperText={errors.user}
            />

            <FormControl fullWidth required error={!!errors.status}>
              <InputLabel id="status-select-label">{tr('状态', 'Status')}</InputLabel>
              <Select
                labelId="status-select-label"
                value={status}
                label={tr('状态', 'Status')}
                onChange={(e) => setStatus(e.target.value as UsageLog['status'])}
              >
                <MenuItem value="not-started">{tr('未开始', 'Not started')}</MenuItem>
                <MenuItem value="in-progress">{tr('进行中', 'In progress')}</MenuItem>
                <MenuItem value="completed">{tr('已完成', 'Completed')}</MenuItem>
                <MenuItem value="overdue">{tr('已超时', 'Overdue')}</MenuItem>
              </Select>
              {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
            </FormControl>

            <TextField label={tr('备注', 'Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={3} />

            {formSubmitError && (<Alert severity="error" sx={{ mt: 1 }}>{formSubmitError}</Alert>)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose()}>{tr('取消', 'Cancel')}</Button>
          <Button type="submit" variant="contained" color="primary">
            {log ? tr('保存更改', 'Save changes') : tr('登记记录', 'Create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UsageLogForm;
