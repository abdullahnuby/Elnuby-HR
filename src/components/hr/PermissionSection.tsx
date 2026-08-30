'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge } from './common';

const TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'إذن عام' },
  { value: 'PERSONAL', label: 'إذن شخصي' },
  { value: 'MEDICAL', label: 'إذن طبي' },
  { value: 'EMERGENCY', label: 'إذن طارئ' },
  { value: 'OFFICIAL', label: 'إذن رسمي' },
  { value: 'MISSION', label: 'مأمورية' },
  { value: 'EARLY_DEPARTURE', label: 'انصراف مبكر' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(x => [x.value, x.label]));

function formatDate(value: unknown) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text || '—';
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${text}T00:00:00`));
}

function time12(value: unknown) {
  const text = String(value || '').slice(0, 5);
  const [h, m] = text.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(value || '—');
  const period = h >= 12 ? 'م' : 'ص';
  return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDuration(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} دقيقة`;
  if (!m) return `${h} ساعة`;
  return `${h} ساعة و${m} دقيقة`;
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
}: any) {
  const [localRows, setLocalRows] = useState<any[]>(Array.isArray(rows) ? rows : []);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => setLocalRows(Array.isArray(rows) ? rows : []), [rows]);

  useEffect(() => {
    if (employeeMode) return;
    let active = true;
    (async () => {
      try {
        const list = await api<any[]>('employees');
        if (active) setEmployees(Array.isArray(list) ? list : []);
      } catch {
        if (active) setEmployees([]);
      }
    })();
    return () => { active = false; };
  }, [employeeMode]);

  const employeeMap = useMemo(() => new Map(employees.map(e => [String(e.employee_id), e])), [employees]);
  const normalizedRows = useMemo(() => localRows.map(r => ({
    ...r,
    employee_name: r.employee_name || employeeMap.get(String(r.employee_id))?.name || r.employee_id || 'غير محدد',
    permission_type_label: TYPE_LABEL[String(r.permission_type || '').toUpperCase()] || r.permission_type || 'إذن عام',
  })), [localRows, employeeMap]);

  const filteredRows = useMemo(() => normalizedRows.filter(r => {
    const haystack = `${r.employee_name || ''} ${r.employee_id || ''} ${r.reason || ''} ${r.permission_type_label || ''}`.toLowerCase();
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if (statusFilter !== 'ALL' && String(r.status || '') !== statusFilter) return false;
    if (typeFilter !== 'ALL' && String(r.permission_type || '').toUpperCase() !== typeFilter) return false;
    return true;
  }), [normalizedRows, search, statusFilter, typeFilter]);

  async function decide(requestId: string, decision: 'APPROVE'|'REJECT', comment?: string) {
    setWorking(requestId + decision);
    try {
      await api('decide_permission', { request_id: requestId, decision, comment: comment || null });
      const nextStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      setLocalRows(prev => prev.map(r => r.request_id === requestId ? { ...r, status: nextStatus, manager_comment: comment || null } : r));
      if (selected?.request_id === requestId) setSelected((prev: any) => prev ? { ...prev, status: nextStatus, manager_comment: comment || null } : prev);
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: decision === 'APPROVE' ? 'تم اعتماد طلب الإذن' : 'تم رفض طلب الإذن' } }));
      setRejecting(null);
      setRejectReason('');
    } catch (error: any) {
      window.dispatchEvent(new CustomEvent('hr:toast', { detail: { message: error?.message || 'تعذر تنفيذ القرار', type: 'error' } }));
    } finally {
      setWorking(null);
    }
  }

  const permissionMinutes = permissionStart && permissionEnd
    ? Math.max(0, Math.round((new Date(`2000-01-01T${permissionEnd.slice(11, 16) || permissionEnd}`).getTime() - new Date(`2000-01-01T${permissionStart.slice(11, 16) || permissionStart}`).getTime()) / 60000))
    : 0;

  return (
    <section className="panel page-panel hr-permissions">
      <div className="panel-head">
        <div>
          <h2>الأذونات</h2>
          <p>إدارة طلبات الأذونات ومراجعتها واعتمادها من شاشة واحدة.</p>
        </div>
        <span className="count-pill">{filteredRows.length} طلب</span>
      </div>

      {employeeMode && (
        <div className="request-card permission-form-card">
          <div className="request-card-head">
            <div><h3>طلب إذن جديد</h3><p>حدد نوع الإذن ووقته وسيحسب النظام المدة تلقائيًا.</p></div>
          </div>
          <div className="permission-type-grid">
            {TYPE_OPTIONS.map(option => (
              <button type="button" key={option.value} className={`permission-type-option ${permissionType === option.value ? 'active' : ''}`} onClick={() => setPermissionType(option.value)}>
                <strong>{option.label}</strong>
                <span>{option.value === 'EARLY_DEPARTURE' ? 'مغادرة قبل نهاية العمل' : 'طلب يحتاج اعتمادًا'}</span>
              </button>
            ))}
          </div>
          <div className="formgrid permission-form-grid">
            <label><span>وقت البداية</span><input type="datetime-local" value={permissionStart} onChange={e => setPermissionStart(e.target.value)} /></label>
            <label><span>وقت النهاية</span><input type="datetime-local" value={permissionEnd} onChange={e => setPermissionEnd(e.target.value)} /></label>
            <label className="wide"><span>السبب</span><textarea rows={3} placeholder="اكتب سبب الإذن" value={permissionReason} onChange={e => setPermissionReason(e.target.value)} /></label>
          </div>
          {permissionMinutes > 0 && <div className="permission-duration-preview"><span>مدة الإذن المتوقعة</span><strong>{formatDuration(permissionMinutes)}</strong></div>}
          <button className="primary" disabled={busy || !permissionStart || !permissionEnd || !permissionReason.trim()} onClick={createPermission}>{busy ? 'جاري إرسال الطلب...' : 'إرسال طلب الإذن'}</button>
        </div>
      )}

      <div className="table-toolbar">
        <div className="table-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم الموظف أو سبب الطلب" aria-label="بحث الأذونات" /></div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="نوع الإذن">
          <option value="ALL">كل أنواع الأذونات</option>{TYPE_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="حالة الإذن">
          <option value="ALL">كل الحالات</option><option value="PENDING">بانتظار الاعتماد</option><option value="APPROVED">معتمد</option><option value="REJECTED">مرفوض</option>
        </select>
        {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL') && <button className="secondary" onClick={() => { setSearch(''); setStatusFilter('ALL'); setTypeFilter('ALL'); }}>مسح الفلاتر</button>}
      </div>

      <div className="table-wrap hr-enhanced-table">
        <table>
          <thead><tr><th>الموظف</th><th>نوع الإذن</th><th>التاريخ</th><th>الفترة</th><th>المدة</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
          <tbody>
            {filteredRows.map(r => (
              <tr key={r.request_id} onDoubleClick={() => setSelected(r)}>
                <td data-label="الموظف"><strong>{r.employee_name}</strong><small>{r.employee_id || '—'}</small></td>
                <td data-label="نوع الإذن">{r.permission_type_label}</td>
                <td data-label="التاريخ">{formatDate(r.date)}</td>
                <td data-label="الفترة" dir="ltr">{time12(r.start_time)} — {time12(r.end_time)}</td>
                <td data-label="المدة">{formatDuration(r.minutes)}</td>
                <td data-label="الحالة"><Badge status={r.status}/></td>
                <td data-label="الإجراءات"><div className="table-actions"><button className="table-action" onClick={() => setSelected(r)}>التفاصيل</button>{r.status === 'PENDING' && <><button className="tiny approve" disabled={working === r.request_id + 'APPROVE'} onClick={() => void decide(r.request_id, 'APPROVE')}>اعتماد</button><button className="tiny reject" onClick={() => setRejecting(r)}>رفض</button></>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!filteredRows.length && <Empty text={search || statusFilter !== 'ALL' || typeFilter !== 'ALL' ? 'لا توجد طلبات مطابقة للفلاتر.' : 'لا توجد طلبات إذن.'} />}

      {selected && <div className="request-drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        <aside className="request-drawer" role="dialog" aria-modal="true" aria-labelledby="permission-details-title">
          <header className="request-drawer-head"><div><span>طلب إذن</span><h2 id="permission-details-title">تفاصيل طلب الإذن</h2><small>{selected.request_id}</small></div><button className="icon-close" onClick={() => setSelected(null)} aria-label="إغلاق">×</button></header>
          <div className="request-status-banner"><span>الحالة</span><Badge status={selected.status}/></div>
          <div className="request-detail-grid">
            <div><span>الموظف</span><strong>{selected.employee_name}</strong></div>
            <div><span>الرقم الوظيفي</span><strong>{selected.employee_id || '—'}</strong></div>
            <div><span>نوع الإذن</span><strong>{selected.permission_type_label}</strong></div>
            <div><span>التاريخ</span><strong>{formatDate(selected.date)}</strong></div>
            <div><span>البداية</span><strong>{time12(selected.start_time)}</strong></div>
            <div><span>النهاية</span><strong>{time12(selected.end_time)}</strong></div>
            <div><span>المدة</span><strong>{formatDuration(selected.minutes)}</strong></div>
            <div className="wide"><span>السبب</span><strong>{selected.reason || 'لا يوجد سبب مسجل'}</strong></div>
          </div>
          {selected.manager_comment && <div className="request-comment"><span>ملاحظة الاعتماد</span><p>{selected.manager_comment}</p></div>}
          <footer className="request-drawer-footer">{selected.status === 'PENDING' && <><button className="danger-outline" onClick={() => setRejecting(selected)}>رفض الطلب</button><button className="primary" disabled={!!working} onClick={() => void decide(selected.request_id, 'APPROVE')}>اعتماد الطلب</button></>}</footer>
        </aside>
      </div>}

      {rejecting && <div className="confirm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setRejecting(null); }}>
        <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <div className="confirm-dialog-icon danger">!</div><h3 id="reject-title">رفض طلب الإذن</h3><p>اكتب سبب الرفض ليظهر ضمن سجل الطلب.</p>
          <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="سبب الرفض *" autoFocus />
          <div className="confirm-dialog-actions"><button className="secondary" onClick={() => { setRejecting(null); setRejectReason(''); }}>إلغاء</button><button className="danger" disabled={!rejectReason.trim() || !!working} onClick={() => void decide(rejecting.request_id, 'REJECT', rejectReason.trim())}>تأكيد الرفض</button></div>
        </div>
      </div>}
    </section>
  );
}
