alter table users add column status text not null default 'active';
alter table users add column approved_by text;
alter table users add column approved_at text;

create unique index if not exists idx_users_admin_unique on users(role) where role = 'admin';

