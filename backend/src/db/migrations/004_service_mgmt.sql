create table if not exists vendors (
  id text primary key,
  name text not null,
  contact text,
  phone text,
  email text,
  address text,
  notes text,
  created_at text not null,
  updated_at text
);

create index if not exists idx_vendors_name on vendors(name);

create table if not exists maintenance_plans (
  id text primary key,
  asset_id text not null,
  kind text not null check (kind in ('calibration','inspection','pm')),
  interval_days integer not null,
  next_due_at text not null,
  last_done_at text,
  vendor_id text,
  notes text,
  created_at text not null,
  updated_at text
);

create index if not exists idx_maintenance_plans_asset on maintenance_plans(asset_id);
create index if not exists idx_maintenance_plans_kind on maintenance_plans(kind);
create index if not exists idx_maintenance_plans_due on maintenance_plans(next_due_at);

create table if not exists service_tickets (
  id text primary key,
  asset_id text not null,
  plan_id text,
  kind text not null check (kind in ('calibration','inspection','pm')),
  status text not null check (status in ('planned','in-progress','completed','cancelled')),
  vendor_id text,
  cost_amount real,
  expected_return_at text,
  completed_at text,
  created_at text not null,
  updated_at text,
  timeline text
);

create index if not exists idx_service_tickets_asset on service_tickets(asset_id);
create index if not exists idx_service_tickets_status on service_tickets(status);
create index if not exists idx_service_tickets_kind on service_tickets(kind);

alter table repair_tickets add column vendor_id text;
alter table repair_tickets add column cost_amount real;

