import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TextField, Button, Container, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { signInUser, signUpUser } from '../store/authSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useI18n } from '../i18n'

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // 新增：密码状态
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const dispatch = useAppDispatch()
  const { tr } = useI18n()
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth)

  const from = location.state?.from?.pathname || '/timeline';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null)
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setLocalError(tr('两次输入的密码不一致', 'Passwords do not match'))
        return
      }
      const result = await dispatch(signUpUser({ email, password }))
      if (signUpUser.fulfilled.match(result)) {
        navigate(from, { replace: true });
      }
      return
    }

    const result = await dispatch(signInUser({ email, password }))
    if (signInUser.fulfilled.match(result)) {
      navigate(from, { replace: true });
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          {mode === 'signin' ? tr('登录', 'Sign in') : tr('注册', 'Sign up')}
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            required
            fullWidth
            id="email"
            label={tr('邮箱', 'Email')}
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField // 新增：密码输入框
            required
            fullWidth
            name="password"
            label={tr('密码', 'Password')}
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' ? (
            <TextField
              required
              fullWidth
              name="confirmPassword"
              label={tr('确认密码', 'Confirm password')}
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          ) : null}
          {localError ? <Alert severity="error" sx={{ width: '100%', mt: 1 }}>{localError}</Alert> : null}
          {error ? <Alert severity="error" sx={{ width: '100%', mt: 1 }}>{error}</Alert> : null}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading || !email || !password || (mode === 'signup' && !confirmPassword)}
          >
            {loading ? <CircularProgress size={24} /> : mode === 'signin' ? tr('登录', 'Sign in') : tr('注册', 'Sign up')}
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={() => {
              setLocalError(null)
              setConfirmPassword('')
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
            }}
            disabled={loading}
          >
            {mode === 'signin'
              ? tr('没有账号？去注册', "Don't have an account? Sign up")
              : tr('已有账号？去登录', 'Already have an account? Sign in')}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LoginPage;
