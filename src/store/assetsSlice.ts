import { PayloadAction, SerializedError, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { Asset, AssetType } from '../types'
import * as assetService from '../services/assetService'
import type { RootState } from './index'

interface AssetsState {
  assets: Asset[]
  loading: boolean
  refreshing: boolean
  submitting: boolean
  lastFetchedAt: number | null
  error: string | null
}

const initialState: AssetsState = {
  assets: [],
  loading: false,
  refreshing: false,
  submitting: false,
  lastFetchedAt: null,
  error: null,
}

const upsertAssetItem = (items: Asset[], item: Asset) => {
  const index = items.findIndex((x) => x.id === item.id)
  if (index !== -1) items[index] = item
  else items.unshift(item)
}

export const fetchAssetsByType = createAsyncThunk<
  Asset[],
  { type: AssetType; force?: boolean },
  { rejectValue: string }
>(
  'assets/fetchAssetsByType',
  async ({ type }, { rejectWithValue }) => {
    try {
      return await assetService.getAssetsByType(type)
    } catch (error: any) {
      return rejectWithValue(error.message || '获取资产列表失败')
    }
  },
  {
    condition: ({ force }, { getState }) => {
      if (force) return true
      const state = (getState() as RootState).assets
      if (state.loading || state.refreshing) return false
      if (state.lastFetchedAt !== null && Date.now() - state.lastFetchedAt < 60 * 1000) return false
      return true
    },
  }
)

export const fetchAssetById = createAsyncThunk<
  Asset | null,
  { id: string },
  { rejectValue: string }
>('assets/fetchAssetById', async ({ id }, { rejectWithValue }) => {
  try {
    return await assetService.getAssetById(id)
  } catch (error: any) {
    return rejectWithValue(error.message || '获取资产失败')
  }
})

export const addAsset = createAsyncThunk<
  Asset,
  Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>,
  { rejectValue: string }
>('assets/addAsset', async (assetDataFromForm, { rejectWithValue }) => {
  try {
    return await assetService.createAsset(assetDataFromForm)
  } catch (error: any) {
    return rejectWithValue(error.message || '添加资产失败')
  }
})

export const updateAsset = createAsyncThunk<
  Asset,
  { id: string; changes: assetService.AssetUpdate },
  { rejectValue: string }
>('assets/updateAsset', async ({ id, changes }, { rejectWithValue }) => {
  try {
    return await assetService.updateAsset(id, changes)
  } catch (error: any) {
    return rejectWithValue(error.message || '更新资产失败')
  }
})

export const deleteAsset = createAsyncThunk<string, string, { rejectValue: string }>(
  'assets/deleteAsset',
  async (id, { rejectWithValue }) => {
    try {
      await assetService.deleteAsset(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.message || '删除资产失败')
    }
  }
)

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssetsByType.pending, (state) => {
        if (state.assets.length > 0) state.refreshing = true
        else state.loading = true
        state.error = null
      })
      .addCase(fetchAssetsByType.fulfilled, (state, action: PayloadAction<Asset[]>) => {
        state.assets = action.payload.slice().sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime()
          const bTime = new Date(b.createdAt).getTime()
          return bTime - aTime
        })
        state.loading = false
        state.refreshing = false
        state.lastFetchedAt = Date.now()
      })
      .addCase(
        fetchAssetsByType.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.refreshing = false
          state.error = action.payload || action.error.message || '获取资产失败 (未知错误)'
        }
      )
      .addCase(fetchAssetById.fulfilled, (state, action: PayloadAction<Asset | null>) => {
        if (action.payload) upsertAssetItem(state.assets, action.payload)
      })
      .addCase(addAsset.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(addAsset.fulfilled, (state, action: PayloadAction<Asset>) => {
        upsertAssetItem(state.assets, action.payload)
        state.submitting = false
      })
      .addCase(
        addAsset.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.submitting = false
          state.error = action.payload || action.error.message || '添加资产失败 (未知错误)'
        }
      )
      .addCase(updateAsset.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(updateAsset.fulfilled, (state, action: PayloadAction<Asset>) => {
        upsertAssetItem(state.assets, action.payload)
        state.submitting = false
      })
      .addCase(
        updateAsset.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.submitting = false
          state.error = action.payload || action.error.message || '更新资产失败 (未知错误)'
        }
      )
      .addCase(deleteAsset.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(deleteAsset.fulfilled, (state, action: PayloadAction<string>) => {
        state.assets = state.assets.filter((a) => a.id !== action.payload)
        state.submitting = false
      })
      .addCase(
        deleteAsset.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.submitting = false
          state.error = action.payload || action.error.message || '删除资产失败 (未知错误)'
        }
      )
  },
})

export default assetsSlice.reducer
