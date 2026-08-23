'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Employee={employee_id:string;name:string;job_title?:string;department?:string;phone?:string;status?:string;project_id?:string};
type Project={project_id:string;name:string;client?:string;location_name?:string;latitude?:number|string;longitude?:number|string;geofence_radius_m?:number|string;status?:string;project_manager_id?:string};
type User={user_id:string;employee_id:string;username:string;role:string;status:string;last_login?:string;created_at?:string};
type Row=Record<string,any>;

const roleLabels:Record<string,string>={SUPER_ADMIN:'مدير النظام',HR_MANAGER:'مدير الموارد البشرية',PROJECT_MANAGER:'مدير مشروع',SITE_SUPERVISOR:'مشرف موقع',EMPLOYEE:'موظف'};
const navByRole=(role:string)=>[
 {id:'dashboard',label:'لوحة التحكم',icon:'⌂'},
 {id:'employees',label:'الموظفون',icon:'♙',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'projects',label:'المشاريع',icon:'▦',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'attendance',label:'الحضور والانصراف',icon:'◷'},
 {id:'leaves',label:'الإجازات',icon:'▤'},
 {id:'permissions',label:'الأذونات',icon:'◉'},
 {id:'deductions',label:'الخصومات',icon:'−',roles:['SUPER_ADMIN','HR_MANAGER']},
 {id:'users',label:'حسابات المستخدمين',icon:'♙',roles:['SUPER_ADMIN']},
 {id:'reports',label:'التقارير',icon:'▥',roles:['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER']},
 {id:'settings',label:'إعدادات النظام',icon:'⚙',roles:['SUPER_ADMIN']},
].filter(x=>!x.roles||x.roles.includes(role));

export default function Home(){
 const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const [me,setMe]=useState<any>(null); const [dash,setDash]=useState<any>(null); const [section,setSection]=useState('dashboard'); const [sidebar,setSidebar]=useState(false);
 const [users,setUsers]=useState<User[]>([]); const [employees,setEmployees]=useState<Employee[]>([]); const [projects,setProjects]=useState<Project[]>([]); const [rows,setRows]=useState<Row[]>([]); const [notice,setNotice]=useState('');
 const [newUsername,setNewUsername]=useState(''); const [newPassword,setNewPassword]=useState(''); const [newRole,setNewRole]=useState('EMPLOYEE'); const [newEmployee,setNewEmployee]=useState('');
 const [employeeForm,setEmployeeForm]=useState<any>({name:'',job_title:'',department:'',phone:'',national_id:'',birth_date:'',hire_date:'',project_id:''});
 const [projectForm,setProjectForm]=useState<any>({name:'',client:'',location_name:'',latitude:'',longitude:'',geofence_radius_m:'200'});
 const [selectedEmployee,setSelectedEmployee]=useState(''); const [selectedProject,setSelectedProject]=useState(''); const [selectedManager,setSelectedManager]=useState('');
 const [leaveType,setLeaveType]=useState('Annual'); const [leaveFrom,setLeaveFrom]=useState(''); const [leaveTo,setLeaveTo]=useState(''); const [leaveReason,setLeaveReason]=useState('');
 const [permissionType,setPermissionType]=useState('Permission'); const [permissionStart,setPermissionStart]=useState(''); const [permissionEnd,setPermissionEnd]=useState(''); const [permissionReason,setPermissionReason]=useState('');
 useEffect(()=>{if(localStorage.getItem('hr_token'))load();},[]);
 async function load(){
  const token=localStorage.getItem('hr_token');
  if(!token){setMe(null);return;}
  setError('');
  try{
    const m:any=await api('me');
    setMe(m);
    try{setDash(await api('dashboard'));}catch(e:any){setError(e.message||'تعذر تحميل لوحة التحكم');}
    if(['SUPER_ADMIN','HR_MANAGER','PROJECT_MANAGER'].includes(m.user?.role)){
      try{setEmployees(await api('employees'));}catch(e:any){setError(e.message||'تعذر تحميل الموظفين');}
      try{setProjects(await api('projects'));}catch(e:any){setError(e.message||'تعذر تحميل المشاريع');}
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
      const [freshUsers,freshEmployees]=await Promise.all([api<User[]>('users'),api<Employee[]>('employees')]);
      setUsers(freshUsers||[]);
      setEmployees(freshEmployees||[]);
      setNewEmployee(current => (current && (freshEmployees||[]).some(e=>String(e.employee_id)===String(current))) ? current : '');
    }
    if(id==='employees') setEmployees(await api('employees'));
    if(id==='projects') setProjects(await api('projects'));
  }catch(e:any){
    setError(e.message||'تعذر تحديث البيانات');
  }
}
 function openSection(id:string){setSection(id);setNotice(''); setSidebar(false); if(id!=='dashboard')refreshSection(id)}
 async function createEmployee(){
  setBusy(true);setError('');setNotice('');
  try{const e:any=await api('create_employee',employeeForm);setNotice(`تم تسجيل الموظف ${e.name} وتعيينه على المشروع بنجاح`);setEmployeeForm({name:'',job_title:'',department:'',phone:'',national_id:'',birth_date:'',hire_date:'',project_id:''});setEmployees(await api('employees'));setProjects(await api('projects'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function createProject(){
  setBusy(true);setError('');setNotice('');
  try{const p:any=await api('create_project',projectForm);setNotice(`تم إنشاء المشروع ${p.name} بنجاح`);setProjectForm({name:'',client:'',location_name:'',latitude:'',longitude:'',geofence_radius_m:'200'});setProjects(await api('projects'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function assignProject(){
  setBusy(true);setError('');setNotice('');
  try{await api('assign_employee_project',{employee_id:selectedEmployee,project_id:selectedProject});setNotice('تم نقل الموظف إلى المشروع بنجاح');setSelectedEmployee('');setSelectedProject('');setEmployees(await api('employees'));}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function assignManager(){
  setBusy(true);setError('');setNotice('');
  try{await api('assign_manager_project',{user_id:selectedManager,project_id:selectedProject});setNotice('تم ربط مدير المشروع بالمشروع');}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function createAccount(){setNotice('');setError('');if(!newUsername||!newPassword)return setError('أدخل اسم المستخدم وكلمة المرور');if(newRole==='EMPLOYEE'&&!newEmployee)return setError('اختر الموظف المرتبط بالحساب');setBusy(true);try{await api('create_user',{username:newUsername,password:newPassword,role:newRole,employee_id:newEmployee,status:'ACTIVE'});setNotice('تم إنشاء الحساب بنجاح');setNewUsername('');setNewPassword('');setNewEmployee('');setNewRole('EMPLOYEE');setUsers(await api('users'));}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function createLeave(){setBusy(true);setError('');try{await api('create_leave',{leave_type_id:leaveType,from_date:leaveFrom,to_date:leaveTo,reason:leaveReason});setNotice('تم إرسال طلب الإجازة');setLeaveFrom('');setLeaveTo('');setLeaveReason('');}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function createPermission(){setBusy(true);setError('');try{await api('create_permission',{date:permissionStart.slice(0,10),start_time:permissionStart,end_time:permissionEnd,reason:permissionReason});setNotice('تم إرسال طلب الإذن');setPermissionStart('');setPermissionEnd('');setPermissionReason('');}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 const nav=useMemo(()=>navByRole(me?.user?.role||'EMPLOYEE'),[me?.user?.role]);
 if(!me)return <main className="login-page" dir="rtl"><div className="login-shell"><div className="login-brand"><div className="brand-mark">N</div><div><b>ELNUBY HR</b><span>نظام إدارة موارد بشرية للمشروعات</span></div></div><section className="login-card"><div className="eyebrow">دخول آمن</div><h1>مرحباً بك</h1><p>أدخل بيانات حسابك للوصول إلى لوحة التحكم.</p><label>اسم المستخدم</label><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="abdullah"/><label>كلمة المرور</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&login()}/><button className="primary full" disabled={busy} onClick={login}>{busy?'جاري التحقق…':'تسجيل الدخول'}</button>{error&&<div className="alert danger">{error}</div>}</section><small className="login-footer">ELNUBY HR • Site Workforce Management</small></div></main>;
 return <main className="app" dir="rtl"><div className={`mobile-backdrop ${sidebar?'visible':''}`} onClick={()=>setSidebar(false)} aria-hidden="true"/><aside className={`sidebar ${sidebar?'open':''}`}><div className="side-brand"><div className="brand-mark">N</div><div><b>ELNUBY HR</b><small>WORKFORCE</small></div></div><div className="profile-mini"><div className="avatar">{(me.employee?.name||me.user?.username||'U').slice(0,1)}</div><div><strong>{me.employee?.name||me.user?.username}</strong><span>{roleLabels[me.user?.role]||me.user?.role}</span></div></div><nav>{nav.map(n=><button key={n.id} className={section===n.id?'active':''} onClick={()=>openSection(n.id)}><i>{n.icon}</i><span>{n.label}</span></button>)}</nav><div className="side-bottom"><div className="secure">● النظام متصل</div><button className="logout" onClick={()=>{localStorage.removeItem('hr_token');location.reload()}}>تسجيل الخروج</button></div></aside><section className="workspace"><header className="topbar"><div className="top-left"><button className="menu" onClick={()=>setSidebar(v=>!v)}>☰</button><div><strong>{nav.find(n=>n.id===section)?.label||'لوحة التحكم'}</strong><small>ELNUBY Construction • HR Management</small></div></div><div className="top-actions"><span className="date">{new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span><div className="avatar top-avatar">{(me.employee?.name||me.user?.username||'U').slice(0,1)}</div></div></header><div className="content">
 {section==='dashboard'&&<Dashboard me={me} dash={dash} roleLabels={roleLabels} locate={locate} busy={busy} setSection={openSection} />}
 {section==='employees'&&<Employees employees={employees} projects={projects} employeeForm={employeeForm} setEmployeeForm={setEmployeeForm} createEmployee={createEmployee} selectedEmployee={selectedEmployee} setSelectedEmployee={setSelectedEmployee} selectedProject={selectedProject} setSelectedProject={setSelectedProject} assignProject={assignProject} busy={busy} />}
 {section==='projects'&&<Projects projects={projects} projectForm={projectForm} setProjectForm={setProjectForm} createProject={createProject} busy={busy} />}
 {section==='attendance'&&<DataSection title="سجل الحضور والانصراف" subtitle="متابعة الحضور وتعديلات السجلات" rows={rows} type="attendance" />}
 {section==='leaves'&&<LeaveSection rows={rows} role={me.user?.role} employeeMode={me.user?.role==='EMPLOYEE'} leaveType={leaveType} setLeaveType={setLeaveType} leaveFrom={leaveFrom} setLeaveFrom={setLeaveFrom} leaveTo={leaveTo} setLeaveTo={setLeaveTo} leaveReason={leaveReason} setLeaveReason={setLeaveReason} createLeave={createLeave} busy={busy} />}
 {section==='permissions'&&<PermissionSection rows={rows} employeeMode={me.user?.role==='EMPLOYEE'} permissionType={permissionType} setPermissionType={setPermissionType} permissionStart={permissionStart} setPermissionStart={setPermissionStart} permissionEnd={permissionEnd} setPermissionEnd={setPermissionEnd} permissionReason={permissionReason} setPermissionReason={setPermissionReason} createPermission={createPermission} busy={busy} />}
 {section==='deductions'&&<DataSection title="الخصومات" subtitle="بيانات إدارية خاصة بالإدارة فقط" rows={rows} type="deductions" />}
 {section==='users'&&<Users users={users} employees={employees} newUsername={newUsername} setNewUsername={setNewUsername} newPassword={newPassword} setNewPassword={setNewPassword} newRole={newRole} setNewRole={setNewRole} newEmployee={newEmployee} setNewEmployee={setNewEmployee} createAccount={createAccount} busy={busy} onRefresh={()=>refreshSection('users')} />}
 {section==='reports'&&<Reports dash={dash} />}
 {section==='settings'&&<Settings />}
 {error&&<div className="alert danger global-alert">{error}</div>}{notice&&<div className="alert success global-alert">{notice}</div>}
 </div></section></main>
}

function Dashboard({me,dash,roleLabels,locate,busy,setSection}:any){return <><div className="welcome"><div><div className="eyebrow">SITE HR CONTROL CENTER</div><h1>صباح الخير، {me.employee?.name||me.user?.username} 👋</h1><p>إليك ملخص حالة القوى العاملة اليوم.</p></div><div className="welcome-role"><span>الصلاحية</span><b>{roleLabels[me.user?.role]||me.user?.role}</b></div></div><div className="kpis"><Kpi title="إجمالي الموظفين" value={dash?.employees??0} icon="♙"/><Kpi title="حضور اليوم" value={dash?.present??0} icon="✓"/><Kpi title="متأخرون" value={dash?.late??0} icon="◷"/><Kpi title="بدون انصراف" value={dash?.missingCheckout??0} icon="!" danger/></div><div className="dashboard-grid"><section className="panel attendance-panel"><div className="panel-head"><div><h2>الحضور والانصراف</h2><p>التسجيل متاح حسب الوردية وموقع المشروع.</p></div><span className="live"><b/> LIVE</span></div><div className="attendance-actions"><button className="attendance-btn in" disabled={busy} onClick={()=>locate('check_in')}><span>↘</span><b>تسجيل الحضور</b><small>GPS • موقع المشروع</small></button><button className="attendance-btn out" disabled={busy} onClick={()=>locate('check_out')}><span>↗</span><b>تسجيل الانصراف</b><small>GPS • موقع المشروع</small></button></div><div className="quick-links"><button onClick={()=>setSection('leaves')}>طلب إجازة <span>←</span></button><button onClick={()=>setSection('permissions')}>طلب إذن <span>←</span></button><button onClick={()=>setSection('attendance')}>عرض السجل <span>←</span></button></div></section><section className="panel today-panel"><div className="panel-head"><div><h2>ملخص اليوم</h2><p>نظرة سريعة على الموقع.</p></div></div><div className="today-row"><span>حاضر</span><strong>{dash?.present??0}</strong></div><div className="today-row"><span>متأخر</span><strong>{dash?.late??0}</strong></div><div className="today-row"><span>بدون انصراف</span><strong>{dash?.missingCheckout??0}</strong></div><div className="today-row"><span>إجمالي الموظفين</span><strong>{dash?.employees??0}</strong></div></section></div></>}
function Kpi({title,value,icon,danger}:{title:string;value:any;icon:string;danger?:boolean}){return <div className={`kpi ${danger?'danger-kpi':''}`}><div className="kpi-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div><em>اليوم</em></div>}
function Employees({employees,projects,employeeForm,setEmployeeForm,createEmployee,selectedEmployee,setSelectedEmployee,selectedProject,setSelectedProject,assignProject,busy}:{employees:Employee[];projects:Project[];employeeForm:any;setEmployeeForm:any;createEmployee:()=>void;selectedEmployee:string;setSelectedEmployee:any;selectedProject:string;setSelectedProject:any;assignProject:()=>void;busy:boolean}){
 return <section className="panel page-panel">
  <div className="panel-head"><div><h2>الموظفون</h2><p>إدارة ملفات الموظفين وتعيين المشروع الحالي.</p></div><span className="count-pill">{employees.length} موظف</span></div>
  <div className="request-card"><h3>إضافة موظف جديد</h3><p>سيتم إنشاء ملف الموظف وتعيينه على المشروع المختار في نفس العملية.</p>
   <div className="formgrid">
    <input placeholder="الاسم بالكامل *" value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})}/>
    <input placeholder="الوظيفة *" value={employeeForm.job_title} onChange={e=>setEmployeeForm({...employeeForm,job_title:e.target.value})}/>
    <input placeholder="القسم" value={employeeForm.department} onChange={e=>setEmployeeForm({...employeeForm,department:e.target.value})}/>
    <input placeholder="رقم الهاتف" value={employeeForm.phone} onChange={e=>setEmployeeForm({...employeeForm,phone:e.target.value})}/>
    <input placeholder="الرقم القومي" value={employeeForm.national_id} onChange={e=>setEmployeeForm({...employeeForm,national_id:e.target.value})}/>
    <input type="date" title="تاريخ الميلاد" value={employeeForm.birth_date} onChange={e=>setEmployeeForm({...employeeForm,birth_date:e.target.value})}/>
    <input type="date" title="تاريخ التعيين" value={employeeForm.hire_date} onChange={e=>setEmployeeForm({...employeeForm,hire_date:e.target.value})}/>
    <select value={employeeForm.project_id} onChange={e=>setEmployeeForm({...employeeForm,project_id:e.target.value})}><option value="">اختر المشروع الحالي *</option>{projects.map(p=><option key={p.project_id} value={p.project_id}>{p.name} — {p.project_id}</option>)}</select>
   </div>
   <button className="primary" disabled={busy||!projects.length} onClick={createEmployee}>{!projects.length?'أضف مشروعًا أولاً':'تسجيل الموظف وتعيين المشروع'}</button>
  </div>
  <div className="request-card"><h3>نقل موظف إلى مشروع آخر</h3><div className="formgrid"><select value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}><option value="">اختر الموظف</option>{employees.map(e=><option key={e.employee_id} value={e.employee_id}>{e.name} — {e.employee_id}</option>)}</select><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">اختر المشروع</option>{projects.map(p=><option key={p.project_id} value={p.project_id}>{p.name}</option>)}</select></div><button className="secondary" disabled={busy||!selectedEmployee||!selectedProject} onClick={assignProject}>حفظ التعيين</button></div>
  <Table headers={['الرقم','الاسم','الوظيفة','القسم','الحالة']} rows={employees.map(e=>[e.employee_id,e.name,e.job_title||'—',e.department||'—',e.status||'ACTIVE'])}/>
  {!employees.length&&<Empty text="لا يوجد موظفون حتى الآن."/>}
 </section>
}
function Projects({projects,projectForm,setProjectForm,createProject,busy}:{projects:Project[];projectForm:any;setProjectForm:any;createProject:()=>void;busy:boolean}){
 return <section className="panel page-panel">
  <div className="panel-head"><div><h2>المشاريع</h2><p>إنشاء وإدارة مواقع المشاريع وإحداثيات الـ GPS ونطاق الحضور.</p></div><span className="count-pill">{projects.length} مشروع</span></div>
  <div className="request-card"><h3>إضافة مشروع جديد</h3><div className="formgrid">
   <input placeholder="اسم المشروع *" value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})}/>
   <input placeholder="العميل" value={projectForm.client} onChange={e=>setProjectForm({...projectForm,client:e.target.value})}/>
   <input placeholder="اسم الموقع" value={projectForm.location_name} onChange={e=>setProjectForm({...projectForm,location_name:e.target.value})}/>
   <input type="number" step="any" placeholder="Latitude *" value={projectForm.latitude} onChange={e=>setProjectForm({...projectForm,latitude:e.target.value})}/>
   <input type="number" step="any" placeholder="Longitude *" value={projectForm.longitude} onChange={e=>setProjectForm({...projectForm,longitude:e.target.value})}/>
   <input type="number" placeholder="نطاق GPS بالمتر" value={projectForm.geofence_radius_m} onChange={e=>setProjectForm({...projectForm,geofence_radius_m:e.target.value})}/>
  </div><button className="primary" disabled={busy} onClick={createProject}>إنشاء المشروع</button></div>
  <div className="project-cards">{projects.map(p=><div className="project-card" key={p.project_id}><div className="project-icon">▦</div><div><h3>{p.name||p.project_id}</h3><p>{p.location_name||'الموقع غير محدد'} {p.client?`• ${p.client}`:''}</p><span>{p.status||'ACTIVE'} • GPS {p.latitude}, {p.longitude} • {p.geofence_radius_m||200}m</span></div></div>)}</div>
  {!projects.length&&<Empty text="لا توجد مشاريع مسجلة حتى الآن. أضف أول مشروع من النموذج أعلاه."/>}
 </section>
}
function DataSection({title,subtitle,rows,type}:{title:string;subtitle:string;rows:Row[];type:string}){const headers=type==='attendance'?['الموظف','التاريخ','الحضور','الانصراف','الحالة','المشروع']:['الموظف','التاريخ','النوع','القيمة','السبب','الحالة'];const mapped=rows.map(r=>type==='attendance'?[r.employee_id,r.date,r.check_in||'—',r.check_out||'—',r.status||'—',r.project_id||'—']:[r.employee_id,r.date,r.deduction_type||r.type||'—',r.amount??'—',r.reason||'—',r.status||'—']);return <section className="panel page-panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div><Table headers={headers} rows={mapped}/>{!rows.length&&<Empty text="لا توجد بيانات لعرضها حالياً."/>}</section>}
function LeaveSection({rows,role,employeeMode,leaveType,setLeaveType,leaveFrom,setLeaveFrom,leaveTo,setLeaveTo,leaveReason,setLeaveReason,createLeave,busy}:any){const manager=role==='PROJECT_MANAGER';const hr=role==='HR_MANAGER'||role==='SUPER_ADMIN';return <section className="panel page-panel"><div className="panel-head"><div><h2>الإجازات</h2><p>مسار الاعتماد: الموظف ← مدير المشروع ← الموارد البشرية.</p></div></div>{employeeMode&&<div className="request-card"><h3>طلب إجازة جديد</h3><div className="formgrid"><select value={leaveType} onChange={e=>setLeaveType(e.target.value)}><option value="LT-ANNUAL">سنوية</option><option value="LT-CASUAL">عارضة</option><option value="LT-SICK">مرضية</option><option value="LT-UNPAID">بدون أجر</option><option value="LT-OTHER">أخرى</option></select><input type="date" value={leaveFrom} onChange={e=>setLeaveFrom(e.target.value)}/><input type="date" value={leaveTo} onChange={e=>setLeaveTo(e.target.value)}/><input placeholder="سبب الإجازة" value={leaveReason} onChange={e=>setLeaveReason(e.target.value)}/></div><button className="primary" disabled={busy} onClick={createLeave}>إرسال الطلب</button></div>}<div className="table-wrap"><table><thead><tr>{['الموظف','النوع','من','إلى','الحالة','السبب','إجراء'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r:any)=><tr key={r.request_id}><td>{r.employee_id}</td><td>{r.leave_type_id}</td><td>{r.from_date}</td><td>{r.to_date}</td><td>{r.status}</td><td>{r.reason||'—'}</td><td>{(manager&&r.status==='PENDING_MANAGER')&&<button className="tiny approve" onClick={async()=>{await api('decide_leave_manager',{request_id:r.request_id,decision:'APPROVE'});location.reload()}}>اعتماد</button>}{(manager&&r.status==='PENDING_MANAGER')&&<button className="tiny reject" onClick={async()=>{await api('decide_leave_manager',{request_id:r.request_id,decision:'REJECT'});location.reload()}}>رفض</button>}{(hr&&r.status==='PENDING_HR')&&<button className="tiny approve" onClick={async()=>{await api('decide_leave_hr',{request_id:r.request_id,decision:'APPROVE'});location.reload()}}>اعتماد HR</button>}{(hr&&r.status==='PENDING_HR')&&<button className="tiny reject" onClick={async()=>{await api('decide_leave_hr',{request_id:r.request_id,decision:'REJECT'});location.reload()}}>رفض</button>}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="لا توجد طلبات إجازة."/>}</section>}
function PermissionSection({rows,employeeMode,permissionType,setPermissionType,permissionStart,setPermissionStart,permissionEnd,setPermissionEnd,permissionReason,setPermissionReason,createPermission,busy}:any){return <section className="panel page-panel"><div className="panel-head"><div><h2>الأذونات</h2><p>طلبات الأذونات تمر إلى مدير المشروع للموافقة.</p></div></div>{employeeMode&&<div className="request-card"><h3>طلب إذن جديد</h3><div className="formgrid"><input value={permissionType} onChange={e=>setPermissionType(e.target.value)} placeholder="نوع الإذن"/><input type="datetime-local" value={permissionStart} onChange={e=>setPermissionStart(e.target.value)}/><input type="datetime-local" value={permissionEnd} onChange={e=>setPermissionEnd(e.target.value)}/><input placeholder="السبب" value={permissionReason} onChange={e=>setPermissionReason(e.target.value)}/></div><button className="primary" disabled={busy} onClick={createPermission}>إرسال الطلب</button></div>}<div className="table-wrap"><table><thead><tr>{['الموظف','البداية','النهاية','المدة','الحالة','السبب','إجراء'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r:any)=><tr key={r.request_id}><td>{r.employee_id}</td><td>{r.start_time}</td><td>{r.end_time}</td><td>{r.minutes} دقيقة</td><td>{r.status}</td><td>{r.reason||'—'}</td><td>{r.status==='PENDING'&&<><button className="tiny approve" onClick={async()=>{await api('decide_permission',{request_id:r.request_id,decision:'APPROVE'});location.reload()}}>اعتماد</button><button className="tiny reject" onClick={async()=>{await api('decide_permission',{request_id:r.request_id,decision:'REJECT'});location.reload()}}>رفض</button></>}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="لا توجد طلبات إذن."/>}</section>}
function Users({users,employees,newUsername,setNewUsername,newPassword,setNewPassword,newRole,setNewRole,newEmployee,setNewEmployee,createAccount,busy,onRefresh}:any){
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
        <select value={newEmployee} onChange={e=>setNewEmployee(e.target.value)}>
          <option value="">اختر الموظف المرتبط بالحساب</option>
          {employees.map((e:Employee)=><option key={e.employee_id} value={e.employee_id}>{e.name} — {e.employee_id}</option>)}
        </select>
      </div>
      {!employees.length&&<div className="empty-note">لا توجد سجلات موظفين محملة. اضغط «تحديث الموظفين» وتأكد أن الموظف موجود في جدول EMPLOYEES.</div>}
      <button className="primary" disabled={busy||!employees.length} onClick={createAccount}>إنشاء الحساب</button>
    </div>
    <Table headers={['اسم المستخدم','الصلاحية','الموظف','الحالة','آخر دخول']} rows={users.map((u:User)=>[u.username,roleLabels[u.role]||u.role,u.employee_id||'—',u.status,u.last_login||'—'])}/>
  </section>
}
function Reports({dash}:any){return <section className="panel page-panel"><div className="panel-head"><div><h2>التقارير</h2><p>ملخصات جاهزة للنموذج الأول من النظام.</p></div></div><div className="report-grid"><div><span>إجمالي الموظفين</span><b>{dash?.employees??0}</b></div><div><span>حضور اليوم</span><b>{dash?.present??0}</b></div><div><span>التأخير</span><b>{dash?.late??0}</b></div><div><span>حالات بدون انصراف</span><b>{dash?.missingCheckout??0}</b></div></div><div className="empty-note">سنضيف تصدير Excel/PDF وتقارير شهرية حسب المشروع والموظف في المرحلة التالية.</div></section>}
function Settings(){return <section className="panel page-panel"><div className="panel-head"><div><h2>إعدادات النظام</h2><p>إعدادات أساسية سيتم ربطها بجدول SETTINGS في Google Sheets.</p></div></div><div className="settings-list"><div><b>نطاق GPS</b><span>يتم التحقق من موقع الموظف عند الحضور والانصراف.</span></div><div><b>الوردية</b><span>تُحدد حسب تعيين الموظف للمشروع والتاريخ.</span></div><div><b>المنطقة الزمنية</b><span>Africa/Cairo</span></div><div><b>الأمان</b><span>الصلاحيات يتم التحقق منها في Backend وليس في الواجهة فقط.</span></div></div></section>}
function Table({headers,rows}:{headers:string[];rows:any[][]}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{String(v??'—')}</td>)}</tr>)}</tbody></table></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
