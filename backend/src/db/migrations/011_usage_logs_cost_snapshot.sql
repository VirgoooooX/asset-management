ALTER TABLE usage_logs ADD COLUMN hourly_rate_cents_snapshot INTEGER;
ALTER TABLE usage_logs ADD COLUMN billable_hours_snapshot INTEGER;
ALTER TABLE usage_logs ADD COLUMN cost_cents_snapshot INTEGER;
ALTER TABLE usage_logs ADD COLUMN snapshot_at TEXT;
ALTER TABLE usage_logs ADD COLUMN snapshot_source TEXT;

