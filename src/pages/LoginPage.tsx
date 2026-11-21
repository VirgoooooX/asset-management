import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { signInUser, signUpUser } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setLanguage, toggleThemeMode } from '../store/settingsSlice'
import { useI18n } from '../i18n'

const LoginPage: React.FC = () => {
  const theme = useTheme()
  const dispatch = useAppDispatch()
  const { tr, language } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth)
  const themeMode = useAppSelector((state) => state.settings.themeMode) ?? 'light'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(null)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const handleModeChange = (nextMode: 'signin' | 'signup') => {
    setLocalError(null)
    setLocalNotice(null)
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setMode(nextMode)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLocalError(null)
    setLocalNotice(null)

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setLocalError(tr('两次输入的密码不一致', 'Passwords do not match'))
        return
      }
      const result = await dispatch(signUpUser({ email, password }))
      if (signUpUser.fulfilled.match(result)) {
        setLocalNotice(
          tr(
            '注册申请已提交，等待管理员审批后即可登录',
            'Signup request submitted. You can sign in after admin approval.'
          )
        )
        setPassword('')
        setConfirmPassword('')
        setMode('signin')
      }
      return
    }

    const result = await dispatch(signInUser({ email, password }))
    if (signInUser.fulfilled.match(result)) {
      navigate(from, { replace: true })
    }
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          border: '1px solid',
          borderColor: 'divider',
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 20px 50px ${alpha(theme.palette.common.black, 0.45)}`
              : `0 16px 40px ${alpha(theme.palette.primary.main, 0.08)}`,
        }}
      >
        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.5} sx={{ mb: 1.5 }}>
          <Tooltip title={themeMode === 'dark' ? tr('浅色模式', 'Light mode') : tr('深色模式', 'Dark mode')}>
            <IconButton
              size="small"
              onClick={() => dispatch(toggleThemeMode())}
              aria-label={themeMode === 'dark' ? tr('切换浅色模式', 'Switch to light mode') : tr('切换深色模式', 'Switch to dark mode')}
            >
              {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="text"
            onClick={() => dispatch(setLanguage(language === 'zh' ? 'en' : 'zh'))}
            sx={{ minWidth: 'auto', px: 1, fontWeight: 600 }}
            aria-label={tr('切换语言', 'Switch language')}
          >
            {language === 'zh' ? 'EN' : '中文'}
          </Button>
        </Stack>

        <Stack spacing={1.25} alignItems="center" textAlign="center" sx={{ mb: 2.5 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
            }}
          >
            <Box
              component="img"
              src="/favicon.svg"
              alt="Logo"
              sx={{ width: 42, height: 42, display: 'block' }}
            />
          </Box>
          <Box>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
              {tr('设备管理', 'Lab Asset Management')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {tr(
                '环境试验箱排程、状态监控与资产运维平台',
                'Lab asset scheduling, monitoring & operations'
              )}
            </Typography>
          </Box>
        </Stack>

        <Tabs
          value={mode}
          onChange={(_e, v) => {
            if (v === 'signin' || v === 'signup') handleModeChange(v)
          }}
          variant="fullWidth"
          sx={{
            mb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tab value="signin" label={tr('登录', 'Sign in')} sx={{ fontWeight: 600 }} />
          <Tab value="signup" label={tr('注册', 'Sign up')} sx={{ fontWeight: 600 }} />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={1.75}>
            <TextField
              required
              fullWidth
              margin="none"
              id="email"
              name="email"
              label={tr('账号 / 邮箱', 'Username / Email')}
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              required
              fullWidth
              margin="none"
              name="password"
              label={tr('密码', 'Password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? tr('隐藏密码', 'Hide password') : tr('显示密码', 'Show password')}
                    >
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {mode === 'signup' ? (
              <TextField
                required
                fullWidth
                margin="none"
                name="confirmPassword"
                label={tr('确认密码', 'Confirm password')}
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={
                          showConfirmPassword ? tr('隐藏确认密码', 'Hide confirm password') : tr('显示确认密码', 'Show confirm password')
                        }
                      >
                        {showConfirmPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ) : null}

            {localError ? <Alert severity="error">{localError}</Alert> : null}
            {localNotice ? <Alert severity="success">{localNotice}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 0.5, minHeight: 42 }}
              disabled={loading || !email.trim() || !password || (mode === 'signup' && !confirmPassword)}
            >
              {loading ? (
                <CircularProgress size={22} color="inherit" />
              ) : mode === 'signin' ? (
                tr('登录', 'Sign in')
              ) : (
                tr('注册', 'Sign up')
              )}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}

export default LoginPage
