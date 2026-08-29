-- ELNUBY HR: permission request type metadata.
-- Internal codes remain English; Arabic labels are UI-only.
alter table hr.permission_requests
  add column if not exists permission_type text not null default 'GENERAL';
update hr.permission_requests set permission_type = 'GENERAL' where permission_type is null;
alter table hr.permission_requests drop constraint if exists permission_requests_permission_type_chk;
alter table hr.permission_requests add constraint permission_requests_permission_type_chk
  check (permission_type in ('PERSONAL','LATE_ARRIVAL','EARLY_DEPARTURE','MEDICAL','FIELD_MISSION','GENERAL','OTHER'));
