import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material'
import { UserRole } from '../types'; // 确保路径正确
import { useAppSelector } from '../store/hooks'

interface PrivateRouteProps {
  allowedRoles?: UserRole[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAppSelector((state) => state.auth)
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    // 用户未登录，重定向到登录页，并保存当前位置以便登录后返回
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // 用户已登录但角色不匹配，可以重定向到无权限页面或首页
    // 这里简单重定向到 timeline，您可以创建一个专门的 "Access Denied" 页面
    return <Navigate to="/timeline" state={{ from: location }} replace />;
    // 或者显示一个无权限的提示信息：
    // return <div>您没有权限访问此页面。</div>;
  }

  return <Outlet />; // 如果认证通过且角色符合（或无需特定角色），则渲染子路由
};

export default PrivateRoute;
