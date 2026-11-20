import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Project } from '../types'
import * as projectService from '../services/projectService'
import type { RootState } from './index'

interface ProjectsState {
  projects: Project[]
  loading: boolean
  refreshing: boolean
  submitting: boolean
  lastFetchedAt: number | null
  error: string | null
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
  refreshing: false,
  submitting: false,
  lastFetchedAt: null,
  error: null,
}

const upsertProjectItem = (items: Project[], item: Project) => {
  const index = items.findIndex((p) => p.id === item.id)
  if (index !== -1) items[index] = item
  else items.unshift(item)
}

export const fetchProjects = createAsyncThunk<
  Project[],
  { force?: boolean } | void,
  { rejectValue: string; state: RootState }
>(
  'projects/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      return await projectService.getAllProjects()
    } catch (error: any) {
      return rejectWithValue(error.message || '获取项目列表失败')
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg && arg.force) return true
      const state = getState().projects
      if (state.loading || state.refreshing) return false
      if (state.lastFetchedAt !== null && Date.now() - state.lastFetchedAt < 60 * 1000) return false
      return true
    },
  }
)

export const addProject = createAsyncThunk<
  Project,
  Omit<Project, 'id' | 'createdAt'>,
  { rejectValue: string }
>('projects/addProject', async (projectDataFromForm, { rejectWithValue }) => {
  try {
    return await projectService.createProject(projectDataFromForm)
  } catch (error: any) {
    return rejectWithValue(error.message || '添加项目失败')
  }
})

export const updateProject = createAsyncThunk<
  Project,
  { id: string; project: Partial<Omit<Project, 'id' | 'createdAt'>> },
  { rejectValue: string }
>('projects/updateProject', async ({ id, project: projectUpdateData }, { rejectWithValue }) => {
  try {
    return await projectService.updateProject(id, projectUpdateData)
  } catch (error: any) {
    return rejectWithValue(error.message || '更新项目失败')
  }
})

export const deleteProject = createAsyncThunk<string, string, { rejectValue: string }>(
  'projects/deleteProject',
  async (id, { rejectWithValue }) => {
    try {
      await projectService.deleteProject(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.message || '删除项目失败')
    }
  }
)

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        if (state.projects.length > 0) state.refreshing = true
        else state.loading = true
        state.error = null
      })
      .addCase(fetchProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
        state.projects = action.payload
        state.loading = false
        state.refreshing = false
        state.lastFetchedAt = Date.now()
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false
        state.refreshing = false
        state.error = action.payload || '获取项目失败'
      })

      .addCase(addProject.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(addProject.fulfilled, (state, action: PayloadAction<Project>) => {
        upsertProjectItem(state.projects, action.payload)
        state.submitting = false
      })
      .addCase(addProject.rejected, (state, action) => {
        state.submitting = false
        state.error = action.payload || '添加项目失败'
      })

      .addCase(updateProject.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(updateProject.fulfilled, (state, action: PayloadAction<Project>) => {
        upsertProjectItem(state.projects, action.payload)
        state.submitting = false
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.submitting = false
        state.error = action.payload || '更新项目失败'
      })

      .addCase(deleteProject.pending, (state) => {
        state.submitting = true
        state.error = null
      })
      .addCase(deleteProject.fulfilled, (state, action: PayloadAction<string>) => {
        state.projects = state.projects.filter((project) => project.id !== action.payload)
        state.submitting = false
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.submitting = false
        state.error = action.payload || '删除项目失败'
      })
  },
})

export default projectsSlice.reducer
