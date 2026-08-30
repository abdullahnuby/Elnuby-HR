'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, apiMultipart } from '@/lib/api';
import { apiCacheKey, cacheGet, cacheSet, syncAttendanceQueue, pendingAttendanceCount, clearOfflineData, clearOfflineCache, getOfflineUserId, setOfflineUserId } from '@/lib/offline';
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
import SystemAdminPanel from '@/components/hr/SystemAdminPanel';
import Icon from '@/components/hr/Icon';
import EmployeeProfile from '@/components/hr/EmployeeProfile';
import Performance from '@/components/hr/Performance';
import AttendanceCalendar from '@/components/hr/AttendanceCalendar';
import HRExecutiveDashboard from '@/components/hr/HRExecutiveDashboard';
import ApprovalsCenter from '@/components/hr/ApprovalsCenter';
import HRAdvanced from '@/components/hr/HRAdvanced';


type Employee = {
  employee_id: string;
  name: string;
  job_title?: string;
  department?: string;
  phone?: string;
  status?: string;
  residency_type?: 'EXPATRIATE'|'RESIDENT';
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
  const [notifications, setNotifications] = useState<any>(null);
  const [sidebar, setSidebar] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [employeeProfileId, setEmployeeProfileId] = useState<string | null>(null);
  const APP_TIMEZONE = 'Africa/Cairo';

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
    residency_type: 'RESIDENT',
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
    const updateNetwork = async () => {
      setIsOffline(!navigator.onLine);
      setPendingSync(await pendingAttendanceCount(me?.user?.user_id || null).catch(() => 0));
    };
    void updateNetwork();

    const sync = async () => {
      // Never sync before the current authenticated identity is known.
      // This prevents a device queue from being sent using another account.
      const currentUserId = String(me?.user?.user_id || '');
      if (!currentUserId || !navigator.onLine) return;
      const result = await syncAttendanceQueue(
        async (action, payload) => api(action, payload, { offlineSync: true }),
        currentUserId,
      );
      setPendingSync(result.pending);
      if (result.synced > 0) {
        setNotice(`تمت مزامنة ${result.synced} عملية حضور وانصراف`);
        try { await load(); } catch {}
      }
    };

    const online = () => { setIsOffline(false); void sync(); };
    const offline = () => { setIsOffline(true); void updateNetwork(); };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const syncTimer = window.setInterval(() => { void sync(); }, 30000);
    void sync();

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.clearInterval(syncTimer);
    };
  }, [me?.user?.user_id]);

  useEffect(() => {
    let cancelled = false;

    const restoreCachedOfflineSession = async (degradedNetwork = false) => {
      const cachedMe: any = await cacheGet(apiCacheKey('me', {}));
      if (cancelled || !cachedMe?.user?.user_id) return false;
      setOfflineUserId(String(cachedMe.user.user_id));
      setMe(cachedMe);
      const cachedDashboard: any = await cacheGet(apiCacheKey('dashboard', {}));
      const cachedManagerDashboard: any = await cacheGet(apiCacheKey('project_manager_dashboard', {}));
      if (!cancelled) {
        if (cachedDashboard) setDash(cachedDashboard);
        if (cachedManagerDashboard) setManagerDash(cachedManagerDashboard);
        setPendingSync(await pendingAttendanceCount(String(cachedMe.user.user_id)).catch(() => 0));
        setIsOffline(!navigator.onLine || degradedNetwork);
        setNotice(
          !navigator.onLine
            ? 'أنت تعمل دون اتصال. البيانات المعروضة من آخر مزامنة محفوظة على الجهاز.'
            : 'تعذر الوصول للخادم مؤقتًا. تم عرض آخر بيانات محفوظة، وستعود المزامنة تلقائيًا.'
        );
      }
      return true;
    };

    (async () => {
      // A refresh while offline must restore the last authenticated app state,
      // not interpret network absence as logout.
      if (!navigator.onLine && await restoreCachedOfflineSession()) return;

      try {
        const status: any = await api('session_status');
        if (cancelled) return;
        if (!status?.authenticated) {
          await clearOfflineCache();
          setMe(null);
          setDash(null);
          setManagerDash(null);
          return;
        }
        await load();
      } catch (error: any) {
        if (cancelled) return;
        const message = String(error?.message || '');
        const authFailure = /Authentication required|Invalid session|Session expired|User inactive|الجلسة غير صالحة|منتهية/i.test(message);
        if (authFailure) {
          await clearOfflineCache();
          setMe(null);
        } else if (!(await restoreCachedOfflineSession(true))) {
          setError(message || 'تعذر الاتصال بالخادم.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      setNotice(String(detail.message || 'تم تنفيذ العملية بنجاح'));
      window.setTimeout(() => setNotice(''), 3500);
    };
    window.addEventListener('hr:toast', handler);
    return () => window.removeEventListener('hr:toast', handler);
  }, []);

  useEffect(() => {
    if (!me) return;

    const refresh = async () => {
      try {
        setDash(await api('dashboard'));

        if (['PROJECT_MANAGER', 'SECTOR_MANAGER'].includes(me.user?.role)) {
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

  async function performLogout() {
    setBusy(true);
    try {
      // The API logout is idempotent and clears the httpOnly cookie even if
      // the server-side session has already expired.
      await api('logout');
    } catch {
      // Local cleanup must still happen if the server is unreachable.
    } finally {
      await clearOfflineData();
      setMe(null);
      setDash(null);
      setManagerDash(null);
      setUsers([]);
      setEmployees([]);
      setProjects([]);
      setShifts([]);
      setRows([]);
      setSidebar(false);
      setSection('dashboard');
      setBusy(false);

      // Replace the current page so a refresh can never restore stale React/cache state.
      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
    }
  }

  async function load() {
    setError('');

    try {
      const m: any = await api('me');

      if (!m?.user) {
        setMe(null);
        return;
      }

      setMe(m);

      try {
        setDash(await api('dashboard'));
      } catch (e: any) {
        setError(e.message || 'تعذر تحميل لوحة التحكم');
      }

      if (['PROJECT_MANAGER', 'SECTOR_MANAGER'].includes(m.user?.role)) {
        try {
          setManagerDash(await api('project_manager_dashboard'));
        } catch (e: any) {
          setError(e.message || 'تعذر تحميل لوحة مدير المشروع');
        }
      }

      if (
        ['SYSTEM_ADMIN', 'HR_MANAGER', 'SECTOR_MANAGER', 'PROJECT_MANAGER'].includes(
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

      if (['SYSTEM_ADMIN', 'HR_MANAGER'].includes(m.user?.role)) {
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
        void clearOfflineData();
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
      // A new login is a new security context; never reuse cached data from
      // a previous account on this browser.
      await clearOfflineCache();

      await api('login', {
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
          const clientEventId = crypto.randomUUID();
          const recordedAt = new Date().toISOString();
          const result: any = await api(action, {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            client_event_id: clientEventId,
            client_recorded_at: recordedAt,
            offline_source: navigator.onLine ? 'ONLINE' : 'OFFLINE_SYNC',
            gps_accuracy_m: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
            gps_timestamp: Number.isFinite(p.timestamp) ? new Date(p.timestamp).toISOString() : recordedAt,
          });

          if (result?.offlineQueued) {
            setPendingSync(await pendingAttendanceCount(getOfflineUserId()));
            setNotice(action === 'check_in'
              ? 'تم حفظ الحضور على الجهاز وسيتم مزامنته تلقائيًا عند عودة الإنترنت'
              : 'تم حفظ الانصراف على الجهاز وسيتم مزامنته تلقائيًا عند عودة الإنترنت');
            setDash((prev: any) => {
              const current = prev?.selfAttendance || {};
              const time = new Date(recordedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
              const next = { ...(prev || {}), selfAttendance: action === 'check_in' ? { ...current, check_in: time, check_out: null, source: 'OFFLINE_SYNC', pending_sync: true } : { ...current, check_out: time, source: 'OFFLINE_SYNC', pending_sync: true } };
              void cacheSet('api:dashboard:{}', next);
              void cacheGet<any[]>('api:attendance_list:{}').then((list) => {
                const rows = Array.isArray(list) ? [...list] : [];
                const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(recordedAt));
                const idx = rows.findIndex((r: any) => r.employee_id === me?.user?.employee_id && r.date === localDate);
                if (idx >= 0) rows[idx] = { ...rows[idx], ...(action === 'check_in' ? { check_in: time, check_out: null, source: 'OFFLINE_SYNC', pending_sync: true } : { check_out: time, source: 'OFFLINE_SYNC', pending_sync: true }) };
                else if (action === 'check_in') rows.unshift({ attendance_id: clientEventId, employee_id: me?.user?.employee_id, date: localDate, check_in: time, check_out: null, status: 'PENDING_SYNC', source: 'OFFLINE_SYNC', pending_sync: true });
                void cacheSet('api:attendance_list:{}', rows);
              });
              return next;
            });
          } else {
            setNotice(action === 'check_in' ? 'تم تسجيل الحضور بنجاح' : 'تم تسجيل الانصراف بنجاح');
            await load();
          }
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
        maximumAge: 0,
        timeout: 20000,
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

      if (id === 'notifications') {
        const result: any = await api('notifications');
        setNotifications(result || { notices: [], total: 0, high: 0 });
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

      if (['PROJECT_MANAGER', 'SECTOR_MANAGER'].includes(me?.user?.role)) {
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
        newRole === 'SECTOR_MANAGER') &&
      !newEmployee
    ) {
      return setError(
        'اختر الموظف المرتبط بالحساب',
      );
    }

    if (
      (newRole === 'PROJECT_MANAGER') &&
      !newProject
    ) {
      return setError(
        'اختر المشروع المرتبط بالحساب *',
      );
    }

    if (newRole === 'SECTOR_MANAGER' && !selectedSectorProjects.length) {
      return setError('اختر مشروعًا واحدًا على الأقل لمدير القطاع');
    }

    setBusy(true);

    try {
      await api('create_user', {
        username: newUsername,
        password: newPassword,
        role: newRole,
        employee_id:
          (newRole === 'EMPLOYEE' || newRole === 'PROJECT_MANAGER' || newRole === 'SECTOR_MANAGER')
            ? newEmployee
            : '',
        project_id:
          (newRole === 'PROJECT_MANAGER')
            ? newProject
            : '',
        project_ids:
          newRole === 'SECTOR_MANAGER'
            ? selectedSectorProjects
            : [],
        status: 'ACTIVE',
      });

      setNotice(
        newRole === 'SECTOR_MANAGER'
          ? 'تم إنشاء حساب مدير القطاع وربطه بالمشروعات المحددة بنجاح'
          : newRole === 'PROJECT_MANAGER'
          ? 'تم إنشاء حساب مدير المشروع وربطه بالمشروع بنجاح'
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

  async function updateEmployeeRecord(employeeId: string) {
    setEmployeeProfileId(employeeId);
  }

  async function updateProjectRecord(projectId: string) {
    const current=projects.find(p=>p.project_id===projectId);if(!current)return; const name=window.prompt('اسم المشروع',current.name||'');if(name===null)return;const client=window.prompt('العميل',current.client||'');if(client===null)return;const location_name=window.prompt('اسم الموقع',current.location_name||'');if(location_name===null)return;const radius=window.prompt('نطاق GPS بالمتر',String(current.geofence_radius_m??200));if(radius===null)return;
    try{setBusy(true);await api('update_project',{project_id:projectId,name,client,location_name,geofence_radius_m:Number(radius)});setNotice('تم تعديل المشروع');setProjects(await api('projects'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  async function updateShiftRecord(shiftId: string) {
    const current=shifts.find(s=>s.shift_id===shiftId);if(!current)return; const fields=['name','start_time','attendance_open','attendance_close','checkout_open','checkout_close','auto_checkout_time']; const values:any={}; for(const f of fields){const v=window.prompt(f,current[f as keyof typeof current] as string||'');if(v===null)return;values[f]=v;}
    try{setBusy(true);await api('update_shift',{shift_id:shiftId,...values});setNotice('تم تعديل الوردية');setShifts(await api('shifts'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  async function toggleUser(userId:string,status:string){try{setBusy(true);if(status==='ACTIVE')await api('delete_user',{user_id:userId});else await api('update_user',{user_id:userId,status:'ACTIVE'});setNotice(status==='ACTIVE'?'تم تعطيل الحساب':'تم تفعيل الحساب');setUsers(await api('users'));}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  async function resetUserPassword(userId:string){const password=window.prompt('كلمة المرور الجديدة');if(password===null)return;try{setBusy(true);await api('update_user',{user_id:userId,password});setNotice('تم تغيير كلمة المرور');}catch(e:any){setError(e.message)}finally{setBusy(false)}}

  async function closeAttendanceRecord(attendanceId:string){
    if(!window.confirm('هل تريد إغلاق سجل الحضور هذا الآن؟')) return;
    try{setBusy(true);await api('close_attendance',{attendance_id:attendanceId});setNotice('تم إغلاق سجل الحضور');setRows(await api('attendance_list',{}));}catch(e:any){setError(e.message||'تعذر إغلاق سجل الحضور')}finally{setBusy(false)}
  }

  async function createLeave(medicalDocument?: File) {
    setBusy(true);
    setError('');

    try {
      await apiMultipart('create_leave', {
        leave_type_id: leaveType,
        from_date: leaveFrom,
        to_date: leaveTo,
        reason: leaveReason,
      }, medicalDocument);

      setNotice('تم إرسال طلب الإجازة للاعتماد');
      setLeaveFrom('');
      setLeaveTo('');
      setLeaveReason('');
      await refreshSection('leaves');
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
        start_time: permissionStart.slice(11, 16),
        end_time: permissionEnd.slice(11, 16),
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
            ELNUBY HR
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
            
          </div>
        </div>

        <div className="profile-mini">
          <div className="profile-initials" aria-hidden="true"><Icon name="users" size={17}/></div>

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
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="side-bottom">
          <div className={`secure ${isOffline ? 'offline' : ''}`}>
            ● {isOffline ? 'وضع بدون إنترنت' : 'النظام متصل'}
          </div>

          <button
            className="logout"
            onClick={performLogout}
          >
            <Icon name="logout" size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <section className="workspace">
        {(isOffline || pendingSync > 0) && (
          <div className={`offline-banner ${pendingSync > 0 && !isOffline ? 'pending' : ''}`} role="status">
            <span className="offline-dot" />
            {isOffline
              ? `وضع العمل بدون إنترنت — البيانات المعروضة من آخر مزامنة${pendingSync ? ` • ${pendingSync} عملية حضور بانتظار المزامنة` : ''}`
              : `${pendingSync} عملية حضور وانصراف بانتظار المزامنة`}
            {!isOffline && pendingSync > 0 && (
              <button type="button" onClick={async () => { const r = await syncAttendanceQueue(async (action, payload) => api(action, payload, { offlineSync: true }), getOfflineUserId()); setPendingSync(r.pending); if (r.synced) { setNotice(`تمت مزامنة ${r.synced} عملية`); await load(); } }}>مزامنة الآن</button>
            )}
          </div>
        )}

        <header className="topbar">
          <div className="top-left">
            <button
              className="menu"
              onClick={() =>
                setSidebar((v) => !v)
              }
            >
              <Icon name="menu" size={19} />
            </button>

            <div>
              <strong>
                {nav.find(
                  (n) => n.id === section,
                )?.label ||
                  'لوحة التحكم'}
              </strong>

              <small>{roleLabels[me.user?.role] || me.user?.role}</small>
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

            <details className="profile-menu"><summary className="avatar top-avatar" aria-label="قائمة الحساب">{(me.employee?.name||me.user?.username||'U').slice(0,1)}</summary><div className="profile-menu-card"><strong>{me.employee?.name||me.user?.username}</strong><span>{roleLabels[me.user?.role]||me.user?.role}</span><button className="secondary" onClick={performLogout}>تسجيل الخروج</button></div></details>
          </div>
        </header>

        <div className="content">
          {section === 'dashboard' &&
            (['SYSTEM_ADMIN','HR_MANAGER'].includes(me.user?.role) ? (
              <HRExecutiveDashboard me={me} setSection={openSection} />
            ) : ['PROJECT_MANAGER', 'SECTOR_MANAGER'].includes(me.user?.role) ? (
              <ManagerDashboard
                me={me}
                dash={dash}
                managerDash={managerDash}
                roleLabels={roleLabels}
                setSection={openSection}
                locate={locate}
                busy={busy}
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
              managerMode={['SECTOR_MANAGER', 'PROJECT_MANAGER'].includes(me.user?.role)}
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
            
              onEdit={['SYSTEM_ADMIN','HR_MANAGER'].includes(me.user?.role) ? updateEmployeeRecord : undefined}/>
          )}

          {employeeProfileId && <EmployeeProfile employeeId={employeeProfileId} onClose={() => setEmployeeProfileId(null)} />}

          {section === 'shifts' && (
            <ShiftsPage
              managerMode={['SECTOR_MANAGER', 'PROJECT_MANAGER'].includes(me.user?.role)}
              shifts={shifts}
              rows={rows}
              shiftForm={shiftForm}
              setShiftForm={setShiftForm}
              createShift={createShift}
              busy={busy}
            
              onEdit={['SYSTEM_ADMIN','HR_MANAGER'].includes(me.user?.role) ? updateShiftRecord : undefined}/>
          )}

          {section === 'projects' && (
            <ProjectsPage
              managerMode={['SECTOR_MANAGER', 'PROJECT_MANAGER'].includes(me.user?.role)}
              projects={projects}
              employees={employees}
              projectForm={projectForm}
              setProjectForm={
                setProjectForm
              }
              createProject={createProject}
              busy={busy}
            
              onEdit={['SYSTEM_ADMIN','HR_MANAGER'].includes(me.user?.role) ? updateProjectRecord : undefined}/>
          )}

          {section === 'attendance-calendar' && <AttendanceCalendar />}
          {section === 'approvals' && <ApprovalsCenter />}

          {section === 'attendance' && (
            <DataSection
              title="سجل الحضور والانصراف"
              subtitle="متابعة الحضور وتعديلات السجلات"
              rows={rows}
              type="attendance"
              onCloseAttendance={['SYSTEM_ADMIN','HR_MANAGER'].includes(me.user?.role) ? closeAttendanceRecord : undefined}
              busy={busy}
            />
          )}

          {section === 'leaves' && (
            <LeaveSection
              rows={rows}
              role={me.user?.role}
              employeeMode={['EMPLOYEE', 'PROJECT_MANAGER'].includes(me.user?.role)}
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
              employeeMode={['EMPLOYEE', 'PROJECT_MANAGER'].includes(me.user?.role)}
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
              selectedSectorProjects={
                selectedSectorProjects
              }
              setSelectedSectorProjects={
                setSelectedSectorProjects
              }
              selectedSectorManager={
                selectedSectorManager
              }
              setSelectedSectorManager={
                setSelectedSectorManager
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
            
              onToggleUser={toggleUser}
              onResetPassword={resetUserPassword}/>
          )}

          {section === 'performance' && <Performance employees={employees} role={me.user?.role} />}
          {section === 'hr-advanced' && <HRAdvanced employees={employees} role={me.user?.role} />}

          {section === 'notifications' && (
            <section className="panel-section">
              <div className="section-head">
                <div><h2>تنبيهات الموارد البشرية</h2><p>الحالات التي تحتاج إلى مراجعة من إدارة الموارد البشرية.</p></div>
                <button className="secondary" onClick={() => refreshSection('notifications')}>تحديث</button>
              </div>
              <div className="kpi-grid">
                <div className="kpi"><div className="kpi-icon"><Icon name="alert" size={21}/></div><div><span>إجمالي التنبيهات</span><strong>{notifications?.total ?? 0}</strong></div><em>اليوم</em></div>
                <div className="kpi danger-kpi"><div className="kpi-icon"><Icon name="alert" size={21}/></div><div><span>عالية الأولوية</span><strong>{notifications?.high ?? 0}</strong></div><em>تحتاج مراجعة</em></div>
              </div>
              <div className="state-card">
                {(notifications?.notices || []).length === 0 ? <><Icon name="check" size={22}/><div><strong>لا توجد تنبيهات حالية</strong><span>لا توجد حالات تحتاج إلى مراجعة في الوقت الحالي.</span></div></> : <div style={{width:'100%'}}>{notifications.notices.map((n:any,i:number)=><article key={`${n.type}-${n.request_id||n.case_id||n.employee_id||i}`} className="notification-row"><div><strong>{n.title}</strong><span>{n.message}</span></div><b>{n.priority === 'HIGH' ? 'عالية' : 'متوسطة'}</b></article>)}</div>}
              </div>
            </section>
          )}

          {section === 'reports' && (
            <Reports
              dash={dash}
              managerDash={managerDash}
            />
          )}

          {section === 'settings' && (
            ['SYSTEM_ADMIN','HR_MANAGER'].includes(me.user?.role) ? (
              <Settings role={me.user?.role} />
            ) : (
              <SystemAdminPanel />
            )
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

