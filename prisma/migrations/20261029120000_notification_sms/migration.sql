alter table public."Notification" add column if not exists "smsSent" boolean not null default false;
alter table public."Notification" add column if not exists "smsNote" text;
