-- ELNUBY HR: employee HR documents and document requirements
create table if not exists hr.employee_documents (
  document_id text primary key,
  employee_id text not null references hr.employees(employee_id) on delete cascade,
  document_type text not null,
  document_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null,
  issue_date date,
  expiry_date date,
  status text not null default 'VALID',
  notes text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_size > 0 and file_size <= 10485760),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date),
  check (status in ('VALID','EXPIRING','EXPIRED','REJECTED','MISSING'))
);
create index if not exists idx_employee_documents_employee on hr.employee_documents(employee_id, document_type, expiry_date);
create index if not exists idx_employee_documents_expiry on hr.employee_documents(expiry_date) where expiry_date is not null;
alter table hr.employee_documents enable row level security;
drop policy if exists employee_documents_service_access on hr.employee_documents;
create policy employee_documents_service_access on hr.employee_documents for all using (true) with check (true);

insert into storage.buckets(id,name,public)
values ('hr-employee-documents','hr-employee-documents',false)
on conflict (id) do nothing;

create table if not exists hr.employee_document_requirements (
  requirement_id text primary key,
  document_type text not null unique,
  document_label text not null,
  required_for text not null default 'ALL',
  mandatory boolean not null default true,
  expiry_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table hr.employee_document_requirements enable row level security;
drop policy if exists employee_document_requirements_service_access on hr.employee_document_requirements;
create policy employee_document_requirements_service_access on hr.employee_document_requirements for all using (true) with check (true);

insert into hr.employee_document_requirements(requirement_id,document_type,document_label,required_for,mandatory,expiry_required)
values
 ('REQ-NID','NATIONAL_ID','بطاقة الرقم القومي','ALL',true,false),
 ('REQ-CONTRACT','EMPLOYMENT_CONTRACT','عقد العمل','ALL',true,true),
 ('REQ-QUALIFICATION','QUALIFICATION','المؤهل الدراسي','ALL',false,false),
 ('REQ-MEDICAL','MEDICAL_FITNESS','شهادة اللياقة الطبية','ALL',false,true),
 ('REQ-INSURANCE','INSURANCE','مستند التأمينات','ALL',false,true)
on conflict (document_type) do nothing;
