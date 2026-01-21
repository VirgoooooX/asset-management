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

export const createTestProject = async (testProjectData: Omit<TestProject, 'id' | 'createdAt'>): Promise<string> => {
  const data = await apiFetch<{ id: string }>('/api/test-projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(testProjectData),
  })
  return data.id
}

export const updateTestProject = async (
  id: string,
  testProjectUpdateData: Partial<Omit<TestProject, 'id' | 'createdAt'>>
): Promise<void> => {
  await apiFetch(`/api/test-projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(testProjectUpdateData),
  })
}

export const deleteTestProject = async (id: string): Promise<void> => {
  await apiFetch(`/api/test-projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
