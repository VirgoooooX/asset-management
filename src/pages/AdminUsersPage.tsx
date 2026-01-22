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

const AdminUsersPage: React.FC = () => {
  const { tr } = useI18n()

  const [tab, setTab] = useState<UserStatus>('pending')
  const [items, setItems] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<'manager' | 'user'>('user')

  const [approveRoleById, setApproveRoleById] = useState<Record<string, 'manager' | 'user'>>({})

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
      await fetchUsers()
    } catch (e: any) {
      const text = e?.bodyText ? String(e.bodyText) : ''
      if (text.includes('username_taken')) setError(tr('账号已存在', 'Username already exists'))
      else setError(e?.message || tr('开户失败', 'Failed to create user'))
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
      await fetchUsers()
    } catch (e: any) {
      setError(e?.message || tr('审批失败', 'Failed to approve user'))
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
            <Typography variant="body2" color="text.secondary">
              {tr('暂无数据', 'No data')}
            </Typography>
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
                    gridTemplateColumns: { xs: '1fr', md: '1fr 360px' },
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography sx={{ fontWeight: 800 }} noWrap>
                        {u.username}
                      </Typography>
                      <Chip size="small" label={u.role} variant="outlined" />
                      <Chip size="small" label={u.status} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {tr('创建时间', 'Created')}: {formatTs(u.createdAt)}
                      {u.approvedAt ? ` · ${tr('审批时间', 'Approved')}: ${formatTs(u.approvedAt)}` : ''}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
                    {u.status === 'pending' ? (
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id={`approve-role-${u.id}`}>{tr('角色', 'Role')}</InputLabel>
                        <Select
                          labelId={`approve-role-${u.id}`}
                          label={tr('角色', 'Role')}
                          value={approveRoleById[u.id] ?? 'user'}
                          onChange={(e) =>
                            setApproveRoleById((prev) => ({ ...prev, [u.id]: e.target.value as 'manager' | 'user' }))
                          }
                        >
                          <MenuItem value="user">{tr('user（普通）', 'user')}</MenuItem>
                          <MenuItem value="manager">{tr('manager（管理员）', 'manager')}</MenuItem>
                        </Select>
                      </FormControl>
                    ) : null}

                    {u.status === 'pending' ? (
                      <Button
                        variant="contained"
                        startIcon={<CheckIcon />}
                        onClick={() => approveUser(u.id)}
                        disabled={loading}
                      >
                        {tr('批准', 'Approve')}
                      </Button>
                    ) : null}

                    {u.role !== 'admin' ? (
                      <Button
                        color="error"
                        variant="outlined"
                        startIcon={<BlockIcon />}
                        onClick={() => disableUser(u.id)}
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
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </AppCard>

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
