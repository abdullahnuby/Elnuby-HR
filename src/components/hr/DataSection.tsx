import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Employee, Project, Row, Shift } from './types';
import { Table, Empty } from './common';

type Props = {
  title: string;
  subtitle: string;
  rows: Row[];
  type: string;
};

function formatMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 د';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} د`;
  if (!mins) return `${hours} س`;
  return `${hours} س ${mins} د`;
}

function formatWorkedMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function statusLabel(value: unknown) {
  switch (String(value || '').toUpperCase()) {
    case 'PRESENT':
      return 'حاضر';
    case 'LATE':
      return 'متأخر';
    case 'ABSENT':
      return 'غائب';
    case 'AUTO_CLOSED':
      return 'انصراف تلقائي';
    case 'INCOMPLETE':
      return 'غير مكتمل';
    default:
      return value ? String(value) : '—';
  }
}

export default function DataSection({
  title,
  subtitle,
  rows,
  type,
}: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (type !== 'attendance') return;

    let cancelled = false;
    setLookupLoading(true);

    Promise.all([
      api<Employee[]>('employees'),
      api<Project[]>('projects'),
      api<Shift[]>('shifts'),
    ])
      .then(([employeeRows, projectRows, shiftRows]) => {
        if (cancelled) return;
        setEmployees(employeeRows || []);
        setProjects(projectRows || []);
        setShifts(shiftRows || []);
      })
      .catch((error) => {
        console.error('attendance lookup data:', error);
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [type]);

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.employee_id, employee])),
    [employees],
  );

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.project_id, project])),
    [projects],
  );

  const shiftMap = useMemo(
    () => new Map(shifts.map((shift) => [shift.shift_id, shift])),
    [shifts],
  );

  const headers =
    type === 'attendance'
      ? [
          'الموظف',
          'الوظيفة',
          'القسم',
          'المشروع',
          'الوردية',
          'التاريخ',
          'الحضور',
          'الانصراف',
          'التأخير',
          'ساعات العمل',
          'الحالة',
        ]
      : [
          'الموظف',
          'التاريخ',
          'النوع',
          'القيمة',
          'السبب',
          'الحالة',
        ];

  const mapped = rows.map((r) => {
    if (type !== 'attendance') {
      return [
        r.employee_id,
        r.date,
        r.deduction_type || r.type || '—',
        r.amount ?? '—',
        r.reason || '—',
        r.status || '—',
      ];
    }

    const employee = employeeMap.get(String(r.employee_id || ''));
    const project = projectMap.get(String(r.project_id || ''));
    const shift = shiftMap.get(String(r.shift_id || ''));

    return [
      employee?.name || r.employee_name || r.employee_id || '—',
      employee?.job_title || r.job_title || '—',
      employee?.department || r.department || '—',
      project?.name || r.project_name || r.project_id || '—',
      shift?.name || r.shift_name || r.shift_id || '—',
      r.date || '—',
      r.check_in || '—',
      r.check_out || '—',
      formatMinutes(r.late_minutes),
      formatWorkedMinutes(r.worked_minutes),
      statusLabel(r.status),
    ];
  });

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {type === 'attendance' && lookupLoading && (
          <span className="count-pill">جاري تحميل بيانات الموظفين…</span>
        )}
      </div>

      <Table headers={headers} rows={mapped} />

      {!rows.length && (
        <Empty text="لا توجد بيانات لعرضها حالياً." />
      )}
    </section>
  );
}
