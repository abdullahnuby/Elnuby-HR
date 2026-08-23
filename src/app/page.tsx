'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Employee={employee_id:string;name:string;job_title?:string;department?:string;phone?:string;status?:string;project_id?:string;project_name?:string;assignment_start?:string;assignment_id?:string;current_project_name?:string;shift_id?:string;shift_name?:string;shift_start?:string;attendance_open?:string;attendance_close?:string;checkout_open?:string;auto_checkout_time?:string};
type Shift={shift_id:string;name:string;start_time:string;attendance_open:string;attendance_close:string;checkout_open:string;checkout_close:string;auto_checkout_time:string;status?:string};
type Project={project_id:string;name:string;client?:string;location_name?:string;latitude?:number|string;longitude?:number|string;geofence_radius_m?:number|string;status?:string;project_manager_id?:string;manager_count?:number;managers?:any[]};
type User={user_id:string;employee_id:string;username:string;role:string;status:string;last_login?:string;created_at?:string};
type Row=Record<string,any>;

const roleLabels:Record<string,string>={SUPER_ADMIN:'مدير النظام',HR_MANAGER:'مدير الموارد البشرية',PROJECT_MANAGER:'مدير مشروع',SITE_SUPERVISOR:'مشرف موقع',EMPLOYEE:'موظف'};
const navByRole=(role:string)=>[
 {id:'dashboard',label:'لوحة التحكم',icon:'⌂'},
 {id:'employees',label:'الموظفون',icon:'♙',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'projects',label:'المشاريع',icon:'▦',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'shifts',label:'الورديات',icon:'◴',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'attendance',label:'الحضور والانصراف',icon:'◷'},
 {id:'leaves',label:'الإجازات',icon:'▤'},
 {id:'permissions',label:'الأذونات',icon:'◉'},
 {id:'deductions',label:'الخصومات',icon:'−',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'users',label:'حسابات المستخدمين',icon:'♙',roles:['SUPER_ADMIN']},
 {id:'reports',label:'التقارير',icon:'▥',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'settings',label:'إعدادات النظام',icon:'⚙',roles:['SUPER_ADMIN']},
].filter(x=>!x.roles||x.roles.includes(role));

export default function Home(){
 const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const [me,setMe]=useState<any>(null); const [dash,setDash]=useState<any>(null); const [managerDash,setManagerDash]=useState<any>(null); const [section,setSection]=useState('dashboard'); const [sidebar,setSidebar]=useState(false);
 const [users,setUsers]=useState<User[]>([]); const [employees,setEmployees]=useState<Employee[]>([]); const [projects,setProjects]=useState<Project[]>([]); const [shifts,setShifts]=useState<Shift[]>([]); const [rows,setRows]=useState<Row[]>([]); const [notice,setNotice]=useState('');
 const [newUsername,setNewUsername]=useState(''); const [newPassword,setNewPassword]=useState(''); const [newRole,setNewRole]=useState('EMPLOYEE'); const [newEmployee,setNewEmployee]=useState(''); const [newProject,setNewProject]=useState('');
 const [employeeForm,setEmployeeForm]=useState<any>({name:'',job_title:'',department:'',phone:'',national_id:'',birth_date:'',hire_date:'',project_id:'',shift_id:''});
 const [projectForm,setProjectForm]=useState<any>({name:'',client:'',location_name:'',latitude:'',longitude:'',geofence_radius_m:'200'});
 const [selectedEmployee,setSelectedEmployee]=useState(''); const [selectedProject,setSelectedProject]=useState(''); const [selectedShift,setSelectedShift]=useState(''); const [selectedManager,setSelectedManager]=useState('');
 const [leaveType,setLeaveType]=useState('Annual'); const [leaveFrom,setLeaveFrom]=useState(''); const [leaveTo,setLeaveTo]=useState(''); const [leaveReason,setLeaveReason]=useState('');
 const [shiftForm,setShiftForm]=useState<any>({name:'',start_time:'08:00',attendance_open:'06:00',attendance_close:'09:30',checkout_open:'15:00',checkout_close:'23:59',auto_checkout_time:'18:00'});
 const [permissionType,setPermissionType]=useState('Permission'); const [permissionStart,setPermissionStart]=useState(''); const [permissionEnd,setPermissionEnd]=useState(''); const [permissionReason,setPermissionReason]=useState('');
 useEffect(()=>{if(localStorage.getItem('hr_token'))load();},[]);
 useEffect(()=>{if(!me)return; const refresh=async()=>{try{setDash(await api('dashboard')); if(me.user?.role==='PROJECT_MANAGER') setManagerDash(await api('project_manager_dashboard'));}catch(e:any){/* keep session on transient dashboard refresh errors */}}; refresh(); const t=setInterval(refresh,15000); return ()=>clearInterval(t);},[me]);
 async function load(){
  const token=localStorage.getItem('hr_token');
  if(!token){setMe(null);return;}
  setError('');
  try{
    const m:any=await api('me');
    setMe(m);
    try{setDash(await api('dashboard'));}catch(e:any){setError(e.message||'تعذر تحميل لوحة التحكم');}
    if(m.user?.role==='PROJECT_MANAGER'){try{setManagerDash(await api('project_manager_dashboard'));}catch(e:any){setError(e.message||'تعذر تحميل لوحة مدير المشروع');}}
    if(['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER'].includes(m.user?.role)){
      try{setEmployees(await api('employees'));}catch(e:any){setError(e.message||'تعذر تحميل الموظفين');}
      try{setProjects(await api('projects'));}catch(e:any){setError(e.message||'تعذر تحميل المشاريع');}
      try{setShifts(await api('shifts'));}catch(e:any){setError(e.message||'تعذر تحميل الورديات');}
    }
    if(m.user?.role==='SUPER_ADMIN'){
      try{setUsers(await api('users'));}catch(e:any){setError(e.message||'تعذر تحميل المستخدمين');}
    }
  }catch(e:any){
    const message=String(e?.message||'');
    const authError=/Authentication required|Invalid session|Session expired|User inactive/i.test(message);
    if(authError){
      localStorage.removeItem('hr_token');
      setMe(null);
      setDash(null);
      setManagerDash(null);
      setUsers([]);
      setEmployees([]);
      setProjects([]);
      setError('انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى.');
    }else{
      // Do not log the employee out because of a temporary network/API error.
      setError(message||'تعذر الاتصال بالخادم، حاول مرة أخرى.');
    }
  }
}
 async function login(){setBusy(true);setError('');try{const r:any=await api('login',{username,password});localStorage.setItem('hr_token',r.token);await load();}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function locate(action:string){setError('');if(!navigator.geolocation)return setError('المتصفح لا يدعم GPS');setBusy(true);navigator.geolocation.getCurrentPosition(async p=>{try{await api(action,{latitude:p.coords.latitude,longitude:p.coords.longitude});setNotice(action==='check_in'?'تم تسجيل الحضور بنجاح':'تم تسجيل الانصراف بنجاح');await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}},()=>{setError('يجب السماح بالموقع لتسجيل الحضور/الانصراف');setBusy(false)},{enableHighAccuracy:true,timeout:10000});}
 async function refreshSection(id:string){
  setError('');
  try{
    if(id==='attendance') setRows(await api('attendance_list',{}));
    if(id==='leaves') setRows(await api('leave_list',{}));
    if(id==='permissions') setRows(await api('permission_list',{}));
    if(id==='deductions') setRows(await api('deductions',{}));
    if(id==='users'){
      // Always refresh employees when opening User Management.
      // A newly-created employee may not have been present when the session loaded.
      const [freshUsers,freshEmployees,freshProjects]=await Promise.all([api<User[]>('users'),api<Employee[]>('employees'),api<Project[]>('projects')]);
      setUsers(freshUsers||[]);
      setEmployees(freshEmployees||[]);
      setProjects(freshProjects||[]);
      setNewEmployee(current => (current && (freshEmployees||[]).some(e=>String(e.employee_id)===String(current))) ? current : '');
    }
    if(id==='employees') setEmployees(await api('employees'));
    if(id==='projects') setProjects(await api('projects'));
    if(id==='shifts'){ const [ss,es]=await Promise.all([api<Shift[]>('shifts'),api<Row[]>('employee_shifts',{})]); setShifts(ss||[]); setRows(es||[]); }
    if(id==='employees'){ const [ee,ss]=await Promise.all([api<Employee[]>('employees'),api<Shift[]>('shifts')]); setEmployees(ee||[]); setShifts(ss||[]); }
  }catch(e:any){
    setError(e.message||'تعذر تحديث البيانات');
  }
}
 async function openSection(id:string){setSection(id);setNotice(''); setSidebar(false); try{setDash(await api('dashboard')); if(me?.user?.role==='PROJECT_MANAGER') setManagerDash(await api('project_manager_dashboard'));}catch(e:any){setError(e.message||'تعذر تحديث لوحة التحكم');} if(id!=='dashboard') refreshSection(id)}
 async function createEmployee(){
  setBusy(true);setError('');setNotice('');
  try{const e:any=await api('create_employee',employeeForm);setNotice(`تم تسجيل الموظف ${e.name} وتعيينه على المشروع والوردية بنجاح`);setEmployeeForm({name:'',job_title:'',department:'',phone:'',national_id:'',birth_date:'',hire_date:'',project_id:'',shift_id:''});setEmployees(await api('employees'));setProjects(await api('projects'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function createProject(){
  setBusy(true);setError('');setNotice('');
  try{const p:any=await api('create_project',projectForm);setNotice(`تم إنشاء المشروع ${p.name} بنجاح`);setProjectForm({name:'',client:'',location_name:'',latitude:'',longitude:'',geofence_radius_m:'200'});setProjects(await api('projects'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function assignProject(){
  setBusy(true);setError('');setNotice('');
  try{await api('assign_employee_project',{employee_id:selectedEmployee,project_id:selectedProject,shift_id:selectedShift});setNotice('تم نقل الموظف إلى المشروع وتعيين الوردية بنجاح');setSelectedEmployee('');setSelectedProject('');setSelectedShift('');setEmployees(await api('employees'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function assignManager(){
  setBusy(true);setError('');setNotice('');
  try{await api('assign_manager_project',{user_id:selectedManager,project_id:selectedProject});setNotice('تم ربط مدير المشروع بالمشروع');}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function createShift(){setBusy(true);setError('');setNotice('');try{await api('create_shift',shiftForm);setNotice('تم إنشاء الوردية بنجاح');setShiftForm({name:'',start_time:'08:00',attendance_open:'06:00',attendance_close:'09:30',checkout_open:'15:00',checkout_close:'23:59',auto_checkout_time:'18:00'});setShifts(await api('shifts'));}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function assignShift(){if(!selectedEmployee||!selectedProject||!selectedShift)return setError('اختر الموظف والمشروع والوردية');setBusy(true);setError('');try{await api('assign_employee_shift',{employee_id:selectedEmployee,project_id:selectedProject,shift_id:selectedShift});setNotice('تم تعيين الوردية بنجاح');setRows(await api('employee_shifts',{}));setEmployees(await api('employees'));}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function createAccount(){
  setNotice('');setError('');
  if(!newUsername||!newPassword)return setError('أدخل اسم المستخدم وكلمة المرور');
  if((newRole==='EMPLOYEE'||newRole==='PROJECT_MANAGER')&&!newEmployee)return setError('اختر الموظف المرتبط بالحساب');
  if(newRole==='PROJECT_MANAGER'&&!newProject)return setError('اختر مشروع مدير المشروع *');
  setBusy(true);
  try{
    const result:any=await api('create_user',{username:newUsername,password:newPassword,role:newRole,employee_id:(newRole==='EMPLOYEE'||newRole==='PROJECT_MANAGER')?newEmployee:'',project_id:newRole==='PROJECT_MANAGER'?newProject:'',status:'ACTIVE'});
    setNotice(newRole==='PROJECT_MANAGER'?'تم إنشاء الحساب وربطه بالمشروع وتسجيله كمدير للمشروع ومنحه الصلاحيات تلقائياً':newRole==='HR_MANAGER'?'تم إنشاء حساب HR بدون ربطه بموظف أو مشروع':'تم إنشاء الحساب بنجاح');
    setNewUsername('');setNewPassword('');setNewEmployee('');setNewProject('');setNewRole('EMPLOYEE');
    const [freshUsers,freshEmployees,freshProjects]=await Promise.all([api<User[]>('users'),api<Employee[]>('employees'),api<Project[]>('projects')]);
    setUsers(freshUsers||[]);setEmployees(freshEmployees||[]);setProjects(freshProjects||[]);
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function createLeave(){setBusy(true);setError('');try{await api('create_leave',{leave_type_id:leaveType,from_date:leaveFrom,to_date:leaveTo,reason:leaveReason});setNotice('تم إرسال طلب الإجازة');setLeaveFrom('');setLeaveTo('');setLeaveReason('');}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function createPermission(){setBusy(true);setError('');try{await api('create_permission',{date:permissionStart.slice(0,10),start_time:permissionStart,end_time:permissionEnd,reason:permissionReason});setNotice('تم إرسال طلب الإذن');setPermissionStart('');setPermissionEnd('');setPermissionReason('');}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 const nav=useMemo(()=>navByRole(me?.user?.role||'EMPLOYEE'),[me?.user?.role]);
 if(!me)return <main className="login-page" dir="rtl"><div className="login-shell"><div className="login-brand"><div className="brand-mark">N</div><div><b>ELNUBY HR</b><span>نظام إدارة موارد بشرية للمشروعات</span></div></div><section className="login-card"><div className="eyebrow">دخول آمن</div><h1>مرحباً بك</h1><p>أدخل بيانات حسابك للوصول إلى لوحة التحكم.</p><label>اسم المستخدم</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="abdullah"/><label>كلمة المرور</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&login()}/><button className="primary full" disabled={busy} onClick={login}>{busy?'جاري التحقق…':'تسجيل الدخول'}</button>{error&&<div className="alert danger">{error}</div>}</section><small className="login-footer">ELNUBY HR • Site Workforce Management</small></div></main>;
 return <main className="app" dir="rtl"><div className={`mobile-backdrop ${sidebar?'visible':''}`} onClick={()=>setSidebar(false)} aria-hidden="true"/><aside className={`sidebar ${sidebar?'open':''}`}><div className="side-brand"><div className="brand-mark">N</div><div><b>ELNUBY HR</b><small>WORKFORCE</small></div></div><div className="profile-mini"><div className="avatar">{(me.employee?.name||me.user?.username||'U').slice(0,1)}</div><div><strong>{me.employee?.name||me.user?.username}</strong><span>{roleLabels[me.user?.role]||me.user?.role}</span></div></div><nav>{nav.map(n=><button key={n.id} className={section===n.id?'active':''} onClick={()=>openSection(n.id)}><i>{n.icon}</i><span>{n.label}</span></button>)}</nav><div className="side-bottom"><div className="secure">● النظام متصل</div><button className="logout" onClick={()=>{localStorage.removeItem('hr_token');location.reload()}}>تسجيل الخروج</button></div></aside><section className="workspace"><header className="topbar"><div className="top-left"><button className="menu" onClick={()=>setSidebar(v=>!v)}>☰</button><div><strong>{nav.find(n=>n.id===section)?.label||'لوحة التحكم'}</strong><small>ELNUBY Construction • HR Management</small></div></div><div className="top-actions"><span className="date">{new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span><div className="avatar top-avatar">{(me.employee?.name||me.user?.username||'U').slice(0,1)}</div></div></header><div className="content">
 {section==='dashboard'&&(me.user?.role==='PROJECT_MANAGER'?<ManagerDashboard me={me} dash={dash} managerDash={managerDash} roleLabels={roleLabels} setSection={openSection}/>:<Dashboard me={me} dash={dash} roleLabels={roleLabels} locate={locate} busy={busy} setSection={openSection} />)}
 {section==='employees'&&<Employees managerMode={me.user?.role==='PROJECT_MANAGER'} employees={employees} projects={projects} shifts={shifts} employeeForm={employeeForm} setEmployeeForm={setEmployeeForm} createEmployee={createEmployee} selectedEmployee={selectedEmployee} setSelectedEmployee={setSelectedEmployee} selectedProject={selectedProject} setSelectedProject={setSelectedProject} selectedShift={selectedShift} setSelectedShift={setSelectedShift} assignProject={assignProject} busy={busy} />}
 {section==='shifts'&&<Shifts managerMode={me.user?.role==='PROJECT_MANAGER'} shifts={shifts} rows={rows} shiftForm={shiftForm} setShiftForm={setShiftForm} createShift={createShift} busy={busy} />}
 {section==='projects'&&<Projects managerMode={me.user?.role==='PROJECT_MANAGER'} projects={projects} employees={employees} projectForm={projectForm} setProjectForm={setProjectForm} createProject={createProject} busy={busy} />}
 {section==='attendance'&&<DataSection title="سجل الحضور والانصراف" subtitle="متابعة الحضور وتعديلات السجلات" rows={rows} type="attendance" />}
 {section==='leaves'&&<LeaveSection rows={rows} role={me.user?.role} employeeMode={me.user?.role==='EMPLOYEE'} leaveType={leaveType} setLeaveType={setLeaveType} leaveFrom={leaveFrom} setLeaveFrom={setLeaveFrom} leaveTo={leaveTo} setLeaveTo={setLeaveTo} leaveReason={leaveReason} setLeaveReason={setLeaveReason} createLeave={createLeave} busy={busy} />}
 {section==='permissions'&&<PermissionSection rows={rows} employeeMode={me.user?.role==='EMPLOYEE'} permissionType={permissionType} setPermissionType={setPermissionType} permissionStart={permissionStart} setPermissionStart={setPermissionStart} permissionEnd={permissionEnd} setPermissionEnd={setPermissionEnd} permissionReason={permissionReason} setPermissionReason={setPermissionReason} createPermission={createPermission} busy={busy} />}
 {section==='deductions'&&<DataSection title="الخصومات" subtitle="بيانات إدارية خاصة بالإدارة فقط" rows={rows} type="deductions" />}
 {section==='users'&&<Users users={users} employees={employees} projects={projects} newUsername={newUsername} setNewUsername={setNewUsername} newPassword={newPassword} setNewPassword={setNewPassword} newRole={newRole} setNewRole={setNewRole} newEmployee={newEmployee} setNewEmployee={setNewEmployee} newProject={newProject} setNewProject={setNewProject} selectedManager={selectedManager} setSelectedManager={setSelectedManager} selectedProject={selectedProject} setSelectedProject={setSelectedProject} assignManager={assignManager} createAccount={createAccount} busy={busy} onRefresh={()=>refreshSection('users')} />}
 {section==='reports'&&<Reports dash={dash} managerDash={managerDash} />}
 {section==='settings'&&<Settings />}
 {error&&<div className="alert danger global-alert">{error}</div>}{notice&&<div className="alert success global-alert">{notice}</div>}
 </div></section></main>
}

function ManagerDashboard({me,dash,managerDash,roleLabels,setSection}:any){
 const s=managerDash?.summary||{}; const projects=managerDash?.projects||[]; const team=managerDash?.team||[]; const leaves=managerDash?.pendingLeaves||[]; const permissions=managerDash?.pendingPermissions||[];
 const stateLabel=(v:string)=>({PRESENT:'حاضر',CHECKED_IN:'حاضر ولم ينصرف',LATE:'متأخر',ON_LEAVE:'إجازة',ABSENT:'غائب'} as any)[v]||v;
 return <>
  <div className="welcome"><div><div className="eyebrow">PROJECT MANAGEMENT CENTER</div><h1>لوحة مدير المشروع — {me.employee?.name||me.user?.username} 👋</h1><p>إدارة ومتابعة مشروعك وموظفيك والحضور والطلبات من مكان واحد.</p></div><div className="welcome-role"><span>المشاريع التابعة</span><b>{projects.length}</b></div></div>
  <div className="kpis"><Kpi title="موظفو المشروع" value={s.employees??0} icon="♙"/><Kpi title="حاضر اليوم" value={s.present??0} icon="✓"/><Kpi title="متأخرون" value={s.late??0} icon="◷"/><Kpi title="في إجازة" value={s.onLeave??0} icon="▤"/></div>
  <div className="dashboard-grid">
   <section className="panel page-panel"><div className="panel-head"><div><h2>مشاريعي</h2><p>المشاريع التي تم تعيينك عليها رسميًا.</p></div></div><div className="project-cards">{projects.map((p:any)=><div className="project-card" key={p.project_id}><div className="project-icon">▦</div><div className="project-card-main"><h3>{p.name}</h3><p>{p.location_name||'الموقع غير محدد'} {p.client?`• ${p.client}`:''}</p><div className="project-meta"><span>👷 {p.employee_count||0} موظف</span><span>GPS {p.latitude}, {p.longitude}</span><span>{p.geofence_radius_m||200}m</span></div></div></div>)}</div></section>
   <section className="panel today-panel"><div className="panel-head"><div><h2>حالة اليوم</h2><p>حالة القوة العاملة في مشروعك.</p></div></div><div className="today-row"><span>غائب</span><strong>{s.absent??0}</strong></div><div className="today-row"><span>في إجازة</span><strong>{s.onLeave??0}</strong></div><div className="today-row"><span>طلبات إجازة معلقة</span><strong>{s.pendingLeaves??0}</strong></div><div className="today-row"><span>طلبات إذن معلقة</span><strong>{s.pendingPermissions??0}</strong></div></section>
  </div>
  <section className="panel page-panel"><div className="panel-head"><div><h2>حالة الموظفين الآن</h2><p>حاضر، متأخر، غائب أو في إجازة.</p></div><span className="count-pill">{team.length} موظف</span></div><Table headers={['الموظف','الوظيفة','المشروع','الحالة','الحضور','الانصراف']} rows={team.map((e:any)=>[e.name,e.job_title||'—',e.project_name||'—',stateLabel(e.state),e.attendance?.check_in||'—',e.attendance?.check_out||'—'])}/></section>
  <div className="dashboard-grid"><section className="panel page-panel"><div className="panel-head"><div><h2>طلبات الإجازات</h2><p>الطلبات التي تحتاج قرار مدير المشروع.</p></div></div>{leaves.length?<Table headers={['الموظف','النوع','من','إلى','الحالة']} rows={leaves.map((r:any)=>[r.employee_name,r.leave_type_name||r.leave_type_id,r.from_date,r.to_date,r.status])}/>:<Empty text="لا توجد طلبات إجازة معلقة."/>}<button className="secondary" onClick={()=>setSection('leaves')}>فتح كل الإجازات</button></section><section className="panel page-panel"><div className="panel-head"><div><h2>طلبات الأذونات</h2><p>طلبات الأذونات المنتظرة.</p></div></div>{permissions.length?<Table headers={['الموظف','البداية','النهاية','المدة','الحالة']} rows={permissions.map((r:any)=>[r.employee_name,r.start_time,r.end_time,`${r.minutes} دقيقة`,r.status])}/>:<Empty text="لا توجد طلبات إذن معلقة."/>}<button className="secondary" onClick={()=>setSection('permissions')}>فتح كل الأذونات</button></section></div>
 </>;
}

function Dashboard({me,dash,roleLabels,locate,busy,setSection}:any){return <><div className="welcome"><div><div className="eyebrow">SITE HR CONTROL CENTER</div><h1>صباح الخير، {me.employee?.name||me.user?.username} 👋</h1><p>إليك ملخص حالة القوى العاملة اليوم.</p></div><div className="welcome-role"><span>الصلاحية</span><b>{roleLabels[me.user?.role]||me.user?.role}</b></div></div><div className="kpis"><Kpi title="إجمالي الموظفين" value={dash?.employees??0} icon="♙"/><Kpi title="حضور اليوم" value={dash?.present??0} icon="✓"/><Kpi title="متأخرون" value={dash?.late??0} icon="◷"/><Kpi title="بدون انصراف" value={dash?.missingCheckout??0} icon="!" danger/></div><div className="dashboard-grid"><section className="panel attendance-panel"><div className="panel-head"><div><h2>الحضور والانصراف</h2><p>التسجيل متاح حسب الوردية وموقع المشروع.</p></div><span className="live"><b/> LIVE</span></div><div className="attendance-actions"><button className="attendance-btn in" disabled={busy} onClick={()=>locate('check_in')}><span>↘</span><b>تسجيل الحضور</b><small>GPS • موقع المشروع</small></button><button className="attendance-btn out" disabled={busy} onClick={()=>locate('check_out')}><span>↗</span><b>تسجيل الانصراف</b><small>GPS • موقع المشروع</small></button></div><div className="quick-links"><button onClick={()=>setSection('leaves')}>طلب إجازة <span>←</span></button><button onClick={()=>setSection('permissions')}>طلب إذن <span>←</span></button><button onClick={()=>setSection('attendance')}>عرض السجل <span>←</span></button></div></section><section className="panel today-panel"><div className="panel-head"><div><h2>ملخص اليوم</h2><p>نظرة سريعة على الموقع.</p></div></div><div className="today-row"><span>حاضر</span><strong>{dash?.present??0}</strong></div><div className="today-row"><span>متأخر</span><strong>{dash?.late??0}</strong></div><div className="today-row"><span>بدون انصراف</span><strong>{dash?.missingCheckout??0}</strong></div><div className="today-row"><span>إجمالي الموظفين</span><strong>{dash?.employees??0}</strong></div></section></div></>}
function Kpi({title,value,icon,danger}:{title:string;value:any;icon:string;danger?:boolean}){return <div className={`kpi ${danger?'danger-kpi':''}`}><div className="kpi-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div><em>اليوم</em></div>}
function Employees({employees,projects,shifts,managerMode,employeeForm,setEmployeeForm,createEmployee,selectedEmployee,setSelectedEmployee,selectedProject,setSelectedProject,selectedShift,setSelectedShift,assignProject,busy}:{employees:Employee[];projects:Project[];shifts:Shift[];managerMode:boolean;employeeForm:any;setEmployeeForm:any;createEmployee:()=>void;selectedEmployee:string;setSelectedEmployee:any;selectedProject:string;setSelectedProject:any;selectedShift:string;setSelectedShift:any;assignProject:()=>void;busy:boolean}){
 return <section className="panel page-panel">
  <div className="panel-head"><div><h2>الموظفون</h2><p>كل موظف مرتبط بمشروع ووردية فعالة، وتظهر العلاقة هنا وفي Google Sheets.</p></div><span className="count-pill">{employees.length} موظف</span></div>
  {!managerMode&&<div className="request-card"><h3>إضافة موظف جديد</h3><p>سيتم إنشاء ملف الموظف وتعيينه على المشروع والوردية المختارين في نفس العملية.</p>
   <div className="formgrid">
    <input placeholder="الاسم بالكامل *" value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})}/><input placeholder="الوظيفة *" value={employeeForm.job_title} onChange={e=>setEmployeeForm({...employeeForm,job_title:e.target.value})}/><input placeholder="القسم" value={employeeForm.department} onChange={e=>setEmployeeForm({...employeeForm,department:e.target.value})}/><input placeholder="رقم الهاتف" value={employeeForm.phone} onChange={e=>setEmployeeForm({...employeeForm,phone:e.target.value})}/><input placeholder="الرقم القومي" value={employeeForm.national_id} onChange={e=>setEmployeeForm({...employeeForm,national_id:e.target.value})}/><input type="date" title="تاريخ الميلاد" value={employeeForm.birth_date} onChange={e=>setEmployeeForm({...employeeForm,birth_date:e.target.value})}/><input type="date" title="تاريخ التعيين" value={employeeForm.hire_date} onChange={e=>setEmployeeForm({...employeeForm,hire_date:e.target.value})}/>
    <select value={employeeForm.project_id} onChange={e=>setEmployeeForm({...employeeForm,project_id:e.target.value})}><option value="">اختر المشروع الحالي *</option>{projects.map(p=><option key={p.project_id} value={p.project_id}>{p.name} — {p.project_id}</option>)}</select>
    <select value={employeeForm.shift_id} onChange={e=>setEmployeeForm({...employeeForm,shift_id:e.target.value})}><option value="">اختر الوردية *</option>{shifts.map(s=><option key={s.shift_id} value={s.shift_id}>{s.name} — {s.start_time} / حضور حتى {s.attendance_close}</option>)}</select>
   </div><button className="primary" disabled={busy||!projects.length||!shifts.length} onClick={createEmployee}>{!projects.length?'أضف مشروعًا أولاً':!shifts.length?'أنشئ وردية أولاً':'تسجيل الموظف وتعيين المشروع والوردية'}</button>
  </div>}
  <div className="request-card"><h3>{managerMode?'إدارة تعيينات موظفي مشروعي':'نقل موظف + تغيير الوردية'}</h3><div className="formgrid"><select value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}><option value="">اختر الموظف</option>{employees.map(e=><option key={e.employee_id} value={e.employee_id}>{e.name} — {e.employee_id}</option>)}</select><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">اختر المشروع</option>{projects.map(p=><option key={p.project_id} value={p.project_id}>{p.name}</option>)}</select><select value={selectedShift} onChange={e=>setSelectedShift(e.target.value)}><option value="">اختر الوردية</option>{shifts.map(s=><option key={s.shift_id} value={s.shift_id}>{s.name} — {s.start_time}</option>)}</select></div><button className="secondary" disabled={busy||!selectedEmployee||!selectedProject||!selectedShift} onClick={assignProject}>حفظ المشروع والوردية</button></div>
  <Table headers={['الرقم','الاسم','الوظيفة','المشروع الحالي','الوردية','بداية الوردية','الحضور حتى','الانصراف من','الحالة']} rows={employees.map(e=>[e.employee_id,e.name,e.job_title||'—',e.project_name||'غير معين',e.shift_name||'غير معين',e.shift_start||'—',e.attendance_close||'—',e.checkout_open||'—',e.status||'ACTIVE'])}/>
  {!employees.length&&<Empty text="لا يوجد موظفون حتى الآن."/>}
 </section>
}
function Shifts({shifts,rows,managerMode,shiftForm,setShiftForm,createShift,busy}:{shifts:Shift[];rows:Row[];managerMode:boolean;shiftForm:any;setShiftForm:any;createShift:()=>void;busy:boolean}){return <section className="panel page-panel"><div className="panel-head"><div><h2>الورديات</h2><p>تعريف ساعات العمل ونافذة الحضور والانصراف وربطها بالمشروع والموظف.</p></div><span className="count-pill">{shifts.length} وردية فعالة</span></div>{!managerMode&&<div className="request-card"><h3>إنشاء وردية</h3><div className="formgrid"><input placeholder="اسم الوردية *" value={shiftForm.name} onChange={e=>setShiftForm({...shiftForm,name:e.target.value})}/><label>بداية العمل<input type="time" value={shiftForm.start_time} onChange={e=>setShiftForm({...shiftForm,start_time:e.target.value})}/></label><label>فتح الحضور<input type="time" value={shiftForm.attendance_open} onChange={e=>setShiftForm({...shiftForm,attendance_open:e.target.value})}/></label><label>إغلاق الحضور<input type="time" value={shiftForm.attendance_close} onChange={e=>setShiftForm({...shiftForm,attendance_close:e.target.value})}/></label><label>فتح الانصراف<input type="time" value={shiftForm.checkout_open} onChange={e=>setShiftForm({...shiftForm,checkout_open:e.target.value})}/></label><label>إغلاق الانصراف<input type="time" value={shiftForm.checkout_close} onChange={e=>setShiftForm({...shiftForm,checkout_close:e.target.value})}/></label><label>الانصراف التلقائي<input type="time" value={shiftForm.auto_checkout_time} onChange={e=>setShiftForm({...shiftForm,auto_checkout_time:e.target.value})}/></label></div><button className="primary" disabled={busy} onClick={createShift}>إنشاء الوردية</button></div>}<Table headers={['الوردية','بداية العمل','فتح الحضور','إغلاق الحضور','فتح الانصراف','إغلاق الانصراف','Auto Checkout']} rows={shifts.map(s=>[s.name,s.start_time,s.attendance_open,s.attendance_close,s.checkout_open,s.checkout_close,s.auto_checkout_time])}/><div className="panel-head" style={{marginTop:24}}><div><h3>تعيينات الورديات الحالية والتاريخية</h3><p>كل سطر يوضح الموظف والمشروع والوردية الفعلية.</p></div></div><Table headers={['الموظف','المشروع','الوردية','بداية العمل','فتح الحضور','إغلاق الحضور','فتح الانصراف','Auto Checkout','من تاريخ','إلى تاريخ','الحالة']} rows={rows.map(r=>[r.employee_name||r.employee_id,r.project_name||r.project_id,r.shift_name||r.shift_id,r.shift_start||'—',r.attendance_open||'—',r.attendance_close||'—',r.checkout_open||'—',r.auto_checkout_time||'—',r.start_date||'—',r.end_date||'—',r.end_date?'HISTORY':'CURRENT'])}/></section>}
function Projects({projects,employees,managerMode,projectForm,setProjectForm,createProject,busy}:{projects:Project[];employees:Employee[];managerMode:boolean;projectForm:any;setProjectForm:any;createProject:()=>void;busy:boolean}){
 return <section className="panel page-panel">
  <div className="panel-head"><div><h2>المشاريع</h2><p>إنشاء وإدارة مواقع المشاريع وإحداثيات الـ GPS ونطاق الحضور.</p></div><span className="count-pill">{projects.length} مشروع</span></div>
  {!managerMode&&<div className="request-card"><h3>إضافة مشروع جديد</h3><div className="formgrid">
   <input placeholder="اسم المشروع *" value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})}/>
   <input placeholder="العميل" value={projectForm.client} onChange={e=>setProjectForm({...projectForm,client:e.target.value})}/>
   <input placeholder="اسم الموقع" value={projectForm.location_name} onChange={e=>setProjectForm({...projectForm,location_name:e.target.value})}/>
   <input type="number" step="any" placeholder="Latitude *" value={projectForm.latitude} onChange={e=>setProjectForm({...projectForm,latitude:e.target.value})}/>
   <input type="number" step="any" placeholder="Longitude *" value={projectForm.longitude} onChange={e=>setProjectForm({...projectForm,longitude:e.target.value})}/>
   <input type="number" placeholder="نطاق GPS بالمتر" value={projectForm.geofence_radius_m} onChange={e=>setProjectForm({...projectForm,geofence_radius_m:e.target.value})}/>
  </div><button className="primary" disabled={busy} onClick={createProject}>إنشاء المشروع</button></div>}
  <div className="project-cards">{projects.map(p=>{const assigned=employees.filter(e=>String(e.project_id||'')===String(p.project_id));return <div className="project-card" key={p.project_id}><div className="project-icon">▦</div><div className="project-card-main"><h3>{p.name||p.project_id}</h3><p>{p.location_name||'الموقع غير محدد'} {p.client?`• ${p.client}`:''}</p><div className="project-meta"><span>{p.status||'ACTIVE'}</span><span>👷 {assigned.length} موظف</span><span>مديرو المشروع: {(p.managers||[]).map((m:any)=>m.name||m.username).filter(Boolean).join('، ')||'غير محدد'}</span><span>GPS {p.latitude}, {p.longitude}</span><span>{p.geofence_radius_m||200}m</span></div><div className="project-workers">{assigned.slice(0,6).map(e=><span key={e.employee_id} title={e.name}>{e.name}</span>)}{assigned.length>6&&<span>+{assigned.length-6}</span>}{!assigned.length&&<span>لا يوجد موظفون معينون</span>}</div></div></div>})}</div>
  {!projects.length&&<Empty text="لا توجد مشاريع مسجلة حتى الآن. أضف أول مشروع من النموذج أعلاه."/>}
 </section>
}
function DataSection({title,subtitle,rows,type}:{title:string;subtitle:string;rows:Row[];type:string}){const headers=type==='attendance'?['الموظف','الوظيفة','القسم','المشروع','الوردية','التاريخ','الحضور','الانصراف','التأخير','ساعات العمل','الحالة']:['الموظف','التاريخ','النوع','القيمة','السبب','الحالة'];const mapped=rows.map(r=>type==='attendance'?[r.employee_name||r.employee_id,r.job_title||'—',r.department||'—',r.project_name||r.project_id||'—',r.shift_name||r.shift_id||'—',r.date,r.check_in||'—',r.check_out||'—',r.late_minutes?`${r.late_minutes} د`:'0',r.worked_minutes?`${Math.floor(Number(r.worked_minutes)/60)}:${String(Number(r.worked_minutes)%60).padStart(2,'0')}`:'—',r.status||'—']:[r.employee_id,r.date,r.deduction_type||r.type||'—',r.amount??'—',r.reason||'—',r.status||'—']);return <section className="panel page-panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div><Table headers={headers} rows={mapped}/>{!rows.length&&<Empty text="لا توجد بيانات لعرضها حالياً."/>}</section>}
function LeaveSection({rows,role,employeeMode,leaveType,setLeaveType,leaveFrom,setLeaveFrom,leaveTo,setLeaveTo,leaveReason,setLeaveReason,createLeave,busy}:any){const manager=role==='PROJECT_MANAGER';const hr=role==='HR_MANAGER'||role==='SUPER_ADMIN';return <section className="panel page-panel"><div className="panel-head"><div><h2>الإجازات</h2><p>مسار الاعتماد: الموظف ← مدير المشروع ← الموارد البشرية.</p></div></div>{employeeMode&&<div className="request-card"><h3>طلب إجازة جديد</h3><div className="formgrid"><select value={leaveType} onChange={e=>setLeaveType(e.target.value)}><option value="LT-ANNUAL">سنوية</option><option value="LT-CASUAL">عارضة</option><option value="LT-SICK">مرضية</option><option value="LT-UNPAID">بدون أجر</option><option value="LT-OTHER">أخرى</option></select><input type="date" value={leaveFrom} onChange={e=>setLeaveFrom(e.target.value)}/><input type="date" value={leaveTo} onChange={e=>setLeaveTo(e.target.value)}/><input placeholder="سبب الإجازة" value={leaveReason} onChange={e=>setLeaveReason(e.target.value)}/></div><button className="primary" disabled={busy} onClick={createLeave}>إرسال الطلب</button></div>}<div className="table-wrap"><table><thead><tr>{['الموظف','النوع','من','إلى','الحالة','السبب','إجراء'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r:any)=><tr key={r.request_id}><td>{r.employee_id}</td><td>{r.leave_type_id}</td><td>{r.from_date}</td><td>{r.to_date}</td><td>{r.status}</td><td>{r.reason||'—'}</td><td>{(manager&&r.status==='PENDING_MANAGER')&&<button className="tiny approve" onClick={async()=>{await api('decide_leave_manager',{request_id:r.request_id,decision:'APPROVE'});location.reload()}}>اعتماد</button>}{(manager&&r.status==='PENDING_MANAGER')&&<button className="tiny reject" onClick={async()=>{await api('decide_leave_manager',{request_id:r.request_id,decision:'REJECT'});location.reload()}}>رفض</button>}{(hr&&r.status==='PENDING_HR')&&<button className="tiny approve" onClick={async()=>{await api('decide_leave_hr',{request_id:r.request_id,decision:'APPROVE'});location.reload()}}>اعتماد HR</button>}{(hr&&r.status==='PENDING_HR')&&<button className="tiny reject" onClick={async()=>{await api('decide_leave_hr',{request_id:r.request_id,decision:'REJECT'});location.reload()}}>رفض</button>}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="لا توجد طلبات إجازة."/>}</section>}
function PermissionSection({rows,employeeMode,permissionType,setPermissionType,permissionStart,setPermissionStart,permissionEnd,setPermissionEnd,permissionReason,setPermissionReason,createPermission,busy}:any){return <section className="panel page-panel"><div className="panel-head"><div><h2>الأذونات</h2><p>طلبات الأذونات تمر إلى مدير المشروع للموافقة.</p></div></div>{employeeMode&&<div className="request-card"><h3>طلب إذن جديد</h3><div className="formgrid"><input value={permissionType} onChange={e=>setPermissionType(e.target.value)} placeholder="نوع الإذن"/><input type="datetime-local" value={permissionStart} onChange={e=>setPermissionStart(e.target.value)}/><input type="datetime-local" value={permissionEnd} onChange={e=>setPermissionEnd(e.target.value)}/><input placeholder="السبب" value={permissionReason} onChange={e=>setPermissionReason(e.target.value)}/></div><button className="primary" disabled={busy} onClick={createPermission}>إرسال الطلب</button></div>}<div className="table-wrap"><table><thead><tr>{['الموظف','البداية','النهاية','المدة','الحالة','السبب','إجراء'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r:any)=><tr key={r.request_id}><td>{r.employee_id}</td><td>{r.start_time}</td><td>{r.end_time}</td><td>{r.minutes} دقيقة</td><td>{r.status}</td><td>{r.reason||'—'}</td><td>{r.status==='PENDING'&&<><button className="tiny approve" onClick={async()=>{await api('decide_permission',{request_id:r.request_id,decision:'APPROVE'});location.reload()}}>اعتماد</button><button className="tiny reject" onClick={async()=>{await api('decide_permission',{request_id:r.request_id,decision:'REJECT'});location.reload()}}>رفض</button></>}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="لا توجد طلبات إذن."/>}</section>}
function Users({users,employees,projects,newUsername,setNewUsername,newPassword,setNewPassword,newRole,setNewRole,newEmployee,setNewEmployee,newProject,setNewProject,selectedManager,setSelectedManager,selectedProject,setSelectedProject,assignManager,createAccount,busy,onRefresh}:any){
  return <section className="panel page-panel">
    <div className="panel-head">
      <div><h2>حسابات المستخدمين</h2><p>إنشاء وإدارة حسابات الدخول والصلاحيات من مكان واحد.</p></div>
      <div className="panel-actions"><span className="count-pill">{employees.length} موظف متاح</span><button className="secondary" disabled={busy} onClick={onRefresh}>تحديث الموظفين</button></div>
    </div>
    <div className="request-card">
      <h3>إنشاء حساب جديد</h3>
      <div className="formgrid">
        <input placeholder="اسم المستخدم" value={newUsername} onChange={e=>setNewUsername(e.target.value)}/>
        <input type="password" placeholder="كلمة المرور" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
        <select value={newRole} onChange={e=>setNewRole(e.target.value)}>
          <option value="EMPLOYEE">موظف</option><option value="PROJECT_MANAGER">مدير مشروع</option><option value="HR_MANAGER">مدير HR</option><option value="SUPER_ADMIN">مدير النظام</option>
        </select>
        {(newRole==='EMPLOYEE'||newRole==='PROJECT_MANAGER')&&<select value={newEmployee} onChange={e=>setNewEmployee(e.target.value)}>
          <option value="">اختر الموظف المرتبط بالحساب *</option>
          {employees.map((e:Employee)=><option key={e.employee_id} value={e.employee_id}>{e.name} — {e.employee_id}</option>)}
        </select>}
        {newRole==='PROJECT_MANAGER'&&<select value={newProject} onChange={e=>setNewProject(e.target.value)}><option value="">اختر مشروع مدير المشروع *</option>{projects.map((p:Project)=><option key={p.project_id} value={p.project_id}>{p.name} — {p.project_id}</option>)}</select>}
        {newRole==='HR_MANAGER'&&<div className="empty-note">حساب HR إداري مركزي: لا يحتاج موظفاً مرتبطاً ولا يتم تعيينه على مشروع.</div>}
        {newRole==='SUPER_ADMIN'&&<div className="empty-note">حساب مدير النظام إداري مركزي: لا يحتاج موظفاً ولا مشروعاً.</div>}
      </div>
      {!employees.length&&<div className="empty-note">لا توجد سجلات موظفين محملة. اضغط «تحديث الموظفين» وتأكد أن الموظف موجود في جدول EMPLOYEES.</div>}
      <button className="primary" disabled={busy||((newRole==='EMPLOYEE'||newRole==='PROJECT_MANAGER')&&!employees.length)} onClick={createAccount}>إنشاء الحساب</button>
    </div>
    <div className="request-card"><h3>ربط مدير مشروع بمشروع</h3><p>يمكنك هنا إصلاح أو تغيير ربط حساب مدير المشروع بالمشروع، وسيتم تسجيله في PROJECT_MANAGERS فوراً.</p><div className="formgrid"><select value={selectedManager} onChange={e=>setSelectedManager(e.target.value)}><option value="">اختر مدير المشروع</option>{users.filter((u:User)=>u.role==='PROJECT_MANAGER'&&u.status==='ACTIVE').map((u:User)=><option key={u.user_id} value={u.user_id}>{u.username} — {u.employee_id||'بدون موظف'}</option>)}</select><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">اختر المشروع</option>{projects.map((p:Project)=><option key={p.project_id} value={p.project_id}>{p.name} — {p.project_id}</option>)}</select></div><button className="secondary" disabled={busy||!selectedManager||!selectedProject} onClick={assignManager}>حفظ صلاحية مدير المشروع</button></div>
    <Table headers={['اسم المستخدم','الصلاحية','الموظف','المشروع','الحالة','آخر دخول']} rows={users.map((u:User)=>{const mp=projects.find((p:Project)=>(p.managers||[]).some((m:any)=>String(m.user_id)===String(u.user_id)));return [u.username,roleLabels[u.role]||u.role,u.employee_id||'—',mp?.name||'—',u.status,u.last_login||'—']})}/>
  </section>
}
function Reports({dash,managerDash}:any){return <section className="panel page-panel"><div className="panel-head"><div><h2>التقارير</h2><p>ملخصات جاهزة للنموذج الأول من النظام.</p></div></div><div className="report-grid"><div><span>إجمالي الموظفين</span><b>{dash?.employees??0}</b></div><div><span>حضور اليوم</span><b>{dash?.present??0}</b></div><div><span>التأخير</span><b>{dash?.late??0}</b></div><div><span>حالات بدون انصراف</span><b>{dash?.missingCheckout??0}</b></div></div><div className="empty-note">آخر تحديث من الخادم: {dash?.serverTime||'—'} • يتم التحديث تلقائياً كل 15 ثانية.</div>{managerDash&&<><div className="panel-head" style={{marginTop:24}}><div><h3>تقرير فريق المشروع</h3><p>الموظفون حسب الحالة اليومية والطلبات المعلقة.</p></div></div><Table headers={['الموظف','المشروع','الحالة','حضور','انصراف']} rows={(managerDash.team||[]).map((e:any)=>[e.name,e.project_name||'—',({PRESENT:'حاضر',CHECKED_IN:'حاضر ولم ينصرف',LATE:'متأخر',ON_LEAVE:'إجازة',ABSENT:'غائب'} as any)[e.state]||e.state,e.attendance?.check_in||'—',e.attendance?.check_out||'—'])}/></>}</section>}
function Settings(){return <section className="panel page-panel"><div className="panel-head"><div><h2>إعدادات النظام</h2><p>إعدادات أساسية سيتم ربطها بجدول SETTINGS في Google Sheets.</p></div></div><div className="settings-list"><div><b>نطاق GPS</b><span>يتم التحقق من موقع الموظف عند الحضور والانصراف.</span></div><div><b>الوردية</b><span>تُحدد حسب تعيين الموظف للمشروع والتاريخ.</span></div><div><b>المنطقة الزمنية</b><span>Africa/Cairo</span></div><div><b>الأمان</b><span>الصلاحيات يتم التحقق منها في Backend وليس في الواجهة فقط.</span></div></div></section>}
function Table({headers,rows}:{headers:string[];rows:any[][]}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{String(v??'—')}</td>)}</tr>)}</tbody></table></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
