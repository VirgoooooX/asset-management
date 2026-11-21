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
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import BlockIcon from '@mui/icons-material/Block'
import LockResetIcon from '@mui/icons-material/LockReset'
import SaveIcon from '@mui/icons-material/Save'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import TitleWithIcon from '../components/TitleWithIcon'
import { useToast } from '../components/ToastProvider'
import { apiFetch } from '../services/apiClient'
import { useI18n } from '../i18n'

type UserStatus = 'pending' | 'active' | 'disabled'
type UserRole = 'admin' | 'manager' | 'user'

type AdminUserRow = {
  id: string
  username: string
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

const AdminUsersPage: React.FC = () => {
  const { tr } = useI18n()
  const toast = useToast()

  const [tab, setTab] = useState<UserStatus>('pending')
  const [items, setItems] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<'manager' | 'user'>('user')

  const [approveRoleById, setApproveRoleById] = useState<Record<string, 'manager' | 'user'>>({})
  const [editRoleById, setEditRoleById] = useState<Record<string, 'manager' | 'user'>>({})

  const [pendingDisableUser, setPendingDisableUser] = useState<AdminUserRow | null>(null)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const fetchUsers = React.useCallback(async () => {
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
  }, [tr])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

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

  const openCreate = () => {
    setCreateUsername('')
    setCreatePassword('')
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
        body: JSON.stringify({ username: createUsername.trim(), password: createPassword, role: createRole }),
      })
      setCreateOpen(false)
      toast.success(tr('用户已创建', 'User created.'))
      await fetchUsers()
    } catch (e: any) {
      const text = e?.bodyText ? String(e.bodyText) : ''
      const msg = text.includes('username_taken')
        ? tr('账号已存在', 'Username already exists')
        : e?.message || tr('开户失败', 'Failed to create user')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const approveUser = async (id: string) => {
    const role = approveRoleById[id] ?? 'user'
    setLoading(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      toast.success(tr('已批准该账号', 'User approved.'))
      await fetchUsers()
    } catch (e: any) {
      const msg = e?.message || tr('审批失败', 'Failed to approve user')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const disableUser = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(id)}/disable`, { method: 'POST' })
      toast.success(tr('账号已禁用', 'User disabled.'))
      await fetchUsers()
    } catch (e: any) {
      const msg = e?.message || tr('禁用失败', 'Failed to disable user')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (id: string, role: 'manager' | 'user') => {
    setLoading(true)
    setError(null)
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      toast.success(tr('权限已更新', 'Role updated.'))
      await fetchUsers()
    } catch (e: any) {
      const text = e?.bodyText ? String(e.bodyText) : ''
      const msg = text.includes('cannot_change_admin_role')
        ? tr('不能修改 admin 的角色', 'Cannot change admin role')
        : e?.message || tr('更新角色失败', 'Failed to update role')
      setError(msg)
      toast.error(msg)
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
      toast.success(tr('密码已重置', 'Password reset.'))
    } catch (e: any) {
      const msg = e?.message || tr('重置密码失败', 'Failed to reset password')
      setError(msg)
      toast.error(msg)
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
      <AppCard>
        <Stack spacing={2}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
            <Tab value="pending" label={<Stack direction="row" spacing={1} alignItems="center"><span>{tr('待审批', 'Pending')}</span><Chip size="small" label={counts.pending} /></Stack>} />
            <Tab value="active" label={<Stack direction="row" spacing={1} alignItems="center"><span>{tr('已启用', 'Active')}</span><Chip size="small" label={counts.active} /></Stack>} />
            <Tab value="disabled" label={<Stack direction="row" spacing={1} alignItems="center"><span>{tr('已禁用', 'Disabled')}</span><Chip size="small" label={counts.disabled} /></Stack>} />
          </Tabs>

          {loading ? <LinearProgress /> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Divider />

          {filteredItems.length === 0 ? (
            <EmptyState
              compact
              title={tr('暂无该状态用户', 'No users in this status')}
              action={
                tab === 'active' ? (
                  <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    {tr('开户', 'Create user')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Stack spacing={1}>
              {filteredItems.map((u) => (
                <Box
                  key={u.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.25,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                    columnGap: 2,
                    rowGap: 1,
                    alignItems: { xs: 'stretch', md: 'center' },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
                        {u.username}
                      </Typography>
                      <Chip size="small" label={u.role} variant="outlined" color={u.role === 'admin' ? 'primary' : 'default'} />
                      <Chip
                        size="small"
                        label={u.status}
                        color={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warning' : 'default'}
                        variant={u.status === 'disabled' ? 'outlined' : 'filled'}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {tr('创建时间', 'Created')}: {formatTs(u.createdAt)}
                      {u.approvedAt ? ` · ${tr('审批时间', 'Approved')}: ${formatTs(u.approvedAt)}` : ''}
                    </Typography>
                  </Box>

                  <Stack
                    direction="column"
                    spacing={0.75}
                    alignItems={{ xs: 'stretch', md: 'flex-end' }}
                    justifyContent="center"
                    sx={{ minWidth: { md: 360 } }}
                  >
                    {u.role !== 'admin' ? (
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
                        {u.status === 'pending' ? (
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id={`approve-role-${u.id}`}>{tr('权限', 'Role')}</InputLabel>
                            <Select
                              labelId={`approve-role-${u.id}`}
                              label={tr('权限', 'Role')}
                              value={approveRoleById[u.id] ?? 'user'}
                              onChange={(e) =>
                                setApproveRoleById((prev) => ({ ...prev, [u.id]: e.target.value as 'manager' | 'user' }))
                              }
                            >
                              <MenuItem value="user">{tr(roleLabel.user.zh, roleLabel.user.en)}</MenuItem>
                              <MenuItem value="manager">{tr(roleLabel.manager.zh, roleLabel.manager.en)}</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id={`edit-role-${u.id}`}>{tr('权限', 'Role')}</InputLabel>
                            <Select
                              labelId={`edit-role-${u.id}`}
                              label={tr('权限', 'Role')}
                              value={editRoleById[u.id] ?? (u.role === 'manager' ? 'manager' : 'user')}
                              onChange={(e) =>
                                setEditRoleById((prev) => ({ ...prev, [u.id]: e.target.value as 'manager' | 'user' }))
                              }
                            >
                              <MenuItem value="user">{tr(roleLabel.user.zh, roleLabel.user.en)}</MenuItem>
                              <MenuItem value="manager">{tr(roleLabel.manager.zh, roleLabel.manager.en)}</MenuItem>
                            </Select>
                          </FormControl>
                        )}

                        {u.status === 'pending' ? (
                          <Button
                            variant="contained"
                            startIcon={<CheckIcon />}
                            onClick={() => approveUser(u.id)}
                            disabled={loading}
                          >
                            {tr('批准', 'Approve')}
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={() => updateUserRole(u.id, editRoleById[u.id] ?? (u.role === 'manager' ? 'manager' : 'user'))}
                            disabled={loading || (editRoleById[u.id] ?? (u.role === 'manager' ? 'manager' : 'user')) === u.role}
                          >
                            {tr('更新权限', 'Update role')}
                          </Button>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                        {tr('admin 账号不可修改权限', 'Admin role is immutable')}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
                      {u.status !== 'disabled' && u.role !== 'admin' ? (
                        <Button
                          color="error"
                          variant="outlined"
                          startIcon={<BlockIcon />}
                          onClick={() => setPendingDisableUser(u)}
                          disabled={loading}
                        >
                          {tr('禁用', 'Disable')}
                        </Button>
                      ) : null}

                      {u.status === 'active' && u.role !== 'admin' ? (
                        <Button
                          variant="outlined"
                          startIcon={<LockResetIcon />}
                          onClick={() => openResetPassword(u.id)}
                          disabled={loading}
                        >
                          {tr('重置密码', 'Reset password')}
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </AppCard>

      <ConfirmDialog
        open={Boolean(pendingDisableUser)}
        title={tr('确认禁用账号', 'Confirm disable user')}
        description={tr(
          `确定要禁用账号「${pendingDisableUser?.username || ''}」吗？禁用后该用户将无法登录系统。`,
          `Disable user "${pendingDisableUser?.username || ''}"? They will no longer be able to sign in.`
        )}
        confirmText={tr('禁用', 'Disable')}
        confirmColor="error"
        onClose={() => setPendingDisableUser(null)}
        onConfirm={() => {
          const target = pendingDisableUser
          setPendingDisableUser(null)
          if (target) void disableUser(target.id)
        }}
      />

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
              margin="none"
            />
            <TextField
              label={tr('初始密码（至少8位）', 'Initial password (min 8 chars)')}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              fullWidth
              size="small"
              margin="none"
              type="password"
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
              margin="none"
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
