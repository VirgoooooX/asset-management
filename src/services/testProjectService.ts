import { apiFetch } from './apiClient'
import type { TestProject } from '../types'

export const getAllTestProjects = async (): Promise<TestProject[]> => {
  const data = await apiFetch<{ items: TestProject[] }>('/api/test-projects')
  return Array.isArray(data.items) ? data.items : []
}

export const getTestProjectById = async (id: string): Promise<TestProject | null> => {
  try {
    const data = await apiFetch<{ item: TestProject }>(`/api/test-projects/${encodeURIComponent(id)}`)
    return data.item ?? null
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

export const createTestProject = async (testProjectData: Omit<TestProject, 'id' | 'createdAt'>): Promise<TestProject> => {
  const data = await apiFetch<{ id: string; item?: TestProject }>('/api/test-projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(testProjectData),
  })
  if (data.item) return data.item
  const fetched = await getTestProjectById(data.id)
  if (!fetched) throw new Error('创建测试项目后未能检索到该项目。')
  return fetched
}

export const updateTestProject = async (
  id: string,
  testProjectUpdateData: Partial<Omit<TestProject, 'id' | 'createdAt'>>
): Promise<TestProject> => {
  const data = await apiFetch<{ ok: boolean; item?: TestProject }>(`/api/test-projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(testProjectUpdateData),
  })
  if (data.item) return data.item
  const fetched = await getTestProjectById(id)
  if (!fetched) throw new Error('更新测试项目后未能检索到该项目。')
  return fetched
}

export const deleteTestProject = async (id: string): Promise<void> => {
  await apiFetch(`/api/test-projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
