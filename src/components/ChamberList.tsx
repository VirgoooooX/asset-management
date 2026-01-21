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
import TitleWithIcon from './TitleWithIcon'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import { useI18n } from '../i18n'

interface ChamberListProps {
  onView: (id: string) => void
  onEdit: (id: string) => void;
  onAddNew: () => void;
}

const ChamberList: React.FC<ChamberListProps> = ({ onView, onEdit, onAddNew }) => {
  const dispatch = useAppDispatch()
  const { assets: chambers, loading, error } = useAppSelector((state) => state.assets)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { tr } = useI18n()

  useEffect(() => {
    dispatch(fetchAssetsByType('chamber'));
  }, [dispatch]);

  const handleDeleteClick = (id: string) => setPendingDeleteId(id);

  const handleCloseDelete = () => setPendingDeleteId(null);

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    dispatch(deleteAsset(pendingDeleteId));
    setPendingDeleteId(null);
  };

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
      <AppCard
        title={<TitleWithIcon icon={<AcUnitIcon />}>{tr('设备列表', 'Asset list')}</TitleWithIcon>}
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
