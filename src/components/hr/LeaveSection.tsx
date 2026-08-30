'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge, ConfirmDialog, DetailsDrawer, FormField, SectionHeader } from './common';

type Props={rows:any[];role:string;employeeMode:boolean;leaveType:string;setLeaveType:(v:string)=>void;leaveFrom:string;setLeaveFrom:(v:string)=>void;leaveTo:string;setLeaveTo:(v:string)=>void;leaveReason:string;setLeaveReason:(v:string)=>void;createLeave:(document?:File)=>void;busy:boolean};
const leaveTypes=[
 {value:'LT-ANNUAL',label:'إجازة سنوية',desc:'إجازة دورية من الرصيد السنوي'},
 {value:'LT-CASUAL',label:'إجازة عارضة',desc:'غياب قصير لظرف طارئ أو شخصي'},
 {value:'LT-SICK',label:'إجازة مرضية',desc:'تحتاج مستندًا طبيًا عند طلبه'},
 {value:'LT-UNPAID',label:'إجازة بدون أجر',desc:'لا تخصم من الرصيد السنوي'}
];
function daysInclusive(a:string,b:string){if(!a||!b)return 0;const s=new Date(`${a}T00:00:00`),e=new Date(`${b}T00:00:00`);if(e<s)return 0;return Math.floor((e.getTime()-s.getTime())/86400000)+1}

export default function LeaveSection(props:Props){
 const {rows,role,employeeMode,leaveType,setLeaveType,leaveFrom,setLeaveFrom,leaveTo,setLeaveTo,leaveReason,setLeaveReason,createLeave,busy}=props;
 const [medicalDocument,setMedicalDocument]=useState<File|null>(null),[balances,setBalances]=useState<any[]>([]),[selected,setSelected]=useState<any|null>(null),[rejecting,setRejecting]=useState<any|null>(null),[comment,setComment]=useState('');
 const [me,setMe]=useState<any>(null),[employees,setEmployees]=useState<any[]>([]),[projects,setProjects]=useState<any[]>([]),[query,setQuery]=useState(''),[status,setStatus]=useState('ALL'),[notice,setNotice]=useState('');
 const manager=role==='PROJECT_MANAGER'||role==='SECTOR_MANAGER',hr=role==='HR_MANAGER'||role==='SYSTEM_ADMIN';
 useEffect(()=>setBalances([]),[employeeMode]);
 useEffect(()=>{setTimeout(()=>{},0); if(employeeMode){api<any[]>('leave_balances').then(setBalances).catch(()=>setBalances([]))}},[employeeMode]);
 useEffect(()=>{let active=true;(async()=>{try{const mine=await api<any>('me');if(active)setMe(mine);if(['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'].includes(mine?.user?.role)){const [es,ps]=await Promise.all([api<any[]>('employees').catch(()=>[]),api<any[]>('projects').catch(()=>[])]);if(active){setEmployees(Array.isArray(es)?es:[]);setProjects(Array.isArray(ps)?ps:[]);}}}catch(e){console.error('leave details',e)}})();return()=>{active=false}},[rows]);
 const localRows=Array.isArray(rows)?rows:[];
 const displayRows=useMemo(()=>{const em=new Map(employees.map(e=>[String(e.employee_id),e]));const pm=new Map(projects.map(p=>[String(p.project_id),p]));return localRows.map(r=>{const e=em.get(String(r.employee_id));const p=pm.get(String(r.project_id));return {...r,employee_name:r.employee_name||e?.name||r.employee_id,job_title:r.job_title||r.employee_job_title||e?.job_title,department:r.department||r.employee_department||e?.department,project_name:r.project_name||p?.name||r.project_id}})},[localRows,employees,projects]);
 const filtered=useMemo(()=>displayRows.filter(r=>{const hit=!query||String(r.employee_name||'').includes(query)||String(r.employee_id||'').includes(query)||String(r.leave_type_name||'').includes(query);const st=status==='ALL'||String(r.status)===status;return hit&&st}),[displayRows,query,status]);
 const requestedDays=daysInclusive(leaveFrom,leaveTo); const type=leaveTypes.find(x=>x.value===leaveType)||leaveTypes[0];
 const selectedBalance=balances.find((b:any)=>b.leave_type_id===leaveType||b.leave_types?.leave_type_id===leaveType);
 async function decide(action:'decide_leave_manager'|'decide_leave_hr',id:string,decision:'APPROVE'|'REJECT',reason=''){
  try{await api(action,{request_id:id,decision,comment:reason||undefined});setNotice(decision==='APPROVE'?'تم اعتماد طلب الإجازة بنجاح':'تم رفض طلب الإجازة بنجاح');setSelected(null);setRejecting(null);setComment('');setTimeout(()=>setNotice(''),2600)}catch(e:any){setNotice(e?.message||'تعذر تنفيذ القرار')}}
 return <section className="panel page-panel hr-leave">
  <div className="panel-head"><div><span className="eyebrow">إدارة الإجازات</span><h2>الإجازات</h2><p>إنشاء الطلبات ومراجعتها واعتمادها مع متابعة الرصيد ومسار القرار.</p></div><span className="count-pill">{filtered.length} طلب</span></div>
  {notice&&<div className="alert success page-alert">{notice}</div>}
  {employeeMode&&<div className="smart-form leave-form">
   <div className="smart-form-title"><div><span>طلب إجازة جديد</span><h3>ابدأ بتحديد نوع الإجازة والفترة</h3></div><span className="form-step">1 من 3</span></div>
   <div className="leave-type-grid">{leaveTypes.map(x=><button type="button" key={x.value} className={`leave-type-card ${leaveType===x.value?'selected':''}`} onClick={()=>{setLeaveType(x.value);setMedicalDocument(null)}}><strong>{x.label}</strong><small>{x.desc}</small></button>)}</div>
   <div className="ui-form-grid leave-fields"><FormField label="من" required><input type="date" value={leaveFrom} onChange={e=>setLeaveFrom(e.target.value)}/></FormField><FormField label="إلى" required><input type="date" value={leaveTo} min={leaveFrom||undefined} onChange={e=>setLeaveTo(e.target.value)}/></FormField><FormField label="سبب الإجازة" required><input value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} placeholder="اكتب سببًا واضحًا"/></FormField>{leaveType==='LT-SICK'&&<FormField label="المستند الطبي" required help="PDF أو صورة — حتى 10 ميجابايت"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setMedicalDocument(e.target.files?.[0]||null)}/></FormField>}</div>
   <div className="leave-review"><div><span>نوع الإجازة</span><b>{type.label}</b></div><div><span>مدة الطلب</span><b>{requestedDays?`${requestedDays} يوم`:'—'}</b></div><div><span>الرصيد المتاح</span><b>{selectedBalance?.remaining??'غير متاح'}</b></div>{selectedBalance?.remaining!==undefined&&requestedDays>0&&<div><span>الرصيد بعد الطلب</span><b>{Math.max(0,Number(selectedBalance.remaining)-requestedDays)} يوم</b></div>}</div>
   <div className="form-actions"><button className="primary" disabled={busy||!leaveFrom||!leaveTo||requestedDays<1||!String(leaveReason||'').trim()||(leaveType==='LT-SICK'&&!medicalDocument)} onClick={()=>createLeave(medicalDocument||undefined)}>{busy?'جاري الإرسال...':'مراجعة وإرسال الطلب'}</button></div>
  </div>}
  <div className="filters-panel"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم الموظف أو نوع الإجازة"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">كل الحالات</option><option value="PENDING_MANAGER">بانتظار المدير</option><option value="PENDING_HR">بانتظار الموارد البشرية</option><option value="APPROVED">معتمد</option><option value="REJECTED">مرفوض</option></select><button className="secondary" onClick={()=>{setQuery('');setStatus('ALL')}}>مسح</button></div>
  <SectionHeader title="طلبات الإجازات" subtitle="اضغط على الطلب لعرض الرصيد ومسار الاعتماد والمستندات." count={<span className="count-pill">{filtered.length}</span>}/>
  {!filtered.length?<Empty text="لا توجد طلبات إجازة تطابق البحث الحالي."/>:<div className="request-list leave-list">{filtered.map(r=><article className="request-item" key={r.request_id} onClick={()=>setSelected(r)}><div className="request-main"><div className="request-avatar leave-avatar">{String(r.employee_name||'م').slice(0,1)}</div><div><strong>{r.employee_name||r.employee_id}</strong><span>{r.leave_type_name||r.leave_type_id||'إجازة'} • {r.from_date||'—'} إلى {r.to_date||'—'}</span><small>{r.days??'—'} يوم • الرصيد بعد الطلب: {r.leave_balance?.remaining??'غير متاح'}</small></div></div><div className="request-side"><Badge status={r.status}/><span className="request-arrow">عرض</span></div></article>)}</div>}

  <DetailsDrawer open={!!selected} title="تفاصيل طلب الإجازة" subtitle={selected?.request_id} onClose={()=>setSelected(null)} footer={selected&&(manager&&selected.status==='PENDING_MANAGER')?<><button className="reject-action" onClick={()=>setRejecting(selected)}>رفض الطلب</button><button className="primary" onClick={()=>void decide('decide_leave_manager',selected.request_id,'APPROVE')}>اعتماد المدير</button></>:selected&&(hr&&selected.status==='PENDING_HR')?<><button className="reject-action" onClick={()=>setRejecting(selected)}>رفض الطلب</button><button className="primary" onClick={()=>void decide('decide_leave_hr',selected.request_id,'APPROVE')}>اعتماد الموارد البشرية</button></>:<button className="secondary" onClick={()=>setSelected(null)}>إغلاق</button>}>
   {selected&&<div className="drawer-stack">
     <div className="drawer-status"><span>الحالة الحالية</span><Badge status={selected.status}/></div>
     <div className="detail-grid">
       <div><span>الموظف</span><strong>{selected.employee_name||selected.employee_id}</strong></div>
       <div><span>الوظيفة</span><strong>{selected.job_title||'—'}</strong></div>
       <div><span>القسم</span><strong>{selected.department||'—'}</strong></div>
       <div><span>المشروع</span><strong>{selected.project_name||'—'}</strong></div>
       <div><span>النوع</span><strong>{selected.leave_type_name||selected.leave_type_id||'—'}</strong></div>
       <div><span>المدة</span><strong>{selected.days??'—'} يوم</strong></div>
       <div><span>من</span><strong>{selected.from_date||'—'}</strong></div>
       <div><span>إلى</span><strong>{selected.to_date||'—'}</strong></div>
       <div><span>الرصيد المتبقي</span><strong>{selected.leave_balance?.remaining??'غير متاح'}</strong></div>
     </div>
     <div className="approval-timeline">
       <div className="timeline-title">مسار الاعتماد</div>
       <div className="timeline-step done"><i/>تم إنشاء الطلب</div>
       <div className={`timeline-step ${selected.status==='PENDING_MANAGER'?'current':''} ${['PENDING_HR','APPROVED','REJECTED'].includes(selected.status)?'done':''}`}><i/>مدير المشروع</div>
       <div className={`timeline-step ${selected.status==='PENDING_HR'?'current':''} ${['APPROVED','REJECTED'].includes(selected.status)?'done':''}`}><i/>إدارة الموارد البشرية</div>
       <div className={`timeline-step ${selected.status==='APPROVED'?'done':''}`}><i/>اعتماد نهائي</div>
     </div>
     {selected.reason&&<div className="detail-note"><span>السبب</span><p>{selected.reason}</p></div>}
     {selected.document_required&&<div className="detail-actions"><button className="secondary" onClick={async()=>{try{const d=await api<any>('leave_document',{request_id:selected.request_id});window.open(d.signed_url,'_blank','noopener,noreferrer')}catch(e:any){setNotice(e.message||'تعذر فتح المستند')}}}>فتح المستند المؤيد</button></div>}
   </div>}
  </DetailsDrawer>
  <ConfirmDialog open={!!rejecting} title="رفض طلب الإجازة" description="يجب تسجيل سبب الرفض قبل إنهاء الطلب." confirmText="رفض الطلب" danger busy={busy} onClose={()=>{setRejecting(null);setComment('')}} onConfirm={()=>rejecting&&void decide(manager?'decide_leave_manager':'decide_leave_hr',rejecting.request_id,'REJECT',comment)}><FormField label="سبب الرفض" required><textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} placeholder="اكتب سبب الرفض"/></FormField></ConfirmDialog>
 </section>
}
