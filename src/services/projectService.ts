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

export const createProject = async (projectData: Omit<Project, 'id' | 'createdAt'>): Promise<Project> => {
  const data = await apiFetch<{ id: string; item?: Project }>('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projectData),
  })
  if (data.item) return data.item
  const fetched = await getProjectById(data.id)
  if (!fetched) throw new Error('项目创建成功，但未能获取到创建后的项目数据。')
  return fetched
}

export const updateProject = async (
  id: string,
  projectUpdateData: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project> => {
  const data = await apiFetch<{ ok: boolean; item?: Project }>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(projectUpdateData),
  })
  if (data.item) return data.item
  const fetched = await getProjectById(id)
  if (!fetched) throw new Error('更新项目后未能检索到该项目。')
  return fetched
}

export const deleteProject = async (id: string): Promise<void> => {
  await apiFetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
