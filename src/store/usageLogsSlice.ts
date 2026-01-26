// src/store/usageLogsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction, SerializedError } from '@reduxjs/toolkit';
import { UsageLog } from '../types';
import * as usageLogService from '../services/usageLogService';
import { fetchAssetById } from './assetsSlice'
import type { AppDispatch, RootState } from './index';

interface UsageLogsState {
  usageLogs: UsageLog[];
  loading: boolean;
  refreshing: boolean;
  lastFetchedAt: number | null;
  error: string | null;
}

const initialState: UsageLogsState = {
  usageLogs: [],
  loading: false,
  refreshing: false,
  lastFetchedAt: null,
  error: null,
};

// --- 异步 Thunks ---

export const fetchUsageLogs = createAsyncThunk<
  UsageLog[],
  { force?: boolean } | undefined,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>(
  'usageLogs/fetchUsageLogs',
  async (_, { rejectWithValue }) => {
    try {
      const data = await usageLogService.getAllUsageLogs();
      return data;
    } catch (error: any) {
      console.error('[Thunk] fetchUsageLogs: Caught error from service. Error message:', error.message, 'Error object:', error);
      return rejectWithValue(error.message || '获取所有使用记录失败');
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg?.force) return true
      const state = (getState() as RootState).usageLogs
      if (state.loading || state.refreshing) return false
      if (state.usageLogs.length === 0) return true
      if (!state.lastFetchedAt) return true
      return Date.now() - state.lastFetchedAt > 60 * 1000
    }
  }
);

export const fetchUsageLogsByChamber = createAsyncThunk<
  UsageLog[],
  string,
  { rejectValue: string }
>(
  'usageLogs/fetchUsageLogsByChamber',
  async (chamberId, { rejectWithValue }) => {
    try {
      return await usageLogService.getUsageLogsByChamber(chamberId);
    } catch (error: any) {
      return rejectWithValue(error.message || '获取环境箱使用记录失败');
    }
  }
);

export const addUsageLog = createAsyncThunk<
  UsageLog,
  Omit<UsageLog, 'id' | 'createdAt'>,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>(
  'usageLogs/addUsageLog',
  async (usageLogDataFromForm, { rejectWithValue, dispatch }) => {
    try {
      const newLogId = await usageLogService.createUsageLog(usageLogDataFromForm);
      const createdLog = await usageLogService.getUsageLogById(newLogId);
      if (!createdLog) {
        throw new Error('使用记录创建成功，但未能获取到创建后的数据。');
      }
      dispatch(fetchAssetById({ id: createdLog.chamberId }))
      return createdLog;
    } catch (error: any) {
      return rejectWithValue(error.message || '添加使用记录失败');
    }
  }
);

export const updateUsageLog = createAsyncThunk<
  UsageLog,
  { id: string; log: Partial<Omit<UsageLog, 'id' | 'createdAt'>> },
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>(
  'usageLogs/updateUsageLog',
  async ({ id, log: logUpdateData }, { rejectWithValue, dispatch, getState }) => {
    try {
      const prev = (getState() as RootState).usageLogs.usageLogs.find((x) => x.id === id)
      await usageLogService.updateUsageLog(id, logUpdateData);

      const updatedLog = await usageLogService.getUsageLogById(id);
      if (!updatedLog) {
        throw new Error('更新使用记录后未能检索到该记录。');
      }
      if (prev?.chamberId && prev.chamberId !== updatedLog.chamberId) {
        dispatch(fetchAssetById({ id: prev.chamberId }))
      }
      dispatch(fetchAssetById({ id: updatedLog.chamberId }))
      return updatedLog;
    } catch (error: any) {
      return rejectWithValue(error.message || '更新使用记录失败');
    }
  }
);

// Thunk for manually marking a log as completed
export const markLogAsCompleted = createAsyncThunk<
  UsageLog, // Returns the updated UsageLog
  string,   // Argument is the logId
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>(
  'usageLogs/markLogAsCompleted',
  async (logId, { rejectWithValue, dispatch, getState }) => {
    try {
      // The service function `updateUsageLog` will handle setting status to 'completed',
      // adjusting endTime if necessary, and then triggering the chamber status update.
      const prev = (getState() as RootState).usageLogs.usageLogs.find((x) => x.id === logId)
      await usageLogService.updateUsageLog(logId, { status: 'completed' });

      // Fetch the updated log to return to the reducer
      const updatedLog = await usageLogService.getUsageLogById(logId);
      if (!updatedLog) {
        throw new Error('Log marked as completed, but failed to retrieve updated details.');
      }
      dispatch(fetchAssetById({ id: updatedLog.chamberId }))
      if (prev?.chamberId && prev.chamberId !== updatedLog.chamberId) dispatch(fetchAssetById({ id: prev.chamberId }))

      return updatedLog;
    } catch (error: any) {
      console.error(`[Thunk] markLogAsCompleted: Error for log ${logId}:`, error);
      return rejectWithValue(error.message || 'Failed to mark log as completed.');
    }
  }
);

export const removeConfigFromUsageLog = createAsyncThunk<
  void,
  { logId: string; configId: string },
  { rejectValue: string; dispatch: AppDispatch }
>(
  'usageLogs/removeConfigFromUsageLog',
  async ({ logId, configId }, { rejectWithValue, dispatch }) => {
    try {
      await usageLogService.removeConfigFromUsageLog(logId, configId);
      await dispatch(fetchUsageLogs({ force: true }));
    } catch (error: any) {
      return rejectWithValue(error.message || '从使用记录中移除配置失败');
    }
  }
);

export const deleteUsageLog = createAsyncThunk<
  string,
  string,
  { rejectValue: string; dispatch: AppDispatch; state: RootState }
>(
  'usageLogs/deleteUsageLog',
  async (id, { rejectWithValue, dispatch, getState }) => {
    try {
      const prev = (getState() as RootState).usageLogs.usageLogs.find((x) => x.id === id)
      await usageLogService.deleteUsageLog(id);
      if (prev?.chamberId) dispatch(fetchAssetById({ id: prev.chamberId }))

      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || '删除使用记录失败');
    }
  }
);

const usageLogsSlice = createSlice({
  name: 'usageLogs',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchUsageLogs cases
      .addCase(fetchUsageLogs.pending, (state) => {
        if (state.usageLogs.length > 0) state.refreshing = true
        else state.loading = true
        state.error = null
      })
      .addCase(fetchUsageLogs.fulfilled, (state, action: PayloadAction<UsageLog[]>) => {
          state.usageLogs = action.payload.sort((a, b) => {
            // Sort by start time descending, then by creation time descending as a fallback
            const startTimeDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            if (startTimeDiff !== 0) return startTimeDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          state.loading = false;
          state.refreshing = false;
          state.lastFetchedAt = Date.now();
      })
      .addCase(fetchUsageLogs.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.refreshing = false;
          state.error = action.payload || action.error.message || '获取使用记录失败';
          console.error('获取使用记录失败:', action.payload || action.error);
      })

      // fetchUsageLogsByChamber cases
      .addCase(fetchUsageLogsByChamber.pending, (state) => { state.loading = true; state.error = null;})
      .addCase(fetchUsageLogsByChamber.fulfilled, (state, action: PayloadAction<UsageLog[]>) => {
        // Example: Replace all logs with fetched ones, or merge, depending on desired behavior
        state.usageLogs = action.payload.sort((a, b) => {
            const startTimeDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            if (startTimeDiff !== 0) return startTimeDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        state.loading = false;
        state.refreshing = false;
        state.lastFetchedAt = null;
      })
      .addCase(fetchUsageLogsByChamber.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
        state.loading = false;
        state.refreshing = false;
        state.error = action.payload || action.error.message || '获取环境箱使用记录失败';
      })

      // addUsageLog cases
      .addCase(addUsageLog.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(addUsageLog.fulfilled, (state, action: PayloadAction<UsageLog>) => {
        state.usageLogs.unshift(action.payload); // Add to the beginning for chronological display (newest first)
        state.usageLogs.sort((a, b) => { // Re-sort just in case
            const startTimeDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            if (startTimeDiff !== 0) return startTimeDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        state.loading = false;
      })
      .addCase(addUsageLog.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.error = action.payload || action.error.message || '添加失败';
          console.error('添加使用记录失败:', action.payload || action.error);
      })

      // updateUsageLog cases
      .addCase(updateUsageLog.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateUsageLog.fulfilled, (state, action: PayloadAction<UsageLog>) => {
        const index = state.usageLogs.findIndex(log => log.id === action.payload.id);
        if (index !== -1) {
          state.usageLogs[index] = action.payload;
        }
        state.usageLogs.sort((a, b) => {
            const startTimeDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            if (startTimeDiff !== 0) return startTimeDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        state.loading = false;
      })
      .addCase(updateUsageLog.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.error = action.payload || action.error.message || '更新失败';
          console.error('更新使用记录失败:', action.payload || action.error);
      })

      // markLogAsCompleted cases
      .addCase(markLogAsCompleted.pending, (state) => {
        // Optionally set a more specific loading state if needed, e.g., state.markingAsCompleted = true
        state.loading = true;
        state.error = null;
      })
      .addCase(markLogAsCompleted.fulfilled, (state, action: PayloadAction<UsageLog>) => {
        const index = state.usageLogs.findIndex(log => log.id === action.payload.id);
        if (index !== -1) {
          state.usageLogs[index] = action.payload; // Replace with the fully updated log
        }
        state.usageLogs.sort((a, b) => { // Ensure list remains sorted
            const startTimeDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
            if (startTimeDiff !== 0) return startTimeDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        state.loading = false;
      })
      .addCase(markLogAsCompleted.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
        state.loading = false;
        state.error = action.payload || action.error.message || '标记完成操作失败';
        console.error('标记记录为已完成失败:', action.payload || action.error);
      })

      // deleteUsageLog cases
      .addCase(deleteUsageLog.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteUsageLog.fulfilled, (state, action: PayloadAction<string>) => {
          state.usageLogs = state.usageLogs.filter(log => log.id !== action.payload);
          // No re-sorting needed here as an item is removed
          state.loading = false;
       })
      .addCase(deleteUsageLog.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.error = action.payload || action.error.message || '删除失败';
          console.error('删除使用记录失败:', action.payload || action.error);
      });
  },
});

export default usageLogsSlice.reducer;
