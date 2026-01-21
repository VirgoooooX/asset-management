// src/pages/TestProjectsPage.tsx
import React, { useState, useCallback, useEffect } from 'react'; // useEffect might be needed if fetching at page level
import { useDispatch } from 'react-redux';
import { 
  Box, 
  Typography, 
  Button,
  Snackbar, // 用于显示操作结果
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science'
import TestProjectList from '../components/TestProjectList'; // 导入列表组件
import TestProjectForm from '../components/TestProjectForm'; // 导入表单组件
import PageShell from '../components/PageShell';
import ConfirmDialog from '../components/ConfirmDialog';
import TitleWithIcon from '../components/TitleWithIcon'
import { AppDispatch } from '../store';
import { TestProject } from '../types';
// 导入 deleteTestProject。fetchTestProjects 通常在 TestProjectList 中处理，
// 但如果需要在表单关闭后强制刷新，这里也可以导入。
import { deleteTestProject, fetchTestProjects } from '../store/testProjectsSlice'; 
import { useI18n } from '../i18n'

const TestProjectsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tr } = useI18n()

  // --- State Management ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTestProject, setEditingTestProject] = useState<TestProject | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [deletingTestProjectId, setDeletingTestProjectId] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // --- Handlers ---
  const handleOpenForm = useCallback((testProject?: TestProject) => {
    setEditingTestProject(testProject || null);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingTestProject(null);
    // 可选：在添加或编辑成功后，如果列表组件本身不因 Redux state 变化而自动更新，
    // 或者希望确保获取最新数据，可以在这里 dispatch fetchTestProjects。
    // 通常，如果 thunk 的 fulfilled reducer 正确更新了列表，则可能不需要手动刷新。
    // dispatch(fetchTestProjects()); 
  }, [/* dispatch */]); // 如果上面的 dispatch 被取消注释，则添加 dispatch 到依赖数组

  const handleDeleteClick = useCallback((id: string) => {
    setDeletingTestProjectId(id);
    setIsConfirmDeleteDialogOpen(true);
  }, []);

  const handleCloseConfirmDelete = useCallback(() => {
    setIsConfirmDeleteDialogOpen(false);
    setDeletingTestProjectId(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deletingTestProjectId) {
      try {
        await dispatch(deleteTestProject(deletingTestProjectId)).unwrap();
        setSnackbarMessage(tr('测试项目删除成功', 'Test project deleted.'));
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        // 删除成功后，列表应该会自动更新 (因为 Redux state 变化)
        // 如果 TestProjectList 组件依赖于父组件触发刷新，可以在此 dispatch(fetchTestProjects());
      } catch (error: any) {
        setSnackbarMessage(tr(`删除失败: ${error.message || '未知错误'}`, `Delete failed: ${error.message || 'Unknown error'}`));
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } finally {
        handleCloseConfirmDelete();
      }
    }
  }, [dispatch, deletingTestProjectId, handleCloseConfirmDelete]);

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  // 如果希望页面级别也确保数据已加载，可以添加 useEffect，
  // 但 TestProjectList 内部也做了这个。避免重复。
  // useEffect(() => {
  //   dispatch(fetchTestProjects()); // 假设在列表组件中没有这个逻辑时使用
  // }, [dispatch]);

  return (
    <PageShell
      title={<TitleWithIcon icon={<ScienceIcon />}>{tr('测试项目', 'Test projects')}</TitleWithIcon>}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenForm()}>
          {tr('添加测试项目', 'Add test project')}
        </Button>
      }
    >
        <TestProjectList 
          onEdit={handleOpenForm}
          onDelete={handleDeleteClick}
        />

        {/* TestProjectForm 对话框 */}
        {/* 使用条件渲染确保表单在关闭时其内部状态（包括useEffect）不会意外触发 */}
        {isFormOpen && ( 
          <TestProjectForm
            open={isFormOpen}
            onClose={handleCloseForm}
            testProject={editingTestProject || undefined} 
          />
        )}

        <ConfirmDialog
          open={isConfirmDeleteDialogOpen}
          title={tr('确认删除', 'Confirm deletion')}
          description={tr('您确定要删除这个测试项目吗？此操作无法撤销。', 'Delete this test project? This action cannot be undone.')}
          onClose={handleCloseConfirmDelete}
          onConfirm={handleConfirmDelete}
        />

        {/* 操作结果提示 */}
        <Snackbar 
          open={snackbarOpen} 
          autoHideDuration={4000} // 缩短一点持续时间
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }} variant="filled">
            {snackbarMessage}
          </Alert>
        </Snackbar>
    </PageShell>
  );
};

export default TestProjectsPage;
