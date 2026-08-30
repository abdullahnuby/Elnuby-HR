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
  const safeUsers: User[] = Array.isArray(users) ? users : [];
  const safeEmployees: Employee[] = Array.isArray(employees) ? employees : [];
  const safeProjects: Project[] = Array.isArray(projects) ? projects : [];
  const safeSelectedSectorProjects: string[] = Array.isArray(selectedSectorProjects)
    ? selectedSectorProjects.map(String)
    : [];

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
            {safeEmployees.length} موظف متاح
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
              مدير الموارد البشرية
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

              {safeEmployees.map(
                (e: Employee) => (
                  <option
                    key={e.employee_id}
                    value={e.employee_id}
                  >
                    {e.name}
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

              {safeProjects.map(
                (p: Project) => (
                  <option
                    key={p.project_id}
                    value={p.project_id}
                  >
                    {p.name}
                  </option>
                ),
              )}
            </select>
          )}

          {newRole === 'SECTOR_MANAGER' && (
            <label className="field-stack">
              <span>المشروعات التابعة لمدير القطاع *</span>
              <div className="project-checklist">{safeProjects.map((p: Project) => { const checked=safeSelectedSectorProjects.includes(String(p.project_id)); return <label key={p.project_id} className={checked?'checked':''}><input type="checkbox" checked={checked} onChange={()=>setSelectedSectorProjects(checked?safeSelectedSectorProjects.filter((id:string)=>id!==String(p.project_id)):[...safeSelectedSectorProjects,String(p.project_id)])}/><span>{p.name}</span></label>; })}{!safeProjects.length&&<span className="empty-note">لا توجد مشروعات متاحة.</span>}</div>
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
              حساب مدير الموارد البشرية إداري مركزي: لا يحتاج
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
            في قائمة الموظفين.
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

            {safeUsers
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

            {safeProjects.map(
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
          <div className="project-checklist">{safeProjects.map((p: Project) => { const checked=safeSelectedSectorProjects.includes(String(p.project_id)); return <label key={p.project_id} className={checked?'checked':''}><input type="checkbox" checked={checked} onChange={()=>setSelectedSectorProjects(checked?safeSelectedSectorProjects.filter((id:string)=>id!==String(p.project_id)):[...safeSelectedSectorProjects,String(p.project_id)])}/><span>{p.name}</span></label>; })}{!safeProjects.length&&<span className="empty-note">لا توجد مشروعات متاحة.</span>}</div>
        </div>
        <button
          className="secondary"
          disabled={busy || !selectedSectorManager || !safeSelectedSectorProjects.length}
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
        rows={safeUsers.map((u: User) => {
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

