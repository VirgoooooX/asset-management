// src/components/ProjectForm.tsx
import React, { useState, useEffect } from 'react';
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
  Chip,
  Alert,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useI18n } from '../i18n';
import { useAppDispatch } from '../store/hooks';
import { addProject, updateProject } from '../store/projectsSlice';
import { Project, Config } from '../types';
import { useToast } from './ToastProvider';

interface ProjectFormProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  project?: Project;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ open, onClose, project }) => {
  const dispatch = useAppDispatch();
  const { tr } = useI18n();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [configs, setConfigs] = useState<Config[]>([]);
  const [wfs, setWfs] = useState<string[]>([]);

  const [configName, setConfigName] = useState('');
  const [configRemark, setConfigRemark] = useState('');

  const [newWf, setNewWf] = useState('');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormSubmitError(null);
      if (project) {
        setName(project.name);
        setDescription(project.description || '');
        setCustomerName(project.customerName || '');
        setConfigs(project.configs || []);
        setWfs(project.wfs || []);
      } else {
        setName('');
        setDescription('');
        setCustomerName('');
        setConfigs([]);
        setWfs([]);
      }
      setConfigName('');
      setConfigRemark('');
      setNewWf('');
    }
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);

    if (!name.trim()) {
      setFormSubmitError(tr('项目名称不能为空', 'Project name is required'));
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
        await dispatch(
          updateProject({
            id: project.id,
            project: projectDataForDispatch,
          })
        ).unwrap();
        toast.success(tr('项目信息已更新', 'Project updated.'));
      } else {
        await dispatch(addProject(projectDataForDispatch)).unwrap();
        toast.success(tr('项目已创建', 'Project created.'));
      }
      onClose(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || '');
      console.error('ProjectForm: Submit error:', error);
      setFormSubmitError(msg || tr('操作失败，请稍后再试。', 'Operation failed, please try again later.'));
    }
  };

  const handleAddConfig = () => {
    if (!configName.trim()) {
      toast.error(tr('Config 名称不能为空', 'Config name is required'));
      return;
    }

    const trimmedRemark = configRemark.trim();

    const newConfigData: { id: string; name: string; remark?: string } = {
      id: `config-${Date.now()}-${Math.random()}`,
      name: configName.trim(),
    };

    if (trimmedRemark) {
      newConfigData.remark = trimmedRemark;
    }

    setConfigs([...configs, newConfigData as Config]);
    setConfigName('');
    setConfigRemark('');
  };

  const handleDeleteConfig = (id: string) => {
    setConfigs(configs.filter((config) => config.id !== id));
  };

  const handleAddWf = () => {
    if (!newWf.trim()) {
      toast.error(tr('WaterFall 名称不能为空', 'WaterFall name is required'));
      return;
    }
    if (wfs.includes(newWf.trim())) {
      toast.error(tr('该 WaterFall 已存在', 'This WaterFall already exists'));
      return;
    }
    setWfs([...wfs, newWf.trim()]);
    setNewWf('');
  };

  const handleDeleteWf = (wfToRemove: string) => {
    setWfs(wfs.filter((item) => item !== wfToRemove));
  };

  return (
    <Dialog open={open} onClose={() => onClose()} maxWidth="md" fullWidth>
      <DialogTitle>{project ? tr('编辑项目', 'Edit project') : tr('添加新项目', 'Add project')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField label={tr('项目名称', 'Project name')} value={name} onChange={(e) => setName(e.target.value)} fullWidth required autoFocus />
            <TextField label={tr('项目描述', 'Description')} value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={3} />
            <TextField label={tr('客户名称', 'Customer')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Config
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ mb: 1 }}
              >
                <TextField
                  label={tr('新 Config 名称', 'New Config name')}
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  size="small"
                  margin="none"
                  fullWidth
                  sx={{ flex: 1 }}
                />
                <TextField
                  label={tr('备注 (可选)', 'Remark (optional)')}
                  value={configRemark}
                  onChange={(e) => setConfigRemark(e.target.value)}
                  size="small"
                  margin="none"
                  fullWidth
                  sx={{ flex: 1.5 }}
                />
                <Button
                  onClick={handleAddConfig}
                  variant="outlined"
                  size="small"
                  sx={{ minWidth: { xs: '100%', sm: 120 }, whiteSpace: 'nowrap' }}
                >
                  {tr('添加 Config', 'Add Config')}
                </Button>
              </Stack>
              <List dense>
                {configs.map((config) => (
                  <ListItem
                    key={config.id}
                    sx={{ py: 0.5 }}
                    secondaryAction={
                      <IconButton edge="end" aria-label={tr('删除', 'Delete')} onClick={() => handleDeleteConfig(config.id)} size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {config.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                            {config.remark ? config.remark : tr('无备注', 'No remark')}
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
                      primary={tr('暂无 Config', 'No configs')}
                    />
                  </ListItem>
                )}
              </List>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="h6" gutterBottom>
                WaterFall
              </Typography>
              <Box display="flex" gap={1} mb={1} alignItems="center">
                <TextField
                  label={tr('新 WaterFall 名称', 'New WaterFall name')}
                  value={newWf}
                  onChange={(e) => setNewWf(e.target.value)}
                  margin="none"
                  sx={{ flexGrow: 1 }}
                />
                <Button onClick={handleAddWf} variant="outlined" size="medium">
                  {tr('添加 WaterFall', 'Add WaterFall')}
                </Button>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {wfs.map((wf, index) => (
                  <Chip key={index} label={wf} onDelete={() => handleDeleteWf(wf)} color="primary" />
                ))}
                {wfs.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {tr('暂无 WaterFall', 'No WaterFalls')}
                  </Typography>
                )}
              </Box>
            </Box>

            {formSubmitError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {formSubmitError}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose()}>{tr('取消', 'Cancel')}</Button>
          <Button type="submit" variant="contained" color="primary">
            {project ? tr('保存更改', 'Save changes') : tr('确认添加', 'Create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ProjectForm;
