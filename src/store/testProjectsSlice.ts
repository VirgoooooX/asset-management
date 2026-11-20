import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { TestProject } from '../types'
import * as testProjectService from '../services/testProjectService'
import type { RootState } from './index'

interface TestProjectsState {
  testProjects: TestProject[]
  loading: boolean
  refreshing: boolean
  submitting: boolean
  lastFetchedAt: number | null
  error: string | null
}

const initialState: TestProjectsState = {
  testProjects: [],
  loading: false,
  refreshing: false,
  submitting: false,
  lastFetchedAt: null,
  error: null,
}

const upsertTestProjectItem = (items: TestProject[], item: TestProject) => {
  const index = items.findIndex((tp) => tp.id === item.id)
  if (index !== -1) items[index] = item
  else items.unshift(item)
}

export const fetchTestProjects = createAsyncThunk<
  TestProject[],
  { force?: boolean } | void,
  { rejectValue: string; state: RootState }
>(
  'testProjects/fetchTestProjects',
  async (_, { rejectWithValue }) => {
    try {
      return await testProjectService.getAllTestProjects()
    } catch (error: any) {
      return rejectWithValue(error.message || '获取测试项目失败')
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg && arg.force) return true
      const state = getState().testProjects
      if (state.loading || state.refreshing) return false
      if (state.lastFetchedAt !== null && Date.now() - state.lastFetchedAt < 60 * 1000) return false
      return true
    },
  }
)

export const addTestProject = createAsyncThunk<
  TestProject,
  Omit<TestProject, 'id' | 'createdAt'>,
  { rejectValue: string }
>('testProjects/addTestProject', async (newTestData, { rejectWithValue }) => {
  try {
    return await testProjectService.createTestProject(newTestData)
  } catch (error: any) {
    return rejectWithValue(error.message || '添加测试项目失败')
  }
})

export const updateTestProject = createAsyncThunk<
  TestProject,
  { id: string; testProject: Partial<Omit<TestProject, 'id' | 'createdAt'>> },
  { rejectValue: string }
>('testProjects/updateTestProject', async ({ id, testProject }, { rejectWithValue }) => {
  try {
    return await testProjectService.updateTestProject(id, testProject)
  } catch (error: any) {
    return rejectWithValue(error.message || '更新测试项目失败')
  }
})

export const deleteTestProject = createAsyncThunk<string, string, { rejectValue: string }>(
  'testProjects/deleteTestProject',
  async (id, { rejectWithValue }) => {
    try {
      await testProjectService.deleteTestProject(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.message || '删除测试项目失败')
    }
  }
)

const testProjectsSlice = createSlice({
  name: 'testProjects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTestProjects.pending, (state) => {
        if (state.testProjects.length > 0) state.refreshing = true
        else state.loading = true
        state.error = null
      })
      .addCase(fetchTestProjects.fulfilled, (state, action: PayloadAction<TestProject[]>) => {
        state.testProjects = action.payload
        state.loading = false
        state.refreshing = false
        state.lastFetchedAt = Date.now()
      })
      .addCase(fetchTestProjects.rejected, (state, action) => {
        state.loading = false
        state.refreshing = false
        state.error = action.payload || action.error.message || '获取测试项目失败'
      })

      .addCase(addTestProject.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(addTestProject.fulfilled, (state, action: PayloadAction<TestProject>) => {
        upsertTestProjectItem(state.testProjects, action.payload)
        state.submitting = false
      })
      .addCase(addTestProject.rejected, (state, action) => {
        state.submitting = false
        state.error = action.payload || action.error.message || '添加测试项目失败'
      })

      .addCase(updateTestProject.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(updateTestProject.fulfilled, (state, action: PayloadAction<TestProject>) => {
        upsertTestProjectItem(state.testProjects, action.payload)
        state.submitting = false
      })
      .addCase(updateTestProject.rejected, (state, action) => {
        state.submitting = false
        state.error = action.payload || action.error.message || '更新测试项目失败'
      })

      .addCase(deleteTestProject.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(deleteTestProject.fulfilled, (state, action: PayloadAction<string>) => {
        state.testProjects = state.testProjects.filter((tp) => tp.id !== action.payload)
        state.submitting = false
      })
      .addCase(deleteTestProject.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.submitting = false
        state.error = action.payload || '删除测试项目失败'
      })
  },
})

export default testProjectsSlice.reducer
