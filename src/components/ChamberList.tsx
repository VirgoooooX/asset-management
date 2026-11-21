import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
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
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { deleteAsset, fetchAssetsByType } from '../store/assetsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import type { AssetStatus } from '../types';
import { useI18n } from '../i18n';
import { formatDateOnly } from '../utils/formatters';
import AppCard from './AppCard';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import StatusChip from './StatusChip';
import TableSkeleton from './TableSkeleton';
import { useToast } from './ToastProvider';

interface ChamberListProps {
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onAddNew: () => void;
}

type SortKey = 'assetCode' | 'name' | 'status' | 'calibrationDate' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const ChamberList: React.FC<ChamberListProps> = ({ onView, onEdit, onAddNew }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { assets: chambers, loading, error } = useAppSelector((state) => state.assets);
  const role = useAppSelector((state) => state.auth.user?.role);
  const canManage = role === 'admin' || role === 'manager';
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { tr, language } = useI18n();

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }));
  }, [dispatch]);

  const handleDeleteClick = (id: string) => setPendingDeleteId(id);

  const handleCloseDelete = () => setPendingDeleteId(null);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await dispatch(deleteAsset(pendingDeleteId)).unwrap();
      toast.success(tr('设备已删除', 'Asset deleted.'));
    } catch (e: any) {
      toast.error(e?.message || tr('删除设备失败', 'Failed to delete asset'));
    } finally {
      setPendingDeleteId(null);
    }
  };

  const categorySummary = useMemo(() => {
    const map = new Map<string, { label: string; total: number; available: number; inUse: number; maintenance: number }>();
    chambers.forEach((a) => {
      const raw = a.category?.trim() || '';
      const label = raw ? raw : tr('未分类', 'Uncategorized');
      const prev = map.get(raw) ?? { label, total: 0, available: 0, inUse: 0, maintenance: 0 };
      prev.total += 1;
      if (a.status === 'available') prev.available += 1;
      else if (a.status === 'in-use') prev.inUse += 1;
      else prev.maintenance += 1;
      map.set(raw, prev);
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].label.localeCompare(b[1].label, language === 'en' ? 'en' : 'zh-Hans-CN', { sensitivity: 'base' })
    );
  }, [chambers, language, tr]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setPage(0);
  };

  const filteredAndSorted = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const locale = language === 'en' ? 'en' : 'zh-Hans-CN';
    const filtered = chambers.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (categoryFilter !== 'all') {
        const cat = c.category?.trim() || '__uncategorized__';
        if (cat !== categoryFilter) return false;
      }
      if (!q) return true;
      const haystack = [c.name, c.assetCode ?? '', c.location ?? '', c.manufacturer ?? '', c.model ?? '', c.category ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const parseTime = (v?: string) => {
      if (!v) return 0;
      const ms = Date.parse(v);
      return Number.isFinite(ms) ? ms : 0;
    };

    return filtered.slice().sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'assetCode') {
        cmp = (a.assetCode || '').localeCompare(b.assetCode || '', locale, { numeric: true, sensitivity: 'base' });
      } else if (sortKey === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', locale, { numeric: true, sensitivity: 'base' });
      } else if (sortKey === 'status') {
        cmp = a.status.localeCompare(b.status, locale);
      } else if (sortKey === 'calibrationDate') {
        cmp = parseTime(a.calibrationDate) - parseTime(b.calibrationDate);
      } else if (sortKey === 'createdAt') {
        cmp = parseTime(a.createdAt) - parseTime(b.createdAt);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [categoryFilter, chambers, language, searchText, sortKey, sortOrder, statusFilter]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filteredAndSorted.length / rowsPerPage) - 1));
  const paginatedChambers = useMemo(
    () => filteredAndSorted.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [filteredAndSorted, rowsPerPage, safePage]
  );

  const hasFilters = Boolean(searchText.trim()) || statusFilter !== 'all' || categoryFilter !== 'all';

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button size="small" color="inherit" onClick={() => dispatch(fetchAssetsByType({ type: 'chamber', force: true }))}>
            {tr('重试', 'Retry')}
          </Button>
        }
      >
        {tr(`加载设备列表失败: ${error}`, `Failed to load assets: ${error}`)}
      </Alert>
    );
  }

  return (
    <Box>
      <AppCard title={tr('设备类型概览', 'Category overview')} sx={{ mb: 2 }}>
        {loading && chambers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {tr('正在加载...', 'Loading...')}
          </Typography>
        ) : categorySummary.length === 0 ? (
          <EmptyState compact title={tr('暂无设备类型统计', 'No category data')} />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(1, minmax(0, 1fr))',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.25,
            }}
          >
            {categorySummary.map(([categoryRaw, c]) => {
              const utilization = c.total ? (c.inUse / c.total) * 100 : 0;
              const routeKey = categoryRaw ? encodeURIComponent(categoryRaw) : '__uncategorized__';
              const openCategory = () => navigate(`/assets/categories/${routeKey}`);
              return (
                <Box
                  key={categoryRaw || '__uncategorized__'}
                  role="button"
                  tabIndex={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.25,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    cursor: 'pointer',
                    transition: 'border-color 150ms ease, background-color 150ms ease',
                    '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
                    '&:focus-visible': {
                      outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                  onClick={openCategory}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openCategory();
                    }
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                      {c.label}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontWeight: 700 }}>{c.total}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                    <Chip size="small" label={tr(`可用 ${c.available}`, `Available ${c.available}`)} color="success" variant="outlined" />
                    <Chip size="small" label={tr(`使用中 ${c.inUse}`, `In use ${c.inUse}`)} color="warning" variant="outlined" />
                    <Chip size="small" label={tr(`维护 ${c.maintenance}`, `Maintenance ${c.maintenance}`)} color="error" variant="outlined" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {tr(`当前使用率 ${utilization.toFixed(1)}%`, `Utilization ${utilization.toFixed(1)}%`)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </AppCard>

      <AppCard
        title={tr('设备列表', 'Asset list')}
        actions={
          canManage ? (
            <Button variant="contained" color="primary" onClick={onAddNew} startIcon={<AddIcon />}>
              {tr('新增设备', 'Add asset')}
            </Button>
          ) : undefined
        }
        contentSx={{ mx: -2.5, mb: -2.5 }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.25}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          sx={{ px: 2.5, pb: 1.5 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ flex: 1 }}>
            <TextField
              size="small"
              margin="none"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(0);
              }}
              placeholder={tr('搜索名称 / 资产号 / 位置 / 厂商 / 型号', 'Search name / code / location / vendor / model')}
              sx={{ minWidth: { sm: 240 }, flex: 1, maxWidth: { sm: 360 } }}
            />
            <TextField
              select
              size="small"
              margin="none"
              label={tr('状态', 'Status')}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | AssetStatus);
                setPage(0);
              }}
              sx={{ minWidth: 135 }}
            >
              <MenuItem value="all">{tr('全部状态', 'All')}</MenuItem>
              <MenuItem value="available">{tr('可用', 'Available')}</MenuItem>
              <MenuItem value="in-use">{tr('使用中', 'In use')}</MenuItem>
              <MenuItem value="maintenance">{tr('维护中', 'Maintenance')}</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              margin="none"
              label={tr('类型', 'Category')}
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">{tr('全部类型', 'All categories')}</MenuItem>
              {categorySummary.map(([raw, c]) => {
                const val = raw || '__uncategorized__';
                return (
                  <MenuItem key={val} value={val}>
                    {c.label}
                  </MenuItem>
                );
              })}
            </TextField>
          </Stack>
          <Chip
            size="small"
            label={tr(`共 ${filteredAndSorted.length} 台`, `${filteredAndSorted.length} assets`)}
            sx={{ fontWeight: 600, alignSelf: { xs: 'flex-start', md: 'center' } }}
          />
        </Stack>

        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'assetCode'}
                    direction={sortKey === 'assetCode' ? sortOrder : 'asc'}
                    onClick={() => handleSort('assetCode')}
                  >
                    {tr('资产号', 'Asset code')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'name'}
                    direction={sortKey === 'name' ? sortOrder : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    {tr('名称', 'Name')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'status'}
                    direction={sortKey === 'status' ? sortOrder : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    {tr('状态', 'Status')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('位置', 'Location')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('厂商', 'Manufacturer')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tr('型号', 'Model')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortKey === 'calibrationDate'}
                    direction={sortKey === 'calibrationDate' ? sortOrder : 'asc'}
                    onClick={() => handleSort('calibrationDate')}
                  >
                    {tr('校验日期', 'Calibration date')}
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
                {canManage ? (
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    {tr('操作', 'Actions')}
                  </TableCell>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && chambers.length === 0 ? (
                <TableSkeleton rows={6} columns={canManage ? 9 : 8} />
              ) : filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 9 : 8}>
                    <EmptyState
                      compact
                      title={hasFilters ? tr('没有匹配的设备', 'No matching assets') : tr('暂无设备', 'No assets')}
                      action={
                        hasFilters ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setSearchText('');
                              setStatusFilter('all');
                              setCategoryFilter('all');
                              setPage(0);
                            }}
                          >
                            {tr('重置筛选', 'Reset filters')}
                          </Button>
                        ) : canManage ? (
                          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAddNew}>
                            {tr('新增设备', 'Add asset')}
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedChambers.map((chamber) => (
                  <TableRow
                    key={chamber.id}
                    hover
                    onClick={() => onView(chamber.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{chamber.assetCode || '-'}</TableCell>
                    <TableCell>{chamber.name}</TableCell>
                    <TableCell>
                      <StatusChip kind="asset" status={chamber.status} />
                    </TableCell>
                    <TableCell>{chamber.location || '-'}</TableCell>
                    <TableCell>{chamber.manufacturer || '-'}</TableCell>
                    <TableCell>{chamber.model || '-'}</TableCell>
                    <TableCell>{formatDateOnly(chamber.calibrationDate)}</TableCell>
                    <TableCell>{formatDateOnly(chamber.createdAt)}</TableCell>
                    {canManage ? (
                      <TableCell align="center">
                        <Tooltip title={tr('编辑', 'Edit')}>
                          <IconButton
                            aria-label={tr('编辑', 'Edit')}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(chamber.id);
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
                              handleDeleteClick(chamber.id);
                            }}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    ) : null}
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
        description={tr('您确定要删除这个设备吗？此操作无法撤销。', 'Delete this asset? This action cannot be undone.')}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export default ChamberList;
