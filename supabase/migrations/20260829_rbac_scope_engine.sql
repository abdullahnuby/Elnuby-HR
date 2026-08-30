-- RBAC + scope hardening
alter table if exists hr.projects add column if not exists organization_unit_id text null;
create index if not exists idx_projects_organization_unit on hr.projects(organization_unit_id);
