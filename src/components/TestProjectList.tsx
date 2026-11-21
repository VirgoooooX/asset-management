// src/components/TestProjectList.tsx
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AppCard from './AppCard';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';
import { TestProject } from '../types';
import { fetchProjects } from '../store/projectsSlice';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useI18n } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { formatDateTimeShort } from '../utils/formatters';

interface TestProjectListProps {
  onEdit: (testProject: TestProject) => void;
  onDelete: (id: string) => void;
}

type SortKey = 'name' | 'temperature' | 'humidity' | 'duration' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const TestProjectList: React.FC<TestProjectListProps> = ({ onEdit, onDelete }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { testProjects, loading, error } = useAppSelector((state) => state.testProjects);
  const projects = useAppSelector((state) => state.projects.projects);
  const { tr, language, dateFnsLocale } = useI18n();

  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    dispatch(fetchTestProjects());
    dispatch(fetchProjects());
  }, [dispatch]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

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
    const filtered = testProjects.filter((tp) => {
      if (!q) return true;
      const projectName = tp.projectId ? projectNameById.get(tp.projectId) ?? tp.projectId : '';
      return [tp.name, projectName].join(' ').toLowerCase().includes(q);
    });

    return filtered.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', locale, { numeric: true, sensitivity: 'base' });
      } else if (sortKey === 'temperature') {
        cmp = (a.temperature ?? 0) - (b.temperature ?? 0);
      } else if (sortKey === 'humidity') {
        cmp = (a.humidity ?? 0) - (b.humidity ?? 0);
      } else if (sortKey === 'duration') {
        cmp = (a.duration ?? 0) - (b.duration ?? 0);
      } else {
        const aMs = Date.parse(a.createdAt || '') || 0;
        const bMs = Date.parse(b.createdAt || '') || 0;
        cmp = aMs - bMs;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [language, projectNameById, searchText, sortKey, sortOrder, testProjects]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredAndSorted.length / rowsPerPage) - 1));
  const paginatedTestProjects = useMemo(
    () => filteredAndSorted.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [filteredAndSorted, rowsPerPage, safePage]
  );

  if (error && !loading) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {tr(`加载测试项目列表失败: ${error}`, `Failed to load test projects: ${error}`)}
        <Button
          size="small"
          onClick={() => {
            dispatch(fetchTestProjects({ force: true }));
          }}
          sx={{ ml: 2 }}
        >
          {tr('重试', 'Retry')}
        </Button>
      </Alert>
    );
  }

  return (
    <AppCard title={tr('测试项目列表', 'Test project list')} contentSx={{ mx: -2.5, mb: -2.5 }}>
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
          placeholder={tr('搜索测试项目名称 / 关联项目', 'Search test project / linked project')}
          sx={{ minWidth: { sm: 260 }, flex: 1, maxWidth: { sm: 380 } }}
        />
        <Chip
          size="small"
          label={tr(`共 ${filteredAndSorted.length} 个`, `${filteredAndSorted.length} items`)}
          sx={{ fontWeight: 600, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        />
      </Stack>

      <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
        <Table sx={{ minWidth: 650 }} aria-label={tr('测试项目列表', 'Test project list')} size="small">
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
              <TableCell sx={{ fontWeight: 600 }} align="right">
                <TableSortLabel
                  active={sortKey === 'temperature'}
                  direction={sortKey === 'temperature' ? sortOrder : 'asc'}
                  onClick={() => handleSort('temperature')}
                >
                  {tr('温度 (°C)', 'Temperature (°C)')}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                <TableSortLabel
                  active={sortKey === 'humidity'}
                  direction={sortKey === 'humidity' ? sortOrder : 'asc'}
                  onClick={() => handleSort('humidity')}
                >
                  {tr('湿度 (%)', 'Humidity (%)')}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                <TableSortLabel
                  active={sortKey === 'duration'}
                  direction={sortKey === 'duration' ? sortOrder : 'asc'}
                  onClick={() => handleSort('duration')}
                >
                  {tr('时长 (小时)', 'Duration (hours)')}
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('关联项目', 'Project')}</TableCell>
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
            {loading && testProjects.length === 0 ? (
              <TableSkeleton rows={5} columns={7} />
            ) : filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    compact
                    title={
                      searchText.trim()
                        ? tr('没有匹配的测试项目', 'No matching test projects')
                        : tr('没有找到测试项目数据', 'No test projects found')
                    }
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
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginatedTestProjects.map((tp) => {
                const projectLabel = tp.projectId
                  ? projectNameById.get(tp.projectId) || tp.projectId
                  : tr('无', 'None');
                return (
                  <TableRow
                    key={tp.id}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: 'pointer' }}
                    onClick={() => navigate(`/test-projects/${encodeURIComponent(tp.id)}`)}
                  >
                    <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                      {tp.name}
                    </TableCell>
                    <TableCell align="right">{tp.temperature}</TableCell>
                    <TableCell align="right">{tp.humidity}</TableCell>
                    <TableCell align="right">{tp.duration}</TableCell>
                    <TableCell>{projectLabel}</TableCell>
                    <TableCell>{formatDateTimeShort(tp.createdAt, { fallback: 'N/A', locale: dateFnsLocale })}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={tr('编辑', 'Edit')}>
                        <IconButton
                          aria-label={tr('编辑', 'Edit')}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(tp);
                          }}
                          size="small"
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={tr('删除', 'Delete')}>
                        <IconButton
                          aria-label={tr('删除', 'Delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(tp.id);
                          }}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
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
  );
};

export default TestProjectList;
