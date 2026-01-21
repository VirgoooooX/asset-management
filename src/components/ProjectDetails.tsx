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
  CircularProgress, // 用于项目数据可能尚未加载的情况
} from '@mui/material';
import { Project, Config } from '../types'; // 确保 Config 类型已更新 (remark 代替 parameters)
import { format, parseISO, isValid } from 'date-fns'; // 导入日期处理函数
import { zhCN } from 'date-fns/locale';       // 导入中文本地化
import { fetchProjects } from '../store/projectsSlice'; // 用于确保项目数据已加载
import { useAppDispatch, useAppSelector } from '../store/hooks'

interface ProjectDetailsProps {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ open, onClose, projectId }) => {
  const dispatch = useAppDispatch()
  // 修正 useSelector，并获取 loading 和 error 状态
  const { 
    projects, 
    loading: projectsLoading
  } = useAppSelector((state) => state.projects)

  const [project, setProject] = useState<Project | null>(null);

  // 当弹窗打开且 projectId 存在时，尝试加载项目数据
  useEffect(() => {
    if (open && projects.length === 0 && !projectsLoading) {
      dispatch(fetchProjects());
    }
  }, [open, projects.length, projectsLoading, dispatch]);

  useEffect(() => {
    if (open && projectId && !projectsLoading && projects.length > 0) {
      const foundProject = projects.find(p => p.id === projectId);
      setProject(foundProject || null);
    } else if (!open || !projectId) { // 如果弹窗关闭或没有 projectId，则重置
      setProject(null);
    }
  }, [open, projectId, projects, projectsLoading]);

  // 日期格式化辅助函数
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'yyyy-MM-dd HH:mm', { locale: zhCN }) : '无效日期';
  };

  // 如果正在加载项目列表或者正在查找特定项目，显示加载状态
  if (open && projectsLoading && !project) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>项目详情</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>正在加载项目数据...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>关闭</Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  // 如果没有找到项目，或者 projectId 为 null (弹窗逻辑应该会处理不显示的情况)
  if (!project) {
    // 如果弹窗是打开的，但项目未找到（例如，在 projects 数组中搜索后），可以显示提示
    if (open && projectId && !projectsLoading) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>项目详情</DialogTitle>
                <DialogContent>
                    <Typography>未找到指定的项目信息 (ID: {projectId})。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>关闭</Button>
                </DialogActions>
            </Dialog>
        );
    }
    return null; // 通常情况下，如果 project 为 null，弹窗不会被父组件渲染为 open
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>项目详情: {project.name}</DialogTitle>
      <DialogContent dividers> {/* 使用 dividers 属性为内容区域添加上下边框 */}
        <Box p={2}>
          <Typography variant="h5" component="div" gutterBottom>{project.name}</Typography>
          
          {project.customerName && (
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
              客户: {project.customerName}
            </Typography>
          )}

          <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
            {project.description || '无项目描述'}
          </Typography>
          
          <Typography variant="body2" color="textSecondary" gutterBottom>
            创建时间: {formatDate(project.createdAt)}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {/* Config 列表 */}
            <Box sx={{ flex: '1 1 100%', maxWidth: { xs: '100%', md: '48%' }, mb: {xs: 2, md: 0} }}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}> {/* 使 Paper 高度一致 */}
                <Typography variant="h6" gutterBottom>Config 列表</Typography> {/* 修改标题 */}
                
                {project.configs && project.configs.length > 0 ? (
                  <List dense> {/* 使用 dense 让列表更紧凑 */}
                    {project.configs.map((config: Config) => ( // 显式指定 config 类型
                      <ListItem key={config.id} disableGutters>
                        <ListItemText 
                          primary={config.name}
                          // 修改：显示备注 (remark) 而不是参数数量
                          secondary={config.remark ? `备注: ${config.remark}` : '无备注'} 
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">暂无 Config</Typography> 
                )}
              </Paper>
            </Box>
            
            {/* WaterFall 列表 */}
            <Box sx={{ flex: '1 1 100%', maxWidth: { xs: '100%', md: '48%' } }}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}> {/* 使 Paper 高度一致 */}
                <Typography variant="h6" gutterBottom>WaterFall 列表</Typography> {/* 修改标题 */}
                
                {project.wfs && project.wfs.length > 0 ? (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {project.wfs.map((wf, index) => (
                      <Chip key={index} label={wf} color="primary" size="small" />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">暂无 WaterFall</Typography>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectDetails;
