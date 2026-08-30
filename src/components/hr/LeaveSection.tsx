'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge } from './common';

type Props={rows:any[];role:string;employeeMode:boolean;leaveType:string;setLeaveType:(v:string)=>void;leaveFrom:string;setLeaveFrom:(v:string)=>void;leaveTo:string;setLeaveTo:(v:string)=>void;leaveReason:string;setLeaveReason:(v:string)=>void;createLeave:(document?:File)=>void;busy:boolean};

const LEAVE_TYPES = [
  ['LT-ANNUAL','سنوية','الإجازة السنوية'],
  ['LT-CASUAL','عارضة','إجازة قصيرة لأسباب شخصية'],
  ['LT-SICK','مرضية','تحتاج مستندًا طبيًا'],
  ['LT-UNPAID','بدون أجر','إجازة غير مدفوعة'],
] as const;
const leaveTypeLabel = Object.fromEntries(LEAVE_TYPES.map(([v,l])=>[v,l]));

function formatDate(value?:string){
  if(!value)return '—';
  const d=new Date(`${value}T00:00:00`);
  if(Number.isNaN(d.getTime()))return value;
  return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric'}).format(d);
}
function calcDays(from:string,to:string){
  if(!from||!to)return 0;
  const a=new Date(`${from}T00:00:00`),b=new Date(`${to}T00:00:00`);
  const ms=b.getTime()-a.getTime();
  return Number.isFinite(ms)&&ms>=0 ? Math.floor(ms/86400000)+1 : 0;
}

export default function LeaveSection({rows,role,employeeMode,leaveType,setLeaveType,leaveFrom,setLeaveFrom,leaveTo,setLeaveTo,leaveReason,setLeaveReason,createLeave,busy}:Props){
  const [medicalDocument,setMedicalDocument]=useState<File|null>(null);
  const [balances,setBalances]=useState<any[]>([]);
  const [localRows,setLocalRows]=useState<any[]>(Array.isArray(rows)?rows:[]);
  const [employees,setEmployees]=useState<any[]>([]);
  const [projects,setProjects]=useState<any[]>([]);
  const [selected,setSelected]=useState<any|null>(null);
  const [rejecting,setRejecting]=useState(false);
  const [rejectReason,setRejectReason]=useState('');
  const [formError,setFormError]=useState('');
  const manager=role==='PROJECT_MANAGER'||role==='SECTOR_MANAGER';
  const hr=role==='HR_MANAGER'||role==='SYSTEM_ADMIN';

  useEffect(()=>setLocalRows(Array.isArray(rows)?rows:[]),[rows]);
  useEffect(()=>{if(!employeeMode)return;void api<any[]>('leave_balances').then(v=>setBalances(Array.isArray(v)?v:[])).catch(()=>setBalances([]));},[employeeMode]);
  useEffect(()=>{let active=true;(async()=>{try{const [es,ps]=await Promise.all([api<any[]>('employees'),api<any[]>('projects')]);if(active){setEmployees(Array.isArray(es)?es:[]);setProjects(Array.isArray(ps)?ps:[]);}}catch{if(active){setEmployees([]);setProjects([])}}})();return()=>{active=false}},[]);

  const employeeMap=useMemo(()=>new Map(employees.map(e=>[String(e.employee_id),e])),[employees]);
  const projectMap=useMemo(()=>new Map(projects.map(p=>[String(p.project_id),p])),[projects]);
  const displayRows=useMemo(()=>localRows.map(r=>({...r,employee_name:r.employee_name||employeeMap.get(String(r.employee_id))?.name||r.employee_id,job_title:r.job_title||employeeMap.get(String(r.employee_id))?.job_title,department:r.department||employeeMap.get(String(r.employee_id))?.department,project_name:r.project_name||projectMap.get(String(r.project_id))?.name||r.project_id})),[localRows,employeeMap,projectMap]);
  const requestedDays=calcDays(leaveFrom,leaveTo);
  const selectedBalance=balances.find(b=>String(b.leave_type_id)===String(leaveType));
  const remaining=Number(selectedBalance?.remaining ?? 0);
  const afterBalance=selectedBalance ? remaining-requestedDays : null;

  async function decide(action:'decide_leave_manager'|'decide_leave_hr',requestId:string,decision:'APPROVE'|'REJECT',comment?:string){
    try{await api(action,{request_id:requestId,decision,comment:comment||undefined});setLocalRows(prev=>prev.map(r=>r.request_id===requestId?{...r,status:action==='decide_leave_hr'?(decision==='APPROVE'?'APPROVED':'REJECTED'):(decision==='APPROVE'?'PENDING_HR':'REJECTED'),manager_comment:comment||r.manager_comment}:r));setSelected(null);setRejecting(false);setRejectReason('');window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:decision==='APPROVE'?'تم اعتماد طلب الإجازة':'تم رفض طلب الإجازة'}}));}
    catch(error:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:error?.message||'تعذر تنفيذ القرار',type:'error'}}));}
  }
  function submit(){setFormError('');if(!leaveFrom||!leaveTo)return setFormError('حدد بداية ونهاية الإجازة.');if(requestedDays<=0)return setFormError('الفترة المحددة غير صحيحة.');if(!leaveReason.trim())return setFormError('اكتب سبب الإجازة.');if(leaveType==='LT-SICK'&&!medicalDocument)return setFormError('الإجازة المرضية تحتاج مستندًا طبيًا.');if(selectedBalance&&afterBalance!<0)return setFormError('الرصيد المتاح لا يكفي لمدة الإجازة.');createLeave(medicalDocument||undefined);}

  return <section className="panel page-panel hr-leave">
    <div className="panel-head"><div><div className="eyebrow">إدارة الإجازات</div><h2>الإجازات</h2><p>اطلب إجازتك بسهولة أو راجع واعتمد طلبات فريقك من مكان واحد.</p></div><span className="count-pill">{displayRows.length} طلب</span></div>

    {employeeMode&&<div className="request-card hr-leave-form">
      <div className="request-card-headline"><div><h3>طلب إجازة جديد</h3><p>سيحسب النظام مدة الإجازة والرصيد المتوقع قبل الإرسال.</p></div></div>
      <div className="permission-type-grid leave-type-grid">{LEAVE_TYPES.map(([value,label,note])=><button type="button" key={value} className={`permission-type-option ${leaveType===value?'active':''}`} onClick={()=>{setLeaveType(value);setMedicalDocument(null)}}><strong>{label}</strong><span>{note}</span></button>)}</div>
      <div className="formgrid permission-form-grid"><label><span>من</span><input type="date" value={leaveFrom} onChange={e=>setLeaveFrom(e.target.value)}/></label><label><span>إلى</span><input type="date" value={leaveTo} onChange={e=>setLeaveTo(e.target.value)}/></label><label className="wide"><span>السبب</span><textarea rows={3} value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} placeholder="اكتب سبب الإجازة"/></label>{leaveType==='LT-SICK'&&<label className="wide"><span>المستند الطبي *</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setMedicalDocument(e.target.files?.[0]||null)}/><small>الحد الأقصى 10 ميجابايت</small></label>}</div>
      <div className="leave-balance-strip leave-summary-strip"><div><span>مدة الطلب</span><strong>{requestedDays} {requestedDays===1?'يوم':'أيام'}</strong></div><div><span>الرصيد الحالي</span><strong>{selectedBalance?`${remaining} يوم`:'غير متاح'}</strong></div><div><span>الرصيد بعد الطلب</span><strong className={afterBalance!==null&&afterBalance<0?'text-danger':''}>{afterBalance===null?'—':`${afterBalance} يوم`}</strong></div></div>
      {formError&&<div className="inline-form-error">{formError}</div>}
      <button className="primary" disabled={busy} onClick={submit}>{busy?'جاري الإرسال...':'إرسال طلب الإجازة'}</button>
    </div>}

    {!employeeMode&&<div className="table-toolbar"><div className="table-toolbar-title"><strong>طلبات الإجازات</strong><span>اضغط على الطلب لعرض التفاصيل ومسار الاعتماد.</span></div><span className="table-toolbar-count">{displayRows.length} طلب</span></div>}

    <div className="leave-request-list">{displayRows.map(r=><article className="leave-request-card" key={r.request_id} onClick={()=>setSelected(r)}>
      <div className="leave-request-main"><div className="permission-person"><div className="avatar-letter">{String(r.employee_name||'م').slice(0,1)}</div><div><strong>{r.employee_name}</strong><span>{r.employee_id||'—'}{r.department?` · ${r.department}`:''}</span></div></div><div><strong>{leaveTypeLabel[String(r.leave_type_id)]||r.leave_type_name||'إجازة'}</strong><span>{formatDate(r.from_date)} — {formatDate(r.to_date)}</span></div><div className="leave-duration"><strong>{r.days??calcDays(r.from_date,r.to_date)}</strong><span>يوم</span></div><div><span className="muted-label">الرصيد</span><strong>{r.leave_balance?.remaining??'—'}</strong></div><Badge status={r.status}/><button type="button" className="table-action" onClick={e=>{e.stopPropagation();setSelected(r)}}>التفاصيل</button></div>
      {r.reason&&<p className="permission-request-reason">{r.reason}</p>}
    </article>)}</div>
    {!displayRows.length&&<Empty text="لا توجد طلبات إجازة."/>}

    {selected&&<div className="request-drawer-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><aside className="request-drawer leave-drawer" role="dialog" aria-modal="true"><div className="request-drawer-head"><div><span>تفاصيل طلب الإجازة</span><h2>{selected.employee_name||selected.employee_id}</h2><small>{selected.request_id}</small></div><button className="icon-close" onClick={()=>setSelected(null)} aria-label="إغلاق">×</button></div>
      <div className="request-status-banner"><span>الحالة الحالية</span><Badge status={selected.status}/></div>
      <div className="request-detail-grid"><div><span>نوع الإجازة</span><strong>{leaveTypeLabel[String(selected.leave_type_id)]||selected.leave_type_name||'إجازة'}</strong></div><div><span>المشروع</span><strong>{selected.project_name||selected.project_id||'غير محدد'}</strong></div><div><span>من</span><strong>{formatDate(selected.from_date)}</strong></div><div><span>إلى</span><strong>{formatDate(selected.to_date)}</strong></div><div><span>المدة</span><strong>{selected.days??calcDays(selected.from_date,selected.to_date)} يوم</strong></div><div><span>الرصيد</span><strong>{selected.leave_balance?.remaining??'غير متاح'}</strong></div><div className="wide"><span>السبب</span><strong>{selected.reason||'لم يُذكر سبب'}</strong></div></div>
      <div className="approval-timeline"><div className="approval-step done"><i/><div><strong>إنشاء الطلب</strong><span>تم إرسال الطلب</span></div></div><div className={`approval-step ${selected.status!=='PENDING_MANAGER'?'done':''}`}><i/><div><strong>اعتماد المدير</strong><span>{selected.status==='PENDING_MANAGER'?'في انتظار القرار':'تمت معالجة المرحلة'}</span></div></div><div className={`approval-step ${['APPROVED','REJECTED'].includes(selected.status)?'done':''}`}><i/><div><strong>اعتماد الموارد البشرية</strong><span>{selected.status==='PENDING_HR'?'في انتظار الموارد البشرية':selected.status==='APPROVED'?'تم الاعتماد':'لم تكتمل المرحلة'}</span></div></div></div>
      {selected.manager_comment&&<div className="request-comment"><span>ملاحظة القرار</span><p>{selected.manager_comment}</p></div>}
      <div className="request-drawer-footer">{((manager&&selected.status==='PENDING_MANAGER')||(hr&&selected.status==='PENDING_HR'))?<><button className="primary" onClick={()=>void decide(hr&&selected.status==='PENDING_HR'?'decide_leave_hr':'decide_leave_manager',selected.request_id,'APPROVE')}>اعتماد الطلب</button><button className="danger-outline" onClick={()=>setRejecting(true)}>رفض الطلب</button></>:<button className="secondary" onClick={()=>setSelected(null)}>إغلاق</button>}</div>
    </aside></div>}

    {rejecting&&selected&&<div className="confirm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setRejecting(false)}}><div className="confirm-dialog"><div className="confirm-dialog-icon danger">!</div><h3>رفض طلب الإجازة</h3><p>اكتب سبب الرفض ليظهر للموظف ويحفظ ضمن سجل الطلب.</p><textarea rows={4} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="سبب الرفض *" autoFocus/><div className="confirm-dialog-actions"><button className="secondary" onClick={()=>setRejecting(false)}>إلغاء</button><button className="danger" disabled={!rejectReason.trim()} onClick={()=>void decide(hr&&selected.status==='PENDING_HR'?'decide_leave_hr':'decide_leave_manager',selected.request_id,'REJECT',rejectReason.trim())}>تأكيد الرفض</button></div></div></div>}
  </section>;
}
