// src/store/chambersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction, SerializedError } from '@reduxjs/toolkit'; // 导入 SerializedError
import { Chamber } from '../types';
import * as chamberService from '../services/chamberService';
import type { RootState } from './index'; 

interface ChambersState {
  chambers: Chamber[];
  loading: boolean;
  error: string | null;
}

const initialState: ChambersState = {
  chambers: [],
  loading: false,
  error: null,
};

// --- 异步 Thunks (保持之前的修改，确保 rejectValue 和 state 类型) ---

export const fetchChambers = createAsyncThunk<
  Chamber[],
  void,
  { rejectValue: string }
>(
  'chambers/fetchChambers',
  async (_, { rejectWithValue }) => {
      try {
          return await chamberService.getAllChambers();
      } catch (error: any) {
          return rejectWithValue(error.message || '获取环境箱列表失败');
      }
  }
);

export const addChamber = createAsyncThunk<
  Chamber,
  Omit<Chamber, 'id' | 'createdAt'>,
  { rejectValue: string; state: RootState }
>(
  'chambers/addChamber',
  async (chamberDataFromForm, { rejectWithValue }) => {
    try {
      const newChamberId = await chamberService.createChamber(chamberDataFromForm);
      const newChamber = await chamberService.getChamberById(newChamberId);
      if (!newChamber) {
        throw new Error('环境箱创建成功，但未能获取到创建后的数据。');
      }
      return newChamber; 
    } catch (error: any) {
      return rejectWithValue(error.message || '添加环境箱失败');
    }
  }
);

export const updateChamber = createAsyncThunk<
  Partial<Chamber> & { id: string },
  { id: string; chamber: Partial<Omit<Chamber, 'id' | 'createdAt'>> },
  { rejectValue: string; state: RootState }
>(
  'chambers/updateChamber',
  async ({ id, chamber: chamberUpdateData }, { rejectWithValue }) => {
    try {
      await chamberService.updateChamber(id, chamberUpdateData);
      // 为了在 fulfilled reducer 中获得完整的对象，也可以在此处调用 getChamberById(id)
      // 当前返回部分更新 + id
      return { id, ...chamberUpdateData };
    } catch (error: any) {
       return rejectWithValue(error.message || '更新环境箱失败');
    }
  }
);

export const deleteChamber = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>(
  'chambers/deleteChamber',
  async (id, { rejectWithValue }) => {
    try {
      await chamberService.deleteChamber(id);
      return id;
    } catch (error: any) {
       return rejectWithValue(error.message || '删除环境箱失败');
    }
  }
);

// --- Slice Definition ---
const chambersSlice = createSlice({
  name: 'chambers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchChambers
      .addCase(fetchChambers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchChambers.fulfilled, (state, action: PayloadAction<Chamber[]>) => {
          state.chambers = action.payload.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          state.loading = false;
      })
      // 修改 fetchChambers.rejected
      .addCase(fetchChambers.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
        state.loading = false;
        // 优先使用 rejectWithValue 传递的 payload (string)
        // 否则尝试 action.error.message (可能为 undefined)
        // 最后使用回退消息
        state.error = action.payload || action.error.message || '获取环境箱失败 (未知错误)';
        console.error('获取环境箱失败:', action.payload || action.error); // 记录更详细的信息
      })
      
      // addChamber
      .addCase(addChamber.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(addChamber.fulfilled, (state, action: PayloadAction<Chamber>) => {
        state.chambers.unshift(action.payload);
        state.loading = false;
      })
      // 修改 addChamber.rejected
      .addCase(addChamber.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.error = action.payload || action.error.message || '添加环境箱失败 (未知错误)';
          console.error('添加环境箱失败:', action.payload || action.error);
      })
      
      // updateChamber
      .addCase(updateChamber.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateChamber.fulfilled, (state, action: PayloadAction<Partial<Chamber> & { id: string }>) => {
        const { id, ...changes } = action.payload;
        const index = state.chambers.findIndex(chamber => chamber.id === id);
        if (index !== -1) {
          state.chambers[index] = { ...state.chambers[index], ...changes };
        }
        state.loading = false;
      })
      // 修改 updateChamber.rejected
      .addCase(updateChamber.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.error = action.payload || action.error.message || '更新环境箱失败 (未知错误)';
           console.error('更新环境箱失败:', action.payload || action.error);
      })
      
      // deleteChamber
      .addCase(deleteChamber.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(deleteChamber.fulfilled, (state, action: PayloadAction<string>) => {
        state.chambers = state.chambers.filter(chamber => chamber.id !== action.payload);
        state.loading = false;
      })
      // 修改 deleteChamber.rejected
      .addCase(deleteChamber.rejected, (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false;
          state.error = action.payload || action.error.message || '删除环境箱失败 (未知错误)';
          console.error('删除环境箱失败:', action.payload || action.error);
      });
  },
});

export default chambersSlice.reducer;
