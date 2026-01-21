export type UserRole = 'admin' | 'user'

export interface User {
  id: string
  username: string
  role: UserRole
  password?: string
}

export type AssetType = 'chamber'

export type AssetStatus = 'available' | 'in-use' | 'maintenance'

export interface AssetAttachment {
  id: string
  name: string
  url: string
  path: string
  contentType?: string
  size?: number
  uploadedAt: string
}

export interface Asset {
  id: string
  type: AssetType
  name: string
  status: AssetStatus
  category?: string
  assetCode?: string
  description?: string
  tags?: string[]
  location?: string
  serialNumber?: string
  manufacturer?: string
  model?: string
  owner?: string
  photoUrls?: string[]
  nameplateUrls?: string[]
  attachments?: AssetAttachment[]
  calibrationDate?: string
  createdAt: string
  updatedAt?: string
}

export interface Chamber {
  id: string
  name: string
  description?: string
  status: AssetStatus
  manufacturer: string
  model: string
  calibrationDate?: string
  createdAt: string
}

export interface Config {
  id: string
  name: string
  remark?: string
}

export interface Project {
  id: string
  name: string
  description?: string
  customerName?: string
  configs?: Config[]
  wfs?: string[]
  createdAt: string
}

export interface TestProject {
  id: string
  name: string
  temperature: number
  humidity: number
  duration: number
  projectId?: string
  createdAt: string
}

export interface UsageLog {
  id: string
  chamberId: string
  projectId?: string
  testProjectId?: string
  startTime: string
  endTime?: string
  user: string
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue'
  notes?: string
  selectedConfigIds?: string[]
  selectedWaterfall?: string
  createdAt: string
}

export type RepairStatus = 'quote-pending' | 'repair-pending' | 'completed'

export interface RepairTimelineEntry {
  at: string
  from?: RepairStatus
  to: RepairStatus
  note?: string
}

export interface RepairTicket {
  id: string
  assetId: string
  status: RepairStatus
  problemDesc: string
  vendorName?: string
  quoteAmount?: number
  quoteAt?: string
  expectedReturnAt?: string
  completedAt?: string
  createdAt: string
  updatedAt?: string
  timeline?: RepairTimelineEntry[]
}
