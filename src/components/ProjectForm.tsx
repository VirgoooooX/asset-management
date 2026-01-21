// src/components/ProjectForm.tsx
import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Snackbar,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Project, Config } from '../types'; // Config 类型现在包含 remark
import { addProject, updateProject } from '../store/projectsSlice';
import { AppDispatch } from '../store';

interface ProjectFormProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  project?: Project;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ open, onClose, project }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [configs, setConfigs] = useState<Config[]>([]);
  const [wfs, setWfs] = useState<string[]>([]); // 如果类型中 wfs 改名，这里也要改

  // 新配置表单状态
  const [configName, setConfigName] = useState('');
  // const [configParams, setConfigParams] = useState(''); // 旧的参数状态
  const [configRemark, setConfigRemark] = useState(''); // 新的备注状态

  // 新工作流状态
  const [newWf, setNewWf] = useState('');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (open) {
      setFormSubmitError(null);
      if (project) {
        setName(project.name);
        setDescription(project.description || '');
        setCustomerName(project.customerName || '');
        setConfigs(project.configs || []);
        setWfs(project.wfs || []); // 如果类型中 wfs 改名，这里也要改
      } else {
        setName('');
        setDescription('');
        setCustomerName('');
        setConfigs([]);
        setWfs([]);
      }
      setConfigName('');
      // setConfigParams(''); // 清除旧参数状态
      setConfigRemark(''); // 清除新备注状态
      setNewWf('');
      setSnackbarOpen(false);
    }
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
  
    if (!name.trim()) {
      setFormSubmitError("项目名称不能为空");
      return;
    }
  
    const projectDataForDispatch: Omit<Project, 'id' | 'createdAt'> = {
      name: name.trim(),
      description: description.trim() || undefined,
      customerName: customerName.trim() || undefined,
      configs, 
      wfs: wfs.length > 0 ? wfs : [], 
    };
    
    try {
      if (project && project.id) { 
        await dispatch(updateProject({ 
          id: project.id, 
          project: projectDataForDispatch 
        })).unwrap();
      } else { 
        await dispatch(addProject(projectDataForDispatch)).unwrap();
      }
      onClose(true); 
    } catch (error: any) {
      console.error('ProjectForm: Submit error:', error); // 打印 Thunk 返回的错误
      setFormSubmitError(error.message || '操作失败，请稍后再试。');
    }
  };

  const handleAddConfig = () => {
    if (!configName.trim()) {
      setSnackbarMessage('Config 名称不能为空');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    const trimmedRemark = configRemark.trim(); // 先 trim
    
    const newConfigData: { id: string; name: string; remark?: string } = { // 定义一个临时类型
      id: `config-${Date.now()}-${Math.random()}`, 
      name: configName.trim(), 
    };
  
    // 只有当 remark 有实际内容时才添加它
    if (trimmedRemark) {
      newConfigData.remark = trimmedRemark;
    }
    // 如果 trimmedRemark 为空，newConfigData 中就不会有 remark 字段
  
    setConfigs([...configs, newConfigData as Config]); // 类型断言回 Config
    setConfigName('');
    setConfigRemark('');
  };

  const handleDeleteConfig = (id: string) => {
    setConfigs(configs.filter(config => config.id !== id));
  };

  const handleAddWf = () => { // "Wf" 可以考虑是否也改为 "WaterFall Item" 之类的
    if (!newWf.trim()) {
      setSnackbarMessage('WaterFall 名称不能为空');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    if (wfs.includes(newWf.trim())) {
      setSnackbarMessage('该 WaterFall 已存在');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    setWfs([...wfs, newWf.trim()]);
    setNewWf('');
  };

  const handleDeleteWf = (wfToRemove: string) => {
    setWfs(wfs.filter(item => item !== wfToRemove));
  };

  return (
    <Dialog open={open} onClose={() => onClose()} maxWidth="md" fullWidth>
      <DialogTitle>{project ? '编辑项目' : '添加新项目'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField label="项目名称" value={name} onChange={(e) => setName(e.target.value)} fullWidth required autoFocus />
            <TextField label="项目描述" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={3} />
            <TextField label="客户名称" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />
            
            <Divider sx={{ my: 2 }} />

            {/* Config 管理 */}
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>Config</Typography> {/* 修改标题 */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ mb: 1 }}
              >
                <TextField
                  label="新 Config 名称"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="备注 (可选)"
                  value={configRemark}
                  onChange={(e) => setConfigRemark(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ flex: 1.5 }}
                />
                <Button
                  onClick={handleAddConfig}
                  variant="outlined"
                  size="small"
                  sx={{ minWidth: { xs: '100%', sm: 120 }, whiteSpace: 'nowrap' }}
                >
                  添加 Config
                </Button>
              </Stack>
              <List dense>
                {configs.map((config) => (
                  <ListItem
                    key={config.id}
                    sx={{ py: 0.5 }}
                    secondaryAction={
                      <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteConfig(config.id)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 650 }} noWrap>
                            {config.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                            {config.remark ? config.remark : '无备注'}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
                {configs.length === 0 && (
                  <ListItem sx={{ py: 0.5 }}>
                    <ListItemText
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      primary="暂无 Config"
                    />
                  </ListItem>
                )}
              </List>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* WaterFall 管理 */}
            <Box>
              <Typography variant="h6" gutterBottom>WaterFall</Typography> {/* 修改标题 */}
              <Box display="flex" gap={1} mb={1} alignItems="center">
                <TextField label="新 WaterFall 名称" value={newWf} onChange={(e) => setNewWf(e.target.value)} sx={{flexGrow: 1}}/> {/* 修改标签 */}
                <Button onClick={handleAddWf} variant="outlined" size="medium">添加 WaterFall</Button> {/* 修改按钮文本 */}
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {wfs.map((wf, index) => ( <Chip key={index} label={wf} onDelete={() => handleDeleteWf(wf)} color="primary" /> ))}
                {wfs.length === 0 && <Typography variant="body2" color="text.secondary">暂无 WaterFall</Typography>} {/* 修改提示 */}
              </Box>
            </Box>

            {formSubmitError && ( <Alert severity="error" sx={{ mt: 2 }}>{formSubmitError}</Alert> )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose()}>取消</Button>
          <Button type="submit" variant="contained" color="primary">
            {project ? '保存更改' : '确认添加'}
          </Button>
        </DialogActions>
      </form>
      <Snackbar open={snackbarOpen} autoHideDuration={3500} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default ProjectForm;
