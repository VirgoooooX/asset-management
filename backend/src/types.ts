export type UserRole = 'admin' | 'manager' | 'user'
export type AssetStatus = 'available' | 'in-use' | 'maintenance'
export type UsageLogStatus = 'not-started' | 'in-progress' | 'completed' | 'overdue'
export type RepairStatus = 'quote-pending' | 'repair-pending' | 'completed'

export interface AttachmentDto {
  id: string
  name: string
  url: string
  path: string
  contentType?: string
  size?: number
  uploadedAt: string
}

export interface RepairTimelineEntry {
  at: string
  from?: RepairStatus
  to: RepairStatus
  by?: string
  note?: string
}

export interface ProjectConfigDto {
  id: string
  name: string
  remark?: string
}

export interface TestStageDto {
  name?: string
  durationMinutes: number
  targetTemp?: number
  targetHumidity?: number
  endTemp?: number
  startTemp?: number
  endHumidity?: number
  startHumidity?: number
}

export interface AssetRow {
  id: string
  type: string
  name: string
  status: AssetStatus
  hourly_rate_cents: number
  category: string | null
  asset_code: string | null
  description: string | null
  tags: string | null
  location: string | null
  serial_number: string | null
  manufacturer: string | null
  model: string | null
  owner: string | null
  photo_urls: string | null
  nameplate_urls: string | null
  attachments: string | null
  capabilities: string | null
  calibration_date: string | null
  created_at: string
  updated_at: string | null
}

export interface UsageLogRow {
  id: string
  chamber_id: string
  project_id: string | null
  test_project_id: string | null
  start_time: string
  end_time: string | null
  user: string
  status: UsageLogStatus
  notes: string | null
  selected_config_ids: string | null
  selected_waterfall: string | null
  hourly_rate_cents_snapshot: number | null
  billable_hours_snapshot: number | null
  cost_cents_snapshot: number | null
  snapshot_at: string | null
  snapshot_source: string | null
  created_at: string
}

export interface ProjectRow {
  id: string
  name: string
  description: string | null
  customer_name: string | null
  configs: string | null
  wfs: string | null
  created_at: string
}

export interface TestProjectRow {
  id: string
  name: string
  temperature: number
  humidity: number
  duration: number
  project_id: string | null
  asset_categories: string | null
  procedure: string | null
  stages: string | null
  created_at: string
}

export interface RepairTicketRow {
  id: string
  asset_id: string
  status: RepairStatus
  problem_desc: string
  started_at: string | null
  vendor_name: string | null
  quote_amount: number | null
  quote_at: string | null
  expected_return_at: string | null
  completed_at: string | null
  vendor_id: string | null
  cost_amount: number | null
  created_at: string
  updated_at: string | null
  timeline: string | null
  attachments: string | null
}

export interface UserRow {
  id: string
  username: string
  password_hash: string
  role: UserRole
  status: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string | null
}

export interface AuthSessionRow {
  id: string
  user_id: string
  refresh_token_hash: string
  created_at: string
  expires_at: string
}

export interface AuditLogRow {
  id: string
  at: string
  actor_user_id: string
  actor_username: string
  action: string
  entity_type: string
  entity_id: string
  before_json: string | null
  after_json: string | null
  ip: string | null
  user_agent: string | null
  request_id: string | null
}

export interface CategoryRateRow {
  category: string
  hourly_rate_cents: number
}
