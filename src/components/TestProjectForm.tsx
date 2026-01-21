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
  FormHelperText,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { TestProject, Project } from '../types'; // 导入 Project 类型
import { addTestProject, updateTestProject } from '../store/testProjectsSlice';
import { fetchProjects } from '../store/projectsSlice'; // 导入用于获取项目列表的 action
import { useAppDispatch, useAppSelector } from '../store/hooks'

interface TestProjectFormProps {
  open: boolean;
  onClose: () => void;
  testProject?: TestProject; // 传入表示编辑模式
}

const TestProjectForm: React.FC<TestProjectFormProps> = ({ open, onClose, testProject }) => {
  const dispatch = useAppDispatch()
  const { projects, loading: loadingProjects, error: projectsError } = useAppSelector((state) => state.projects) // 获取项目列表用于关联

  // 表单字段状态
  const [name, setName] = useState('');
  const [temperature, setTemperature] = useState<string>(''); // 用字符串处理输入，提交时转换
  const [humidity, setHumidity] = useState<string>('');     // 用字符串处理输入，提交时转换
  const [duration, setDuration] = useState<string>('');     // 用字符串处理输入，提交时转换
  const [projectId, setProjectId] = useState<string>('');   // 关联的项目 ID (可选)

  // 错误状态
  const [errors, setErrors] = useState({
    name: '',
    temperature: '',
    humidity: '',
    duration: '',
  });
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  // 获取项目列表 Effect
  useEffect(() => {
    if (open && projects.length === 0 && !loadingProjects) {
      dispatch(fetchProjects());
    }
  }, [open, dispatch, projects.length, loadingProjects]);

  // 初始化/重置表单 Effect
  useEffect(() => {
    if (open) {
      setFormSubmitError(null); // 清除提交错误
      if (testProject) { // 编辑模式
        setName(testProject.name);
        setTemperature(String(testProject.temperature));
        setHumidity(String(testProject.humidity));
        setDuration(String(testProject.duration));
        setProjectId(testProject.projectId || '');
      } else { // 新建模式
        setName('');
        setTemperature('');
        setHumidity('');
        setDuration('');
        setProjectId('');
      }
      setErrors({ name: '', temperature: '', humidity: '', duration: '' }); // 重置校验错误
    }
  }, [testProject, open]); // 依赖 testProject 和 open

  // 表单校验函数
  const validateForm = (): boolean => {
    const newErrors = {
      name: !name.trim() ? '名称不能为空' : '',
      temperature: !temperature.trim() ? '温度不能为空' : (isNaN(Number(temperature)) ? '温度必须是数字' : ''),
      humidity: !humidity.trim() ? '湿度不能为空' : (isNaN(Number(humidity)) ? '湿度必须是数字' : ''),
      duration: !duration.trim() ? '持续时间不能为空' : (isNaN(Number(duration)) ? '持续时间必须是数字' : ''),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== ''); // 检查是否有错误
  };

  // 提交处理函数
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);

    if (!validateForm()) {
      return;
    }

    // 准备提交的数据 (不包含 id 和 createdAt)
    const testProjectData = {
      name: name.trim(),
      temperature: Number(temperature),
      humidity: Number(humidity),
      duration: Number(duration),
      projectId: projectId || undefined, // 如果为空字符串，则设为 undefined
    };

    try {
      if (testProject && testProject.id) { // 编辑模式
        await dispatch(updateTestProject({ 
          id: testProject.id, 
          testProject: testProjectData // service 层会忽略 createdAt
        })).unwrap();
      } else { // 新建模式
        // addTestProject thunk 需要 Omit<TestProject, 'id' | 'createdAt'>
        await dispatch(addTestProject(testProjectData)).unwrap();
      }
      onClose(); // 成功后关闭
    } catch (error: any) {
      console.error('提交测试项目失败:', error);
      setFormSubmitError(error.message || '操作失败，请检查输入或稍后再试。');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{testProject ? '编辑测试项目' : '添加测试项目'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {/* 如果项目列表正在加载，显示提示 */}
          {loadingProjects && open && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 2 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} /> 正在加载项目列表...
            </Box>
          )}
           {/* 如果项目列表加载出错，显示提示 */}
          {projectsError && open && (
             <Alert severity="warning" sx={{ mb: 2 }}>
                加载关联项目列表失败: {projectsError}。 您仍然可以保存，但无法关联项目。
             </Alert>
          )}

          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {/* 名称 */}
            <TextField
              label="名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name}
              autoFocus // 进入时自动聚焦
            />

            {/* 温度 */}
            <TextField
              label="温度 (°C)"
              type="number" // 使用 number 类型输入，浏览器可能提供 +/- 按钮
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              fullWidth
              required
              error={!!errors.temperature}
              helperText={errors.temperature}
              InputProps={{ // 可以添加 inputProps 来设置步长等（可选）
                // inputProps: { step: 0.1 } 
              }}
            />

            {/* 湿度 */}
            <TextField
              label="湿度 (%)"
              type="number"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              fullWidth
              required
              error={!!errors.humidity}
              helperText={errors.humidity}
              InputProps={{
                inputProps: { min: 0, max: 100 } // 示例：限制输入范围
              }}
            />

            {/* 持续时间 */}
            <TextField
              label="持续时间 (小时)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              fullWidth
              required
              error={!!errors.duration}
              helperText={errors.duration}
               InputProps={{
                inputProps: { min: 0 } // 示例：限制输入范围
              }}
            />

            {/* 关联项目 */}
            <FormControl fullWidth disabled={loadingProjects || !!projectsError}>
              <InputLabel id="project-select-label">关联项目 (可选)</InputLabel>
              <Select
                labelId="project-select-label"
                value={projectId}
                label="关联项目 (可选)"
                onChange={(e: SelectChangeEvent<string>) => setProjectId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">
                  <em>无</em>
                </MenuItem>
                {projects.map((project: Project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
              {/* 可以添加加载或错误时的提示 */}
              {loadingProjects && <FormHelperText>正在加载项目列表...</FormHelperText>}
               {projectsError && <FormHelperText error>无法加载项目列表</FormHelperText>}
            </FormControl>

            {/* 显示提交错误 */}
            {formSubmitError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {formSubmitError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button type="submit" variant="contained">
            {testProject ? '保存更改' : '添加项目'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TestProjectForm;
