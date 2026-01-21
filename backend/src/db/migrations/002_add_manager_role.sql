pragma foreign_keys=off;

begin;

create table if not exists users_new (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin','manager','user')),
  created_at text not null,
  updated_at text
);

insert into users_new (id, username, password_hash, role, created_at, updated_at)
select id, username, password_hash, role, created_at, updated_at from users;

drop table users;
alter table users_new rename to users;

commit;

pragma foreign_keys=on;

