-- HR notifications are derived from existing business data.
-- This migration provides a durable read/seen store for future notification center expansion.
create table if not exists hr.notification_reads (
  user_id text not null,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_key)
);
create index if not exists notification_reads_user_idx on hr.notification_reads(user_id, read_at desc);
