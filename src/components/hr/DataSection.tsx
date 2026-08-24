import type { Row } from './types';
import { Table, Empty } from './common';
export default function DataSection({
  title,
  subtitle,
  rows,
  type,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  type: string;
}) {
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

  const mapped = rows.map((r) =>
    type === 'attendance'
      ? [
          r.employee_name ||
            r.employee_id,
          r.job_title || '—',
          r.department || '—',
          r.project_name ||
            r.project_id ||
            '—',
          r.shift_name ||
            r.shift_id ||
            '—',
          r.date,
          r.check_in || '—',
          r.check_out || '—',
          r.late_minutes
            ? `${r.late_minutes} د`
            : '0',
          r.worked_minutes
            ? `${Math.floor(
                Number(
                  r.worked_minutes,
                ) / 60,
              )}:${String(
                Number(
                  r.worked_minutes,
                ) % 60,
              ).padStart(2, '0')}`
            : '—',
          r.status || '—',
        ]
      : [
          r.employee_id,
          r.date,
          r.deduction_type ||
            r.type ||
            '—',
          r.amount ?? '—',
          r.reason || '—',
          r.status || '—',
        ],
  );

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <Table
        headers={headers}
        rows={mapped}
      />

      {!rows.length && (
        <Empty text="لا توجد بيانات لعرضها حالياً." />
      )}
    </section>
  );
}

