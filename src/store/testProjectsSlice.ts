// src/store/testProjectsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TestProject } from '../types';
// 导入真实的 service 函数
import * as testProjectService from '../services/testProjectService'; 

interface TestProjectsState {
  testProjects: TestProject[];
  loading: boolean;
  error: string | null;
}

const initialState: TestProjectsState = {
  testProjects: [],
  loading: false,
  error: null,
};

// --- 使用真实的 Service 调用 ---

export const fetchTestProjects = createAsyncThunk<
  TestProject[], // 返回类型
  void, // 参数类型 (无参数)
  { rejectValue: string } // Thunk 配置，用于 reject 类型
>(
  'testProjects/fetchTestProjects',
  async (_, { rejectWithValue }) => {
    try {
      return await testProjectService.getAllTestProjects();
    } catch (error: any) {
      return rejectWithValue(error.message || '获取测试项目失败');
    }
  }
);

// Thunk for adding a test project
// Input: Omit<TestProject, 'id' | 'createdAt'> (UI 不提供 id 和 createdAt)
// Return: TestProject (完整的，包含 id 和服务器生成的 createdAt 字符串)
export const addTestProject = createAsyncThunk<
  TestProject,
  Omit<TestProject, 'id' | 'createdAt'>, 
  { rejectValue: string }
>(
  'testProjects/addTestProject',
  async (newTestData, { rejectWithValue }) => {
    try {
      // service 的 createTestProject (修改后) 接收 Omit<TestProject, 'id' | 'createdAt'>
      // 并且内部会使用服务器时间戳处理 createdAt
      // 它返回新创建的 testProject 的 ID
      const id = await testProjectService.createTestProject(newTestData);
      
      // 创建成功后，获取完整的 TestProject 对象以便更新 Redux state
      const createdTestProject = await testProjectService.getTestProjectById(id);
      if (!createdTestProject) {
          // 如果 getById 失败，抛出错误，会被 catch 捕获
          throw new Error('创建测试项目后未能检索到该项目。');
      }
      // getTestProjectById 返回的对象中 createdAt 已经是 ISO 字符串
      return createdTestProject; 
    } catch (error: any) {
      return rejectWithValue(error.message || '添加测试项目失败');
    }
  }
);

// Thunk for updating a test project
// Input: { id: string; testProject: Partial<Omit<TestProject, 'id' | 'createdAt'>> }
//        (只传递需要更新的字段，不包括 id 和 createdAt)
// Return: Partial<TestProject> & { id: string } (包含 id 和更新后的字段)
export const updateTestProject = createAsyncThunk<
  Partial<TestProject> & { id: string },
  { id: string; testProject: Partial<Omit<TestProject, 'id' | 'createdAt'>> }, // 输入类型与修改后的 service 匹配
  { rejectValue: string }
>(
  'testProjects/updateTestProject',
  async ({ id, testProject }, { rejectWithValue }) => {
    try {
      // testProjectService.updateTestProject (修改后) 接收 Omit<..., 'id' | 'createdAt'>
      // 并且内部会确保 createdAt 不被更新
      await testProjectService.updateTestProject(id, testProject);
      // 返回 id 和更新的字段以便 reducer 使用
      return { id, ...testProject }; 
    } catch (error: any) {
      return rejectWithValue(error.message || '更新测试项目失败');
    }
  }
);

// Thunk for deleting a test project
// Input: string (the id to delete)
// Return: string (the id deleted)
export const deleteTestProject = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>(
  'testProjects/deleteTestProject',
  async (id, { rejectWithValue }) => {
    try {
      await testProjectService.deleteTestProject(id);
      return id; // 返回被删除的 ID
    } catch (error: any) {
      return rejectWithValue(error.message || '删除测试项目失败');
    }
  }
);

// --- Slice Definition ---
const testProjectsSlice = createSlice({
  name: 'testProjects',
  initialState,
  reducers: {
    // 可以添加同步 reducer (如果需要)
  },
  extraReducers: (builder) => {
    builder
      // fetchTestProjects
      .addCase(fetchTestProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTestProjects.fulfilled, (state, action: PayloadAction<TestProject[]>) => {
        state.testProjects = action.payload;
        state.loading = false;
      })
      .addCase(fetchTestProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || '获取测试项目失败';
      })
      
      // addTestProject
      .addCase(addTestProject.pending, (state) => {
        state.loading = true; 
        state.error = null;
      })
      .addCase(addTestProject.fulfilled, (state, action: PayloadAction<TestProject>) => {
        // action.payload 是包含服务器生成的 createdAt 的完整 TestProject 对象
        state.testProjects.unshift(action.payload); // 添加到列表开头，保持最新在最前
        state.loading = false;
      })
      .addCase(addTestProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || '添加测试项目失败';
      })
      
      // updateTestProject
      .addCase(updateTestProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTestProject.fulfilled, (state, action: PayloadAction<Partial<TestProject> & { id: string }>) => {
        const { id, ...changes } = action.payload;
        const index = state.testProjects.findIndex(tp => tp.id === id);
        if (index !== -1) {
          // 合并更新
          state.testProjects[index] = { ...state.testProjects[index], ...changes };
        }
        state.loading = false;
      })
      .addCase(updateTestProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || '更新测试项目失败';
      })
      
      // deleteTestProject
      .addCase(deleteTestProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTestProject.fulfilled, (state, action: PayloadAction<string>) => {
        // action.payload 是被删除的 testProject 的 id
        state.testProjects = state.testProjects.filter(tp => tp.id !== action.payload);
        state.loading = false;
      })
      .addCase(deleteTestProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message || '删除测试项目失败';
      });
  },
});

export default testProjectsSlice.reducer;