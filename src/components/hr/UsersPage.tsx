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
  selectedSectorProjects,
  setSelectedSectorProjects,
  selectedSectorManager,
  setSelectedSectorManager,
  selectedManager,
  setSelectedManager,
  selectedProject,
  setSelectedProject,
  assignManager,
  assignSectorManagerProjects,
  createAccount,
  busy,
  onRefresh,
  onToggleUser,
  onResetPassword,
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

            <option value="SECTOR_MANAGER">
              مدير قطاع / مدير مشروعات
            </option>

            <option value="HR_MANAGER">
              مدير HR
            </option>

            <option value="SYSTEM_ADMIN">
              مدير النظام
            </option>
          </select>

          {(newRole === 'EMPLOYEE' ||
            newRole === 'PROJECT_MANAGER' ||
            newRole === 'SECTOR_MANAGER') && (
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

          {newRole === 'PROJECT_MANAGER' && (
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

          {newRole === 'SECTOR_MANAGER' && (
            <label className="field-stack">
              <span>المشروعات التابعة لمدير القطاع *</span>
              <select
                multiple
                value={selectedSectorProjects}
                onChange={(e) =>
                  setSelectedSectorProjects(
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
                style={{ minHeight: 140 }}
              >
                {projects.map((p: Project) => (
                  <option key={p.project_id} value={p.project_id}>
                    {p.name} — {p.project_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {newRole ===
            'SECTOR_MANAGER' && (
            <div className="empty-note">
              مدير القطاع موظف فعلي في الشركة، وله صلاحيات إدارية على المشروعات المحددة فقط، ولا يملك حضورًا أو انصرافًا، وتقتصر صلاحياته على المشروعات المحددة والعمليات التابعة لها.
            </div>
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
            'SYSTEM_ADMIN' && (
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

      <div className="request-card">
        <h3>تحديد مشروعات مدير القطاع</h3>
        <div className="formgrid">
          <select value={selectedSectorManager} onChange={(e) => setSelectedSectorManager(e.target.value)}>
            <option value="">اختر مدير القطاع</option>
            {users.filter((u: User) => u.role === 'SECTOR_MANAGER' && u.status === 'ACTIVE').map((u: User) => (
              <option key={u.user_id} value={u.user_id}>
                {u.username} — {u.employee_id || 'بدون موظف'}
              </option>
            ))}
          </select>
          <select
            multiple
            value={selectedSectorProjects}
            onChange={(e) => setSelectedSectorProjects(Array.from(e.target.selectedOptions).map((o) => o.value))}
            style={{ minHeight: 140 }}
          >
            {projects.map((p: Project) => (
              <option key={p.project_id} value={p.project_id}>{p.name} — {p.project_id}</option>
            ))}
          </select>
        </div>
        <button
          className="secondary"
          disabled={busy || !selectedSectorManager || !selectedSectorProjects.length}
          onClick={async () => {
            await assignSectorManagerProjects();
          }}
        >
          حفظ مشروعات مدير القطاع
        </button>
      </div>

      <Table
        headers={[
          'اسم المستخدم',
          'الصلاحية',
          'الموظف',
          'المشروع',
          'الحالة',
          'آخر دخول','إجراء',
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
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button className="secondary" disabled={busy} onClick={() => onToggleUser?.(u.user_id,u.status)}>{u.status==='ACTIVE'?'تعطيل':'تفعيل'}</button><button className="secondary" disabled={busy} onClick={() => onResetPassword?.(u.user_id)}>تغيير كلمة المرور</button></div>,
          ];
        })}
      />
    </section>
  );
}

