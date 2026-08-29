import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge } from './common';

type Props = {
  rows: any[];
  role: string;
  employeeMode: boolean;
  leaveType: string;
  setLeaveType: (v: string) => void;
  leaveFrom: string;
  setLeaveFrom: (v: string) => void;
  leaveTo: string;
  setLeaveTo: (v: string) => void;
  leaveReason: string;
  setLeaveReason: (v: string) => void;
  createLeave: (document?: File) => void;
  busy: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_MANAGER: 'في انتظار مدير المشروع',
  PENDING_HR: 'في انتظار HR',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغي',
};

const TYPE_LABELS: Record<string, string> = {
  'LT-ANNUAL': 'سنوية',
  'LT-CASUAL': 'عارضة',
  'LT-SICK': 'مرضية',
  'LT-UNPAID': 'بدون أجر',
};

function daysInclusive(from: string, to: string) {
  if (!from || !to || from > to) return 0;
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

export default function LeaveSection(props: Props) {
  const { rows, role, employeeMode, leaveType, setLeaveType, leaveFrom, setLeaveFrom, leaveTo, setLeaveTo, leaveReason, setLeaveReason, createLeave, busy } = props;
  const [medicalDocument, setMedicalDocument] = useState<File | null>(null);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [localRows, setLocalRows] = useState<any[]>(rows);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ request: any; decision: 'APPROVE' | 'REJECT'; stage: 'manager' | 'hr' } | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);

  const manager = role === 'PROJECT_MANAGER' || role === 'SECTOR_MANAGER';
  const hr = role === 'HR_MANAGER' || role === 'SYSTEM_ADMIN';

  useEffect(() => setLocalRows(rows), [rows]);

  async function loadTypes() {
    try {
      const data = await api<any[]>('leave_types');
      const active = (data || []).filter((x) => x.status === 'ACTIVE');
      setLeaveTypes(active);
      if (!leaveType && active[0]?.leave_type_id) setLeaveType(active[0].leave_type_id);
    } catch {
      setLeaveTypes([]);
    }
  }

  useEffect(() => { void loadTypes(); }, []);
  useEffect(() => {
    if (!employeeMode) return;
    void api<any[]>('leave_balances').then(setBalances).catch(() => setBalances([]));
  }, [employeeMode]);

  const selectedBalance = useMemo(() => balances.find((b) => String(b.leave_type_id) === String(leaveType)), [balances, leaveType]);
  const selectedType = useMemo(() => leaveTypes.find((x) => String(x.leave_type_id) === String(leaveType)), [leaveTypes, leaveType]);
  const requestedDays = daysInclusive(leaveFrom, leaveTo);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return localRows.filter((r) => {
      const statusOk = statusFilter === 'ALL' || r.status === statusFilter;
      const typeOk = typeFilter === 'ALL' || r.leave_type_id === typeFilter;
      const hay = `${r.employee_name || ''} ${r.employee_id || ''} ${r.project_name || ''} ${r.reason || ''}`.toLowerCase();
      return statusOk && typeOk && (!q || hay.includes(q));
    });
  }, [localRows, query, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: localRows.length,
    pending: localRows.filter((r) => r.status === 'PENDING_MANAGER' || r.status === 'PENDING_HR').length,
    approved: localRows.filter((r) => r.status === 'APPROVED').length,
    rejected: localRows.filter((r) => r.status === 'REJECTED').length,
  }), [localRows]);

  async function refresh() {
    try { setLocalRows(await api<any[]>('leave_list', {})); } catch {}
  }

  function openDecision(request: any, decision: 'APPROVE' | 'REJECT', stage: 'manager' | 'hr') {
    setDecisionComment('');
    setDecisionModal({ request, decision, stage });
  }

  async function submitDecision() {
    if (!decisionModal) return;
    if (decisionModal.decision === 'REJECT' && decisionComment.trim().length < 3) {
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: 'سبب الرفض مطلوب (3 أحرف على الأقل)', type: 'error' } }));
      return;
    }
    try {
      setDecisionBusy(true);
      const action = decisionModal.stage === 'manager' ? 'decide_leave_manager' : 'decide_leave_hr';
      await api(action, { request_id: decisionModal.request.request_id, decision: decisionModal.decision, comment: decisionComment.trim() });
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: decisionModal.decision === 'APPROVE' ? 'تم اعتماد الطلب بنجاح' : 'تم رفض الطلب' } }));
      await refresh();
      setDetail(null);
      setDecisionModal(null);
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: error?.message || 'تعذر تنفيذ القرار', type: 'error' } }));
    } finally { setDecisionBusy(false); }
  }

  async function cancel(requestId: string) {
    const reason = window.prompt('اكتب سبب إلغاء طلب الإجازة:');
    if (reason === null) return;
    try {
      setCancelBusy(requestId);
      await api('cancel_leave', { request_id: requestId, reason });
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: 'تم إلغاء طلب الإجازة' } }));
      await refresh();
      setDetail(null);
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: error?.message || 'تعذر إلغاء الطلب', type: 'error' } }));
    } finally { setCancelBusy(null); }
  }

  return (
    <section className="panel page-panel hr-workflow-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">LEAVE WORKFLOW</div>
          <h2>الإجازات</h2>
          <p>رصيد الإجازات، الطلبات، مسار الاعتماد، المستندات، وسجل القرار في مكان واحد.</p>
        </div>
        <span className="count-pill">{stats.total} طلب</span>
      </div>

      <div className="hr-request-stats">
        <div><span>إجمالي الطلبات</span><strong>{stats.total}</strong></div>
        <div><span>قيد الاعتماد</span><strong>{stats.pending}</strong></div>
        <div><span>معتمد</span><strong>{stats.approved}</strong></div>
        <div><span>مرفوض</span><strong>{stats.rejected}</strong></div>
      </div>

      {employeeMode && (
        <div className="request-card hr-request-composer">
          <div className="hr-request-composer-head"><div><h3>إنشاء طلب إجازة</h3><p>حدد النوع والفترة، وسيتم حساب الأيام والرصيد قبل الإرسال.</p></div><span className="live">طلب جديد</span></div>
          <div className="hr-leave-form-grid">
            <label><span>نوع الإجازة</span><select value={leaveType} onChange={(e) => { setLeaveType(e.target.value); setMedicalDocument(null); }}><option value="">اختر النوع</option>{leaveTypes.map((t) => <option key={t.leave_type_id} value={t.leave_type_id}>{t.name || TYPE_LABELS[t.leave_type_id] || t.leave_type_id}</option>)}</select></label>
            <label><span>من</span><input type="date" min={new Date().toISOString().slice(0,10)} value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} /></label>
            <label><span>إلى</span><input type="date" min={leaveFrom || new Date().toISOString().slice(0,10)} value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} /></label>
            <label className="wide"><span>سبب الطلب</span><textarea rows={2} placeholder="اكتب سببًا مختصرًا وواضحًا" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} /></label>
            {selectedType?.requires_document && <label><span>المستند المؤيد *</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setMedicalDocument(e.target.files?.[0] || null)} /><small>PDF أو صورة — حتى 10 ميجابايت</small></label>}
          </div>

          <div className="hr-leave-preview">
            <div><span>مدة الطلب</span><strong>{requestedDays || 0} يوم</strong></div>
            <div><span>الرصيد المتاح</span><strong>{selectedBalance ? `${selectedBalance.remaining} يوم` : selectedType?.requires_balance === false ? 'غير محسوب' : '—'}</strong></div>
            <div><span>بعد الطلب</span><strong>{selectedBalance && requestedDays ? `${Math.max(0, Number(selectedBalance.remaining) - requestedDays)} يوم` : '—'}</strong></div>
          </div>
          <button className="primary" disabled={busy || !leaveType || requestedDays < 1 || (selectedType?.requires_document && !medicalDocument)} onClick={() => createLeave(medicalDocument || undefined)}>{busy ? 'جاري الإرسال...' : 'إرسال طلب الإجازة'}</button>
        </div>
      )}

      {employeeMode && balances.length > 0 && (
        <div className="hr-balance-grid">
          {balances.map((b) => <div className="hr-balance-card" key={b.id}><div><span>{b.leave_types?.name || TYPE_LABELS[b.leave_type_id] || b.leave_type_id}</span><small>استحقاق {b.entitlement} • مستخدم {b.used} • محجوز {b.pending}</small></div><strong>{b.remaining}</strong><em>يوم متاح</em></div>)}
        </div>
      )}

      <div className="hr-list-toolbar">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث باسم الموظف، الكود، المشروع أو السبب" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">كل الحالات</option>{Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="ALL">كل الأنواع</option>{leaveTypes.map((t) => <option key={t.leave_type_id} value={t.leave_type_id}>{t.name || TYPE_LABELS[t.leave_type_id] || t.leave_type_id}</option>)}</select>
      </div>

      <div className="table-wrap hr-leave-table"><table><thead><tr>{['الموظف','النوع','الفترة','الأيام','الرصيد','الحالة','مسار الاعتماد','إجراء'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>
        {filteredRows.map((r) => {
          const canCancel = (employeeMode && (r.status === 'PENDING_MANAGER' || r.status === 'PENDING_HR')) || (hr && (r.status === 'PENDING_MANAGER' || r.status === 'PENDING_HR'));
          const approvalStep = r.status === 'PENDING_MANAGER' ? 'مدير المشروع' : r.status === 'PENDING_HR' ? 'الموارد البشرية' : r.status === 'APPROVED' ? 'اكتمل الاعتماد' : r.status === 'REJECTED' ? 'تم الرفض' : '—';
          return <tr key={r.request_id}>
            <td><strong>{r.employee_name || r.employee_id}</strong><small>{r.employee_id || '—'}{r.project_name ? ` • ${r.project_name}` : ''}</small></td>
            <td>{r.leave_type_name || TYPE_LABELS[r.leave_type_id] || r.leave_type_id}</td>
            <td><span className="time-value">{r.from_date}</span> <span>←</span> <span className="time-value">{r.to_date}</span></td>
            <td><strong>{r.days}</strong> يوم</td>
            <td>{r.leave_balance?.remaining ?? '—'}</td>
            <td><Badge status={r.status} /></td>
            <td><span className="workflow-step">{approvalStep}</span></td>
            <td><div className="table-actions"><button className="table-action" onClick={() => setDetail(r)}>التفاصيل</button>{r.document_required && <button className="table-action" onClick={async () => { try { const d = await api<any>('leave_document',{request_id:r.request_id}); window.open(d.signed_url,'_blank','noopener,noreferrer'); } catch (e:any) { window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message || 'تعذر فتح المستند',type:'error'}})); } }}>المستند</button>}{manager && r.status === 'PENDING_MANAGER' && <><button className="table-action" onClick={() => openDecision(r,'APPROVE','manager')}>اعتماد</button><button className="table-action danger" onClick={() => openDecision(r,'REJECT','manager')}>رفض</button></>}{hr && r.status === 'PENDING_HR' && <><button className="table-action" onClick={() => openDecision(r,'APPROVE','hr')}>اعتماد HR</button><button className="table-action danger" onClick={() => openDecision(r,'REJECT','hr')}>رفض</button></>}{canCancel && <button className="table-action danger" disabled={cancelBusy === r.request_id} onClick={() => void cancel(r.request_id)}>{cancelBusy === r.request_id ? 'جاري الإلغاء' : 'إلغاء'}</button>}</div></td>
          </tr>;
        })}
      </tbody></table></div>
      {!filteredRows.length && <Empty text="لا توجد طلبات تطابق الفلاتر الحالية." />}

      {detail && <div className="hr-modal-backdrop" onClick={() => setDetail(null)}><div className="hr-modal" onClick={(e) => e.stopPropagation()}><div className="hr-modal-head"><div><span className="eyebrow">REQUEST DETAILS</span><h3>{detail.employee_name || detail.employee_id}</h3></div><button onClick={() => setDetail(null)}>×</button></div><div className="hr-detail-grid"><div><span>الحالة</span><strong><Badge status={detail.status}/></strong></div><div><span>نوع الإجازة</span><strong>{detail.leave_type_name || detail.leave_type_id}</strong></div><div><span>الفترة</span><strong>{detail.from_date} → {detail.to_date}</strong></div><div><span>الأيام</span><strong>{detail.days} يوم</strong></div><div><span>المشروع</span><strong>{detail.project_name || detail.project_id}</strong></div><div><span>سبب الطلب</span><strong>{detail.reason || '—'}</strong></div></div><div className="hr-timeline"><div className={detail.status !== 'PENDING_MANAGER' ? 'done' : 'current'}><b>1</b><span>إرسال الطلب</span></div><div className={['PENDING_HR','APPROVED','REJECTED'].includes(detail.status) ? 'done' : 'current'}><b>2</b><span>اعتماد مدير المشروع</span></div><div className={['APPROVED','REJECTED'].includes(detail.status) ? 'done' : 'current'}><b>3</b><span>قرار HR</span></div></div>{detail.manager_comment && <div className="hr-comment"><b>ملاحظة المدير</b><p>{detail.manager_comment}</p></div>}{detail.hr_comment && <div className="hr-comment"><b>ملاحظة HR</b><p>{detail.hr_comment}</p></div>}{detail.cancellation_reason && <div className="hr-comment danger"><b>سبب الإلغاء</b><p>{detail.cancellation_reason}</p></div>}</div></div>}

      {decisionModal && <div className="hr-modal-backdrop" onClick={() => !decisionBusy && setDecisionModal(null)}><div className="hr-modal hr-decision-modal" onClick={(e) => e.stopPropagation()}><div className="hr-modal-head"><div><span className="eyebrow">{decisionModal.stage === 'manager' ? 'MANAGER REVIEW' : 'HR REVIEW'}</span><h3>{decisionModal.decision === 'APPROVE' ? 'اعتماد طلب الإجازة' : 'رفض طلب الإجازة'}</h3></div><button disabled={decisionBusy} onClick={() => setDecisionModal(null)}>×</button></div><div className="hr-decision-summary"><div><span>الموظف</span><strong>{decisionModal.request.employee_name || decisionModal.request.employee_id}</strong></div><div><span>نوع الإجازة</span><strong>{decisionModal.request.leave_type_name || decisionModal.request.leave_type_id}</strong></div><div><span>الفترة</span><strong>{decisionModal.request.from_date} → {decisionModal.request.to_date}</strong></div><div><span>المدة</span><strong>{decisionModal.request.days} يوم</strong></div><div><span>الرصيد</span><strong>{decisionModal.request.leave_balance?.remaining ?? '—'} يوم</strong></div><div><span>المشروع</span><strong>{decisionModal.request.project_name || decisionModal.request.project_id}</strong></div></div><div className="hr-decision-reason"><span>سبب الطلب</span><p>{decisionModal.request.reason || 'لم يذكر الموظف سببًا.'}</p></div><label className="hr-decision-field"><span>{decisionModal.decision === 'REJECT' ? 'سبب الرفض *' : 'ملاحظة القرار'}</span><textarea rows={4} autoFocus value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} placeholder={decisionModal.decision === 'REJECT' ? 'اكتب سبب الرفض بوضوح ليظهر للموظف...' : 'اكتب ملاحظة القرار (اختياري)...'} /></label><div className="hr-decision-actions"><button className="table-action" disabled={decisionBusy} onClick={() => setDecisionModal(null)}>إلغاء</button><button className={decisionModal.decision === 'REJECT' ? 'table-action danger hr-primary-decision' : 'table-action hr-primary-decision'} disabled={decisionBusy || (decisionModal.decision === 'REJECT' && decisionComment.trim().length < 3)} onClick={() => void submitDecision()}>{decisionBusy ? 'جاري التنفيذ...' : decisionModal.decision === 'REJECT' ? 'تأكيد الرفض' : 'تأكيد الاعتماد'}</button></div></div></div>}
    </section>
  );
}
