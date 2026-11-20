// src/App.tsx
import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import { bootstrapAuth } from './store/authSlice'
import { loadSettingsFromBackend, loadSettingsFromStorage } from './store/settingsSlice'
import { useAppDispatch, useAppSelector } from './store/hooks'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const ChambersPage = lazy(() => import('./pages/ChambersPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const TestProjectsPage = lazy(() => import('./pages/TestProjectsPage'))
const TestProjectDetailPage = lazy(() => import('./pages/TestProjectDetailPage'))
const UsageLogPage = lazy(() => import('./pages/UsagelogPage'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const RepairsPage = lazy(() => import('./pages/RepairsPage'))
const AssetCalibrationsPage = lazy(() => import('./pages/AssetCalibrationsPage'))
const RepairTicketDetailPage = lazy(() => import('./pages/RepairTicketDetailPage'))
const AssetDetailPage = lazy(() => import('./pages/AssetDetailPage'))
const AssetCategoryPage = lazy(() => import('./pages/AssetCategoryPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const ProjectCostReportPage = lazy(() => import('./pages/ProjectCostReportPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))

let didBootstrap = false

const RouteFallback: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
)

function App() {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)

  useEffect(() => {
    if (didBootstrap) return
    didBootstrap = true
    dispatch(loadSettingsFromStorage())
    dispatch(bootstrapAuth())
  }, [dispatch])

  useEffect(() => {
    if (!isAuthenticated) return
    dispatch(loadSettingsFromBackend())
  }, [isAuthenticated, dispatch])

  return (
    <Router>
      <Layout>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<PrivateRoute />}>
              <Route path="/" element={<Navigate replace to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/timeline" element={<TimelinePage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/usage-logs" element={<UsageLogPage />} />
              <Route path="/me" element={<ProfilePage />} />
              <Route path="/repairs" element={<RepairsPage />} />
              <Route path="/repairs/:ticketId" element={<RepairTicketDetailPage />} />
            </Route>

            <Route element={<PrivateRoute allowedRoles={['admin', 'manager']} />}>
              <Route path="/chambers" element={<ChambersPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/test-projects" element={<TestProjectsPage />} />
              <Route path="/test-projects/:testProjectId" element={<TestProjectDetailPage />} />
              <Route path="/calibrations" element={<AssetCalibrationsPage />} />
              <Route path="/reports/project-cost" element={<ProjectCostReportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/assets/new" element={<AssetDetailPage mode="create" />} />
              <Route path="/assets/categories/:categoryKey" element={<AssetCategoryPage />} />
              <Route path="/assets/:assetId" element={<AssetDetailPage mode="view" />} />
            </Route>

            <Route element={<PrivateRoute allowedRoles={['admin']} />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogPage />} />
            </Route>

            <Route path="*" element={<Navigate replace to="/dashboard" />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  )
}

export default App
