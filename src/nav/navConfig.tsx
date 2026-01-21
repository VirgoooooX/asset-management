import React from 'react'
import DashboardIcon from '@mui/icons-material/Dashboard'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import ListAltIcon from '@mui/icons-material/ListAlt'
import TimelineIcon from '@mui/icons-material/ViewTimeline'
import AcUnitIcon from '@mui/icons-material/AcUnit'
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter'
import ScienceIcon from '@mui/icons-material/Science'
import SettingsIcon from '@mui/icons-material/Settings'
import BuildCircleIcon from '@mui/icons-material/BuildCircle'
import PersonIcon from '@mui/icons-material/Person'
import type { SvgIconProps } from '@mui/material'

export type NavRole = 'admin' | 'user'

export type NavSectionId = 'overview' | 'ops' | 'resources' | 'system'

export interface NavItem {
  id: string
  section: NavSectionId
  label: string
  description?: string
  path: string
  roles: NavRole[]
  icon: React.ReactElement
  order: number
  quick?: boolean
}

export interface NavSection {
  id: NavSectionId
  label: string
  icon: React.ReactElement
  order: number
}

export type Tr = (zh: string, en: string) => string

export const buildNavSections = (tr: Tr): NavSection[] => [
  { id: 'overview', label: tr('总览', 'Overview'), icon: <DashboardIcon />, order: 10 },
  { id: 'ops', label: tr('运营', 'Operations'), icon: <NotificationsActiveIcon />, order: 20 },
  { id: 'resources', label: tr('资源', 'Resources'), icon: <AcUnitIcon />, order: 30 },
  { id: 'system', label: tr('系统', 'System'), icon: <SettingsIcon />, order: 40 },
]

export const buildNavItems = (tr: Tr): NavItem[] => [
  {
    id: 'dashboard',
    section: 'overview',
    label: tr('总览', 'Overview'),
    description: tr('关键指标、使用率与校准提醒', 'KPIs, utilization, and calibration reminders'),
    path: '/dashboard',
    roles: ['admin', 'user'],
    icon: <DashboardIcon />,
    order: 10,
    quick: true,
  },
  {
    id: 'timeline',
    section: 'overview',
    label: tr('使用时间线', 'Usage timeline'),
    description: tr('按时间轴查看设备占用情况', 'View occupancy by timeline'),
    path: '/timeline',
    roles: ['admin', 'user'],
    icon: <TimelineIcon />,
    order: 20,
  },
  {
    id: 'alerts',
    section: 'ops',
    label: tr('告警中心', 'Alerts'),
    description: tr('校准到期、逾期、长占用', 'Calibration due/overdue and long occupancy'),
    path: '/alerts',
    roles: ['admin', 'user'],
    icon: <NotificationsActiveIcon />,
    order: 10,
    quick: true,
  },
  {
    id: 'usageLogs',
    section: 'ops',
    label: tr('使用记录', 'Usage logs'),
    description: tr('登记、查询与导出使用记录', 'Create, search, and export usage logs'),
    path: '/usage-logs',
    roles: ['admin', 'user'],
    icon: <ListAltIcon />,
    order: 20,
    quick: true,
  },
  {
    id: 'repairs',
    section: 'ops',
    label: tr('维修管理', 'Repairs'),
    description: tr('维修工单与状态追踪', 'Repair tickets and status tracking'),
    path: '/repairs',
    roles: ['admin'],
    icon: <BuildCircleIcon />,
    order: 30,
    quick: true,
  },
  {
    id: 'assets',
    section: 'resources',
    label: tr('设备台账', 'Assets'),
    description: tr('设备信息、状态与校准日期', 'Asset info, status, and calibration date'),
    path: '/chambers',
    roles: ['admin'],
    icon: <AcUnitIcon />,
    order: 10,
    quick: true,
  },
  {
    id: 'projects',
    section: 'resources',
    label: tr('项目', 'Projects'),
    description: tr('客户项目与配置管理', 'Customer projects and configuration'),
    path: '/projects',
    roles: ['admin'],
    icon: <BusinessCenterIcon />,
    order: 20,
  },
  {
    id: 'testProjects',
    section: 'resources',
    label: tr('测试项目', 'Test projects'),
    description: tr('测试项目/计划管理', 'Test project / plan management'),
    path: '/test-projects',
    roles: ['admin'],
    icon: <ScienceIcon />,
    order: 30,
  },
  {
    id: 'settings',
    section: 'system',
    label: tr('设置', 'Settings'),
    description: tr('外观、阈值与自动刷新', 'Appearance, thresholds, and auto refresh'),
    path: '/settings',
    roles: ['admin', 'user'],
    icon: <SettingsIcon />,
    order: 10,
  },
  {
    id: 'profile',
    section: 'system',
    label: tr('个人', 'Profile'),
    description: tr('个人偏好与密码', 'Preferences and password'),
    path: '/me',
    roles: ['admin', 'user'],
    icon: <PersonIcon />,
    order: 20,
  },
]
