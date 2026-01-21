import { apiFetch } from './apiClient'
import type { Project } from '../types'

export const getAllProjects = async (): Promise<Project[]> => {
  const data = await apiFetch<{ items: Project[] }>('/api/projects')
  return Array.isArray(data.items) ? data.items : []
}

export const getProjectById = async (id: string): Promise<Project | null> => {
  try {
    const data = await apiFetch<{ item: Project }>(`/api/projects/${encodeURIComponent(id)}`)
    return data.item ?? null
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

export const createProject = async (projectData: Omit<Project, 'id' | 'createdAt'>): Promise<string> => {
  const data = await apiFetch<{ id: string }>('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projectData),
  })
  return data.id
}

export const updateProject = async (
  id: string,
  projectUpdateData: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<void> => {
  await apiFetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projectUpdateData),
  })
}

export const deleteProject = async (id: string): Promise<void> => {
  await apiFetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
