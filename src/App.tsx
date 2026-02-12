// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage'
import TimelinePage from './pages/TimelinePage';
import ChambersPage from './pages/ChambersPage';
import ProjectsPage from './pages/ProjectsPage';
import TestProjectsPage from './pages/TestProjectsPage';
import TestProjectDetailPage from './pages/TestProjectDetailPage'
import UsageLogPage from './pages/UsagelogPage';
import AlertsPage from './pages/AlertsPage'
import SettingsPage from './pages/SettingsPage'
import RepairsPage from './pages/RepairsPage';
import AssetCalibrationsPage from './pages/AssetCalibrationsPage';
import RepairTicketDetailPage from './pages/RepairTicketDetailPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AssetPerformancePage from './pages/AssetPerformancePage'
import AssetCategoryPage from './pages/AssetCategoryPage'
import LoginPage from './pages/LoginPage'; // 新增
import PrivateRoute from './components/PrivateRoute'; // 新增
import { bootstrapAuth } from './store/authSlice'
import { loadSettingsFromBackend, loadSettingsFromStorage } from './store/settingsSlice'
import { useEffect } from 'react'; // 新增
import { useAppDispatch, useAppSelector } from './store/hooks'
import ProfilePage from './pages/ProfilePage'
import AdminUsersPage from './pages/AdminUsersPage'
import CapabilitiesSummaryPage from './pages/CapabilitiesSummaryPage'
import ProjectCostReportPage from './pages/ProjectCostReportPage'
import AuditLogPage from './pages/AuditLogPage'

let didBootstrap = false

function App() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector((s) => s.auth)

  useEffect(() => { // 新增: 应用启动时尝试从 localStorage 加载用户信息
    if (didBootstrap) return
    didBootstrap = true
    dispatch(loadSettingsFromStorage())
    dispatch(bootstrapAuth())
  }, [dispatch]);

  useEffect(() => {
    if (!auth.isAuthenticated) return
    dispatch(loadSettingsFromBackend())
  }, [auth.isAuthenticated, dispatch])

  return (
    <Router>
      <Layout> {/* Layout 现在可能需要感知认证状态来显示/隐藏登出按钮 */}
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* 受保护的路由 */}
          <Route element={<PrivateRoute />}> {/* 所有需要登录的页面 */}
            <Route path="/" element={<Navigate replace to="/dashboard" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/usage-logs" element={<UsageLogPage />} />
            <Route path="/me" element={<ProfilePage />} />
            <Route path="/repairs" element={<RepairsPage />} />
            <Route path="/repairs/:ticketId" element={<RepairTicketDetailPage />} />
          </Route>

          <Route element={<PrivateRoute allowedRoles={['admin', 'manager']} />}> {/* 仅管理员可访问的页面 */}
            <Route path="/chambers" element={<ChambersPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/test-projects" element={<TestProjectsPage />} />
            <Route path="/test-projects/:testProjectId" element={<TestProjectDetailPage />} />
            <Route path="/calibrations" element={<AssetCalibrationsPage />} />
            <Route path="/reports/project-cost" element={<ProjectCostReportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/capabilities" element={<CapabilitiesSummaryPage />} />
            <Route path="/assets/new" element={<AssetDetailPage mode="create" />} />
            <Route path="/assets/categories/:categoryKey" element={<AssetCategoryPage />} />
            <Route path="/assets/:assetId" element={<AssetDetailPage mode="view" />} />
            <Route path="/assets/:assetId/performance" element={<AssetPerformancePage />} />
          </Route>

          <Route element={<PrivateRoute allowedRoles={['admin']} />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
          </Route>
          
          {/* 可以添加一个 404 Not Found 页面 */}
          {/* <Route path="*" element={<NotFoundPage />} /> */}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
