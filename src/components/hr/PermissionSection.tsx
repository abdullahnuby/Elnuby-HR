import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge } from './common';

const PERMISSION_TYPES = [
  ['PERSONAL', 'إذن شخصي'],
  ['LATE_ARRIVAL', 'تأخر عن الدوام'],
  ['EARLY_EXIT', 'انصراف مبكر'],
  ['MEDICAL', 'موعد/حالة طبية'],
  ['SITE_TASK', 'مهمة خارج الموقع'],
  ['OTHER', 'أخرى'],
];
const TYPE_LABELS = Object.fromEntries(PERMISSION_TYPES);

export default function PermissionSection({ rows, employeeMode, permissionType, setPermissionType, permissionStart, setPermissionStart, permissionEnd, setPermissionEnd, permissionReason, setPermissionReason, createPermission, busy, role }: any) {
  const [localRows, setLocalRows] = useState(rows);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ request: any; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  useEffect(() => setLocalRows(rows), [rows]);

  const filtered = useMemo(() => localRows.filter((r: any) => {
    const q = query.trim().toLowerCase();
    return (statusFilter === 'ALL' || r.status === statusFilter) && (!q || `${r.employee_id} ${r.reason || ''} ${TYPE_LABELS[r.permission_type] || r.permission_type || ''}`.toLowerCase().includes(q));
  }), [localRows, statusFilter, query]);
  const stats = useMemo(() => ({total:localRows.length,pending:localRows.filter((r:any)=>r.status==='PENDING').length,approved:localRows.filter((r:any)=>r.status==='APPROVED').length,rejected:localRows.filter((r:any)=>r.status==='REJECTED').length}),[localRows]);
  const duration = permissionStart && permissionEnd ? Math.max(0, Math.round((new Date(permissionEnd).getTime() - new Date(permissionStart).getTime()) / 60000)) : 0;

  async function refresh(){ try{setLocalRows(await api<any[]>('permission_list',{}));}catch{} }
  function openDecision(request:any, decision:'APPROVE'|'REJECT'){ setDecisionComment(''); setDecisionModal({request,decision}); }
  async function submitDecision(){
    if(!decisionModal)return;
    if(decisionModal.decision==='REJECT' && decisionComment.trim().length<3){ window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:'سبب الرفض مطلوب (3 أحرف على الأقل)',type:'error'}})); return; }
    try{setDecisionBusy(true); await api('decide_permission',{request_id:decisionModal.request.request_id,decision:decisionModal.decision,comment:decisionComment.trim()}); await refresh(); setDetail(null); setDecisionModal(null); window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:decisionModal.decision==='APPROVE'?'تم اعتماد الإذن بنجاح':'تم رفض الإذن'}}));}
    catch(e:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message||'تعذر تنفيذ القرار',type:'error'}}));}
    finally{setDecisionBusy(false);}
  }
  async function cancel(requestId:string){
    const reason=window.prompt('اكتب سبب إلغاء الإذن:'); if(reason===null)return;
    try{setCancelBusy(requestId);await api('cancel_permission',{request_id:requestId,reason});await refresh();setDetail(null);window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:'تم إلغاء طلب الإذن'}}));}
    catch(e:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message||'تعذر إلغاء الطلب',type:'error'}}));}finally{setCancelBusy(null)}
  }

  return <section className="panel page-panel hr-workflow-panel">
    <div className="panel-head"><div><div className="eyebrow">إدارة الأذونات</div><h2>الأذونات</h2><p>إذن شخصي، تأخر، انصراف مبكر أو مهمة خارج الموقع مع مدة واضحة ومسار اعتماد.</p></div><span className="count-pill">{stats.total} طلب</span></div>
    <div className="hr-request-stats"><div><span>الإجمالي</span><strong>{stats.total}</strong></div><div><span>قيد المراجعة</span><strong>{stats.pending}</strong></div><div><span>معتمد</span><strong>{stats.approved}</strong></div><div><span>مرفوض</span><strong>{stats.rejected}</strong></div></div>
    {employeeMode&&<div className="request-card hr-request-composer"><div className="hr-request-composer-head"><div><h3>إنشاء طلب إذن</h3><p>حدد التاريخ والوقت بدقة. المدة تُحسب تلقائيًا.</p></div><span className="live">طلب جديد</span></div><div className="hr-leave-form-grid"><label><span>نوع الإذن</span><select value={permissionType} onChange={(e)=>setPermissionType(e.target.value)}>{PERMISSION_TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label><span>البداية</span><input type="datetime-local" value={permissionStart} onChange={(e)=>setPermissionStart(e.target.value)}/></label><label><span>النهاية</span><input type="datetime-local" min={permissionStart || undefined} value={permissionEnd} onChange={(e)=>setPermissionEnd(e.target.value)}/></label><label className="wide"><span>السبب</span><textarea rows={2} placeholder="اكتب سببًا واضحًا" value={permissionReason} onChange={(e)=>setPermissionReason(e.target.value)}/></label></div><div className="hr-leave-preview"><div><span>المدة</span><strong>{duration} دقيقة</strong></div><div><span>الحالة</span><strong>سيُرسل للاعتماد</strong></div></div><button className="primary" disabled={busy || !permissionType || !permissionStart || !permissionEnd || duration<=0} onClick={createPermission}>{busy?'جاري الإرسال...':'إرسال طلب الإذن'}</button></div>}
    <div className="hr-list-toolbar"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="بحث في الطلبات"/><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="ALL">كل الحالات</option><option value="PENDING">قيد المراجعة</option><option value="APPROVED">معتمد</option><option value="REJECTED">مرفوض</option><option value="CANCELLED">ملغي</option></select></div>
    <div className="table-wrap"><table><thead><tr>{['الموظف','النوع','التاريخ','الوقت','المدة','الحالة','السبب','إجراء'].map((h)=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map((r:any)=><tr key={r.request_id}><td>{r.employee_id}</td><td>{TYPE_LABELS[r.permission_type]||r.permission_type||'إذن'}</td><td>{r.date}</td><td><span className="time-value">{r.start_time} → {r.end_time}</span></td><td><strong>{r.minutes}</strong> دقيقة</td><td><Badge status={r.status}/></td><td>{r.reason||'—'}</td><td><div className="table-actions"><button className="table-action" onClick={()=>setDetail(r)}>التفاصيل</button>{role&&['PROJECT_MANAGER','SECTOR_MANAGER'].includes(role)&&r.status==='PENDING'&&<><button className="table-action" onClick={()=>openDecision(r,'APPROVE')}>اعتماد</button><button className="table-action danger" onClick={()=>openDecision(r,'REJECT')}>رفض</button></>}{employeeMode&&r.status==='PENDING'&&<button className="table-action danger" disabled={cancelBusy===r.request_id} onClick={()=>void cancel(r.request_id)}>{cancelBusy===r.request_id?'جاري الإلغاء':'إلغاء'}</button>}</div></td></tr>)}</tbody></table></div>
    {!filtered.length&&<Empty text="لا توجد طلبات تطابق الفلاتر الحالية."/>}
    {detail&&<div className="hr-modal-backdrop" onClick={()=>setDetail(null)}><div className="hr-modal" onClick={(e)=>e.stopPropagation()}><div className="hr-modal-head"><div><span className="eyebrow">تفاصيل الإذن</span><h3>{TYPE_LABELS[detail.permission_type]||detail.permission_type||'طلب إذن'}</h3></div><button onClick={()=>setDetail(null)}>×</button></div><div className="hr-detail-grid"><div><span>الموظف</span><strong>{detail.employee_id}</strong></div><div><span>التاريخ</span><strong>{detail.date}</strong></div><div><span>الفترة</span><strong>{detail.start_time} → {detail.end_time}</strong></div><div><span>المدة</span><strong>{detail.minutes} دقيقة</strong></div><div><span>الحالة</span><strong><Badge status={detail.status}/></strong></div><div><span>السبب</span><strong>{detail.reason||'—'}</strong></div></div>{detail.manager_comment&&<div className="hr-comment"><b>ملاحظة المدير</b><p>{detail.manager_comment}</p></div>}{detail.cancellation_reason&&<div className="hr-comment danger"><b>سبب الإلغاء</b><p>{detail.cancellation_reason}</p></div>}</div></div>}

    {decisionModal&&<div className="hr-modal-backdrop" onClick={()=>!decisionBusy&&setDecisionModal(null)}><div className="hr-modal hr-decision-modal" onClick={(e)=>e.stopPropagation()}><div className="hr-modal-head"><div><span className="eyebrow">مراجعة المدير</span><h3>{decisionModal.decision==='APPROVE'?'اعتماد طلب الإذن':'رفض طلب الإذن'}</h3></div><button disabled={decisionBusy} onClick={()=>setDecisionModal(null)}>×</button></div><div className="hr-decision-summary"><div><span>الموظف</span><strong>{decisionModal.request.employee_name||decisionModal.request.employee_id}</strong></div><div><span>نوع الإذن</span><strong>{TYPE_LABELS[decisionModal.request.permission_type]||decisionModal.request.permission_type||'إذن'}</strong></div><div><span>التاريخ</span><strong>{decisionModal.request.date}</strong></div><div><span>الوقت</span><strong>{decisionModal.request.start_time} → {decisionModal.request.end_time}</strong></div><div><span>المدة</span><strong>{decisionModal.request.minutes} دقيقة</strong></div><div><span>المشروع</span><strong>{decisionModal.request.project_name||decisionModal.request.project_id||'—'}</strong></div></div><div className="hr-decision-reason"><span>سبب الطلب</span><p>{decisionModal.request.reason||'لم يذكر الموظف سببًا.'}</p></div><label className="hr-decision-field"><span>{decisionModal.decision==='REJECT'?'سبب الرفض *':'ملاحظة القرار'}</span><textarea rows={4} autoFocus value={decisionComment} onChange={(e)=>setDecisionComment(e.target.value)} placeholder={decisionModal.decision==='REJECT'?'اكتب سبب الرفض بوضوح ليظهر للموظف...':'اكتب ملاحظة القرار (اختياري)...'}/></label><div className="hr-decision-actions"><button className="table-action" disabled={decisionBusy} onClick={()=>setDecisionModal(null)}>إلغاء</button><button className={decisionModal.decision==='REJECT'?'table-action danger hr-primary-decision':'table-action hr-primary-decision'} disabled={decisionBusy||(decisionModal.decision==='REJECT'&&decisionComment.trim().length<3)} onClick={()=>void submitDecision()}>{decisionBusy?'جاري التنفيذ...':decisionModal.decision==='REJECT'?'تأكيد الرفض':'تأكيد الاعتماد'}</button></div></div></div>}
  </section>;
}
