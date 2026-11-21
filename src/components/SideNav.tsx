import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LogoutIcon from '@mui/icons-material/ExitToApp'
import LightModeIcon from '@mui/icons-material/LightMode'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import TranslateIcon from '@mui/icons-material/Translate'
import { useLocation } from 'react-router-dom'
import { useMinuteClock } from '../hooks/useMinuteClock'
import { useI18n } from '../i18n'
import type { NavItem, NavRole, NavSection } from '../nav/navConfig'
import { selectDerivedAlerts, type DerivedAlert } from '../store/alertsSelectors'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { markAllRead, markRead } from '../store/notificationsSlice'
import { setLanguage, setSidebarMode, toggleThemeMode } from '../store/settingsSlice'
import JustifiedNavLabel from './sidenav/JustifiedNavLabel'
import NotificationPopover from './sidenav/NotificationPopover'
import SideNavOverlayRail from './sidenav/SideNavOverlayRail'

type Props = {
  isAuthenticated: boolean
  role?: NavRole
  sections: NavSection[]
  items: NavItem[]
  onNavigate: (path: string) => void
  onLogout: () => void
}

const COLLAPSED_WIDTH = 72
const EXPANDED_WIDTH = 216
const ICON_COLUMN_WIDTH = COLLAPSED_WIDTH
const NAV_LABEL_JUSTIFY_CHARS = 2
const HOVER_OPEN_DELAY_MS = 300
const ICON_SIZE = 24
const ROW_INSET = 8
const TOOL_ROW_HEIGHT = 44

const getNormalizedPathForSelection = (pathname: string) => {
  if (pathname.startsWith('/assets/')) return '/chambers'
  return pathname
}

const SideNav: React.FC<Props> = ({ isAuthenticated, role, sections, items, onNavigate, onLogout }) => {
  const theme = useTheme()
  const { tr, language } = useI18n()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useAppDispatch()
  const sidebarMode = useAppSelector((s) => s.settings.nav?.sidebarMode) ?? 'auto'
  const themeMode = useAppSelector((s) => s.settings.themeMode) ?? 'light'
  const user = useAppSelector((s) => s.auth.user)
  const readIds = useAppSelector((s) => s.notifications.readIds)

  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [notifAnchorEl, setNotifAnchorEl] = useState<HTMLElement | null>(null)
  const effectiveExpanded = isMobile
    ? true
    : sidebarMode === 'lockedOpen'
      ? true
      : sidebarMode === 'lockedCollapsed'
        ? false
        : expanded
  const hasFocusWithinRef = useRef(false)
  const isPointerInsideRef = useRef(false)
  const enterTimerRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<number | null>(null)
  const navScrollRef = useRef<HTMLDivElement>(null)

  const normalizedPathname = useMemo(() => getNormalizedPathForSelection(location.pathname), [location.pathname])

  const visibleItems = useMemo(() => {
    if (!isAuthenticated || !role) return []
    return items.filter((i) => i.roles.includes(role))
  }, [isAuthenticated, items, role])

  const sectionsSorted = useMemo(() => sections.slice().sort((a, b) => a.order - b.order), [sections])

  const itemsBySection = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    visibleItems.forEach((item) => {
      const list = map.get(item.section) ?? []
      list.push(item)
      map.set(item.section, list)
    })
    map.forEach((list, key) => map.set(key, list.slice().sort((a, b) => a.order - b.order)))
    return map
  }, [visibleItems])

  const nowMs = useMinuteClock(isAuthenticated)

  const alerts = useAppSelector((state) => selectDerivedAlerts(state, nowMs))
  const unreadCount = useMemo(() => alerts.filter((a) => !readIds[a.id]).length, [alerts, readIds])
  const latestAlerts = useMemo(() => alerts.slice(0, 20), [alerts])

  const visibleSections = useMemo(() => {
    return sectionsSorted.filter((s) => (itemsBySection.get(s.id) ?? []).length > 0)
  }, [itemsBySection, sectionsSorted])

  const isSelected = useCallback(
    (path: string) => {
      if (normalizedPathname === path) return true
      if (path === '/dashboard' && normalizedPathname === '/') return true
      return normalizedPathname.startsWith(path + '/')
    },
    [normalizedPathname]
  )

  const activeNavItem = useMemo(
    () => visibleItems.find((item) => isSelected(item.path)),
    [isSelected, visibleItems]
  )

  const clearTimers = useCallback(() => {
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    enterTimerRef.current = null
    leaveTimerRef.current = null
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const openExpanded = useCallback(() => {
    clearTimers()
    if (isMobile) return
    if (sidebarMode !== 'auto') return
    enterTimerRef.current = window.setTimeout(() => setExpanded(true), HOVER_OPEN_DELAY_MS)
  }, [clearTimers, isMobile, sidebarMode])

  const closeExpanded = useCallback(() => {
    clearTimers()
    if (isMobile) return
    if (sidebarMode !== 'auto') return
    leaveTimerRef.current = window.setTimeout(() => {
      if (!hasFocusWithinRef.current) setExpanded(false)
    }, 200)
  }, [clearTimers, isMobile, sidebarMode])

  const handleFocusCapture = useCallback(() => {
    hasFocusWithinRef.current = true
    clearTimers()
    setExpanded(true)
  }, [clearTimers])

  const handleBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as Node | null
      const current = e.currentTarget
      if (next && current.contains(next)) return
      hasFocusWithinRef.current = false
      closeExpanded()
    },
    [closeExpanded]
  )

  const drawerWidth = effectiveExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH
  const toggleSidebarMode = useCallback(() => {
    const next =
      sidebarMode === 'auto'
        ? 'lockedOpen'
        : sidebarMode === 'lockedOpen'
          ? 'lockedCollapsed'
          : 'auto'

    dispatch(setSidebarMode(next))
    clearTimers()
    hasFocusWithinRef.current = false

    if (next === 'lockedOpen') {
      setExpanded(true)
      return
    }
    if (next === 'lockedCollapsed') {
      setExpanded(false)
      return
    }

    if (!isPointerInsideRef.current) setExpanded(false)
  }, [clearTimers, dispatch, sidebarMode])

  const iconWrapperSx = useMemo(
    () => ({
      height: TOOL_ROW_HEIGHT,
      display: 'grid',
      placeItems: 'center',
      lineHeight: 0,
      '& .MuiSvgIcon-root': {
        fontSize: ICON_SIZE,
        display: 'block',
      },
    }),
    []
  )

  const brandLogoContainerSize = 44
  const brandLogoSize = 36

  const brand = (
    <Box
      sx={{
        height: 64,
        display: 'grid',
        gridTemplateColumns: `${ICON_COLUMN_WIDTH}px 1fr`,
        alignItems: 'center',
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box
          sx={{
            width: brandLogoContainerSize,
            height: brandLogoContainerSize,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.08),
          }}
        >
          <Box
            component="img"
            src="/favicon.svg"
            alt="Logo"
            sx={{
              width: brandLogoSize,
              height: brandLogoSize,
              flexShrink: 0,
              display: 'block',
            }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          minWidth: 0,
          pr: 1.5,
          opacity: effectiveExpanded ? 1 : 0,
          maxWidth: effectiveExpanded ? EXPANDED_WIDTH - ICON_COLUMN_WIDTH : 0,
          transform: effectiveExpanded ? 'translateX(0)' : 'translateX(-6px)',
          transition: theme.transitions.create(['opacity', 'transform', 'max-width'], {
            easing: theme.transitions.easing.sharp,
            duration: 200,
          }),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'hidden',
          pointerEvents: effectiveExpanded ? 'auto' : 'none',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -0.2,
            fontSize: language === 'en' ? '0.92rem' : '1.12rem',
          }}
        >
          {tr('设备管理', 'Lab Asset Management')}
        </Typography>
      </Box>
    </Box>
  )

  const baseToolRowSx = {
    borderRadius: 0,
    height: effectiveExpanded ? 'auto' : TOOL_ROW_HEIGHT,
    minHeight: TOOL_ROW_HEIGHT,
    px: 0,
    py: 0,
    display: 'grid',
    gridTemplateColumns: `${ICON_COLUMN_WIDTH}px 1fr`,
    alignItems: 'center',
    mx: 0,
    my: 0.25,
    position: 'relative',
    '& > *': { position: 'relative', zIndex: 1 },
    '&::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: 0,
      transition: theme.transitions.create(['background-color'], {
        easing: theme.transitions.easing.sharp,
        duration: 200,
      }),
    },
    '&:hover': {
      bgcolor: 'transparent',
    },
    '&:hover::after': {
      bgcolor: alpha(theme.palette.action.hover, 0.35),
    },
  } as const

  const textColSx = {
    minWidth: 0,
    pr: 1.5,
    opacity: effectiveExpanded ? 1 : 0,
    height: effectiveExpanded ? 'auto' : 0,
    maxWidth: effectiveExpanded ? EXPANDED_WIDTH - ICON_COLUMN_WIDTH : 0,
    transform: effectiveExpanded ? 'translateX(0)' : 'translateX(-6px)',
    transition: theme.transitions.create(['opacity', 'transform', 'max-width', 'height'], {
      easing: theme.transitions.easing.sharp,
      duration: 200,
    }),
    overflow: 'hidden',
    pointerEvents: effectiveExpanded ? 'auto' : 'none',
  } as const

  const userInitial = (user?.username || 'U').slice(0, 1).toUpperCase()
  const nextThemeLabel = themeMode === 'dark' ? tr('浅色模式', 'Light mode') : tr('深色模式', 'Dark mode')
  const nextLangLabel = language === 'zh' ? 'English' : '中文'
  const tooltipDisabled = effectiveExpanded || isMobile

  const handleNavigateAndClose = (path: string) => {
    clearTimers()
    if (!isMobile && sidebarMode === 'auto') setExpanded(false)
    onNavigate(path)
    if (isMobile) setMobileOpen(false)
  }

  const navList = (
    <Box
      onMouseEnter={
        !isMobile
          ? () => {
              isPointerInsideRef.current = true
              openExpanded()
            }
          : undefined
      }
      onMouseLeave={
        !isMobile
          ? () => {
              isPointerInsideRef.current = false
              closeExpanded()
            }
          : undefined
      }
      onFocusCapture={!isMobile ? handleFocusCapture : undefined}
      onBlurCapture={!isMobile ? handleBlurCapture : undefined}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {brand}

      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          ref={navScrollRef}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              width: 0,
              height: 0,
              display: 'none',
            },
          }}
        >
          <List sx={{ py: 1.5 }}>
          {visibleSections.map((section, sectionIndex) => {
            const list = itemsBySection.get(section.id) ?? []
            if (list.length === 0) return null
            const nextSection = sectionIndex < visibleSections.length - 1 ? visibleSections[sectionIndex + 1] : null
            return (
              <Box key={section.id} component="li" sx={{ listStyle: 'none' }}>
                {list.map((item) => {
                  const selected = isSelected(item.path)
                  return (
                    <Tooltip
                      key={item.id}
                      title={item.label}
                      placement="right"
                      arrow
                      disableHoverListener={tooltipDisabled}
                    >
                      <ListItemButton
                        aria-label={item.label}
                        selected={selected}
                        onClick={() => handleNavigateAndClose(item.path)}
                        sx={{
                          mx: 0,
                          my: 0.35,
                          borderRadius: 0,
                          px: 0,
                          minHeight: 46,
                          display: 'grid',
                          gridTemplateColumns: `${ICON_COLUMN_WIDTH}px 1fr`,
                          alignItems: 'center',
                          position: 'relative',
                          '& > *': { position: 'relative', zIndex: 1 },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            borderRadius: 0,
                            transition: theme.transitions.create(['background-color'], {
                              easing: theme.transitions.easing.sharp,
                              duration: 200,
                            }),
                          },
                          '&:hover::after': {
                            bgcolor: alpha(theme.palette.action.hover, 0.35),
                          },
                          '&.Mui-selected': {
                            bgcolor: 'transparent',
                            '&::after': {
                              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.10),
                            },
                            '&:hover::after': {
                              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.14),
                            },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              top: 10,
                              bottom: 10,
                              width: 3,
                              borderRadius: 2,
                              backgroundColor: theme.palette.primary.main,
                            },
                          },
                        }}
                      >
                        <Box sx={iconWrapperSx}>
                          <Box
                            sx={{
                              color: selected ? 'primary.main' : 'text.secondary',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            {item.icon}
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            minWidth: 0,
                            pr: 1.5,
                            opacity: effectiveExpanded ? 1 : 0,
                            maxWidth: effectiveExpanded ? EXPANDED_WIDTH - ICON_COLUMN_WIDTH : 0,
                            transform: effectiveExpanded ? 'translateX(0)' : 'translateX(-6px)',
                            transition: theme.transitions.create(['opacity', 'transform', 'max-width'], {
                              easing: theme.transitions.easing.sharp,
                              duration: 200,
                            }),
                            overflow: 'hidden',
                            pointerEvents: effectiveExpanded ? 'auto' : 'none',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.92rem' }} noWrap>
                            <JustifiedNavLabel label={item.label} maxJustifyChars={NAV_LABEL_JUSTIFY_CHARS} />
                          </Typography>
                        </Box>
                      </ListItemButton>
                    </Tooltip>
                  )
                })}

                {nextSection ? (
                  <Box sx={{ position: 'relative', my: 1.5, mx: effectiveExpanded ? 1.25 : 0.75 }}>
                    <Divider />
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: effectiveExpanded ? 'translate(-50%, -50%)' : 'translate(-50%, -50%) translateX(-6px)',
                        px: 1,
                        bgcolor: 'background.paper',
                        color: 'text.secondary',
                        letterSpacing: 0.4,
                        fontWeight: 700,
                        opacity: effectiveExpanded ? 1 : 0,
                        transition: theme.transitions.create(['opacity', 'transform'], {
                          easing: theme.transitions.easing.sharp,
                          duration: 200,
                        }),
                        pointerEvents: 'none',
                      }}
                    >
                      <JustifiedNavLabel label={nextSection.label} maxJustifyChars={NAV_LABEL_JUSTIFY_CHARS} />
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            )
          })}
        </List>
        </Box>
        <SideNavOverlayRail viewportRef={navScrollRef} />
      </Box>

      <Box sx={{ borderTop: '1px solid', borderTopColor: 'divider', py: 0.5 }}>
        {user ? (
          <Tooltip
            title={`${user.username} (${user.role})`}
            placement="right"
            arrow
            disableHoverListener={tooltipDisabled}
          >
            <ListItemButton
              aria-label={tr('个人中心', 'Profile')}
              onClick={() => handleNavigateAndClose('/me')}
              sx={baseToolRowSx}
            >
              <Box sx={iconWrapperSx}>
                <Avatar
                  sx={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.14),
                    color: 'primary.main',
                  }}
                >
                  {userInitial}
                </Avatar>
              </Box>
              <Box sx={textColSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                  {user.username}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }} noWrap>
                  {user.role}
                </Typography>
              </Box>
            </ListItemButton>
          </Tooltip>
        ) : null}

        <Box
          sx={{
            mx: 0,
            my: effectiveExpanded ? 0.5 : 0,
            height: effectiveExpanded ? 'auto' : 0,
            opacity: effectiveExpanded ? 1 : 0,
            overflow: 'hidden',
            transition: theme.transitions.create(['opacity'], { easing: theme.transitions.easing.sharp, duration: 200 }),
            px: effectiveExpanded ? `${ROW_INSET}px` : 0,
          }}
        >
          <Divider />
        </Box>

        <Tooltip title={nextThemeLabel} placement="right" arrow disableHoverListener={tooltipDisabled}>
          <ListItemButton
            aria-label={nextThemeLabel}
            onClick={() => dispatch(toggleThemeMode())}
            sx={baseToolRowSx}
          >
            <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
              {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </Box>
            <Box sx={textColSx}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {nextThemeLabel}
              </Typography>
            </Box>
          </ListItemButton>
        </Tooltip>

        <Tooltip
          title={tr(`切换语言：${nextLangLabel}`, `Switch language: ${nextLangLabel}`)}
          placement="right"
          arrow
          disableHoverListener={tooltipDisabled}
        >
          <ListItemButton
            aria-label={tr('切换语言', 'Switch language')}
            onClick={() => dispatch(setLanguage(language === 'zh' ? 'en' : 'zh'))}
            sx={baseToolRowSx}
          >
            <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
              <TranslateIcon />
            </Box>
            <Box sx={textColSx}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {language === 'zh' ? '切换为 English' : 'Switch to 中文'}
              </Typography>
            </Box>
          </ListItemButton>
        </Tooltip>

        {!isMobile ? (
          <Tooltip title={tr('切换侧边栏模式', 'Toggle sidebar mode')} placement="right" arrow disableHoverListener={tooltipDisabled}>
            <ListItemButton aria-label={tr('切换侧边栏模式', 'Toggle sidebar mode')} onClick={toggleSidebarMode} sx={baseToolRowSx}>
              <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
                {effectiveExpanded ? <MenuOpenIcon /> : <MenuIcon />}
              </Box>
              <Box sx={textColSx}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }} noWrap>
                  {tr('侧边栏', 'Sidebar')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }} noWrap>
                  {sidebarMode === 'auto'
                    ? tr('自动（悬停展开）', 'Auto (hover)')
                    : sidebarMode === 'lockedOpen'
                      ? tr('固定展开', 'Locked open')
                      : tr('固定收起', 'Locked collapsed')}
                </Typography>
              </Box>
            </ListItemButton>
          </Tooltip>
        ) : null}

        <Tooltip title={tr('通知', 'Notifications')} placement="right" arrow disableHoverListener={tooltipDisabled}>
          <ListItemButton
            aria-label={tr('通知', 'Notifications')}
            onClick={(e) => setNotifAnchorEl(e.currentTarget)}
            sx={baseToolRowSx}
          >
            <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
              <Badge color="error" badgeContent={unreadCount} max={99} invisible={unreadCount === 0}>
                <NotificationsActiveIcon />
              </Badge>
            </Box>
            <Box sx={textColSx}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {tr('通知', 'Notifications')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }} noWrap>
                {unreadCount > 0 ? tr(`未读 ${unreadCount} 条`, `${unreadCount} unread`) : tr('暂无未读', 'No unread')}
              </Typography>
            </Box>
          </ListItemButton>
        </Tooltip>

        <Tooltip title={tr('登出', 'Sign out')} placement="right" arrow disableHoverListener={tooltipDisabled}>
          <ListItemButton aria-label={tr('登出', 'Sign out')} onClick={onLogout} sx={baseToolRowSx}>
            <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
              <LogoutIcon />
            </Box>
            <Box sx={textColSx}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {tr('登出', 'Sign out')}
              </Typography>
            </Box>
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  )

  const notifOpen = Boolean(notifAnchorEl)
  const closeNotif = () => setNotifAnchorEl(null)
  const handleOpenAlert = (alert: DerivedAlert) => {
    dispatch(markRead({ id: alert.id }))
    closeNotif()
    clearTimers()
    if (!isMobile && sidebarMode === 'auto') setExpanded(false)
    const target = alert.type === 'calibration-due' ? '/calibrations' : '/alerts'
    onNavigate(target)
    if (isMobile) setMobileOpen(false)
  }

  const handleMarkAllRead = () => dispatch(markAllRead({ ids: alerts.map((a) => a.id) }))

  if (!isAuthenticated) return null

  if (isMobile) {
    return (
      <>
        <Paper
          component="header"
          elevation={0}
          sx={{
            height: 52,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            borderRadius: 0,
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            backdropFilter: 'blur(12px)',
          }}
        >
          <IconButton
            onClick={() => setMobileOpen(true)}
            size="small"
            aria-label={tr('打开导航', 'Open navigation')}
          >
            <MenuIcon fontSize="small" />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Box
              component="img"
              src="/favicon.svg"
              alt="Logo"
              sx={{ width: 24, height: 24, flexShrink: 0, display: 'block' }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {activeNavItem?.label ?? tr('设备管理', 'Lab Asset Management')}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={() => dispatch(toggleThemeMode())}
            aria-label={nextThemeLabel}
          >
            {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>

          <Button
            size="small"
            variant="text"
            onClick={() => dispatch(setLanguage(language === 'zh' ? 'en' : 'zh'))}
            sx={{ minWidth: 'auto', px: 1, fontWeight: 600 }}
            aria-label={tr('切换语言', 'Switch language')}
          >
            {language === 'zh' ? 'EN' : '中'}
          </Button>

          <IconButton
            size="small"
            onClick={(e) => setNotifAnchorEl(e.currentTarget)}
            aria-label={tr('通知', 'Notifications')}
          >
            <Badge color="error" badgeContent={unreadCount} max={99} invisible={unreadCount === 0}>
              <NotificationsActiveIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Paper>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: EXPANDED_WIDTH,
              boxSizing: 'border-box',
            },
          }}
        >
          <Paper elevation={0} sx={{ height: '100%', borderRadius: 0 }}>
            <Box sx={{ height: '100%' }}>{navList}</Box>
          </Paper>
        </Drawer>

        <NotificationPopover
          open={notifOpen}
          anchorEl={notifAnchorEl}
          onClose={closeNotif}
          unreadCount={unreadCount}
          alertsCount={alerts.length}
          latestAlerts={latestAlerts}
          readIds={readIds}
          onMarkAllRead={handleMarkAllRead}
          onOpenAlert={handleOpenAlert}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        />
      </>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        height: '100vh',
        borderRight: '1px solid',
        borderRightColor: 'divider',
        borderRadius: 0,
        overflow: 'hidden',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: 200,
        }),
      }}
    >
      {navList}
      <NotificationPopover
        open={notifOpen}
        anchorEl={notifAnchorEl}
        onClose={closeNotif}
        unreadCount={unreadCount}
        alertsCount={alerts.length}
        latestAlerts={latestAlerts}
        readIds={readIds}
        onMarkAllRead={handleMarkAllRead}
        onOpenAlert={handleOpenAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      />
    </Paper>
  )
}

export default SideNav
