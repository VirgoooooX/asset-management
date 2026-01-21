create table if not exists users (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','user')),
  created_at text not null,
  updated_at text
);

create table if not exists user_preferences (
  user_id text primary key references users(id) on delete cascade,
  data text not null,
  updated_at text not null
);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at text not null
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  refresh_token_hash text not null,
  created_at text not null,
  expires_at text not null
);

create index if not exists idx_auth_sessions_refresh_hash on auth_sessions(refresh_token_hash);
create index if not exists idx_auth_sessions_user on auth_sessions(user_id);

create table if not exists assets (
  id text primary key,
  type text not null,
  name text not null,
  status text not null check (status in ('available','in-use','maintenance')),
  category text,
  asset_code text,
  description text,
  tags text,
  location text,
  serial_number text,
  manufacturer text,
  model text,
  owner text,
  photo_urls text,
  nameplate_urls text,
  attachments text,
  calibration_date text,
  created_at text not null,
  updated_at text
);

create index if not exists idx_assets_type on assets(type);
create index if not exists idx_assets_category on assets(category);

create table if not exists projects (
  id text primary key,
  name text not null,
  description text,
  customer_name text,
  configs text,
  wfs text,
  created_at text not null
);

create table if not exists test_projects (
  id text primary key,
  name text not null,
  temperature real not null,
  humidity real not null,
  duration integer not null,
  project_id text,
  created_at text not null
);

create index if not exists idx_test_projects_project on test_projects(project_id);

create table if not exists usage_logs (
  id text primary key,
  chamber_id text not null,
  project_id text,
  test_project_id text,
  start_time text not null,
  end_time text,
  user text not null,
  status text not null check (status in ('not-started','in-progress','completed','overdue')),
  notes text,
  selected_config_ids text,
  selected_waterfall text,
  created_at text not null
);

create index if not exists idx_usage_logs_chamber_created on usage_logs(chamber_id, created_at);
create index if not exists idx_usage_logs_status on usage_logs(status);

create table if not exists repair_tickets (
  id text primary key,
  asset_id text not null,
  status text not null check (status in ('quote-pending','repair-pending','completed')),
  problem_desc text not null,
  vendor_name text,
  quote_amount real,
  quote_at text,
  expected_return_at text,
  completed_at text,
  created_at text not null,
  updated_at text,
  timeline text
);

create index if not exists idx_repair_tickets_asset on repair_tickets(asset_id);
create index if not exists idx_repair_tickets_status on repair_tickets(status);

