create table if not exists notification_reads (
  user_id text not null references users(id) on delete cascade,
  notification_id text not null,
  read_at text not null,
  primary key (user_id, notification_id)
);

create index if not exists idx_notification_reads_user_read_at on notification_reads(user_id, read_at);

