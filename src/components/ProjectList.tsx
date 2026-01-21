import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { fetchProjects, deleteProject } from '../store/projectsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks'
import ConfirmDialog from './ConfirmDialog';
import AppCard from './AppCard';
import { useI18n } from '../i18n'

interface ProjectListProps {
  onEdit: (id: string) => void;
  onAddNew: () => void;
  onViewDetails: (id: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onEdit, onAddNew, onViewDetails }) => {
  const dispatch = useAppDispatch()
  const { projects, loading, error } = useAppSelector((state) => state.projects)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { tr, language } = useI18n()

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const handleDeleteClick = (id: string) => setPendingDeleteId(id);

  const handleCloseDelete = () => setPendingDeleteId(null);

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    dispatch(deleteProject(pendingDeleteId));
    setPendingDeleteId(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{tr('正在加载项目列表...', 'Loading projects...')}</Typography>
      </Box>
    );
  }
  if (error) return <Alert severity="error">{tr(`加载项目列表失败: ${error}`, `Failed to load projects: ${error}`)}</Alert>;

  return (
    <Box>
      <AppCard
        title={tr('项目列表', 'Project list')}
        actions={
          <Button variant="contained" color="primary" onClick={onAddNew} startIcon={<AddIcon />}>
            {tr('添加项目', 'Add project')}
          </Button>
        }
        contentSx={{ mx: -2.5, mb: -2.5 }}
      >
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{tr('名称', 'Name')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('描述', 'Description')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('配置数量', 'Configs')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('创建时间', 'Created')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">{tr('操作', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">{tr('暂无数据', 'No data')}</TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id} hover>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>{project.description || '-'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={language === 'en' ? `${project.configs?.length ?? 0}` : `${project.configs?.length ?? 0}个配置`} 
                      color="primary" 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={tr('详情', 'Details')}>
                      <IconButton size="small" color="info" onClick={() => onViewDetails(project.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tr('编辑', 'Edit')}>
                      <IconButton size="small" color="primary" onClick={() => onEdit(project.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tr('删除', 'Delete')}>
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(project.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </TableContainer>
      </AppCard>
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title={tr('确认删除', 'Confirm deletion')}
        description={tr('您确定要删除这个项目吗？此操作无法撤销。', 'Delete this project? This action cannot be undone.')}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export default ProjectList;
