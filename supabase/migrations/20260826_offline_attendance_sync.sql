-- Offline-first attendance synchronization.
-- Attendance is still validated server-side when the device reconnects.
alter table hr.attendance add column if not exists client_event_id text;
alter table hr.attendance add column if not exists check_out_event_id text;
alter table hr.attendance add column if not exists source text not null default 'ONLINE';
alter table hr.attendance add column if not exists client_recorded_at timestamptz;

create unique index if not exists attendance_client_event_id_uidx
  on hr.attendance(client_event_id)
  where client_event_id is not null;

create unique index if not exists attendance_check_out_event_id_uidx
  on hr.attendance(check_out_event_id)
  where check_out_event_id is not null;

alter table hr.attendance drop constraint if exists attendance_source_check;
alter table hr.attendance add constraint attendance_source_check
  check (source in ('ONLINE','OFFLINE_SYNC'));
