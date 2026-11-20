import { createSlice, createAsyncThunk, PayloadAction, SerializedError } from '@reduxjs/toolkit'
import { UsageLog } from '../types'
import * as usageLogService from '../services/usageLogService'
import { fetchAssetById } from './assetsSlice'
import type { AppDispatch, RootState } from './index'

interface UsageLogsState {
  usageLogs: UsageLog[]
  loading: boolean
  refreshing: boolean
  submitting: boolean
  lastFetchedAt: number | null
  error: string | null
}

const initialState: UsageLogsState = {
  usageLogs: [],
  loading: false,
  refreshing: false,
  submitting: false,
  lastFetchedAt: null,
  error: null,
}

const compareUsageLogs = (a: UsageLog, b: UsageLog) => {
  const startTimeDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  if (startTimeDiff !== 0) return startTimeDiff
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

const upsertSortedUsageLog = (logs: UsageLog[], item: UsageLog) => {
  const index = logs.findIndex((log) => log.id === item.id)
  if (index !== -1) logs[index] = item
  else logs.unshift(item)
  logs.sort(compareUsageLogs)
}

const syncAffectedChambers = (dispatch: AppDispatch, nextChamberId: string, prevChamberId?: string) => {
  if (prevChamberId && prevChamberId !== nextChamberId) {
    dispatch(fetchAssetById({ id: prevChamberId }))
  }
  dispatch(fetchAssetById({ id: nextChamberId }))
}

export const fetchUsageLogs = createAsyncThunk<
  UsageLog[],
  { force?: boolean } | undefined,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>(
  'usageLogs/fetchUsageLogs',
  async (_, { rejectWithValue }) => {
    try {
      return await usageLogService.getAllUsageLogs()
    } catch (error: any) {
      return rejectWithValue(error.message || '获取所有使用记录失败')
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg?.force) return true
      const state = (getState() as RootState).usageLogs
      if (state.loading || state.refreshing) return false
      if (state.lastFetchedAt !== null && Date.now() - state.lastFetchedAt < 60 * 1000) return false
      return true
    },
  }
)

export const addUsageLog = createAsyncThunk<
  UsageLog,
  Omit<UsageLog, 'id' | 'createdAt'>,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>('usageLogs/addUsageLog', async (usageLogDataFromForm, { rejectWithValue, dispatch }) => {
  try {
    const createdLog = await usageLogService.createUsageLog(usageLogDataFromForm)
    dispatch(fetchAssetById({ id: createdLog.chamberId }))
    return createdLog
  } catch (error: any) {
    return rejectWithValue(error.message || '添加使用记录失败')
  }
})

export const updateUsageLog = createAsyncThunk<
  UsageLog,
  { id: string; log: Partial<Omit<UsageLog, 'id' | 'createdAt'>> },
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>('usageLogs/updateUsageLog', async ({ id, log: logUpdateData }, { rejectWithValue, dispatch, getState }) => {
  try {
    const prev = (getState() as RootState).usageLogs.usageLogs.find((x) => x.id === id)
    const updatedLog = await usageLogService.updateUsageLog(id, logUpdateData)
    syncAffectedChambers(dispatch, updatedLog.chamberId, prev?.chamberId)
    return updatedLog
  } catch (error: any) {
    return rejectWithValue(error.message || '更新使用记录失败')
  }
})

export const markLogAsCompleted = createAsyncThunk<
  UsageLog,
  string,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>('usageLogs/markLogAsCompleted', async (logId, { rejectWithValue, dispatch, getState }) => {
  try {
    const prev = (getState() as RootState).usageLogs.usageLogs.find((x) => x.id === logId)
    const updatedLog = await usageLogService.updateUsageLog(logId, { status: 'completed' })
    syncAffectedChambers(dispatch, updatedLog.chamberId, prev?.chamberId)
    return updatedLog
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to mark log as completed.')
  }
})

export const removeConfigFromUsageLog = createAsyncThunk<
  void,
  { logId: string; configId: string },
  { rejectValue: string; dispatch: AppDispatch }
>('usageLogs/removeConfigFromUsageLog', async ({ logId, configId }, { rejectWithValue, dispatch }) => {
  try {
    await usageLogService.removeConfigFromUsageLog(logId, configId)
    await dispatch(fetchUsageLogs({ force: true }))
  } catch (error: any) {
    return rejectWithValue(error.message || '从使用记录中移除配置失败')
  }
})

export const deleteUsageLog = createAsyncThunk<
  string,
  string,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>('usageLogs/deleteUsageLog', async (id, { rejectWithValue, dispatch, getState }) => {
  try {
    const prev = (getState() as RootState).usageLogs.usageLogs.find((x) => x.id === id)
    await usageLogService.deleteUsageLog(id)
    if (prev?.chamberId) dispatch(fetchAssetById({ id: prev.chamberId }))
    return id
  } catch (error: any) {
    return rejectWithValue(error.message || '删除使用记录失败')
  }
})

const usageLogsSlice = createSlice({
  name: 'usageLogs',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const handleUpsertPending = (state: UsageLogsState) => {
      state.submitting = true
      state.error = null
    }
    const handleUpsertFulfilled = (state: UsageLogsState, action: PayloadAction<UsageLog>) => {
      upsertSortedUsageLog(state.usageLogs, action.payload)
      state.submitting = false
    }
    const handleMutationRejected =
      (fallback: string) =>
      (state: UsageLogsState, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
        state.submitting = false
        state.error = action.payload || action.error.message || fallback
      }

    builder
      .addCase(fetchUsageLogs.pending, (state) => {
        if (state.usageLogs.length > 0) state.refreshing = true
        else state.loading = true
        state.error = null
      })
      .addCase(fetchUsageLogs.fulfilled, (state, action: PayloadAction<UsageLog[]>) => {
        state.usageLogs = action.payload.slice().sort(compareUsageLogs)
        state.loading = false
        state.refreshing = false
        state.lastFetchedAt = Date.now()
      })
      .addCase(
        fetchUsageLogs.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.refreshing = false
          state.error = action.payload || action.error.message || '获取使用记录失败'
        }
      )

      .addCase(addUsageLog.pending, handleUpsertPending)
      .addCase(addUsageLog.fulfilled, handleUpsertFulfilled)
      .addCase(addUsageLog.rejected, handleMutationRejected('添加失败'))

      .addCase(updateUsageLog.pending, handleUpsertPending)
      .addCase(updateUsageLog.fulfilled, handleUpsertFulfilled)
      .addCase(updateUsageLog.rejected, handleMutationRejected('更新失败'))

      .addCase(markLogAsCompleted.pending, handleUpsertPending)
      .addCase(markLogAsCompleted.fulfilled, handleUpsertFulfilled)
      .addCase(markLogAsCompleted.rejected, handleMutationRejected('标记完成操作失败'))

      .addCase(deleteUsageLog.pending, handleUpsertPending)
      .addCase(deleteUsageLog.fulfilled, (state, action: PayloadAction<string>) => {
        state.usageLogs = state.usageLogs.filter((log) => log.id !== action.payload)
        state.submitting = false
      })
      .addCase(deleteUsageLog.rejected, handleMutationRejected('删除失败'))
  },
})

export default usageLogsSlice.reducer
