alter table users add column email text;

create table if not exists notifications (
  id text primary key,
  type text not null check (type in ('usage_completed','calibration_due','usage_overdue','usage_long')),
  severity text not null check (severity in ('P1','P2','info')),
  title text not null,
  message text not null,
  entity_type text not null,
  entity_id text not null,
  asset_id text,
  asset_name text,
  occurred_at text not null,
  url text,
  dedupe_key text,
  created_at text not null
);

create unique index if not exists idx_notifications_dedupe_key
  on notifications(dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_created_at on notifications(created_at);
create index if not exists idx_notifications_type on notifications(type);

create table if not exists notification_recipients (
  notification_id text not null references notifications(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  created_at text not null,
  primary key (notification_id, user_id)
);

create index if not exists idx_notification_recipients_user on notification_recipients(user_id, created_at);

create table if not exists notification_channels (
  id text primary key,
  type text not null check (type in ('wecom_bot','feishu_bot')),
  name text not null,
  webhook_url text not null,
  enabled integer not null default 1,
  subscribed_types text,
  created_at text not null,
  updated_at text
);

create index if not exists idx_notification_channels_enabled on notification_channels(enabled, type);

create table if not exists notification_deliveries (
  id text primary key,
  notification_id text not null references notifications(id) on delete cascade,
  channel_type text not null check (channel_type in ('email','wecom_bot','feishu_bot')),
  channel_id text,
  target text not null,
  status text not null check (status in ('pending','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  sent_at text,
  created_at text not null,
  updated_at text
);

create index if not exists idx_notification_deliveries_status on notification_deliveries(status, created_at);
create index if not exists idx_notification_deliveries_notification on notification_deliveries(notification_id);
