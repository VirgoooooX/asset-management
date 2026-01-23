import { PayloadAction, SerializedError, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { Asset, AssetType } from '../types'
import * as assetService from '../services/assetService'
import type { RootState } from './index'

interface AssetsState {
  assets: Asset[]
  loading: boolean
  refreshing: boolean
  lastFetchedAt: number | null
  error: string | null
}

const initialState: AssetsState = {
  assets: [],
  loading: false,
  refreshing: false,
  lastFetchedAt: null,
  error: null,
}

export const fetchAssetsByType = createAsyncThunk<
  Asset[],
  { type: AssetType; force?: boolean },
  { rejectValue: string }
>(
  'assets/fetchAssetsByType',
  async ({ type }, { rejectWithValue }) => {
    try {
      const assets = await assetService.getAssetsByType(type)
      return assets
    } catch (error: any) {
      return rejectWithValue(error.message || '获取资产列表失败')
    }
  },
  {
    condition: ({ force }, { getState }) => {
      if (force) return true
      const state = (getState() as RootState).assets
      if (state.loading || state.refreshing) return false
      if (state.assets.length === 0) return true
      if (!state.lastFetchedAt) return true
      return Date.now() - state.lastFetchedAt > 60 * 1000
    },
  }
)

export const fetchAssetById = createAsyncThunk<
  Asset | null,
  { id: string },
  { rejectValue: string }
>('assets/fetchAssetById', async ({ id }, { rejectWithValue }) => {
  try {
    const asset = await assetService.getAssetById(id)
    return asset
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
    const newId = await assetService.createAsset(assetDataFromForm)
    const created = await assetService.getAssetById(newId)
    if (!created) throw new Error('资产创建成功，但未能获取到创建后的数据。')
    return created
  } catch (error: any) {
    return rejectWithValue(error.message || '添加资产失败')
  }
})

export const updateAsset = createAsyncThunk<
  Asset,
  { id: string; changes: Partial<Omit<Asset, 'id' | 'type' | 'createdAt'>> },
  { rejectValue: string }
>('assets/updateAsset', async ({ id, changes }, { rejectWithValue }) => {
  try {
    await assetService.updateAsset(id, changes)
    const updated = await assetService.getAssetById(id)
    if (!updated) throw new Error('更新资产后未能检索到该资产。')
    return updated
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
        const a = action.payload
        if (!a) return
        const index = state.assets.findIndex((x) => x.id === a.id)
        if (index !== -1) state.assets[index] = a
        else state.assets.unshift(a)
      })
      .addCase(addAsset.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addAsset.fulfilled, (state, action: PayloadAction<Asset>) => {
        state.assets.unshift(action.payload)
        state.loading = false
      })
      .addCase(
        addAsset.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '添加资产失败 (未知错误)'
        }
      )
      .addCase(updateAsset.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateAsset.fulfilled, (state, action: PayloadAction<Asset>) => {
        const index = state.assets.findIndex((a) => a.id === action.payload.id)
        if (index !== -1) state.assets[index] = action.payload
        state.loading = false
      })
      .addCase(
        updateAsset.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '更新资产失败 (未知错误)'
        }
      )
      .addCase(deleteAsset.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteAsset.fulfilled, (state, action: PayloadAction<string>) => {
        state.assets = state.assets.filter((a) => a.id !== action.payload)
        state.loading = false
      })
      .addCase(
        deleteAsset.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '删除资产失败 (未知错误)'
        }
      )
  },
})

export default assetsSlice.reducer
