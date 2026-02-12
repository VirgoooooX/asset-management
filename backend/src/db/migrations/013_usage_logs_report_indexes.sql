create index if not exists idx_usage_logs_start_time on usage_logs(start_time);
create index if not exists idx_usage_logs_end_time on usage_logs(end_time);
create index if not exists idx_usage_logs_project_start on usage_logs(project_id, start_time);
create index if not exists idx_usage_logs_chamber_start on usage_logs(chamber_id, start_time);

