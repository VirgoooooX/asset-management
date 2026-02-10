alter table repair_tickets add column started_at text;

update repair_tickets
set started_at = created_at
where started_at is null;
