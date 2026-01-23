import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Typography,
  List,
  ListItemButton,
  useMediaQuery,
  Drawer,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import LogoutIcon from '@mui/icons-material/ExitToApp'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import type { NavItem, NavRole, NavSection } from '../nav/navConfig'
import { useLocation } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSidebarMode } from '../store/settingsSlice'

type Props = {
  isAuthenticated: boolean
  role?: NavRole
  sections: NavSection[]
  items: NavItem[]
  onNavigate: (path: string) => void
  onLogout: () => void
}

const COLLAPSED_WIDTH = 72
const EXPANDED_WIDTH = 180
const ICON_COLUMN_WIDTH = COLLAPSED_WIDTH
const NAV_LABEL_JUSTIFY_CHARS = 2
const HOVER_OPEN_DELAY_MS = 650
const ICON_SIZE = 25
const ICON_SLOT_SIZE = 26
const ROW_INSET = 8

const getNormalizedPathForSelection = (pathname: string) => {
  if (pathname.startsWith('/assets/')) return '/chambers'
  return pathname
}

const SideNav: React.FC<Props> = ({ isAuthenticated, role, sections, items, onNavigate, onLogout }) => {
  const theme = useTheme()
  const { tr } = useI18n()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useAppDispatch()
  const sidebarMode = useAppSelector((s) => s.settings.nav?.sidebarMode) ?? 'auto'

  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const effectiveExpanded = isMobile ? true : (sidebarMode === 'lockedOpen' ? true : sidebarMode === 'lockedCollapsed' ? false : expanded)
  const hasFocusWithinRef = useRef(false)
  const isPointerInsideRef = useRef(false)
  const enterTimerRef = useRef<number | null>(null)
  const leaveTimerRef = useRef<number | null>(null)

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

  const clearTimers = () => {
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    enterTimerRef.current = null
    leaveTimerRef.current = null
  }

  const openExpanded = useCallback(() => {
    clearTimers()
    if (isMobile) return
    if (sidebarMode !== 'auto') return
    enterTimerRef.current = window.setTimeout(() => setExpanded(true), HOVER_OPEN_DELAY_MS)
  }, [isMobile, sidebarMode])

  const closeExpanded = useCallback(() => {
    clearTimers()
    if (isMobile) return
    if (sidebarMode !== 'auto') return
    leaveTimerRef.current = window.setTimeout(() => {
      if (!hasFocusWithinRef.current) setExpanded(false)
    }, 200)
  }, [isMobile, sidebarMode])

  const handleFocusCapture = useCallback(() => {
    hasFocusWithinRef.current = true
    clearTimers()
    setExpanded(true)
  }, [])

  const handleBlurCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    const current = e.currentTarget
    if (next && current.contains(next)) return
    hasFocusWithinRef.current = false
    closeExpanded()
  }, [closeExpanded])

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
  }, [dispatch, sidebarMode])

  const iconWrapperSx = useMemo(
    () => ({
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

  const iconSlotSx = useMemo(
    () => ({
      width: ICON_SLOT_SIZE,
      height: ICON_SLOT_SIZE,
      display: 'grid',
      placeItems: 'center',
      lineHeight: 0,
      '& .MuiSvgIcon-root': { fontSize: ICON_SIZE, display: 'block' },
    }),
    []
  )

  const brandLogoContainerSize = 48
  const brandLogoSize = 40

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
          pr: 2,
          opacity: effectiveExpanded ? 1 : 0,
          maxWidth: effectiveExpanded ? (EXPANDED_WIDTH - ICON_COLUMN_WIDTH) : 0,
          transform: effectiveExpanded ? 'translateX(0)' : 'translateX(-6px)',
          transition: theme.transitions.create(['opacity', 'transform', 'max-width'], {
            easing: theme.transitions.easing.sharp,
            duration: 200,
          }),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          overflow: 'hidden',
          pointerEvents: effectiveExpanded ? 'auto' : 'none',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 950,
            lineHeight: 1.05,
            letterSpacing: -0.2,
            fontSize: { xs: '1.3rem', sm: '1.3rem' },
          }}
          noWrap
        >
          {tr('设备管理', 'Lab Asset Management')}
        </Typography>
      </Box>
    </Box>
  )

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

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <List sx={{ py: 1.5 }}>
          {visibleSections.map((section, sectionIndex) => {
            const list = itemsBySection.get(section.id) ?? []
            if (list.length === 0) return null
            const nextSection = sectionIndex < visibleSections.length - 1 ? visibleSections[sectionIndex + 1] : null
            return (
              <Box key={section.id} component="li" sx={{ listStyle: 'none' }}>
                {list.map((item) => {
                  const selected = isSelected(item.path)
                  const labelChars = Array.from(item.label)
                  const isHanOnly = /^[\u4e00-\u9fff]+$/.test(item.label)
                  const shouldJustifyLabel = isHanOnly && labelChars.length > 1 && labelChars.length <= NAV_LABEL_JUSTIFY_CHARS
                  return (
                    <ListItemButton
                      key={item.id}
                      aria-label={item.label}
                      selected={selected}
                      onClick={() => {
                        clearTimers()
                        if (!isMobile && sidebarMode === 'auto') setExpanded(false)
                        onNavigate(item.path)
                        if (isMobile) setMobileOpen(false)
                      }}
                      sx={{
                        mx: 0,
                        my: 0.5,
                        borderRadius: 0,
                        px: 0,
                        minHeight: 48,
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
                          maxWidth: effectiveExpanded ? (EXPANDED_WIDTH - ICON_COLUMN_WIDTH) : 0,
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
                        <Typography variant="body2" sx={{ fontWeight: 650, fontSize: '0.95rem' }} noWrap>
                          {shouldJustifyLabel ? (
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                width: `${NAV_LABEL_JUSTIFY_CHARS}em`,
                                justifyContent: 'space-between',
                              }}
                            >
                              {labelChars.map((ch, idx) => (
                                <Box component="span" key={`${ch}-${idx}`}>
                                  {ch}
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            item.label
                          )}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  )
                })}

                {nextSection ? (
                  <Box sx={{ position: 'relative', my: 1.75, mx: effectiveExpanded ? 1.25 : 0.75 }}>
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
                        fontWeight: 800,
                        opacity: effectiveExpanded ? 1 : 0,
                        transition: theme.transitions.create(['opacity', 'transform'], {
                          easing: theme.transitions.easing.sharp,
                          duration: 200,
                        }),
                        pointerEvents: 'none',
                      }}
                    >
                      {(() => {
                        const label = nextSection.label
                        const chars = Array.from(label)
                        const isHanOnly = /^[\u4e00-\u9fff]+$/.test(label)
                        const shouldJustify = isHanOnly && chars.length > 1 && chars.length <= NAV_LABEL_JUSTIFY_CHARS
                        if (!shouldJustify) return label
                        return (
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              width: `${NAV_LABEL_JUSTIFY_CHARS}em`,
                              justifyContent: 'space-between',
                            }}
                          >
                            {chars.map((ch, idx) => (
                              <Box component="span" key={`${ch}-${idx}`}>
                                {ch}
                              </Box>
                            ))}
                          </Box>
                        )
                      })()}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            )
          })}
        </List>
      </Box>

      <Box sx={{ borderTop: '1px solid', borderTopColor: 'divider' }}>
        {(() => {
          const baseToolRowSx = {
            borderRadius: 0,
            minHeight: 48,
            px: 0,
            display: 'grid',
            gridTemplateColumns: `${ICON_COLUMN_WIDTH}px 1fr`,
            alignItems: 'center',
            mx: 0,
            my: 0.5,
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
            maxWidth: effectiveExpanded ? (EXPANDED_WIDTH - ICON_COLUMN_WIDTH) : 0,
            transform: effectiveExpanded ? 'translateX(0)' : 'translateX(-6px)',
            transition: theme.transitions.create(['opacity', 'transform', 'max-width'], {
              easing: theme.transitions.easing.sharp,
              duration: 200,
            }),
            overflow: 'hidden',
            pointerEvents: effectiveExpanded ? 'auto' : 'none',
          } as const

          return (
            <>
              <ListItemButton aria-label={tr('切换侧边栏模式', 'Toggle sidebar mode')} onClick={toggleSidebarMode} sx={baseToolRowSx}>
                <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
                  {effectiveExpanded ? <MenuOpenIcon /> : <MenuIcon />}
                </Box>
                <Box sx={textColSx}>
                  <Typography variant="body2" sx={{ fontWeight: 750, lineHeight: 1.1 }} noWrap>
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

              <Box
                sx={{
                  mx: 0,
                  my: 0.75,
                  opacity: effectiveExpanded ? 1 : 0,
                  transition: theme.transitions.create(['opacity'], { easing: theme.transitions.easing.sharp, duration: 200 }),
                  px: effectiveExpanded ? `${ROW_INSET}px` : 0,
                }}
              >
                <Divider />
              </Box>

              <ListItemButton aria-label={tr('登出', 'Sign out')} onClick={onLogout} sx={baseToolRowSx}>
                <Box sx={{ ...iconWrapperSx, color: 'text.secondary' }}>
                  <LogoutIcon />
                </Box>
                <Box sx={textColSx}>
                  <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>
                    {tr('登出', 'Sign out')}
                  </Typography>
                </Box>
              </ListItemButton>
            </>
          )
        })()}
      </Box>
    </Box>
  )

  if (!isAuthenticated) return null

  if (isMobile) {
    return (
      <>
        <IconButton
          onClick={() => setMobileOpen(true)}
          sx={{
            position: 'fixed',
            left: 12,
            top: 12,
            zIndex: theme.zIndex.drawer + 2,
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            border: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(14px) saturate(1.25)',
            '&:hover': {
              bgcolor: alpha(theme.palette.background.paper, 0.98),
            },
          }}
          size="small"
          aria-label={tr('打开导航', 'Open navigation')}
        >
          <MenuIcon fontSize="small" />
        </IconButton>

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
    </Paper>
  )
}

export default SideNav
