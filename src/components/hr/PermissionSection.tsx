'use client';
import { useMemo, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge, ConfirmDialog, DetailsDrawer, FormField, SectionHeader } from './common';

const permissionTypes = [
  {value:'GENERAL',label:'إذن شخصي',desc:'لسبب شخصي خلال ساعات العمل'},
  {value:'MEDICAL',label:'إذن طبي',desc:'موعد أو مراجعة طبية'},
  {value:'EMERGENCY',label:'إذن طارئ',desc:'ظرف طارئ يستدعي المغادرة'},
  {value:'OFFICIAL',label:'إذن رسمي',desc:'مهمة أو إجراء رسمي'},
  {value:'MISSION',label:'مأمورية',desc:'مغادرة لأداء مهمة عمل'},
];

function minutesBetween(start:string,end:string){
  if(!start||!end)return 0;
  const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);
  if(![sh,sm,eh,em].every(Number.isFinite))return 0;
  return (eh*60+em)-(sh*60+sm);
}
function durationText(min:number){if(min<=0)return '—';const h=Math.floor(min/60),m=min%60;return h?`${h} ساعة${m?` و ${m} دقيقة`:''}`:`${m} دقيقة`}

export default function PermissionSection({rows,employeeMode,permissionType,setPermissionType,permissionStart,setPermissionStart,permissionEnd,setPermissionEnd,permissionReason, setPermissionReason,createPermission,busy}:any){
  const [localRows,setLocalRows]=useState<any[]>(Array.isArray(rows)?rows:[]);
  const [selected,setSelected]=useState<any|null>(null);
  const [rejecting,setRejecting]=useState<any|null>(null);
  const [comment,setComment]=useState('');
  const [notice,setNotice]=useState('');
  const [query,setQuery]=useState(''); const [status,setStatus]=useState('ALL');
  useEffect(()=>setLocalRows(Array.isArray(rows)?rows:[]),[rows]);

  const filtered=useMemo(()=>localRows.filter(r=>{
    const hit=!query||String(r.employee_id||'').includes(query)||String(r.permission_type||'').includes(query)||String(r.reason||'').includes(query);
    const st=status==='ALL'||String(r.status)===status; return hit&&st;
  }),[localRows,query,status]);

  async function decide(requestId:string,decision:'APPROVE'|'REJECT',reason=''){
    try{
      await api('decide_permission',{request_id:requestId,decision,comment:reason||undefined});
      setLocalRows(prev=>prev.map(r=>r.request_id===requestId?{...r,status:decision==='APPROVE'?'APPROVED':'REJECTED',manager_comment:reason||r.manager_comment}:r));
      setSelected(null); setRejecting(null); setComment('');
      setNotice(decision==='APPROVE'?'تم اعتماد طلب الإذن بنجاح':'تم رفض طلب الإذن بنجاح');
      setTimeout(()=>setNotice(''),2600);
    }catch(error:any){setNotice(error?.message||'تعذر تنفيذ القرار')}
  }

  const min=minutesBetween(String(permissionStart||''),String(permissionEnd||''));
  const chosen=permissionTypes.find(x=>x.value===permissionType)||permissionTypes[0];

  return <section className="panel page-panel permission-page">
    <div className="panel-head permission-head"><div><span className="eyebrow">إدارة الأذونات</span><h2>الأذونات</h2><p>طلب الإذن، متابعة الحالة، والموافقة من مكان واحد.</p></div><span className="count-pill">{filtered.length} طلب</span></div>
    {notice&&<div className="alert success page-alert">{notice}</div>}

    {employeeMode&&<div className="smart-form permission-form">
      <div className="smart-form-title"><div><span>طلب إذن جديد</span><h3>حدد نوع الإذن والفترة</h3></div><span className="form-step">طلب جديد</span></div>
      <div className="permission-type-grid">{permissionTypes.map(x=><button type="button" key={x.value} className={`permission-type ${permissionType===x.value?'selected':''}`} onClick={()=>setPermissionType(x.value)}><strong>{x.label}</strong><small>{x.desc}</small></button>)}</div>
      <div className="ui-form-grid">
        <FormField label="بداية الإذن" required><input type="datetime-local" value={permissionStart} onChange={e=>setPermissionStart(e.target.value)}/></FormField>
        <FormField label="نهاية الإذن" required><input type="datetime-local" value={permissionEnd} onChange={e=>setPermissionEnd(e.target.value)}/></FormField>
        <FormField label="سبب الإذن" required><input value={permissionReason} onChange={e=>setPermissionReason(e.target.value)} placeholder="اكتب سببًا واضحًا"/></FormField>
      </div>
      <div className="form-summary"><div><span>نوع الإذن</span><b>{chosen.label}</b></div><div><span>المدة</span><b>{durationText(min)}</b></div><div><span>الحالة بعد الإرسال</span><b>بانتظار اعتماد المسؤول</b></div></div>
      <div className="form-actions"><button className="primary" disabled={busy||!permissionStart||!permissionEnd||min<=0||!String(permissionReason||'').trim()} onClick={createPermission}>{busy?'جاري الإرسال...':'إرسال طلب الإذن'}</button></div>
    </div>}

    <div className="filters-panel"><div className="filter-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بالموظف أو السبب"/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">كل الحالات</option><option value="PENDING">بانتظار الاعتماد</option><option value="APPROVED">معتمد</option><option value="REJECTED">مرفوض</option></select><button className="secondary" onClick={()=>{setQuery('');setStatus('ALL')}}>مسح</button></div>

    <SectionHeader title="سجل الطلبات" subtitle="اضغط على أي طلب لعرض التفاصيل والإجراءات المتاحة." count={<span className="count-pill">{filtered.length} طلب</span>}/>
    {!filtered.length?<Empty text="لا توجد طلبات إذن تطابق البحث الحالي."/>:<div className="request-list permission-list">{filtered.map(r=><article key={r.request_id} className="request-item" onClick={()=>setSelected(r)}>
      <div className="request-main"><div className="request-avatar">{String(r.employee_id||'م').slice(0,1)}</div><div><strong>{r.employee_name||r.employee_id||'موظف'}</strong><span>{permissionTypes.find(x=>x.value===r.permission_type)?.label||r.permission_type||'إذن شخصي'} • {r.date||'—'}</span><small>{r.start_time||'—'} — {r.end_time||'—'} • {r.minutes?durationText(Number(r.minutes)):'—'}</small></div></div>
      <div className="request-side"><Badge status={r.status}/><span className="request-arrow">عرض</span></div>
    </article>)}</div>}

    <DetailsDrawer open={!!selected} title="تفاصيل طلب الإذن" subtitle={selected?.request_id} onClose={()=>setSelected(null)} footer={selected?.status==='PENDING'?<><button className="reject-action" onClick={()=>setRejecting(selected)}>رفض الطلب</button><button className="primary" onClick={()=>void decide(selected.request_id,'APPROVE')}>اعتماد الطلب</button></>:<button className="secondary" onClick={()=>setSelected(null)}>إغلاق</button>}>
      {selected&&<div className="drawer-stack"><div className="drawer-status"><span>الحالة</span><Badge status={selected.status}/></div><div className="detail-grid"><div><span>الموظف</span><strong>{selected.employee_name||selected.employee_id||'—'}</strong></div><div><span>نوع الإذن</span><strong>{permissionTypes.find(x=>x.value===selected.permission_type)?.label||selected.permission_type||'—'}</strong></div><div><span>التاريخ</span><strong>{selected.date||'—'}</strong></div><div><span>البداية</span><strong>{selected.start_time||'—'}</strong></div><div><span>النهاية</span><strong>{selected.end_time||'—'}</strong></div><div><span>المدة</span><strong>{selected.minutes?durationText(Number(selected.minutes)):'—'}</strong></div></div><div className="detail-note"><span>السبب</span><p>{selected.reason||'لا يوجد سبب مسجل.'}</p></div>{selected.manager_comment&&<div className="detail-note"><span>ملاحظة المسؤول</span><p>{selected.manager_comment}</p></div>}</div>}
    </DetailsDrawer>

    <ConfirmDialog open={!!rejecting} title="رفض طلب الإذن" description="اكتب سبب الرفض حتى يتم توضيح القرار للموظف." confirmText="رفض الطلب" danger busy={busy} onClose={()=>{setRejecting(null);setComment('')}} onConfirm={()=>rejecting&&void decide(rejecting.request_id,'REJECT',comment)}>
      <FormField label="سبب الرفض" required><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="سبب واضح ومختصر" rows={4}/></FormField>
    </ConfirmDialog>
  </section>
}
