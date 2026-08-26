import type { Shift, Row } from './types';
import { Table } from './common';
export default function Shifts({
  shifts,
  rows,
  managerMode,
  shiftForm,
  setShiftForm,
  createShift,
  busy,
  onEdit,
}: {
  shifts: Shift[];
  rows: Row[];
  managerMode: boolean;
  shiftForm: any;
  setShiftForm: any;
  createShift: () => void;
  busy: boolean;
  onEdit?: (shiftId: string) => void;
}) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>الورديات</h2>
          <p>
            تعريف ساعات العمل ونافذة الحضور
            والانصراف وربطها بالمشروع والموظف.
          </p>
        </div>

        <span className="count-pill">
          {shifts.length} وردية فعالة
        </span>
      </div>

      {!managerMode && (
        <div className="request-card">
          <h3>إنشاء وردية</h3>

          <div className="formgrid">
            <input
              placeholder="اسم الوردية *"
              value={shiftForm.name}
              onChange={(e) =>
                setShiftForm({
                  ...shiftForm,
                  name: e.target.value,
                })
              }
            />

            <label>
              بداية العمل
              <input
                type="time"
                value={
                  shiftForm.start_time
                }
                onChange={(e) =>
                  setShiftForm({
                    ...shiftForm,
                    start_time:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              فتح الحضور
              <input
                type="time"
                value={
                  shiftForm.attendance_open
                }
                onChange={(e) =>
                  setShiftForm({
                    ...shiftForm,
                    attendance_open:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              إغلاق الحضور
              <input
                type="time"
                value={
                  shiftForm.attendance_close
                }
                onChange={(e) =>
                  setShiftForm({
                    ...shiftForm,
                    attendance_close:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              فتح الانصراف
              <input
                type="time"
                value={
                  shiftForm.checkout_open
                }
                onChange={(e) =>
                  setShiftForm({
                    ...shiftForm,
                    checkout_open:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              إغلاق الانصراف
              <input
                type="time"
                value={
                  shiftForm.checkout_close
                }
                onChange={(e) =>
                  setShiftForm({
                    ...shiftForm,
                    checkout_close:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              الانصراف التلقائي
              <input
                type="time"
                value={
                  shiftForm.auto_checkout_time
                }
                onChange={(e) =>
                  setShiftForm({
                    ...shiftForm,
                    auto_checkout_time:
                      e.target.value,
                  })
                }
              />
            </label>
          </div>

          <button
            className="primary"
            disabled={busy}
            onClick={createShift}
          >
            إنشاء الوردية
          </button>
        </div>
      )}

      <Table
        headers={[
          'الوردية',
          'بداية العمل',
          'فتح الحضور',
          'إغلاق الحضور',
          'فتح الانصراف',
          'إغلاق الانصراف',
          'Auto Checkout','إجراء',
        ]}
        rows={shifts.map((s) => [
          s.name,
          s.start_time,
          s.attendance_open,
          s.attendance_close,
          s.checkout_open,
          s.checkout_close,
          s.auto_checkout_time,
        ])}
      />

      <div
        className="panel-head"
        style={{ marginTop: 24 }}
      >
        <div>
          <h3>
            تعيينات الورديات الحالية والتاريخية
          </h3>

          <p>
            كل سطر يوضح الموظف والمشروع
            والوردية الفعلية.
          </p>
        </div>
      </div>

      <Table
        headers={[
          'الموظف',
          'المشروع',
          'الوردية',
          'بداية العمل',
          'فتح الحضور',
          'إغلاق الحضور',
          'فتح الانصراف',
          'Auto Checkout',
          'من تاريخ',
          'إلى تاريخ',
          'الحالة',
        ]}
        rows={rows.map((r) => [
          r.employee_name ||
            r.employee_id,
          r.project_name ||
            r.project_id,
          r.shift_name ||
            r.shift_id,
          r.shift_start || '—',
          r.attendance_open || '—',
          r.attendance_close || '—',
          r.checkout_open || '—',
          r.auto_checkout_time ||
            '—',
          r.start_date || '—',
          r.end_date || '—',
          r.end_date
            ? 'HISTORY'
            : 'CURRENT',
        ])}
      />
    </section>
  );
}

