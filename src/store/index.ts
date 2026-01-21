import { configureStore } from '@reduxjs/toolkit';
import chambersReducer from './chambersSlice';
import assetsReducer from './assetsSlice';
import usageLogsReducer from './usageLogsSlice';
import projectsReducer from './projectsSlice';
import testProjectsReducer from './testProjectsSlice';
import authReducer from './authSlice';
import settingsReducer from './settingsSlice'
import repairTicketsReducer from './repairTicketsSlice'
import { listenerMiddleware } from './listeners'

export const store = configureStore({
  reducer: {
    chambers: chambersReducer,
    assets: assetsReducer,
    usageLogs: usageLogsReducer,
    projects: projectsReducer,
    testProjects: testProjectsReducer, // <--- testProjects 在这里定义
    auth: authReducer,
    settings: settingsReducer,
    repairTickets: repairTicketsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
