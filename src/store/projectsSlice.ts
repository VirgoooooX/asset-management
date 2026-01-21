// src/store/projectsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Project } from '../types';
import * as projectService from '../services/projectService';
import type { RootState } from './index'; // 1. 导入 RootState (假设 index.ts 和 projectsSlice.ts 在同一个 store 目录下)

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
  error: null,
};

// --- 异步 Thunks ---

export const fetchProjects = createAsyncThunk<
  Project[],
  void,
  { rejectValue: string }
>(
  'projects/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      const projectsFromService = await projectService.getAllProjects();
      return projectsFromService;
    } catch (error: any) {
      return rejectWithValue(error.message || '获取项目列表失败');
    }
  }
);

export const addProject = createAsyncThunk<
  Project,
  Omit<Project, 'id' | 'createdAt'>,
  { rejectValue: string }
>(
  'projects/addProject',
  async (projectDataFromForm, { rejectWithValue }) => {
    try {
      const newProjectId = await projectService.createProject(projectDataFromForm);
      const newProject = await projectService.getProjectById(newProjectId);
      if (!newProject) {
        throw new Error('项目创建成功，但未能获取到创建后的项目数据。');
      }
      return newProject;
    } catch (error: any) {
      return rejectWithValue(error.message || '添加项目失败');
    }
  }
);

export const updateProject = createAsyncThunk<
  Project,
  { id: string; project: Partial<Omit<Project, 'id' | 'createdAt'>> },
  { 
    rejectValue: string;
    state: RootState; // 2. 在 Thunk 配置中指定 state 类型
  }
>(
  'projects/updateProject',
  async ({ id, project: projectUpdateData }, { rejectWithValue, getState }) => {
    try {
      await projectService.updateProject(id, projectUpdateData);
      
      // getState() 现在是类型安全的，返回 RootState
      const existingProject = getState().projects.projects.find(p => p.id === id); 
      if (!existingProject) {
        throw new Error('尝试更新的项目在当前状态中未找到。');
      }
      
      const updatedProjectData: Project = {
        ...existingProject,
        ...projectUpdateData,
      };
      return updatedProjectData;

    } catch (error: any) {
      return rejectWithValue(error.message || '更新项目失败');
    }
  }
);

export const deleteProject = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>(
  'projects/deleteProject',
  async (id, { rejectWithValue }) => {
    try {
      await projectService.deleteProject(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || '删除项目失败');
    }
  }
);

// --- Slice Definition ---
const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
        state.projects = action.payload;
        state.loading = false;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '获取项目失败';
      })
      
      .addCase(addProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addProject.fulfilled, (state, action: PayloadAction<Project>) => {
        state.projects.unshift(action.payload);
        state.loading = false;
      })
      .addCase(addProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '添加项目失败';
      })
      
      .addCase(updateProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action: PayloadAction<Project>) => {
        const index = state.projects.findIndex(project => project.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
        state.loading = false;
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '更新项目失败';
      })
      
      .addCase(deleteProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProject.fulfilled, (state, action: PayloadAction<string>) => {
        state.projects = state.projects.filter(project => project.id !== action.payload);
        state.loading = false;
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || '删除项目失败';
      });
  },
});

export default projectsSlice.reducer;