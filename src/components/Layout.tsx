// src/components/Layout.tsx
import React, { ReactNode, useMemo, useState } from 'react'; // useState for potential FAB group open/close
import { useNavigate } from 'react-router-dom'; // useNavigate for programmatic navigation
import {
  AppBar,
  Toolbar,
  Typography,
  CssBaseline,
  Box,
  SpeedDial, // MUI SpeedDial component for a nice menu effect
  SpeedDialIcon,
  SpeedDialAction,
  Button, // <<< Add Button here
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';

import { signOutUser } from '../store/authSlice'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'; // 新增 (登出图标)
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { alpha } from '@mui/material/styles'
import AppsIcon from '@mui/icons-material/Apps'
import NavHubDialog from './NavHubDialog'
import { buildNavItems, buildNavSections } from '../nav/navConfig'
import { useI18n } from '../i18n'

const appBarHeight = '64px';

interface LayoutProps {
  children: ReactNode;
}

// Styled Box for the FAB group container
const FabContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(4), // Adjust spacing from bottom
  right: theme.spacing(4),  // Adjust spacing from right
  zIndex: theme.zIndex.speedDial, // Ensure it's above other content
}));


const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const { tr } = useI18n()

  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [navHubOpen, setNavHubOpen] = useState(false)

  const handleSpeedDialOpen = () => setSpeedDialOpen(true);
  const handleSpeedDialClose = () => setSpeedDialOpen(false);

  const handleActionClick = (path: string) => {
    navigate(path);
    setSpeedDialOpen(false);
  };

  const handleLogout = () => { // 新增
    dispatch(signOutUser());
    navigate('/login');
    setSpeedDialOpen(false);
  };

  // 根据用户角色和认证状态过滤 SpeedDial actions
  const role = user?.role as 'admin' | 'user' | undefined
  const navSections = useMemo(() => buildNavSections(tr), [tr])
  const navItems = useMemo(() => buildNavItems(tr), [tr])
  const filteredItems = isAuthenticated && role ? navItems.filter((i) => i.roles.includes(role)) : []
  const quickItems = filteredItems.filter((i) => i.quick).slice().sort((a, b) => a.order - b.order)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: (theme) =>
            `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.96)} 0%, ${alpha(theme.palette.primary.dark, 0.94)} 100%)`,
          color: 'primary.contrastText',
          height: appBarHeight,
          boxShadow: (theme) => `0 10px 28px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.18)}`,
        }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              component="img"
              src="/favicon.svg"
              alt="Logo"
              sx={{ width: 32, height: 32, mr: 1.5 }}
            />
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontSize: '24px', // 可以适当调整字体大小
                fontWeight: 'bold',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.2)', // 可以调整阴影
              }}
            >
              {tr('实验室设备管理平台', 'Lab Asset Management')}
              {role === 'admin' ? ' (admin)' : ''}
            </Typography>
          </Box>
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                color="inherit"
                onClick={() => setNavHubOpen(true)}
                aria-label="open navigation hub"
                sx={{
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.common.white, 0.18),
                  backgroundColor: (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.10 : 0.12),
                  '&:hover': {
                    backgroundColor: (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.16 : 0.18),
                  },
                }}
              >
                <AppsIcon fontSize="small" />
              </IconButton>
              <Button
                color="inherit"
                startIcon={<ExitToAppIcon />}
                onClick={handleLogout}
                sx={{
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.common.white, 0.16),
                  backgroundColor: (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.10 : 0.08),
                  '&:hover': {
                    backgroundColor: (theme) => alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.16 : 0.14),
                  },
                }}
              >
                {tr('登出', 'Sign out')}
              </Button>
            </Box>
          ) : null}
        </Toolbar>
      </AppBar>

      {isAuthenticated && role ? (
        <NavHubDialog
          open={navHubOpen}
          onClose={() => setNavHubOpen(false)}
          sections={navSections}
          items={navItems}
          role={role}
          onNavigate={(path) => navigate(path)}
        />
      ) : null}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          backgroundColor: 'background.default',
          paddingTop: appBarHeight, // Space for the fixed AppBar
          // height: '100vh', // 高度由外层 Box 控制
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden', // Main area itself should not scroll
        }}
      >
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto', // Content within this Box scrolls if needed
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            // p: 3, // 可以给内容区域一些通用内边距
          }}
        >
          {children} {/* This will be ScrollingTimeline directly or via TimelinePage */}
        </Box>
      </Box>

      {/* Footer Section */}
      <Box
        component="footer"
        sx={{
          py: 0.5,
          px: 2,
          mt: 'auto', // 将页脚推到底部
          backgroundColor: (theme) =>
            theme.palette.mode === 'light'
              ? theme.palette.grey[200]
              : theme.palette.grey[800],
          borderTop: '1px solid',
          borderTopColor: 'divider',
          flexShrink: 0, // 防止页脚在内容不足时缩小
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
          © {new Date().getFullYear()} {tr('Jabil 内部专用', 'Internal use only')} · All Rights Reserved · By Vigoss
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
          · {tr('版本', 'Version')} 2.0.0
        </Typography>
      </Box>

      {/* Floating Action Button Group / Speed Dial */}
      {isAuthenticated && (
        <FabContainer>
          <SpeedDial
            ariaLabel={tr('快捷导航', 'Quick navigation')}
            icon={<SpeedDialIcon />}
            onClose={handleSpeedDialClose}
            onOpen={handleSpeedDialOpen}
            open={speedDialOpen}
            direction="up"
            sx={{
              '& .MuiFab-primary': {
                backgroundColor: 'primary.main',
                boxShadow: (theme) => `0 16px 34px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.22)}`,
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              },
            }}
          >
            {quickItems.map((action) => (
              <SpeedDialAction
                key={action.id}
                icon={action.icon}
                tooltipTitle={action.label}
                tooltipOpen
                onClick={() => handleActionClick(action.path)}
                FabProps={{
                  size: 'medium',
                  sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.10),
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.32),
                    },
                  }
                }}
              />
            ))}
          </SpeedDial>
        </FabContainer>
      )}
    </Box>
  );
};

export default Layout;
