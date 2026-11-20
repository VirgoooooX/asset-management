// src/components/TestProjectForm.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Chip,
  FormHelperText,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { useI18n } from '../i18n';
import { fetchAssetsByType } from '../store/assetsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProjects } from '../store/projectsSlice';
import { addTestProject, updateTestProject } from '../store/testProjectsSlice';
import { TestProject, Project } from '../types';

interface TestProjectFormProps {
  open: boolean;
  onClose: () => void;
  testProject?: TestProject;
}

const TestProjectForm: React.FC<TestProjectFormProps> = ({ open, onClose, testProject }) => {
  const dispatch = useAppDispatch();
  const { tr } = useI18n();
  const { projects, loading: loadingProjects, error: projectsError } = useAppSelector((state) => state.projects);
  const chambers = useAppSelector((state) => state.assets.assets);

  const [name, setName] = useState('');
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [assetCategoriesInput, setAssetCategoriesInput] = useState<string>('');

  const [errors, setErrors] = useState({
    name: '',
    temperature: '',
    humidity: '',
    duration: '',
  });
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    dispatch(fetchProjects());
    dispatch(fetchAssetsByType({ type: 'chamber' }));
  }, [open, dispatch]);

  useEffect(() => {
    if (open) {
      setFormSubmitError(null);
      if (testProject) {
        setName(testProject.name);
        setTemperature(String(testProject.temperature));
        setHumidity(String(testProject.humidity));
        setDuration(String(testProject.duration));
        setProjectId(testProject.projectId || '');
        setAssetCategoriesInput((testProject.assetCategories || []).join(', '));
      } else {
        setName('');
        setTemperature('');
        setHumidity('');
        setDuration('');
        setProjectId('');
        setAssetCategoriesInput('');
      }
      setErrors({ name: '', temperature: '', humidity: '', duration: '' });
    }
  }, [testProject, open]);

  const validateForm = (): boolean => {
    const newErrors = {
      name: !name.trim() ? tr('名称不能为空', 'Name is required') : '',
      temperature: !temperature.trim()
        ? tr('温度不能为空', 'Temperature is required')
        : isNaN(Number(temperature))
          ? tr('温度必须是数字', 'Temperature must be a number')
          : '',
      humidity: !humidity.trim()
        ? tr('湿度不能为空', 'Humidity is required')
        : isNaN(Number(humidity))
          ? tr('湿度必须是数字', 'Humidity must be a number')
          : '',
      duration: !duration.trim()
        ? tr('持续时间不能为空', 'Duration is required')
        : isNaN(Number(duration))
          ? tr('持续时间必须是数字', 'Duration must be a number')
          : '',
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);

    if (!validateForm()) {
      return;
    }

    const assetCategories = Array.from(
      new Set(
        assetCategoriesInput
          .split(/[,，]/g)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
    const testProjectData = {
      name: name.trim(),
      temperature: Number(temperature),
      humidity: Number(humidity),
      duration: Number(duration),
      projectId: projectId || undefined,
      assetCategories: assetCategories.length > 0 ? assetCategories : undefined,
    };

    try {
      if (testProject && testProject.id) {
        await dispatch(
          updateTestProject({
            id: testProject.id,
            testProject: testProjectData,
          })
        ).unwrap();
      } else {
        await dispatch(addTestProject(testProjectData)).unwrap();
      }
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || '');
      console.error('提交测试项目失败:', error);
      setFormSubmitError(msg || tr('操作失败，请检查输入或稍后再试。', 'Operation failed, please check your input or try again.'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{testProject ? tr('编辑测试项目', 'Edit test project') : tr('添加测试项目', 'Add test project')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {loadingProjects && open && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 2 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} /> {tr('正在加载项目列表...', 'Loading projects...')}
            </Box>
          )}
          {projectsError && open && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {tr(
                `加载关联项目列表失败: ${projectsError}。 您仍然可以保存，但无法关联项目。`,
                `Failed to load projects: ${projectsError}. You can still save without linking a project.`
              )}
            </Alert>
          )}

          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label={tr('名称', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name}
              autoFocus
            />

            <TextField
              label={tr('温度 (°C)', 'Temperature (°C)')}
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              fullWidth
              required
              error={!!errors.temperature}
              helperText={errors.temperature}
            />

            <TextField
              label={tr('湿度 (%)', 'Humidity (%)')}
              type="number"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              fullWidth
              required
              error={!!errors.humidity}
              helperText={errors.humidity}
              InputProps={{
                inputProps: { min: 0, max: 100 },
              }}
            />

            <TextField
              label={tr('持续时间 (小时)', 'Duration (hours)')}
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              fullWidth
              required
              error={!!errors.duration}
              helperText={errors.duration}
              InputProps={{
                inputProps: { min: 0 },
              }}
            />

            <FormControl fullWidth disabled={loadingProjects || !!projectsError}>
              <InputLabel id="project-select-label">{tr('关联项目 (可选)', 'Linked project (optional)')}</InputLabel>
              <Select
                labelId="project-select-label"
                value={projectId}
                label={tr('关联项目 (可选)', 'Linked project (optional)')}
                onChange={(e: SelectChangeEvent<string>) => setProjectId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">
                  <em>{tr('无', 'None')}</em>
                </MenuItem>
                {projects.map((project: Project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
              {loadingProjects && <FormHelperText>{tr('正在加载项目列表...', 'Loading projects...')}</FormHelperText>}
              {projectsError && <FormHelperText error>{tr('无法加载项目列表', 'Failed to load projects')}</FormHelperText>}
            </FormControl>

            <TextField
              label={tr('适用设备类型（可选）', 'Asset categories (optional)')}
              value={assetCategoriesInput}
              onChange={(e) => setAssetCategoriesInput(e.target.value)}
              fullWidth
              helperText={tr('多个类型用逗号分隔；留空表示所有设备都可用', 'Separate multiple categories with commas; leave empty for all assets')}
              placeholder={tr('例如：T/H Chamber, LH Chamber', 'e.g. T/H Chamber, LH Chamber')}
            />

            {chambers.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Array.from(
                  new Set(
                    chambers
                      .map((c) => c.category?.trim())
                      .filter((v): v is string => Boolean(v))
                  )
                ).map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const normalized = c.trim();
                      if (!normalized) return;
                      const current = assetCategoriesInput
                        .split(/[,，]/g)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (current.includes(normalized)) return;
                      const next = current.concat([normalized]).join(', ');
                      setAssetCategoriesInput(next);
                    }}
                  />
                ))}
              </Box>
            ) : null}

            {formSubmitError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {formSubmitError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{tr('取消', 'Cancel')}</Button>
          <Button type="submit" variant="contained">
            {testProject ? tr('保存更改', 'Save changes') : tr('添加项目', 'Create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TestProjectForm;
