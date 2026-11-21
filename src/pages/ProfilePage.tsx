import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import PaletteIcon from '@mui/icons-material/Palette'
import PageShell from '../components/PageShell'
import AppCard from '../components/AppCard'
import TitleWithIcon from '../components/TitleWithIcon'
import { useToast } from '../components/ToastProvider'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { apiFetch } from '../services/apiClient'
import {
  applySettingsFromRemote,
  setDensity,
  setLanguage,
  toggleThemeMode,
  type DensityMode,
  type Language,
} from '../store/settingsSlice'
import { useI18n } from '../i18n'

const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch()
  const auth = useAppSelector((s) => s.auth)
  const settings = useAppSelector((s) => s.settings)
  const { tr } = useI18n()
  const toast = useToast()

  const userLabel = useMemo(() => {
    if (!auth.user) return '-'
    return `${auth.user.username} (${auth.user.role})`
  }, [auth.user])

  const [syncing, setSyncing] = useState(false)
  const [changing, setChanging] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const handleSyncFromCloud = async () => {
    setSyncing(true)
    try {
      const data = await apiFetch<{ preferences: any }>('/api/users/me/preferences', { method: 'GET' })
      const remote = data?.preferences?.uiSettings
      if (remote && typeof remote === 'object') {
        dispatch(applySettingsFromRemote(remote))
      }
      toast.success(tr('已从云端同步', 'Synced from cloud'))
    } catch (e: any) {
      toast.error(e?.message || tr('同步失败', 'Sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveToCloud = async () => {
    setSyncing(true)
    try {
      await apiFetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uiSettings: settings }),
      })
      toast.success(tr('已保存到云端', 'Saved to cloud'))
    } catch (e: any) {
      toast.error(e?.message || tr('保存失败', 'Save failed'))
    } finally {
      setSyncing(false)
    }
  }

  const handleChangePassword = async () => {
    setChanging(true)
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      setOldPassword('')
      setNewPassword('')
      toast.success(tr('密码已更新', 'Password updated'))
    } catch (e: any) {
      toast.error(e?.message || tr('修改失败', 'Update failed'))
    } finally {
      setChanging(false)
    }
  }

  return (
    <PageShell title={<TitleWithIcon icon={<PersonIcon />}>{tr('个人', 'Profile')}</TitleWithIcon>}>
      <Stack spacing={2}>
        <AppCard title={tr('账号信息', 'Account')}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {tr('当前用户', 'Current user')}
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>
            {userLabel}
          </Typography>
        </AppCard>

        <AppCard
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <PaletteIcon fontSize="small" />
              <span>{tr('外观偏好', 'Appearance')}</span>
            </Stack>
          }
        >
          <Stack spacing={2}>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.themeMode === 'dark'}
                    onChange={() => dispatch(toggleThemeMode())}
                  />
                }
                label={settings.themeMode === 'dark' ? tr('深色模式', 'Dark mode') : tr('浅色模式', 'Light mode')}
              />
            </Box>

            <Divider />

            <FormControl>
              <FormLabel>{tr('语言', 'Language')}</FormLabel>
              <RadioGroup
                row
                value={settings.language}
                onChange={(e) => dispatch(setLanguage(e.target.value as Language))}
              >
                <FormControlLabel value="zh" control={<Radio />} label={tr('中文', 'Chinese')} />
                <FormControlLabel value="en" control={<Radio />} label="English" />
              </RadioGroup>
            </FormControl>

            <Divider />

            <FormControl>
              <FormLabel>{tr('密度', 'Density')}</FormLabel>
              <RadioGroup
                row
                value={settings.density as DensityMode}
                onChange={(e) => dispatch(setDensity(e.target.value as DensityMode))}
              >
                <FormControlLabel value="comfortable" control={<Radio />} label={tr('舒适', 'Comfortable')} />
                <FormControlLabel value="compact" control={<Radio />} label={tr('紧凑', 'Compact')} />
              </RadioGroup>
            </FormControl>
          </Stack>
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
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleChangePassword}
                    disabled={changing || !oldPassword || newPassword.length < 8}
                  >
                    {tr('更新密码', 'Update password')}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </AppCard>
      </Stack>
    </PageShell>
  )
}

export default ProfilePage
