// src/pages/TestProjectsPage.tsx
import React, { useState, useCallback } from 'react';
import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science'
import TestProjectList from '../components/TestProjectList';
import TestProjectForm from '../components/TestProjectForm';
import PageShell from '../components/PageShell';
import ConfirmDialog from '../components/ConfirmDialog';
import TitleWithIcon from '../components/TitleWithIcon'
import { useToast } from '../components/ToastProvider'
import { useAppDispatch } from '../store/hooks';
import { TestProject } from '../types';
import { deleteTestProject } from '../store/testProjectsSlice';
import { useI18n } from '../i18n'

const TestProjectsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { tr } = useI18n()
  const toast = useToast()

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTestProject, setEditingTestProject] = useState<TestProject | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [deletingTestProjectId, setDeletingTestProjectId] = useState<string | null>(null);

  const handleOpenForm = useCallback((testProject?: TestProject) => {
    setEditingTestProject(testProject || null);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingTestProject(null);
  }, []);

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
        toast.success(tr('测试项目删除成功', 'Test project deleted.'));
      } catch (error: any) {
        toast.error(tr(`删除失败: ${error.message || '未知错误'}`, `Delete failed: ${error.message || 'Unknown error'}`));
      } finally {
        handleCloseConfirmDelete();
      }
    }
  }, [dispatch, deletingTestProjectId, handleCloseConfirmDelete, toast, tr]);

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
    </PageShell>
  );
};

export default TestProjectsPage;
