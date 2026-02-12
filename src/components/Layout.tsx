// src/components/Layout.tsx
import React, { ReactNode, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CssBaseline,
  Box,
  Typography,
} from '@mui/material';

import { signOutUser } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { hydrateNotifications } from '../store/notificationsSlice'
import { buildNavItems, buildNavSections } from '../nav/navConfig'
import { useI18n } from '../i18n'
import { buildInfo } from '../buildInfo'
import SideNav from './SideNav'

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const { tr } = useI18n()

  useEffect(() => {
    if (!isAuthenticated) return
    const id = user?.id
    if (!id) return
    dispatch(hydrateNotifications({ userId: id }))
  }, [dispatch, isAuthenticated, user?.id])

  const handleLogout = () => { // 新增
    dispatch(signOutUser());
    navigate('/login');
  };

  const role = user?.role as 'admin' | 'manager' | 'user' | undefined
  const navSections = useMemo(() => buildNavSections(tr), [tr])
  const navItems = useMemo(() => buildNavItems(tr), [tr])

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />

      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {isAuthenticated ? (
          <SideNav
            isAuthenticated={isAuthenticated}
            role={role}
            sections={navSections}
            items={navItems}
            onNavigate={(path) => navigate(path)}
            onLogout={handleLogout}
          />
        ) : null}

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            className="app-scroll"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              minHeight: 0,
            }}
          >
            {children}
          </Box>

          <Box
            component="footer"
            sx={{
              py: 0.5,
              px: 2,
              mt: 'auto',
              backgroundColor: (theme) =>
                theme.palette.mode === 'light'
                  ? theme.palette.grey[200]
                  : theme.palette.grey[800],
              borderTop: '1px solid',
              borderTopColor: 'divider',
              flexShrink: 0,
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
              · {tr('版本', 'Version')} {buildInfo.version}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
