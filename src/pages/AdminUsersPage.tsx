import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import PeopleIcon from '@mui/icons-material/People'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import BlockIcon from '@mui/icons-material/Block'
import LockResetIcon from '@mui/icons-material/LockReset'
import SaveIcon from '@mui/icons-material/Save'
import EditIcon from '@mui/icons-material/Edit'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import { apiFetch } from '../services/apiClient'
import { useI18n } from '../i18n'

type UserStatus = 'pending' | 'active' | 'disabled'
type UserRole = 'admin' | 'manager' | 'user'

type AdminUserRow = {
  id: string
  username: string
  email?: string
  role: UserRole
  status: UserStatus
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  updatedAt?: string
}

const formatTs = (iso?: string) => {
  if (!iso) return ''
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return iso
  return t.toLocaleString()
}

const roleLabel: Record<'manager' | 'user', { zh: string; en: string }> = {
  user: { zh: 'user（普通）', en: 'user' },
  manager: { zh: 'manager（管理员）', en: 'manager' },
}

const statusOrder: UserStatus[] = ['pending', 'active', 'disabled']

const userRowGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    lg: 'minmax(250px, 0.64fr) minmax(620px, 1.52fr) minmax(156px, 0.36fr)',
  },
  gap: { xs: 1.5, lg: 2 },
  alignItems: 'stretch',
} as const

const AdminUsersPage: React.FC = () => {
  const theme = useTheme()
  const { tr } = useI18n()

  const [tab, setTab] = useState<UserStatus>('pending')
  const [items, setItems] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createRole, setCreateRole] = useState<'manager' | 'user'>('user')

  const [editOpen, setEditOpen] = useState(false)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'manager' | 'user'>('user')

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ items: AdminUserRow[] }>(`/api/admin/users`)
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e: any) {
      setError(e?.message || tr('加载用户列表失败', 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((u) => u.status === tab)
  }, [items, tab])

  const counts = useMemo(() => {
    const by: Record<UserStatus, number> = { pending: 0, active: 0, disabled: 0 }
    items.forEach((u) => {
      by[u.status] = (by[u.status] ?? 0) + 1
    })
    return by
  }, [items])

  const editingUser = useMemo(() => {
    return editUserId ? items.find((u) => u.id === editUserId) ?? null : null
  }, [editUserId, items])

  const openCreate = () => {
    setCreateUsername('')
    setCreatePassword('')
    setCreateEmail('')
    setCreateRole('user')
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (!createUsername.trim() || createPassword.length < 8) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: createUsername.trim(), password: createPassword, role: createRole, email: createEmail.trim() || null }),
      })
      setCreateOpen(false)
      await fetchUsers()
    } catch (e: any) {
      const text = e?.bodyText ? String(e.bodyText) : ''
      if (text.includes('username_taken')) setError(tr('账号已存在', 'Username already exists'))
      else setError(e?.message || tr('开户失败', 'Failed to create user'))
    } finally {
      setLoading(false)
    }
  }

  const disableUser = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/disable`, { method: 'POST' })
      await fetchUsers()
    } catch (e: any) {
      setError(e?.message || tr('禁用失败', 'Failed to disable user'))
    } finally {
      setLoading(false)
    }
  }

  const openEditUser = (user: AdminUserRow) => {
    setEditUserId(user.id)
    setEditEmail(user.email ?? '')
    setEditRole(user.role === 'manager' ? 'manager' : 'user')
    setEditOpen(true)
  }

  const submitEditUser = async (approveAfter = false) => {
    if (!editingUser) return
    setLoading(true)
    setError(null)
    try {
      const payload: { email: string | null; role?: 'manager' | 'user' } = {
        email: editEmail.trim() || null,
      }
      if (editingUser.role !== 'admin') payload.role = editRole

      await apiFetch(`/api/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (approveAfter) {
        await apiFetch(`/api/admin/users/${encodeURIComponent(editingUser.id)}/approve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role: editRole }),
        })
      }

      setEditOpen(false)
      setEditUserId(null)
      await fetchUsers()
    } catch (e: any) {
      const text = e?.bodyText ? String(e.bodyText) : ''
      if (text.includes('cannot_change_admin_role')) setError(tr('不能修改 admin 的角色', 'Cannot change admin role'))
      else setError(e?.message || tr('更新用户失败', 'Failed to update user'))
    } finally {
      setLoading(false)
    }
  }

  const openResetPassword = (id: string) => {
    setResetUserId(id)
    setResetPassword('')
    setResetOpen(true)
  }

  const submitResetPassword = async () => {
    if (!resetUserId || resetPassword.length < 8) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(resetUserId)}/reset-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
      })
      setResetOpen(false)
      setResetUserId(null)
      setResetPassword('')
    } catch (e: any) {
      setError(e?.message || tr('重置密码失败', 'Failed to reset password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell
      title={<TitleWithIcon icon={<PeopleIcon />}>{tr('用户管理（admin）', 'User management (admin)')}</TitleWithIcon>}
      actions={
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={loading}>
            {tr('开户', 'Create')}
          </Button>
        </Stack>
      }
    >
      <AppCard sx={{ p: 0, overflow: 'hidden' }} contentSx={{ mt: 0 }}>
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.045),
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                {tr('账号状态', 'Account status')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {tr(`共 ${items.length} 个账号`, `${items.length} accounts`)}
              </Typography>
            </Box>

            <Tabs
              value={tab}
              onChange={(_e, v) => setTab(v)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{
                minHeight: 44,
                p: 0.5,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.28 : 0.72),
                border: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.9),
                '& .MuiTabs-indicator': { display: 'none' },
                '& .MuiTabs-flexContainer': { gap: 0.5 },
                '& .MuiTab-root': {
                  minHeight: 36,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  color: 'text.secondary',
                  fontWeight: 850,
                  textTransform: 'none',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    backgroundColor: 'background.paper',
                    boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.28 : 0.1)}`,
                  },
                },
              }}
            >
              {statusOrder.map((status) => {
                const selected = tab === status
                const label =
                  status === 'pending'
                    ? tr('待审批', 'Pending')
                    : status === 'active'
                      ? tr('已启用', 'Active')
                      : tr('已禁用', 'Disabled')

                return (
                  <Tab
                    key={status}
                    value={status}
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{label}</span>
                        <Chip
                          size="small"
                          label={counts[status]}
                          color={selected ? 'primary' : 'default'}
                          sx={{
                            height: 24,
                            minWidth: 28,
                            fontWeight: 900,
                            '& .MuiChip-label': { px: 0.85 },
                          }}
                        />
                      </Stack>
                    }
                  />
                )
              })}
            </Tabs>
          </Stack>
        </Box>

        {loading ? <LinearProgress /> : null}

        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 } }}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            {filteredItems.length === 0 ? (
              <Box
                sx={{
                  py: 7,
                  textAlign: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  color: 'text.secondary',
                  backgroundColor: 'action.hover',
                }}
              >
                <Typography variant="body2">{tr('暂无数据', 'No data')}</Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {filteredItems.map((u) => {
                  const statusLabel =
                    u.status === 'active' ? tr('已启用', 'Active') : u.status === 'pending' ? tr('待审批', 'Pending') : tr('已禁用', 'Disabled')
                  const statusColor =
                    u.status === 'active'
                      ? theme.palette.success.main
                      : u.status === 'pending'
                        ? theme.palette.warning.main
                        : theme.palette.text.disabled

                  return (
                    <Box
                      key={u.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        px: { xs: 1.5, md: 2 },
                        py: { xs: 1.5, md: 1.75 },
                        backgroundColor: 'background.paper',
                        boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.18 : 0.035)}`,
                        transition: 'border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
                        '&:hover': {
                          borderColor: alpha(theme.palette.primary.main, 0.38),
                          boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.24 : 0.07)}`,
                        },
                      }}
                    >
                      <Box sx={userRowGridSx}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: 1.5,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              fontWeight: 950,
                              color: u.role === 'admin' ? 'primary.contrastText' : 'primary.main',
                              backgroundColor: u.role === 'admin' ? 'primary.main' : alpha(theme.palette.primary.main, 0.1),
                            }}
                          >
                            {u.username.slice(0, 1).toUpperCase()}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 20, lineHeight: 1.15 }} noWrap>
                              {u.username}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: statusColor,
                                  flexShrink: 0,
                                }}
                              />
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {statusLabel} · {u.role}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                            gap: { xs: 1.25, md: 2 },
                            alignItems: 'stretch',
                            minWidth: 0,
                          }}
                        >
                          {[
                            {
                              label: tr('通知邮箱', 'Notification email'),
                              value: u.email || tr('未设置', 'Not set'),
                              muted: !u.email,
                            },
                            {
                              label: tr('权限', 'Role'),
                              value: u.role === 'manager' ? tr('manager（管理员）', 'manager') : u.role === 'admin' ? 'admin' : tr('user（普通）', 'user'),
                              muted: false,
                            },
                            {
                              label: tr('时间', 'Timeline'),
                              value: `${tr('创建', 'Created')} ${formatTs(u.createdAt)}`,
                              muted: false,
                            },
                          ].map((item) => (
                            <Box key={item.label} sx={{ minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.35, fontWeight: 850 }}>
                                {item.label}
                              </Typography>
                              <Typography
                                variant="body2"
                                color={item.muted ? 'text.disabled' : 'text.primary'}
                                sx={{ fontWeight: 750, minWidth: 0 }}
                                noWrap
                              >
                                {item.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>

                        <Stack
                          direction="row"
                          spacing={0.75}
                          alignItems="center"
                          justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
                          sx={{
                            flexWrap: 'nowrap',
                            minWidth: 132,
                            '& .MuiIconButton-root': {
                              width: 36,
                              height: 36,
                              borderRadius: 1,
                              border: '1px solid',
                            },
                          }}
                        >
                          {u.status !== 'disabled' ? (
                            <Tooltip title={u.status === 'pending' ? tr('审批', 'Approve') : tr('编辑', 'Edit')}>
                              <span>
                                <IconButton
                                  aria-label={u.status === 'pending' ? tr('审批', 'Approve') : tr('编辑', 'Edit')}
                                  color={u.status === 'pending' ? 'primary' : 'default'}
                                  onClick={() => openEditUser(u)}
                                  disabled={loading}
                                  sx={{
                                    borderColor: u.status === 'pending' ? 'primary.main' : 'divider',
                                    backgroundColor: u.status === 'pending' ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                                  }}
                                >
                                  {u.status === 'pending' ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : null}

                          {u.status === 'active' && u.role !== 'admin' ? (
                            <Tooltip title={tr('重置密码', 'Reset password')}>
                              <span>
                                <IconButton
                                  aria-label={tr('重置密码', 'Reset password')}
                                  color="primary"
                                  onClick={() => openResetPassword(u.id)}
                                  disabled={loading}
                                  sx={{
                                    borderColor: alpha(theme.palette.primary.main, 0.35),
                                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                  }}
                                >
                                  <LockResetIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : null}

                          {u.status === 'active' && u.role !== 'admin' ? (
                            <Tooltip title={tr('禁用', 'Disable')}>
                              <span>
                                <IconButton
                                  aria-label={tr('禁用', 'Disable')}
                                  color="error"
                                  onClick={() => disableUser(u.id)}
                                  disabled={loading}
                                  sx={{
                                    borderColor: alpha(theme.palette.error.main, 0.42),
                                    backgroundColor: alpha(theme.palette.error.main, 0.04),
                                  }}
                                >
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : null}

                          {u.status === 'disabled' ? (
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', lg: 'right' } }}>
                              {tr('用户已禁用', 'User disabled')}
                            </Typography>
                          ) : null}
                        </Stack>
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            )}
          </Stack>
        </Box>
      </AppCard>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingUser?.status === 'pending' ? tr('审批账号', 'Approve account') : tr('编辑账号', 'Edit account')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: 'action.hover',
              }}
            >
              <Typography sx={{ fontWeight: 900 }}>{editingUser?.username}</Typography>
              <Typography variant="caption" color="text.secondary">
                {editingUser?.role} · {editingUser?.status}
              </Typography>
            </Box>

            <TextField
              label={tr('通知邮箱', 'Notification email')}
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              fullWidth
              size="small"
              type="email"
            />

            {editingUser?.role !== 'admin' ? (
              <FormControl fullWidth size="small">
                <InputLabel id="edit-user-role-label">{tr('权限', 'Role')}</InputLabel>
                <Select
                  labelId="edit-user-role-label"
                  label={tr('权限', 'Role')}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'manager' | 'user')}
                >
                  <MenuItem value="user">{tr('user（普通）', 'user')}</MenuItem>
                  <MenuItem value="manager">{tr('manager（管理员）', 'manager')}</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Alert severity="info">{tr('admin 账号不可修改权限，仅可维护通知邮箱', 'Admin role is immutable; only notification email can be edited')}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{tr('取消', 'Cancel')}</Button>
          <Button
            variant="contained"
            onClick={() => submitEditUser(editingUser?.status === 'pending')}
            disabled={loading || !editingUser}
            startIcon={editingUser?.status === 'pending' ? <CheckIcon /> : <SaveIcon />}
          >
            {editingUser?.status === 'pending' ? tr('保存并批准', 'Save and approve') : tr('保存', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{tr('后台开户', 'Create user')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={tr('账号', 'Username')}
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={tr('初始密码（至少8位）', 'Initial password (min 8 chars)')}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              fullWidth
              size="small"
              type="password"
            />
            <TextField
              label={tr('邮箱（可选）', 'Email (optional)')}
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              fullWidth
              size="small"
              type="email"
            />
            <FormControl fullWidth size="small">
              <InputLabel id="create-role-label">{tr('角色', 'Role')}</InputLabel>
              <Select
                labelId="create-role-label"
                label={tr('角色', 'Role')}
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as 'manager' | 'user')}
              >
                <MenuItem value="user">{tr('user（普通）', 'user')}</MenuItem>
                <MenuItem value="manager">{tr('manager（管理员）', 'manager')}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{tr('取消', 'Cancel')}</Button>
          <Button variant="contained" onClick={submitCreate} disabled={loading || !createUsername.trim() || createPassword.length < 8}>
            {tr('创建', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{tr('重置密码', 'Reset password')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={tr('新密码（至少8位）', 'New password (min 8 chars)')}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              fullWidth
              size="small"
              type="password"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>{tr('取消', 'Cancel')}</Button>
          <Button variant="contained" onClick={submitResetPassword} disabled={loading || resetPassword.length < 8}>
            {tr('提交', 'Submit')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  )
}

export default AdminUsersPage
