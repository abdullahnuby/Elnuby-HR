import type { User, Employee, Project } from './types';
import { roleLabels } from './constants';
import { Table } from './common';
export default function Users({
  users,
  employees,
  projects,
  newUsername,
  setNewUsername,
  newPassword,
  setNewPassword,
  newRole,
  setNewRole,
  newEmployee,
  setNewEmployee,
  newProject,
  setNewProject,
  selectedManager,
  setSelectedManager,
  selectedProject,
  setSelectedProject,
  assignManager,
  createAccount,
  busy,
  onRefresh,
}: any) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>
            حسابات المستخدمين
          </h2>

          <p>
            إنشاء وإدارة حسابات الدخول
            والصلاحيات من مكان واحد.
          </p>
        </div>

        <div className="panel-actions">
          <span className="count-pill">
            {employees.length} موظف متاح
          </span>

          <button
            className="secondary"
            disabled={busy}
            onClick={onRefresh}
          >
            تحديث الموظفين
          </button>
        </div>
      </div>

      <div className="request-card">
        <h3>
          إنشاء حساب جديد
        </h3>

        <div className="formgrid">
          <input
            placeholder="اسم المستخدم"
            value={newUsername}
            onChange={(e) =>
              setNewUsername(
                e.target.value,
              )
            }
          />

          <input
            type="password"
            placeholder="كلمة المرور"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(
                e.target.value,
              )
            }
          />

          <select
            value={newRole}
            onChange={(e) =>
              setNewRole(
                e.target.value,
              )
            }
          >
            <option value="EMPLOYEE">
              موظف
            </option>

            <option value="PROJECT_MANAGER">
              مدير مشروع
            </option>

            <option value="SITE_SUPERVISOR">
              مشرف موقع
            </option>

            <option value="HR_MANAGER">
              مدير HR
            </option>

            <option value="SUPER_ADMIN">
              مدير النظام
            </option>
          </select>

          {(newRole === 'EMPLOYEE' ||
            newRole === 'PROJECT_MANAGER' ||
            newRole === 'SITE_SUPERVISOR') && (
            <select
              value={newEmployee}
              onChange={(e) =>
                setNewEmployee(
                  e.target.value,
                )
              }
            >
              <option value="">
                اختر الموظف المرتبط بالحساب *
              </option>

              {employees.map(
                (e: Employee) => (
                  <option
                    key={e.employee_id}
                    value={e.employee_id}
                  >
                    {e.name} —{' '}
                    {e.employee_id}
                  </option>
                ),
              )}
            </select>
          )}

          {(newRole === 'PROJECT_MANAGER' ||
            newRole === 'SITE_SUPERVISOR') && (
            <select
              value={newProject}
              onChange={(e) =>
                setNewProject(
                  e.target.value,
                )
              }
            >
              <option value="">
                اختر المشروع المرتبط بالحساب *
              </option>

              {projects.map(
                (p: Project) => (
                  <option
                    key={p.project_id}
                    value={p.project_id}
                  >
                    {p.name} —{' '}
                    {p.project_id}
                  </option>
                ),
              )}
            </select>
          )}

          {newRole ===
            'HR_MANAGER' && (
            <div className="empty-note">
              حساب HR إداري مركزي: لا يحتاج
              موظفاً مرتبطاً ولا يتم تعيينه على
              مشروع.
            </div>
          )}

          {newRole ===
            'SUPER_ADMIN' && (
            <div className="empty-note">
              حساب مدير النظام إداري مركزي: لا
              يحتاج موظفاً ولا مشروعاً.
            </div>
          )}
        </div>

        {!employees.length && (
          <div className="empty-note">
            لا توجد سجلات موظفين محملة. اضغط
            «تحديث الموظفين» وتأكد أن الموظف موجود
            في جدول EMPLOYEES.
          </div>
        )}

        <button
          className="primary"
          disabled={
            busy ||
            ((newRole === 'EMPLOYEE' ||
              newRole ===
                'PROJECT_MANAGER') &&
              !employees.length)
          }
          onClick={createAccount}
        >
          إنشاء الحساب
        </button>
      </div>

      <div className="request-card">
        <h3>
          ربط مدير مشروع بمشروع
        </h3>

        <p>
          يمكنك هنا إصلاح أو تغيير ربط حساب مدير
          المشروع بالمشروع، وسيتم تسجيله في
          PROJECT_MANAGERS فوراً.
        </p>

        <div className="formgrid">
          <select
            value={selectedManager}
            onChange={(e) =>
              setSelectedManager(
                e.target.value,
              )
            }
          >
            <option value="">
              اختر مدير المشروع
            </option>

            {users
              .filter(
                (u: User) =>
                  u.role ===
                    'PROJECT_MANAGER' &&
                  u.status === 'ACTIVE',
              )
              .map((u: User) => (
                <option
                  key={u.user_id}
                  value={u.user_id}
                >
                  {u.username} —{' '}
                  {u.employee_id ||
                    'بدون موظف'}
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

            {projects.map(
              (p: Project) => (
                <option
                  key={p.project_id}
                  value={p.project_id}
                >
                  {p.name} —{' '}
                  {p.project_id}
                </option>
              ),
            )}
          </select>
        </div>

        <button
          className="secondary"
          disabled={
            busy ||
            !selectedManager ||
            !selectedProject
          }
          onClick={assignManager}
        >
          حفظ صلاحية مدير المشروع
        </button>
      </div>

      <Table
        headers={[
          'اسم المستخدم',
          'الصلاحية',
          'الموظف',
          'المشروع',
          'الحالة',
          'آخر دخول',
        ]}
        rows={users.map((u: User) => {
          const mp = projects.find(
            (p: Project) =>
              (p.managers || []).some(
                (m: any) =>
                  String(m.user_id) ===
                  String(u.user_id),
              ),
          );

          return [
            u.username,
            roleLabels[u.role] ||
              u.role,
            u.employee_id || '—',
            mp?.name || '—',
            u.status,
            u.last_login || '—',
          ];
        })}
      />
    </section>
  );
}

