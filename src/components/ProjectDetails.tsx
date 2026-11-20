// src/components/ProjectDetails.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';
import { useI18n } from '../i18n';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProjects } from '../store/projectsSlice';
import { Project, Config } from '../types';
import { formatDateTimeShort } from '../utils/formatters';

interface ProjectDetailsProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ open, onClose, projectId }) => {
  const dispatch = useAppDispatch();
  const { tr, dateFnsLocale } = useI18n();
  const { projects, loading: projectsLoading } = useAppSelector((state) => state.projects);

  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!open) return;
    dispatch(fetchProjects());
  }, [open, dispatch]);

  useEffect(() => {
    if (open && projectId && !projectsLoading && projects.length > 0) {
      const foundProject = projects.find((p) => p.id === projectId);
      setProject(foundProject || null);
    } else if (!open || !projectId) {
      setProject(null);
    }
  }, [open, projectId, projects, projectsLoading]);

  if (open && projectsLoading && !project) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>{tr('项目详情', 'Project details')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>{tr('正在加载项目数据...', 'Loading project...')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{tr('关闭', 'Close')}</Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (!project) {
    if (open && projectId && !projectsLoading) {
      return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
          <DialogTitle>{tr('项目详情', 'Project details')}</DialogTitle>
          <DialogContent>
            <Typography>{tr(`未找到指定的项目信息 (ID: ${projectId})。`, `Project not found (ID: ${projectId}).`)}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>{tr('关闭', 'Close')}</Button>
          </DialogActions>
        </Dialog>
      );
    }
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{tr(`项目详情: ${project.name}`, `Project: ${project.name}`)}</DialogTitle>
      <DialogContent dividers>
        <Box p={2}>
          <Typography variant="h5" component="div" gutterBottom>
            {project.name}
          </Typography>

          {project.customerName && (
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
              {tr('客户', 'Customer')}: {project.customerName}
            </Typography>
          )}

          <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
            {project.description || tr('无项目描述', 'No description')}
          </Typography>

          <Typography variant="body2" color="textSecondary" gutterBottom>
            {tr('创建时间', 'Created')}: {formatDateTimeShort(project.createdAt, { fallback: 'N/A', locale: dateFnsLocale })}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: '1 1 100%', maxWidth: { xs: '100%', md: '48%' }, mb: { xs: 2, md: 0 } }}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  {tr('Config 列表', 'Configs')}
                </Typography>

                {project.configs && project.configs.length > 0 ? (
                  <List dense>
                    {project.configs.map((config: Config) => (
                      <ListItem key={config.id} disableGutters>
                        <ListItemText
                          primary={config.name}
                          secondary={config.remark ? `${tr('备注', 'Remark')}: ${config.remark}` : tr('无备注', 'No remark')}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {tr('暂无 Config', 'No configs')}
                  </Typography>
                )}
              </Paper>
            </Box>

            <Box sx={{ flex: '1 1 100%', maxWidth: { xs: '100%', md: '48%' } }}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  {tr('WaterFall 列表', 'WaterFalls')}
                </Typography>

                {project.wfs && project.wfs.length > 0 ? (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {project.wfs.map((wf, index) => (
                      <Chip key={index} label={wf} color="primary" size="small" />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {tr('暂无 WaterFall', 'No WaterFalls')}
                  </Typography>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {tr('关闭', 'Close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectDetails;
