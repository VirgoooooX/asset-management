import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import AppsIcon from '@mui/icons-material/Apps'
import { NavItem, NavSection, NavRole } from '../nav/navConfig'
import TitleWithIcon from './TitleWithIcon'
import { useI18n } from '../i18n'

type Props = {
  open: boolean
  onClose: () => void
  sections: NavSection[]
  items: NavItem[]
  role: NavRole
  onNavigate: (path: string) => void
}

const normalize = (value: string) => value.trim().toLowerCase()

const NavHubDialog: React.FC<Props> = ({ open, onClose, sections, items, role, onNavigate }) => {
  const [query, setQuery] = useState('')
  const { tr } = useI18n()

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, open])

  const visibleItems = useMemo(() => {
    const q = normalize(query)
    const roleItems = items.filter((i) => i.roles.includes(role))
    if (!q) return roleItems
    return roleItems.filter((i) => {
      const hay = `${i.label} ${i.description || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query, role])

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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2.25 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack spacing={0.25}>
              <Typography variant="h6" sx={{ fontWeight: 850 }}>
                <TitleWithIcon icon={<AppsIcon />}>{tr('导航中心', 'Navigation')}</TitleWithIcon>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tr('搜索并快速跳转到功能页面', 'Search and jump to pages')}
              </Typography>
            </Stack>
            <IconButton onClick={onClose} aria-label="close" size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ mt: 2 }}>
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('搜索：总览 / 告警 / 使用记录 / 设备台账...', 'Search: overview / alerts / logs / assets...')}
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        <Divider />

        <List sx={{ p: 0 }}>
          {sectionsSorted.map((section) => {
            const list = itemsBySection.get(section.id) ?? []
            if (list.length === 0) return null
            return (
              <li key={section.id}>
                <ul style={{ padding: 0, margin: 0 }}>
                  <ListSubheader sx={{ lineHeight: 1, py: 1.25, fontWeight: 800, letterSpacing: 0.2 }}>
                    <TitleWithIcon icon={section.icon} gap={0.75}>
                      {section.label}
                    </TitleWithIcon>
                  </ListSubheader>
                  {list.map((item) => (
                    <ListItemButton
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.path)
                        onClose()
                      }}
                      sx={{ py: 1.15 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} secondary={item.description} />
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            )
          })}
        </List>
      </DialogContent>
    </Dialog>
  )
}

export default NavHubDialog
