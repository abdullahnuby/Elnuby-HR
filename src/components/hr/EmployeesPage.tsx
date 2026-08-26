import type { Employee, Project, Shift } from './types';
import { Table, Empty } from './common';
export default function Employees({
  employees,
  projects,
  shifts,
  managerMode,
  employeeForm,
  setEmployeeForm,
  createEmployee,
  selectedEmployee,
  setSelectedEmployee,
  selectedProject,
  setSelectedProject,
  selectedShift,
  setSelectedShift,
  assignProject,
  busy,
  onEdit,
}: {
  employees: Employee[];
  projects: Project[];
  shifts: Shift[];
  managerMode: boolean;
  employeeForm: any;
  setEmployeeForm: any;
  createEmployee: () => void;
  selectedEmployee: string;
  setSelectedEmployee: any;
  selectedProject: string;
  setSelectedProject: any;
  selectedShift: string;
  setSelectedShift: any;
  assignProject: () => void;
  busy: boolean;
  onEdit?: (employeeId: string) => void;
}) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>الموظفون</h2>
          <p>
            كل موظف مرتبط بمشروع ووردية فعالة،
            وتظهر العلاقة هنا وفي قاعدة بيانات Supabase.
          </p>
        </div>

        <span className="count-pill">
          {employees.length} موظف
        </span>
      </div>

      {!managerMode && (
        <div className="request-card">
          <h3>
            إضافة موظف جديد
          </h3>

          <p>
            سيتم إنشاء ملف الموظف وتعيينه على
            المشروع والوردية المختارين في نفس
            العملية.
          </p>

          <div className="formgrid">
            <input
              placeholder="الاسم بالكامل *"
              value={employeeForm.name}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  name: e.target.value,
                })
              }
            />

            <input
              placeholder="الوظيفة *"
              value={
                employeeForm.job_title
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  job_title:
                    e.target.value,
                })
              }
            />

            <input
              placeholder="القسم"
              value={
                employeeForm.department
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  department:
                    e.target.value,
                })
              }
            />

            <input
              placeholder="رقم الهاتف"
              value={employeeForm.phone}
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  phone: e.target.value,
                })
              }
            />

            <input
              placeholder="الرقم القومي"
              value={
                employeeForm.national_id
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  national_id:
                    e.target.value,
                })
              }
            />

            <input
              type="date"
              title="تاريخ الميلاد"
              value={
                employeeForm.birth_date
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  birth_date:
                    e.target.value,
                })
              }
            />

            <input
              type="date"
              title="تاريخ التعيين"
              value={
                employeeForm.hire_date
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  hire_date:
                    e.target.value,
                })
              }
            />

            <select
              value={
                employeeForm.project_id
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  project_id:
                    e.target.value,
                })
              }
            >
              <option value="">
                اختر المشروع الحالي *
              </option>

              {projects.map((p) => (
                <option
                  key={p.project_id}
                  value={p.project_id}
                >
                  {p.name} — {p.project_id}
                </option>
              ))}
            </select>

            <select
              value={
                employeeForm.shift_id
              }
              onChange={(e) =>
                setEmployeeForm({
                  ...employeeForm,
                  shift_id:
                    e.target.value,
                })
              }
            >
              <option value="">
                اختر الوردية *
              </option>

              {shifts.map((s) => (
                <option
                  key={s.shift_id}
                  value={s.shift_id}
                >
                  {s.name} —{' '}
                  {s.start_time} / حضور حتى{' '}
                  {s.attendance_close}
                </option>
              ))}
            </select>
          </div>

          <button
            className="primary"
            disabled={
              busy ||
              !projects.length ||
              !shifts.length
            }
            onClick={createEmployee}
          >
            {!projects.length
              ? 'أضف مشروعًا أولاً'
              : !shifts.length
                ? 'أنشئ وردية أولاً'
                : 'تسجيل الموظف وتعيين المشروع والوردية'}
          </button>
        </div>
      )}

      <div className="request-card">
        <h3>
          {managerMode
            ? 'إدارة تعيينات موظفي مشروعي'
            : 'نقل موظف + تغيير الوردية'}
        </h3>

        <div className="formgrid">
          <select
            value={selectedEmployee}
            onChange={(e) =>
              setSelectedEmployee(
                e.target.value,
              )
            }
          >
            <option value="">
              اختر الموظف
            </option>

            {employees.map((e) => (
              <option
                key={e.employee_id}
                value={e.employee_id}
              >
                {e.name} — {e.employee_id}
              </option>
            ))}
          </select>

          <select
            value={selectedProject}
            onChange={(e) =>
              setSelectedProject(
                e.target.value,
              )
            }
          >
            <option value="">
              اختر المشروع
            </option>

            {projects.map((p) => (
              <option
                key={p.project_id}
                value={p.project_id}
              >
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={selectedShift}
            onChange={(e) =>
              setSelectedShift(
                e.target.value,
              )
            }
          >
            <option value="">
              اختر الوردية
            </option>

            {shifts.map((s) => (
              <option
                key={s.shift_id}
                value={s.shift_id}
              >
                {s.name} — {s.start_time}
              </option>
            ))}
          </select>
        </div>

        <button
          className="secondary"
          disabled={
            busy ||
            !selectedEmployee ||
            !selectedProject ||
            !selectedShift
          }
          onClick={assignProject}
        >
          حفظ المشروع والوردية
        </button>
      </div>

      <Table
        headers={[
          'الرقم',
          'الاسم',
          'الوظيفة',
          'المشروع الحالي',
          'الوردية',
          'بداية الوردية',
          'الحضور حتى',
          'الانصراف من',
          'الحالة','إجراء',
        ]}
        rows={employees.map((e) => [
          e.employee_id,
          e.name,
          e.job_title || '—',
          e.project_name ||
            'غير معين',
          e.shift_name ||
            'غير معين',
          e.shift_start || '—',
          e.attendance_close ||
            '—',
          e.checkout_open ||
            '—',
          e.status || 'ACTIVE',
        ])}
      />

      {!employees.length && (
        <Empty text="لا يوجد موظفون حتى الآن." />
      )}
    </section>
  );
}

