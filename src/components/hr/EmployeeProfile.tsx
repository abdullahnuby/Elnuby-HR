import { useEffect, useState } from 'react';
import type { Employee } from './types';
import { api } from '@/lib/api';
import { Badge, Empty } from './common';

export default function EmployeeProfile({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [event, setEvent] = useState({ event_type: 'OTHER', title: '', description: '', effective_date: new Date().toISOString().slice(0,10) });
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [docType, setDocType] = useState('NATIONAL_ID');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docIssue, setDocIssue] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [docNotes, setDocNotes] = useState('');

  async function load() {
    try { setBusy(true); setError(''); const [p,d] = await Promise.all([api<any>('employee_profile', { employee_id: employeeId }), api<any>('employee_documents', { employee_id: employeeId })]); setProfile(p); setDocuments(d.documents||[]); setRequirements(d.requirements||[]); }
    catch (e:any) { setError(e.message || 'تعذر تحميل ملف الموظف'); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [employeeId]);

  async function uploadDocument() {
    if (!docFile) return setError('اختر المستند أولًا');
    try {
      setSaving(true); setError('');
      const form = new FormData();
      form.append('action','upload_employee_document'); form.append('employee_id',employeeId); form.append('document_type',docType);
      form.append('issue_date',docIssue); form.append('expiry_date',docExpiry); form.append('notes',docNotes); form.append('document',docFile);
      const res = await fetch('/api/hr',{method:'POST',credentials:'include',cache:'no-store',body:form});
      const data = await res.json(); if(!res.ok || !data.ok) throw new Error(data.error||'تعذر رفع المستند');
      setDocFile(null); setDocIssue(''); setDocExpiry(''); setDocNotes(''); await load();
    } catch(e:any) { setError(e.message||'تعذر حفظ المستند'); } finally { setSaving(false); }
  }

  async function openDocument(id:string) {
    try { const d=await api<any>('employee_document_url',{document_id:id}); window.open(d.signed_url,'_blank','noopener,noreferrer'); } catch(e:any) { setError(e.message||'تعذر فتح المستند'); }
  }

  async function deleteDocument(id:string) {
    if(!window.confirm('هل تريد حذف هذا المستند؟')) return;
    try { setSaving(true); await api('delete_employee_document',{document_id:id}); await load(); } catch(e:any) { setError(e.message||'تعذر حذف المستند'); } finally { setSaving(false); }
  }

  async function addEvent() {
    if (!event.title.trim()) return setError('وصف الحدث الوظيفي مطلوب');
    try { setSaving(true); setError(''); await api('add_employment_event', { employee_id: employeeId, ...event }); setEvent({ ...event, title:'', description:'' }); await load(); }
    catch (e:any) { setError(e.message || 'تعذر حفظ الحدث'); }
    finally { setSaving(false); }
  }

  if (busy) return <div className="profile-drawer"><div className="profile-drawer-card"><div className="panel-head"><h2>ملف الموظف</h2><button className="secondary" onClick={onClose}>إغلاق</button></div><div className="state-card">جاري تحميل ملف الموظف...</div></div></div>;
  if (!profile) return <div className="profile-drawer"><div className="profile-drawer-card"><div className="panel-head"><h2>ملف الموظف</h2><button className="secondary" onClick={onClose}>إغلاق</button></div><div className="state-card error-state">{error || 'تعذر تحميل الملف'}</div></div></div>;
  const e: Employee = profile.employee;
  const safeEvents = Array.isArray(profile?.events) ? profile.events : [];
  const safeAssignments = Array.isArray(profile?.assignments) ? profile.assignments : [];
  const safeShifts = Array.isArray(profile?.shifts) ? profile.shifts : [];
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const safeRequirements = Array.isArray(requirements) ? requirements : [];
  return <div className="profile-drawer" role="dialog" aria-modal="true">
    <div className="profile-drawer-card">
      <div className="profile-drawer-head"><div><span className="eyebrow">ملف الموارد البشرية</span><h2>{e.name}</h2><p>{e.job_title || 'بدون وظيفة محددة'} — {e.employee_id}</p></div><button className="secondary" onClick={onClose}>إغلاق</button></div>
      {error && <div className="state-card error-state">{error}</div>}
      <div className="profile-stat-grid">
        <div><span>القسم</span><strong>{e.department || '—'}</strong></div><div><span>الهاتف</span><strong>{e.phone || '—'}</strong></div><div><span>الرقم القومي</span><strong>{e.national_id || '—'}</strong></div><div><span>تاريخ التعيين</span><strong>{e.hire_date || '—'}</strong></div><div><span>نوع الإقامة</span><strong>{e.residency_type === 'EXPATRIATE' ? 'مغترب' : 'مقيم'}</strong></div><div><span>الحالة</span><strong><Badge status={e.status || 'ACTIVE'} /></strong></div>
      </div>
      <div className="profile-section"><div className="section-title"><div><h3>المسار الوظيفي</h3><p>تاريخ التغييرات والقرارات المرتبطة بالموظف</p></div></div>
        <div className="timeline">{safeEvents.length ? safeEvents.map((x:any)=><div className="timeline-item" key={x.event_id}><i/><div><strong>{x.title}</strong><span>{x.event_type} — {x.effective_date}</span>{x.description && <p>{x.description}</p>}</div></div>) : <Empty text="لا توجد أحداث وظيفية مسجلة."/>}</div>
        <div className="event-form"><select value={event.event_type} onChange={e=>setEvent({...event,event_type:e.target.value})}><option value="HIRE">تعيين</option><option value="TRANSFER">نقل</option><option value="PROMOTION">ترقية</option><option value="JOB_CHANGE">تغيير وظيفة</option><option value="PROJECT_ASSIGNMENT">تعيين مشروع</option><option value="SHIFT_CHANGE">تغيير وردية</option><option value="TERMINATION">إنهاء خدمة</option><option value="OTHER">أخرى</option></select><input value={event.title} onChange={e=>setEvent({...event,title:e.target.value})} placeholder="وصف الحدث"/><input type="date" value={event.effective_date} onChange={e=>setEvent({...event,effective_date:e.target.value})}/><textarea value={event.description} onChange={e=>setEvent({...event,description:e.target.value})} placeholder="ملاحظات أو سبب التغيير"/><button className="primary" disabled={saving} onClick={addEvent}>{saving ? 'جاري الحفظ...' : 'إضافة للسجل الوظيفي'}</button></div>
      </div>
      <div className="profile-section employee-documents-section"><div className="section-title"><div><h3>مستندات الموظف</h3><p>المستندات الرسمية وتواريخ انتهائها وحالتها</p></div></div>
        <div className="document-upload-form"><select value={docType} onChange={e=>setDocType(e.target.value)}>{safeRequirements.map(r=><option key={r.document_type} value={r.document_type}>{r.document_label}</option>)}<option value="PASSPORT">جواز السفر</option><option value="WORK_PERMIT">تصريح العمل</option><option value="OTHER">مستند آخر</option></select><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setDocFile(e.target.files?.[0]||null)}/><input type="date" value={docIssue} onChange={e=>setDocIssue(e.target.value)} aria-label="تاريخ الإصدار"/><input type="date" value={docExpiry} onChange={e=>setDocExpiry(e.target.value)} aria-label="تاريخ الانتهاء"/><input value={docNotes} onChange={e=>setDocNotes(e.target.value)} placeholder="ملاحظات"/><button className="primary" disabled={saving} onClick={uploadDocument}>رفع المستند</button></div>
        <div className="document-list">{safeDocuments.length ? safeDocuments.map(d=><div className="document-row" key={d.document_id}><div><strong>{d.document_label}</strong><span>{d.document_name}</span></div><div><span>{d.expiry_date ? `ينتهي ${d.expiry_date}` : 'بدون تاريخ انتهاء'}</span><Badge status={d.computed_status}/></div><div><button className="tiny secondary" onClick={()=>openDocument(d.document_id)}>فتح</button><button className="tiny reject" disabled={saving} onClick={()=>deleteDocument(d.document_id)}>حذف</button></div></div>) : <Empty text="لا توجد مستندات مرفوعة لهذا الموظف."/>}</div>
      </div>
      <div className="profile-columns">
        <div className="profile-section"><h3>المشروعات السابقة والحالية</h3>{safeAssignments.length ? safeAssignments.map((x:any)=><div className="history-row" key={x.assignment_id}><strong>{x.projects?.name || 'مشروع غير محدد'}</strong><span>{x.start_date} → {x.end_date || 'مستمر'}</span></div>) : <Empty text="لا يوجد سجل مشروعات."/>}</div>
        <div className="profile-section"><h3>الورديات</h3>{safeShifts.length ? safeShifts.map((x:any,i:number)=><div className="history-row" key={`${x.assignment_id}-${i}`}><strong>{x.shifts?.name || 'وردية'}</strong><span>{x.start_date} → {x.end_date || 'مستمرة'}</span></div>) : <Empty text="لا يوجد سجل ورديات."/>}</div>
      </div>
      <div className="profile-kpis"><div><strong>{profile.leaves?.length || 0}</strong><span>طلبات إجازة</span></div><div><strong>{profile.permissions?.length || 0}</strong><span>أذونات</span></div><div><strong>{profile.deductions?.length || 0}</strong><span>خصومات</span></div><div><strong>{profile.disciplinary_cases?.length || 0}</strong><span>وقائع انضباطية</span></div></div>
    </div>
  </div>;
}
