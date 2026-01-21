import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { User, UserRole } from '../types'
import { apiFetch } from '../services/apiClient'
import { setAccessToken } from '../services/session'

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
};

const getRoleFromClaims = (claims: Record<string, any>): UserRole => {
  const role = claims?.role
  if (role === 'admin' || role === 'user') return role
  if (claims?.admin === true) return 'admin'
  return 'user'
}

export const bootstrapAuth = createAsyncThunk<User | null, void, { rejectValue: string }>(
  'auth/bootstrapAuth',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiFetch<{ accessToken: string; user: User }>('/api/auth/refresh', {
        method: 'POST',
        retryOnAuth: false
      })
      setAccessToken(data.accessToken)
      return data.user
    } catch (e: any) {
      setAccessToken(null)
      if (e?.status === 401) return null
      return rejectWithValue(e?.message || '初始化会话失败')
    }
  }
)

export const signInUser = createAsyncThunk<
  User,
  { email: string; password: string },
  { rejectValue: string }
>('auth/signInUser', async ({ email, password }, { rejectWithValue }) => {
  try {
    const data = await apiFetch<{ accessToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
      retryOnAuth: false
    })
    setAccessToken(data.accessToken)
    const role = getRoleFromClaims(data.user as any)
    return { ...data.user, role }
  } catch (e: any) {
    const text = e?.bodyText ? String(e.bodyText) : ''
    if (e?.status === 401) return rejectWithValue('账号或密码错误')
    if (text.includes('username_taken')) return rejectWithValue('账号已被注册')
    return rejectWithValue(e?.message || '登录失败')
  }
})

export const signOutUser = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/signOutUser',
  async (_, { rejectWithValue }) => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', retryOnAuth: false })
      setAccessToken(null)
    } catch (e: any) {
      return rejectWithValue(e?.message || '登出失败')
    }
  }
)

export const signUpUser = createAsyncThunk<
  User,
  { email: string; password: string },
  { rejectValue: string }
>('auth/signUpUser', async ({ email, password }, { rejectWithValue }) => {
  try {
    const data = await apiFetch<{ accessToken: string; user: User }>('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
      retryOnAuth: false
    })
    setAccessToken(data.accessToken)
    const role = getRoleFromClaims(data.user as any)
    return { ...data.user, role }
  } catch (e: any) {
    const text = e?.bodyText ? String(e.bodyText) : ''
    if (text.includes('username_taken')) return rejectWithValue('账号已被注册')
    if (e?.status === 400) return rejectWithValue('注册信息不合法（密码至少 8 位）')
    return rejectWithValue(e?.message || '注册失败')
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    setAuthUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload
      state.isAuthenticated = Boolean(action.payload)
      state.loading = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload
        state.isAuthenticated = Boolean(action.payload)
        state.loading = false
        state.error = null
      })
      .addCase(bootstrapAuth.rejected, (state, action) => {
        state.user = null
        state.isAuthenticated = false
        state.loading = false
        state.error = action.payload ?? '初始化失败'
      })
      .addCase(signInUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signInUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.isAuthenticated = true
        state.loading = false
        state.error = null
      })
      .addCase(signInUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? '登录失败'
      })
      .addCase(signUpUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signUpUser.fulfilled, (state, action) => {
        state.user = action.payload
        state.isAuthenticated = true
        state.loading = false
        state.error = null
      })
      .addCase(signUpUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? '注册失败'
      })
      .addCase(signOutUser.fulfilled, (state) => {
        state.user = null
        state.isAuthenticated = false
        state.loading = false
        state.error = null
      })
      .addCase(signOutUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload ?? '登出失败'
      })
  },
});

export const { setAuthLoading, setAuthError, setAuthUser } = authSlice.actions

export default authSlice.reducer;
