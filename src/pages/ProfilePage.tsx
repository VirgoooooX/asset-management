import React, { useMemo, useState } from 'react'
import { Box, Button, Divider, Stack, TextField, Typography } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { apiFetch } from '../services/apiClient'
import { applySettingsFromRemote } from '../store/settingsSlice'
import { useI18n } from '../i18n'

const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch()
  const auth = useAppSelector((s) => s.auth)
  const settings = useAppSelector((s) => s.settings)
  const { tr } = useI18n()

  const userLabel = useMemo(() => {
    if (!auth.user) return '-'
    return `${auth.user.username} (${auth.user.role})`
  }, [auth.user])

  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncOk, setSyncOk] = useState<string | null>(null)

  const [changing, setChanging] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changeOk, setChangeOk] = useState<string | null>(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const handleSyncFromCloud = async () => {
    setSyncError(null)
    setSyncOk(null)
    setSyncing(true)
    try {
      const data = await apiFetch<{ preferences: any }>('/api/users/me/preferences', { method: 'GET' })
      const remote = data?.preferences?.uiSettings
      if (remote && typeof remote === 'object') {
        dispatch(applySettingsFromRemote(remote))
      }
      setSyncOk(tr('已从云端同步', 'Synced from cloud'))
    } catch (e: any) {
      setSyncError(e?.message || tr('同步失败', 'Sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveToCloud = async () => {
    setSyncError(null)
    setSyncOk(null)
    setSyncing(true)
    try {
      await apiFetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uiSettings: settings })
      })
      setSyncOk(tr('已保存到云端', 'Saved to cloud'))
    } catch (e: any) {
      setSyncError(e?.message || tr('保存失败', 'Save failed'))
    } finally {
      setSyncing(false)
    }
  }

  const handleChangePassword = async () => {
    setChangeError(null)
    setChangeOk(null)
    setChanging(true)
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      })
      setOldPassword('')
      setNewPassword('')
      setChangeOk(tr('密码已更新', 'Password updated'))
    } catch (e: any) {
      setChangeError(e?.message || tr('修改失败', 'Update failed'))
    } finally {
      setChanging(false)
    }
  }

  return (
    <PageShell title={<TitleWithIcon icon={<PersonIcon />}>{tr('个人', 'Profile')}</TitleWithIcon>} maxWidth="md">
      <Stack spacing={2}>
        <AppCard title={tr('账号信息', 'Account')}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650 }}>
            {tr('当前用户', 'Current user')}
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>
            {userLabel}
          </Typography>
        </AppCard>

        <AppCard
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <CloudSyncIcon fontSize="small" />
              <span>{tr('偏好同步', 'Preferences sync')}</span>
            </Stack>
          }
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {tr('将你的界面设置写入数据库，并支持跨设备同步。', 'Persist UI settings to database and sync across devices.')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" onClick={handleSyncFromCloud} disabled={syncing}>
                {tr('从云端同步', 'Sync from cloud')}
              </Button>
              <Button variant="contained" onClick={handleSaveToCloud} disabled={syncing}>
                {tr('保存到云端', 'Save to cloud')}
              </Button>
            </Stack>
            {syncError ? (
              <Typography variant="body2" color="error">
                {syncError}
              </Typography>
            ) : null}
            {syncOk ? (
              <Typography variant="body2" color="success.main">
                {syncOk}
              </Typography>
            ) : null}
          </Stack>
        </AppCard>

        <AppCard
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <LockIcon fontSize="small" />
              <span>{tr('修改密码', 'Change password')}</span>
            </Stack>
          }
        >
          <Stack spacing={2}>
            <Divider />
            <Box>
              <Stack spacing={1.5}>
                <TextField
                  label={tr('旧密码', 'Old password')}
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                  fullWidth
                />
                <TextField
                  label={tr('新密码（至少 8 位）', 'New password (min 8 chars)')}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleChangePassword}
                  disabled={changing || !oldPassword || newPassword.length < 8}
                >
                  {tr('更新密码', 'Update password')}
                </Button>
                {changeError ? (
                  <Typography variant="body2" color="error">
                    {changeError}
                  </Typography>
                ) : null}
                {changeOk ? (
                  <Typography variant="body2" color="success.main">
                    {changeOk}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </AppCard>
      </Stack>
    </PageShell>
  )
}

export default ProfilePage

