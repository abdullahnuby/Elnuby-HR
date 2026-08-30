'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge } from './common';

type Props = {
  rows: any[];
  employeeMode: boolean;
  permissionType: string;
  setPermissionType: (v: string) => void;
  permissionStart: string;
  setPermissionStart: (v: string) => void;
  permissionEnd: string;
  setPermissionEnd: (v: string) => void;
  permissionReason: string;
  setPermissionReason: (v: string) => void;
  createPermission: () => void;
  busy: boolean;
};

const PERMISSION_TYPES = [
  ['GENERAL', 'إذن عام', 'خروج خلال ساعات العمل'],
  ['PERSONAL', 'إذن شخصي', 'لشؤون شخصية'],
  ['MEDICAL', 'إذن طبي', 'مراجعة أو موعد طبي'],
  ['EMERGENCY', 'إذن طارئ', 'ظرف طارئ'],
  ['OFFICIAL', 'إذن رسمي', 'مهمة أو إجراء رسمي'],
  ['MISSION', 'مأمورية', 'مهمة خارج الموقع'],
  ['EARLY_DEPARTURE', 'انصراف مبكر', 'مغادرة قبل نهاية العمل'],
] as const;

const typeLabel = Object.fromEntries(PERMISSION_TYPES.map(([value, label]) => [value, label]));

function formatArabicDate(value?: string) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function formatTime(value?: string) {
  if (!value) return '—';
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? 'م' : 'ص';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function durationText(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} دقيقة`;
  if (!m) return `${h} ${h === 1 ? 'ساعة' : 'ساعات'}`;
  return `${h} س و${m} د`;
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = String(start).slice(0, 5).split(':').map(Number);
  const [eh, em] = String(end).slice(0, 5).split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return e > s ? e - s : 0;
}

export default function PermissionSection({
  rows,
  employeeMode,
  permissionType,
  setPermissionType,
  permissionStart,
  setPermissionStart,
  permissionEnd,
  setPermissionEnd,
  permissionReason,
  setPermissionReason,
  createPermission,
  busy,
}: Props) {
  const [localRows, setLocalRows] = useState<any[]>(Array.isArray(rows) ? rows : []);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => setLocalRows(Array.isArray(rows) ? rows : []), [rows]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<any[]>('employees');
        if (active) setEmployees(Array.isArray(data) ? data : []);
      } catch {
        if (active) setEmployees([]);
      }
    })();
    return () => { active = false; };
  }, [employeeMode]);

  const employeeMap = useMemo(() => new Map(employees.map(e => [String(e.employee_id), e])), [employees]);
  const safeRows = Array.isArray(localRows) ? localRows : [];
  const displayName = (row: any) => row.employee_name || employeeMap.get(String(row.employee_id))?.name || row.employee_id || 'غير محدد';
  const duration = minutesBetween(permissionStart, permissionEnd);

  async function decide(requestId: string, decision: 'APPROVE' | 'REJECT', comment?: string) {
    try {
      await api('decide_permission', { request_id: requestId, decision, comment: comment || undefined });
      setLocalRows(prev => prev.map(r => r.request_id === requestId
        ? { ...r, status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', manager_comment: comment || r.manager_comment }
        : r));
      setSelected((current: any) => current?.request_id === requestId ? null : current);
      setRejecting(false);
      setRejectReason('');
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: decision === 'APPROVE' ? 'تم اعتماد طلب الإذن' : 'تم رفض طلب الإذن' } }));
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: error?.message || 'تعذر تنفيذ القرار', type: 'error' } }));
    }
  }

  function submitRequest() {
    setFormError('');
    if (!permissionType) return setFormError('اختر نوع الإذن.');
    if (!permissionStart || !permissionEnd) return setFormError('حدد بداية ونهاية الإذن.');
    if (duration <= 0) return setFormError('يجب أن تسبق بداية الإذن نهايته.');
    if (!permissionReason.trim()) return setFormError('اكتب سبب الإذن.');
    createPermission();
  }

  return (
    <section className="panel page-panel permissions-page">
      <div className="panel-head">
        <div>
          <div className="eyebrow">إدارة الأذونات</div>
          <h2>الأذونات</h2>
          <p>إنشاء ومتابعة واعتماد الأذونات من شاشة واضحة وسريعة.</p>
        </div>
        <span className="count-pill">{safeRows.length} طلب</span>
      </div>

      {employeeMode && (
        <div className="request-card permission-create-card">
          <div className="request-card-headline">
            <div><h3>طلب إذن جديد</h3><p>اختر النوع والفترة والسبب، وسيظهر لك ملخص الطلب قبل الإرسال.</p></div>
          </div>

          <div className="permission-type-grid">
            {PERMISSION_TYPES.map(([value, label, note]) => (
              <button type="button" key={value} className={`permission-type-option ${permissionType === value ? 'active' : ''}`} onClick={() => setPermissionType(value)}>
                <strong>{label}</strong><span>{note}</span>
              </button>
            ))}
          </div>

          <div className="formgrid permission-form-grid">
            <label><span>من</span><input type="datetime-local" value={permissionStart} onChange={e => setPermissionStart(e.target.value)} /></label>
            <label><span>إلى</span><input type="datetime-local" value={permissionEnd} onChange={e => setPermissionEnd(e.target.value)} /></label>
            <label className="wide"><span>السبب</span><textarea rows={3} value={permissionReason} onChange={e => setPermissionReason(e.target.value)} placeholder="اكتب سبب الإذن بوضوح" /></label>
          </div>

          <div className="permission-duration-preview">
            <span>مدة الإذن المتوقعة</span>
            <strong>{durationText(duration)}</strong>
          </div>

          {formError && <div className="inline-form-error">{formError}</div>}
          <button className="primary" disabled={busy} onClick={submitRequest}>{busy ? 'جاري الإرسال...' : 'إرسال طلب الإذن'}</button>
        </div>
      )}

      {!employeeMode && (
        <div className="table-toolbar">
          <div className="table-toolbar-title"><strong>طلبات الأذونات</strong><span>اضغط على أي طلب لعرض التفاصيل واتخاذ القرار.</span></div>
          <span className="table-toolbar-count">{safeRows.length} طلب</span>
        </div>
      )}

      <div className="permission-list">
        {safeRows.map((r: any) => (
          <article className="permission-request-card" key={r.request_id} onClick={() => setSelected(r)}>
            <div className="permission-request-main">
              <div className="permission-person">
                <div className="avatar-letter">{String(displayName(r)).slice(0, 1)}</div>
                <div><strong>{displayName(r)}</strong><span>{r.employee_id || '—'}</span></div>
              </div>
              <div className="permission-request-type"><strong>{typeLabel[String(r.permission_type || 'GENERAL').toUpperCase()] || String(r.permission_type || 'إذن عام')}</strong><span>{formatArabicDate(r.date)}</span></div>
              <div className="permission-time-block"><strong>{formatTime(r.start_time)} — {formatTime(r.end_time)}</strong><span>{durationText(Number(r.minutes || 0))}</span></div>
              <Badge status={r.status} />
              <button type="button" className="table-action" onClick={e => { e.stopPropagation(); setSelected(r); }}>التفاصيل</button>
            </div>
            {r.reason && <p className="permission-request-reason">{r.reason}</p>}
          </article>
        ))}
      </div>

      {!safeRows.length && <Empty text="لا توجد طلبات إذن." />}

      {selected && (
        <div className="request-drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <aside className="request-drawer permission-drawer" role="dialog" aria-modal="true">
            <div className="request-drawer-head">
              <div><span>تفاصيل طلب الإذن</span><h2>{displayName(selected)}</h2><small>{selected.request_id}</small></div>
              <button className="icon-close" onClick={() => setSelected(null)} aria-label="إغلاق">×</button>
            </div>
            <div className="request-status-banner"><span>الحالة الحالية</span><Badge status={selected.status} /></div>
            <div className="request-detail-grid">
              <div><span>نوع الإذن</span><strong>{typeLabel[String(selected.permission_type || 'GENERAL').toUpperCase()] || String(selected.permission_type || 'إذن عام')}</strong></div>
              <div><span>التاريخ</span><strong>{formatArabicDate(selected.date)}</strong></div>
              <div><span>بداية الإذن</span><strong>{formatTime(selected.start_time)}</strong></div>
              <div><span>نهاية الإذن</span><strong>{formatTime(selected.end_time)}</strong></div>
              <div><span>المدة</span><strong>{durationText(Number(selected.minutes || 0))}</strong></div>
              <div><span>المشروع</span><strong>{selected.project_name || selected.project_id || 'غير محدد'}</strong></div>
              <div className="wide"><span>السبب</span><strong>{selected.reason || 'لم يُذكر سبب'}</strong></div>
            </div>
            {selected.manager_comment && <div className="request-comment"><span>ملاحظة القرار</span><p>{selected.manager_comment}</p></div>}

            <div className="request-drawer-footer">
              {selected.status === 'PENDING' && !employeeMode ? <>
                <button className="primary" onClick={() => void decide(selected.request_id, 'APPROVE')}>اعتماد الطلب</button>
                <button className="danger-outline" onClick={() => setRejecting(true)}>رفض الطلب</button>
              </> : <button className="secondary" onClick={() => setSelected(null)}>إغلاق</button>}
            </div>
          </aside>
        </div>
      )}

      {rejecting && selected && (
        <div className="confirm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setRejecting(false); }}>
          <div className="confirm-dialog">
            <div className="confirm-dialog-icon danger">!</div>
            <h3>رفض طلب الإذن</h3>
            <p>اكتب سبب الرفض ليظهر للموظف ويحفظ ضمن سجل الطلب.</p>
            <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="سبب الرفض *" autoFocus />
            <div className="confirm-dialog-actions"><button className="secondary" onClick={() => setRejecting(false)}>إلغاء</button><button className="danger" disabled={!rejectReason.trim()} onClick={() => void decide(selected.request_id, 'REJECT', rejectReason.trim())}>تأكيد الرفض</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
