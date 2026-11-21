import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { deleteProject, fetchProjects } from '../store/projectsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useI18n } from '../i18n';
import { formatDateOnly } from '../utils/formatters';
import AppCard from './AppCard';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';
import { useToast } from './ToastProvider';

interface ProjectListProps {
  onEdit: (id: string) => void;
  onAddNew: () => void;
  onViewDetails: (id: string) => void;
}

type SortKey = 'name' | 'configs' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const ProjectList: React.FC<ProjectListProps> = ({ onEdit, onAddNew, onViewDetails }) => {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const { projects, loading, error } = useAppSelector((state) => state.projects);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { tr, language } = useI18n();

  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const handleDeleteClick = (id: string) => setPendingDeleteId(id);

  const handleCloseDelete = () => setPendingDeleteId(null);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await dispatch(deleteProject(pendingDeleteId)).unwrap();
      toast.success(tr('项目已删除', 'Project deleted.'));
    } catch (e: any) {
      toast.error(e?.message || tr('删除项目失败', 'Failed to delete project'));
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const locale = language === 'en' ? 'en' : 'zh-Hans-CN';
    const filtered = projects.filter((p) => {
      if (!q) return true;
      return [p.name, p.description ?? '', p.customerName ?? ''].join(' ').toLowerCase().includes(q);
    });

    return filtered.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', locale, { numeric: true, sensitivity: 'base' });
      } else if (sortKey === 'configs') {
        cmp = (a.configs?.length ?? 0) - (b.configs?.length ?? 0);
      } else {
        const aMs = Date.parse(a.createdAt || '') || 0;
        const bMs = Date.parse(b.createdAt || '') || 0;
        cmp = aMs - bMs;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [language, projects, searchText, sortKey, sortOrder]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredAndSorted.length / rowsPerPage) - 1));
  const paginatedProjects = useMemo(
    () => filteredAndSorted.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [filteredAndSorted, rowsPerPage, safePage]
  );

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button size="small" color="inherit" onClick={() => dispatch(fetchProjects({ force: true }))}>
            {tr('重试', 'Retry')}
          </Button>
        }
      >
        {tr(`加载项目列表失败: ${error}`, `Failed to load projects: ${error}`)}
      </Alert>
    );
  }

  return (
    <Box>
      <AppCard
        title={tr('产品专案列表', 'Project list')}
        actions={
          <Button variant="contained" color="primary" onClick={onAddNew} startIcon={<AddIcon />}>
            {tr('添加项目', 'Add project')}
          </Button>
        }
        contentSx={{ mx: -2.5, mb: -2.5 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ px: 2.5, pb: 1.5 }}
        >
          <TextField
            size="small"
            margin="none"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(0);
            }}
            placeholder={tr('搜索项目名称 / 描述 / 客户', 'Search name / description / customer')}
            sx={{ minWidth: { sm: 260 }, flex: 1, maxWidth: { sm: 380 } }}
          />
          <Chip
            size="small"
            label={tr(`共 ${filteredAndSorted.length} 个`, `${filteredAndSorted.length} projects`)}
            sx={{ fontWeight: 600, alignSelf: { xs: 'flex-start', sm: 'center' } }}
          />
        </Stack>

        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'name'}
                    direction={sortKey === 'name' ? sortOrder : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    {tr('名称', 'Name')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('描述', 'Description')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'configs'}
                    direction={sortKey === 'configs' ? sortOrder : 'asc'}
                    onClick={() => handleSort('configs')}
                  >
                    {tr('配置数量', 'Configs')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'createdAt'}
                    direction={sortKey === 'createdAt' ? sortOrder : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    {tr('创建时间', 'Created')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  {tr('操作', 'Actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && projects.length === 0 ? (
                <TableSkeleton rows={5} columns={5} />
              ) : filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      compact
                      title={searchText.trim() ? tr('没有匹配的项目', 'No matching projects') : tr('暂无产品专案', 'No projects')}
                      action={
                        searchText.trim() ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSearchText('');
                              setPage(0);
                            }}
                          >
                            {tr('重置筛选', 'Reset filters')}
                          </Button>
                        ) : (
                          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAddNew}>
                            {tr('添加项目', 'Add project')}
                          </Button>
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    hover
                    onClick={() => onViewDetails(project.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{project.name}</TableCell>
                    <TableCell>{project.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={language === 'en' ? `${project.configs?.length ?? 0}` : `${project.configs?.length ?? 0}个配置`}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDateOnly(project.createdAt)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={tr('详情', 'Details')}>
                        <IconButton
                          aria-label={tr('详情', 'Details')}
                          size="small"
                          color="info"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(project.id);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tr('编辑', 'Edit')}>
                        <IconButton
                          aria-label={tr('编辑', 'Edit')}
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(project.id);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tr('删除', 'Delete')}>
                        <IconButton
                          aria-label={tr('删除', 'Delete')}
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(project.id);
                          }}
                        >
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
        <TablePagination
          component="div"
          count={filteredAndSorted.length}
          page={safePage}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage={tr('每页行数', 'Rows per page')}
        />
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
