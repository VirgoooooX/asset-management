// src/components/TestProjectList.tsx
import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button, // <--- 新增导入 Button 组件
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AppCard from './AppCard';
import { format, parseISO, isValid } from 'date-fns';
import { TestProject } from '../types';
import { fetchTestProjects } from '../store/testProjectsSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useI18n } from '../i18n'

// 定义 Props 接口
interface TestProjectListProps {
  onEdit: (testProject: TestProject) => void;
  onDelete: (id: string) => void;
}

const TestProjectList: React.FC<TestProjectListProps> = ({ onEdit, onDelete }) => {
  const dispatch = useAppDispatch()
  const { 
    testProjects, 
    loading, 
    error 
  } = useAppSelector((state) => state.testProjects)
  const { tr, dateFnsLocale } = useI18n()

  const dataFetchedRef = useRef(false);

  useEffect(() => {
    if (!loading && !dataFetchedRef.current) {
      dispatch(fetchTestProjects()).finally(() => {
        dataFetchedRef.current = true;
      });
    }
  }, [dispatch, loading]); 

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    if (!isValid(date)) return tr('无效日期', 'Invalid date');
    return format(date, 'yyyy-MM-dd HH:mm', { locale: dateFnsLocale });
  };

  if (loading && !dataFetchedRef.current) { 
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{tr('正在加载测试项目列表...', 'Loading test projects...')}</Typography>
      </Box>
    );
  }

  if (error && !loading) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {tr(`加载测试项目列表失败: ${error}`, `Failed to load test projects: ${error}`)}
        <Button // 现在 Button 组件应该能被正确识别了
            size="small" 
            onClick={() => {
                dataFetchedRef.current = false; 
                dispatch(fetchTestProjects());
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
      <TableContainer component={Box} sx={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
        <Table sx={{ minWidth: 650 }} aria-label={tr('测试项目列表', 'Test project list')} size="small">
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{tr('名称', 'Name')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">{tr('温度 (°C)', 'Temperature (°C)')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">{tr('湿度 (%)', 'Humidity (%)')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">{tr('时长 (小时)', 'Duration (hours)')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('关联项目 ID', 'Project ID')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{tr('创建时间', 'Created')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="center">{tr('操作', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {testProjects.length === 0 && !loading && dataFetchedRef.current ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {tr('没有找到测试项目数据。', 'No test projects found.')}
                </TableCell>
              </TableRow>
            ) : (
              testProjects.map((tp) => (
                <TableRow key={tp.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {tp.name}
                  </TableCell>
                  <TableCell align="right">{tp.temperature}</TableCell>
                  <TableCell align="right">{tp.humidity}</TableCell>
                  <TableCell align="right">{tp.duration}</TableCell>
                  <TableCell>{tp.projectId || tr('无', 'None')}</TableCell>
                  <TableCell>{formatDate(tp.createdAt)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={tr('编辑', 'Edit')}>
                      <IconButton onClick={() => onEdit(tp)} size="small" color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={tr('删除', 'Delete')}>
                      <IconButton onClick={() => onDelete(tp.id)} size="small" color="error">
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
  );
};

export default TestProjectList;
