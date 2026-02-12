import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Stack,
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add'; // 添加导入
import { fetchAssetsByType, deleteAsset } from '../store/assetsSlice'
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppDispatch, useAppSelector } from '../store/hooks'
import ConfirmDialog from './ConfirmDialog';
import AppCard from './AppCard';
import { useI18n } from '../i18n'
import { useNavigate } from 'react-router-dom'

interface ChamberListProps {
  onView: (id: string) => void
  onEdit: (id: string) => void;
  onAddNew: () => void;
}

const ChamberList: React.FC<ChamberListProps> = ({ onView, onEdit, onAddNew }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { assets: chambers, loading, error } = useAppSelector((state) => state.assets)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { tr } = useI18n()

  useEffect(() => {
    dispatch(fetchAssetsByType({ type: 'chamber' }));
  }, [dispatch]);

  const handleDeleteClick = (id: string) => setPendingDeleteId(id);

  const handleCloseDelete = () => setPendingDeleteId(null);

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    dispatch(deleteAsset(pendingDeleteId));
    setPendingDeleteId(null);
  };

  const categorySummary = useMemo(() => {
    const map = new Map<string, { label: string; total: number; available: number; inUse: number; maintenance: number }>()
    chambers.forEach((a) => {
      const raw = a.category?.trim() || ''
      const label = raw ? raw : tr('未分类', 'Uncategorized')
      const prev = map.get(raw) ?? { label, total: 0, available: 0, inUse: 0, maintenance: 0 }
      prev.total += 1
      if (a.status === 'available') prev.available += 1
      else if (a.status === 'in-use') prev.inUse += 1
      else prev.maintenance += 1
      map.set(raw, prev)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label, 'zh-Hans-CN', { sensitivity: 'base' }))
  }, [chambers, tr])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{tr('正在加载设备列表...', 'Loading assets...')}</Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{tr(`加载设备列表失败: ${error}`, `Failed to load assets: ${error}`)}</Alert>;
  }

  return (
    <Box>
      <AppCard title={tr('设备类型概览', 'Category overview')} sx={{ mb: 2 }}>
        {categorySummary.length === 0 ? (
          <Typography color="text.secondary">{tr('暂无数据', 'No data')}</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {categorySummary.map(([categoryRaw, c]) => {
              const utilization = c.total ? (c.inUse / c.total) * 100 : 0
              const routeKey = categoryRaw ? encodeURIComponent(categoryRaw) : '__uncategorized__'
              return (
              <Box
                key={categoryRaw || '__uncategorized__'}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.25,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
                }}
                onClick={() => navigate(`/assets/categories/${routeKey}`)}
              >
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography sx={{ fontWeight: 950, minWidth: 0 }} noWrap>
                    {c.label}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontWeight: 950 }}>{c.total}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={tr(`可用 ${c.available}`, `Available ${c.available}`)} color="success" variant="outlined" />
                  <Chip size="small" label={tr(`使用中 ${c.inUse}`, `In use ${c.inUse}`)} color="warning" variant="outlined" />
                  <Chip size="small" label={tr(`维护 ${c.maintenance}`, `Maintenance ${c.maintenance}`)} color="error" variant="outlined" />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
                  {tr(`当前使用率 ${utilization.toFixed(1)}%`, `Utilization ${utilization.toFixed(1)}%`)}
                </Typography>
              </Box>
            )})}
          </Box>
        )}
      </AppCard>
      <AppCard
        title={tr('设备列表', 'Asset list')}
        actions={
          <Button variant="contained" color="primary" onClick={onAddNew} startIcon={<AddIcon />}>
            {tr('新增设备', 'Add asset')}
          </Button>
        }
        contentSx={{ mx: -2.5, mb: -2.5 }}
      >
        <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{tr('资产号', 'Asset code')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('名称', 'Name')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('状态', 'Status')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('位置', 'Location')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('厂商', 'Manufacturer')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('型号', 'Model')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('校验日期', 'Calibration date')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('创建时间', 'Created')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">{tr('操作', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chambers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  {tr('暂无数据', 'No data')}
                </TableCell>
              </TableRow>
            ) : (
              chambers.map((chamber) => (
                <TableRow
                  key={chamber.id}
                  hover
                  onClick={() => onView(chamber.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 650 }}>{chamber.assetCode || '-'}</TableCell>
                  <TableCell>{chamber.name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={
                        chamber.status === 'available'
                          ? tr('可用', 'Available')
                          : chamber.status === 'in-use'
                            ? tr('使用中', 'In use')
                            : tr('维护中', 'Maintenance')
                      } 
                      color={chamber.status === 'available' ? 'success' : chamber.status === 'in-use' ? 'warning' : 'error'} 
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{chamber.location || '-'}</TableCell>
                  <TableCell>{chamber.manufacturer || '-'}</TableCell>
                  <TableCell>{chamber.model || '-'}</TableCell>
                  <TableCell>
                    {chamber.calibrationDate ? new Date(chamber.calibrationDate).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{new Date(chamber.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(chamber.id)
                      }}
                      size="small"
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(chamber.id)
                      }}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
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
        description={tr('您确定要删除这个设备吗？此操作无法撤销。', 'Delete this asset? This action cannot be undone.')}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export default ChamberList;
