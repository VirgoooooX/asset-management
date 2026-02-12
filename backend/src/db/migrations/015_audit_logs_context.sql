ALTER TABLE audit_logs ADD COLUMN ip TEXT;
ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN request_id TEXT;

create index if not exists idx_audit_logs_request_id on audit_logs(request_id);
create index if not exists idx_audit_logs_action_at on audit_logs(action, at);

