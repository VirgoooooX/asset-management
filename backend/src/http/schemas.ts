import { z } from 'zod'

export const assetTypeSchema = z.enum(['chamber'])
export const assetStatusSchema = z.enum(['available', 'in-use', 'maintenance'])
export const usageLogStatusSchema = z.enum(['not-started', 'in-progress', 'completed', 'overdue'])
export const repairStatusSchema = z.enum(['quote-pending', 'repair-pending', 'completed'])
export const assignRoleSchema = z.enum(['manager', 'user'])

export const paginationQueryShape = {
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
}

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  path: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
  uploadedAt: z.string(),
})
