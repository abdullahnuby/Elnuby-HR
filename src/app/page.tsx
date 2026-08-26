'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { navByRole, roleLabels } from '@/components/hr/constants';
import ManagerDashboard from '@/components/hr/Dashboard';
import DashboardHome from '@/components/hr/DashboardHome';
import EmployeesPage from '@/components/hr/EmployeesPage';
import ShiftsPage from '@/components/hr/ShiftsPage';
import ProjectsPage from '@/components/hr/ProjectsPage';
import DataSection from '@/components/hr/DataSection';
import LeaveSection from '@/components/hr/LeaveSection';
import PermissionSection from '@/components/hr/PermissionSection';
import UsersPage from '@/components/hr/UsersPage';
import Reports from '@/components/hr/Reports';
import Settings from '@/components/hr/Settings';


type Employee = {
  employee_id: string;
  name: string;
  job_title?: string;
  department?: string;
  phone?: string;
  status?: string;
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
  auto_checkout_time?: string;
};

type Shift = {
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

type Project = {
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

type User = {
  user_id: string;
  employee_id: string;
  username: string;
  role: string;
  status: string;
  last_login?: string;
  created_at?: string;
};

type Row = Record<string, any>;

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [me, setMe] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [managerDash, setManagerDash] = useState<any>(null);

  const [section, setSection] = useState('dashboard');
  const [sidebar, setSidebar] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('EMPLOYEE');
  const [newEmployee, setNewEmployee] = useState('');
  const [newProject, setNewProject] = useState('');
  const [selectedSectorProjects, setSelectedSectorProjects] = useState<string[]>([]);
  const [selectedSectorManager, setSelectedSectorManager] = useState('');

  const [employeeForm, setEmployeeForm] = useState<any>({
    name: '',
    job_title: '',
    department: '',
    phone: '',
    national_id: '',
    birth_date: '',
    hire_date: '',
    project_id: '',
    shift_id: '',
  });

  const [projectForm, setProjectForm] = useState<any>({
    name: '',
    client: '',
    location_name: '',
    latitude: '',
    longitude: '',
    geofence_radius_m: '200',
  });

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  const [leaveType, setLeaveType] = useState('Annual');
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const [shiftForm, setShiftForm] = useState<any>({
    name: '',
    start_time: '08:00',
    attendance_open: '06:00',
    attendance_close: '09:30',
    checkout_open: '15:00',
    checkout_close: '23:59',
    auto_checkout_time: '18:00',
  });

  const [permissionType, setPermissionType] = useState('Permission');
  const [permissionStart, setPermissionStart] = useState('');
  const [permissionEnd, setPermissionEnd] = useState('');
  const [permissionReason, setPermissionReason] = useState('');

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!me) return;

    const refresh = async () => {
      try {
        setDash(await api('dashboard'));

        if (['PROJECT_MANAGER', 'PROJECT_DIRECTOR'].includes(me.user?.role)) {
          setManagerDash(await api('project_manager_dashboard'));
        }
      } catch {
        // لا يتم تسجيل الخروج بسبب خطأ مؤقت في التحديث
      }
    };

    refresh();

    const timer = setInterval(refresh, 15000);

    return () => clearInterval(timer);
  }, [me]);

  async function load() {
    setError('');

    try {
      const m: any = await api('me');

      setMe(m);

      try {
        setDash(await api('dashboard'));
      } catch (e: any) {
        setError(e.message || 'تعذر تحميل لوحة التحكم');
      }

      if (['PROJECT_MANAGER', 'PROJECT_DIRECTOR'].includes(m.user?.role)) {
        try {
          setManagerDash(await api('project_manager_dashboard'));
        } catch (e: any) {
          setError(e.message || 'تعذر تحميل لوحة مدير المشروع');
        }
      }

      if (
        ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER'].includes(
          m.user?.role,
        )
      ) {
        try {
          setEmployees(await api('employees'));
        } catch (e: any) {
          setError(e.message || 'تعذر تحميل الموظفين');
        }

        try {
          setProjects(await api('projects'));
        } catch (e: any) {
          setError(e.message || 'تعذر تحميل المشاريع');
        }

        try {
          setShifts(await api('shifts'));
        } catch (e: any) {
          setError(e.message || 'تعذر تحميل الورديات');
        }
      }

      if (['SUPER_ADMIN', 'HR_MANAGER'].includes(m.user?.role)) {
        try {
          setUsers(await api('users'));
        } catch (e: any) {
          setError(e.message || 'تعذر تحميل المستخدمين');
        }
      }
    } catch (e: any) {
      const message = String(e?.message || '');

      const authError =
        /Authentication required|Invalid session|Session expired|User inactive|الجلسة غير صالحة|منتهية/i.test(
          message,
        );

      if (authError) {
        setMe(null);
        setDash(null);
        setManagerDash(null);
        setUsers([]);
        setEmployees([]);
        setProjects([]);
        setShifts([]);

        setError(
          'انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى.',
        );
      } else {
        setError(
          message || 'تعذر الاتصال بالخادم، حاول مرة أخرى.',
        );
      }
    }
  }

  async function login() {
    setBusy(true);
    setError('');

    try {
      const r: any = await api('login', {
        username,
        password,
      });

      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function locate(action: string) {
    setError('');

    if (!navigator.geolocation) {
      return setError('المتصفح لا يدعم GPS');
    }

    setBusy(true);

    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await api(action, {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          });

          setNotice(
            action === 'check_in'
              ? 'تم تسجيل الحضور بنجاح'
              : 'تم تسجيل الانصراف بنجاح',
          );

          await load();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      },
      () => {
        setError(
          'يجب السماح بالموقع لتسجيل الحضور/الانصراف',
        );

        setBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  async function refreshSection(id: string) {
    setError('');

    try {
      if (id === 'attendance') {
        setRows(await api('attendance_list', {}));
      }

      if (id === 'leaves') {
        setRows(await api('leave_list', {}));
      }

      if (id === 'permissions') {
        setRows(await api('permission_list', {}));
      }

      if (id === 'deductions') {
        setRows(await api('deductions', {}));
      }

      if (id === 'users') {
        const [
          freshUsers,
          freshEmployees,
          freshProjects,
        ] = await Promise.all([
          api<User[]>('users'),
          api<Employee[]>('employees'),
          api<Project[]>('projects'),
        ]);

        setUsers(freshUsers || []);
        setEmployees(freshEmployees || []);
        setProjects(freshProjects || []);

        setNewEmployee((current) =>
          current &&
          (freshEmployees || []).some(
            (e) => String(e.employee_id) === String(current),
          )
            ? current
            : '',
        );
      }

      if (id === 'employees') {
        setEmployees(await api('employees'));
      }

      if (id === 'projects') {
        setProjects(await api('projects'));
      }

      if (id === 'shifts') {
        const [ss, es] = await Promise.all([
          api<Shift[]>('shifts'),
          api<Row[]>('employee_shifts', {}),
        ]);

        setShifts(ss || []);
        setRows(es || []);
      }

      if (id === 'employees') {
        const [ee, ss] = await Promise.all([
          api<Employee[]>('employees'),
          api<Shift[]>('shifts'),
        ]);

        setEmployees(ee || []);
        setShifts(ss || []);
      }
    } catch (e: any) {
      setError(e.message || 'تعذر تحديث البيانات');
    }
  }

  async function openSection(id: string) {
    setSection(id);
    setNotice('');
    setSidebar(false);

    try {
      setDash(await api('dashboard'));

      if (me?.user?.role === 'PROJECT_MANAGER') {
        setManagerDash(
          await api('project_manager_dashboard'),
        );
      }
    } catch (e: any) {
      setError(
        e.message || 'تعذر تحديث لوحة التحكم',
      );
    }

    if (id !== 'dashboard') {
      refreshSection(id);
    }
  }

  async function createEmployee() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const e: any = await api(
        'create_employee',
        employeeForm,
      );

      setNotice(
        `تم تسجيل الموظف ${e.name} وتعيينه على المشروع والوردية بنجاح`,
      );

      setEmployeeForm({
        name: '',
        job_title: '',
        department: '',
        phone: '',
        national_id: '',
        birth_date: '',
        hire_date: '',
        project_id: '',
        shift_id: '',
      });

      setEmployees(await api('employees'));
      setProjects(await api('projects'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const p: any = await api(
        'create_project',
        projectForm,
      );

      setNotice(
        `تم إنشاء المشروع ${p.name} بنجاح`,
      );

      setProjectForm({
        name: '',
        client: '',
        location_name: '',
        latitude: '',
        longitude: '',
        geofence_radius_m: '200',
      });

      setProjects(await api('projects'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignProject() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api('assign_employee_project', {
        employee_id: selectedEmployee,
        project_id: selectedProject,
        shift_id: selectedShift,
      });

      setNotice(
        'تم نقل الموظف إلى المشروع وتعيين الوردية بنجاح',
      );

      setSelectedEmployee('');
      setSelectedProject('');
      setSelectedShift('');

      setEmployees(await api('employees'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignManager() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api('assign_manager_project', {
        user_id: selectedManager,
        project_id: selectedProject,
      });

      setNotice(
        'تم ربط مدير المشروع بالمشروع',
      );

      setProjects(await api('projects'));
      setUsers(await api('users'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createShift() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api('create_shift', shiftForm);

      setNotice('تم إنشاء الوردية بنجاح');

      setShiftForm({
        name: '',
        start_time: '08:00',
        attendance_open: '06:00',
        attendance_close: '09:30',
        checkout_open: '15:00',
        checkout_close: '23:59',
        auto_checkout_time: '18:00',
      });

      setShifts(await api('shifts'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignShift() {
    if (
      !selectedEmployee ||
      !selectedProject ||
      !selectedShift
    ) {
      return setError(
        'اختر الموظف والمشروع والوردية',
      );
    }

    setBusy(true);
    setError('');

    try {
      await api('assign_employee_shift', {
        employee_id: selectedEmployee,
        project_id: selectedProject,
        shift_id: selectedShift,
      });

      setNotice('تم تعيين الوردية بنجاح');

      setRows(await api('employee_shifts', {}));
      setEmployees(await api('employees'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignSectorManagerProjects() {
    if (!selectedSectorManager || !selectedSectorProjects.length) {
      return setError('اختر مدير القطاع والمشروعات');
    }
    setBusy(true);
    setError('');
    try {
      await api('assign_sector_manager_projects', {
        user_id: selectedSectorManager,
        project_ids: selectedSectorProjects,
      });
      setNotice('تم تحديث مشروعات مدير القطاع بنجاح');
      setSelectedSectorProjects([]);
      setSelectedSectorManager('');
      await refreshSection('users');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    setNotice('');
    setError('');

    if (!newUsername || !newPassword) {
      return setError(
        'أدخل اسم المستخدم وكلمة المرور',
      );
    }

    if (
      (newRole === 'EMPLOYEE' ||
        newRole === 'PROJECT_MANAGER' ||
        newRole === 'PROJECT_DIRECTOR' ||
        newRole === 'SITE_SUPERVISOR') &&
      !newEmployee
    ) {
      return setError(
        'اختر الموظف المرتبط بالحساب',
      );
    }

    if (
      (newRole === 'PROJECT_MANAGER' || newRole === 'SITE_SUPERVISOR') &&
      !newProject
    ) {
      return setError(
        'اختر المشروع المرتبط بالحساب *',
      );
    }

    if (newRole === 'PROJECT_DIRECTOR' && !selectedSectorProjects.length) {
      return setError('اختر مشروعًا واحدًا على الأقل لمدير القطاع');
    }

    setBusy(true);

    try {
      await api('create_user', {
        username: newUsername,
        password: newPassword,
        role: newRole,
        employee_id:
          (newRole === 'EMPLOYEE' || newRole === 'PROJECT_MANAGER' || newRole === 'PROJECT_DIRECTOR' || newRole === 'SITE_SUPERVISOR')
            ? newEmployee
            : '',
        project_id:
          (newRole === 'PROJECT_MANAGER' || newRole === 'SITE_SUPERVISOR')
            ? newProject
            : '',
        project_ids:
          newRole === 'PROJECT_DIRECTOR'
            ? selectedSectorProjects
            : [],
        status: 'ACTIVE',
      });

      setNotice(
        newRole === 'PROJECT_DIRECTOR'
          ? 'تم إنشاء حساب مدير القطاع وربطه بالمشروعات المحددة بنجاح'
          : newRole === 'PROJECT_MANAGER'
          ? 'تم إنشاء حساب مدير المشروع وربطه بالمشروع بنجاح'
          : newRole === 'SITE_SUPERVISOR'
            ? 'تم إنشاء حساب مشرف الموقع وربطه بالمشروع بنجاح'
          : newRole === 'HR_MANAGER'
            ? 'تم إنشاء حساب HR بدون ربطه بموظف أو مشروع'
            : 'تم إنشاء الحساب بنجاح',
      );

      setNewUsername('');
      setNewPassword('');
      setNewEmployee('');
      setNewProject('');
      setSelectedSectorProjects([]);
      setSelectedSectorManager('');
      setNewRole('EMPLOYEE');

      const [
        freshUsers,
        freshEmployees,
        freshProjects,
      ] = await Promise.all([
        api<User[]>('users'),
        api<Employee[]>('employees'),
        api<Project[]>('projects'),
      ]);

      setUsers(freshUsers || []);
      setEmployees(freshEmployees || []);
      setProjects(freshProjects || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createLeave() {
    setBusy(true);
    setError('');

    try {
      await api('create_leave', {
        leave_type_id: leaveType,
        from_date: leaveFrom,
        to_date: leaveTo,
        reason: leaveReason,
      });

      setNotice('تم إرسال طلب الإجازة');

      setLeaveFrom('');
      setLeaveTo('');
      setLeaveReason('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createPermission() {
    setBusy(true);
    setError('');

    try {
      await api('create_permission', {
        permission_type: permissionType,
        date: permissionStart.slice(0, 10),
        start_time: permissionStart,
        end_time: permissionEnd,
        reason: permissionReason,
      });

      setNotice('تم إرسال طلب الإذن');

      setPermissionStart('');
      setPermissionEnd('');
      setPermissionReason('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const nav = useMemo(
    () =>
      navByRole(
        me?.user?.role || 'EMPLOYEE',
      ),
    [me?.user?.role],
  );

  if (!me) {
    return (
      <main
        className="login-page"
        dir="rtl"
      >
        <div className="login-shell">
          <div className="login-brand">
            <div className="brand-mark">
              N
            </div>

            <div>
              <b>ELNUBY HR</b>
              <span>
                نظام إدارة موارد بشرية للمشروعات
              </span>
            </div>
          </div>

          <section className="login-card">
            <div className="eyebrow">
              دخول آمن
            </div>

            <h1>مرحباً بك</h1>

            <p>
              أدخل بيانات حسابك للوصول إلى لوحة
              التحكم.
            </p>

            <label>
              اسم المستخدم
            </label>

            <input
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="abdullah"
            />

            <label>
              كلمة المرور
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              onKeyDown={(e) =>
                e.key === 'Enter' && login()
              }
            />

            <button
              className="primary full"
              disabled={busy}
              onClick={login}
            >
              {busy
                ? 'جاري التحقق…'
                : 'تسجيل الدخول'}
            </button>

            {error && (
              <div className="alert danger">
                {error}
              </div>
            )}
          </section>

          <small className="login-footer">
            ELNUBY HR • Site Workforce Management
          </small>
        </div>
      </main>
    );
  }

  return (
    <main
      className="app"
      dir="rtl"
    >
      <div
        className={`mobile-backdrop ${
          sidebar ? 'visible' : ''
        }`}
        onClick={() => setSidebar(false)}
        aria-hidden="true"
      />

      <aside
        className={`sidebar ${
          sidebar ? 'open' : ''
        }`}
      >
        <div className="side-brand">
          <div className="brand-mark">
            N
          </div>

          <div>
            <b>ELNUBY HR</b>
            <small>WORKFORCE</small>
          </div>
        </div>

        <div className="profile-mini">
          <div className="avatar">
            {(
              me.employee?.name ||
              me.user?.username ||
              'U'
            ).slice(0, 1)}
          </div>

          <div>
            <strong>
              {me.employee?.name ||
                me.user?.username}
            </strong>

            <span>
              {roleLabels[me.user?.role] ||
                me.user?.role}
            </span>
          </div>
        </div>

        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={
                section === n.id
                  ? 'active'
                  : ''
              }
              onClick={() =>
                openSection(n.id)
              }
            >
              <i>{n.icon}</i>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="secure">
            ● النظام متصل
          </div>

          <button
            className="logout"
            onClick={async () => {
              try {
                await api('logout');
              } finally {
                location.reload();
              }
            }}
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="top-left">
            <button
              className="menu"
              onClick={() =>
                setSidebar((v) => !v)
              }
            >
              ☰
            </button>

            <div>
              <strong>
                {nav.find(
                  (n) => n.id === section,
                )?.label ||
                  'لوحة التحكم'}
              </strong>

              <small>
                ELNUBY Construction • HR
                Management
              </small>
            </div>
          </div>

          <div className="top-actions">
            <span className="date">
              {new Date().toLocaleDateString(
                'ar-EG',
                {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              )}
            </span>

            <div className="avatar top-avatar">
              {(
                me.employee?.name ||
                me.user?.username ||
                'U'
              ).slice(0, 1)}
            </div>
          </div>
        </header>

        <div className="content">
          {section === 'dashboard' &&
            (me.user?.role ===
            'PROJECT_MANAGER' ? (
              <ManagerDashboard
                me={me}
                dash={dash}
                managerDash={managerDash}
                roleLabels={roleLabels}
                setSection={openSection}
              />
            ) : (
              <DashboardHome
                me={me}
                dash={dash}
                roleLabels={roleLabels}
                locate={locate}
                busy={busy}
                setSection={openSection}
              />
            ))}

          {section === 'employees' && (
            <EmployeesPage
              managerMode={['PROJECT_DIRECTOR', 'PROJECT_MANAGER'].includes(me.user?.role)}
              employees={employees}
              projects={projects}
              shifts={shifts}
              employeeForm={employeeForm}
              setEmployeeForm={setEmployeeForm}
              createEmployee={createEmployee}
              selectedEmployee={
                selectedEmployee
              }
              setSelectedEmployee={
                setSelectedEmployee
              }
              selectedProject={
                selectedProject
              }
              setSelectedProject={
                setSelectedProject
              }
              selectedShift={
                selectedShift
              }
              setSelectedShift={
                setSelectedShift
              }
              assignProject={assignProject}
              busy={busy}
            />
          )}

          {section === 'shifts' && (
            <ShiftsPage
              managerMode={['PROJECT_DIRECTOR', 'PROJECT_MANAGER'].includes(me.user?.role)}
              shifts={shifts}
              rows={rows}
              shiftForm={shiftForm}
              setShiftForm={setShiftForm}
              createShift={createShift}
              busy={busy}
            />
          )}

          {section === 'projects' && (
            <ProjectsPage
              managerMode={['PROJECT_DIRECTOR', 'PROJECT_MANAGER'].includes(me.user?.role)}
              projects={projects}
              employees={employees}
              projectForm={projectForm}
              setProjectForm={
                setProjectForm
              }
              createProject={createProject}
              busy={busy}
            />
          )}

          {section === 'attendance' && (
            <DataSection
              title="سجل الحضور والانصراف"
              subtitle="متابعة الحضور وتعديلات السجلات"
              rows={rows}
              type="attendance"
            />
          )}

          {section === 'leaves' && (
            <LeaveSection
              rows={rows}
              role={me.user?.role}
              employeeMode={
                me.user?.role === 'EMPLOYEE'
              }
              leaveType={leaveType}
              setLeaveType={setLeaveType}
              leaveFrom={leaveFrom}
              setLeaveFrom={setLeaveFrom}
              leaveTo={leaveTo}
              setLeaveTo={setLeaveTo}
              leaveReason={leaveReason}
              setLeaveReason={setLeaveReason}
              createLeave={createLeave}
              busy={busy}
            />
          )}

          {section === 'permissions' && (
            <PermissionSection
              rows={rows}
              employeeMode={
                me.user?.role === 'EMPLOYEE'
              }
              permissionType={
                permissionType
              }
              setPermissionType={
                setPermissionType
              }
              permissionStart={
                permissionStart
              }
              setPermissionStart={
                setPermissionStart
              }
              permissionEnd={
                permissionEnd
              }
              setPermissionEnd={
                setPermissionEnd
              }
              permissionReason={
                permissionReason
              }
              setPermissionReason={
                setPermissionReason
              }
              createPermission={
                createPermission
              }
              busy={busy}
            />
          )}

          {section === 'deductions' && (
            <DataSection
              title="الخصومات"
              subtitle="بيانات إدارية خاصة بالإدارة فقط"
              rows={rows}
              type="deductions"
            />
          )}

          {section === 'users' && (
            <UsersPage
              users={users}
              employees={employees}
              projects={projects}
              newUsername={newUsername}
              setNewUsername={
                setNewUsername
              }
              newPassword={newPassword}
              setNewPassword={
                setNewPassword
              }
              newRole={newRole}
              setNewRole={setNewRole}
              newEmployee={newEmployee}
              setNewEmployee={
                setNewEmployee
              }
              newProject={newProject}
              setNewProject={
                setNewProject
              }
              selectedManager={
                selectedManager
              }
              setSelectedManager={
                setSelectedManager
              }
              selectedProject={
                selectedProject
              }
              setSelectedProject={
                setSelectedProject
              }
              assignManager={
                assignManager
              }
              assignSectorManagerProjects={
                assignSectorManagerProjects
              }
              createAccount={
                createAccount
              }
              busy={busy}
              onRefresh={() =>
                refreshSection('users')
              }
            />
          )}

          {section === 'reports' && (
            <Reports
              dash={dash}
              managerDash={managerDash}
            />
          )}

          {section === 'settings' && (
            <Settings />
          )}

          {error && (
            <div className="alert danger global-alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="alert success global-alert">
              {notice}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

