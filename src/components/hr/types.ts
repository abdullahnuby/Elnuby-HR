export type Employee = {
  employee_id: string;
  name: string;
  job_title?: string;
  department?: string;
  phone?: string;
  status?: string;
  residency_type?: 'EXPATRIATE' | 'RESIDENT';
  project_id?: string;
  project_name?: string;
  assignment_start?: string;
  assignment_id?: string;
  current_project_name?: string;
  shift_id?: string;
  shift_name?: string;
  shift_start?: string;
  attendance_open?: string;
  attendance_close?: string;
  checkout_open?: string;
  checkout_close?: string;
  auto_checkout_time?: string;
};

export type Shift = {
  shift_id: string;
  name: string;
  start_time: string;
  attendance_open: string;
  attendance_close: string;
  checkout_open: string;
  checkout_close: string;
  auto_checkout_time: string;
  status?: string;
};

export type Project = {
  project_id: string;
  name: string;
  client?: string;
  location_name?: string;
  latitude?: number | string;
  longitude?: number | string;
  geofence_radius_m?: number | string;
  status?: string;
  project_manager_id?: string;
  manager_count?: number;
  employee_count?: number;
  managers?: any[];
};

export type User = {
  user_id: string;
  employee_id: string;
  username: string;
  role: string;
  status: string;
  last_login?: string;
  created_at?: string;
};

export type Row = Record<string, any>;
