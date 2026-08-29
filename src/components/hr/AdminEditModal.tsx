'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Employee, Project, Shift, User } from './types';
import Icon from './Icon';

type Entity = 'employee' | 'project' | 'shift' | 'user-password';

type Props = {
  entity: Entity;
  record: Employee | Project | Shift | User;
  busy?: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void> | void;
};

const statusOptions = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'INACTIVE', label: 'غير نشط' },
];

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`admin-edit-field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default function AdminEditModal({ entity, record, busy = false, onClose, onSave }: Props) {
  const initial = useMemo(() => {
    if (entity === 'employee') {
      const r = record as Employee;
      return {
        name: r.name || '',
        job_title: r.job_title || '',
        department: r.department || '',
        phone: r.phone || '',
        residency_type: r.residency_type || 'RESIDENT',
        status: r.status || 'ACTIVE',
      };
    }
    if (entity === 'project') {
      const r = record as Project;
      return {
        name: r.name || '',
        client: r.client || '',
        location_name: r.location_name || '',
        latitude: r.latitude ?? '',
        longitude: r.longitude ?? '',
        geofence_radius_m: r.geofence_radius_m ?? 200,
        status: r.status || 'ACTIVE',
      };
    }
    if (entity === 'shift') {
      const r = record as Shift;
      return {
        name: r.name || '',
        start_time: String(r.start_time || '').slice(0, 5),
        attendance_open: String(r.attendance_open || '').slice(0, 5),
        attendance_close: String(r.attendance_close || '').slice(0, 5),
        checkout_open: String(r.checkout_open || '').slice(0, 5),
        checkout_close: String(r.checkout_close || '').slice(0, 5),
        auto_checkout_time: String(r.auto_checkout_time || '').slice(0, 5),
        status: r.status || 'ACTIVE',
      };
    }
    return { password: '' };
  }, [entity, record]);

  const [form, setForm] = useState<Record<string, unknown>>(initial);

  useEffect(() => setForm(initial), [initial]);

  const titles: Record<Entity, string> = {
    employee: 'تعديل بيانات الموظف',
    project: 'تعديل بيانات المشروع',
    shift: 'تعديل الوردية',
    'user-password': 'تغيير كلمة مرور الحساب',
  };

  const subtitles: Record<Entity, string> = {
    employee: 'راجع البيانات الأساسية قبل الحفظ. الحقول المرتبطة بالتعيينات تظل من شاشة التعيين.',
    project: 'تعديل بيانات الموقع ونطاق الحضور والإحداثيات المستخدمة في التحقق الجغرافي.',
    shift: 'ضبط أوقات الوردية ونوافذ الحضور والانصراف والإغلاق التلقائي.',
    'user-password': 'اكتب كلمة مرور جديدة للحساب. يجب أن تكون 8 أحرف على الأقل.',
  };

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (entity === 'employee') {
      const name = String(form.name || '').trim();
      if (!name) return;
      await onSave({
        employee_id: (record as Employee).employee_id,
        name,
        job_title: String(form.job_title || '').trim(),
        department: String(form.department || '').trim(),
        phone: String(form.phone || '').trim(),
        residency_type: String(form.residency_type || 'RESIDENT'),
        status: String(form.status || 'ACTIVE'),
      });
      return;
    }
    if (entity === 'project') {
      const name = String(form.name || '').trim();
      if (!name) return;
      await onSave({
        project_id: (record as Project).project_id,
        name,
        client: String(form.client || '').trim(),
        location_name: String(form.location_name || '').trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        geofence_radius_m: Number(form.geofence_radius_m || 200),
        status: String(form.status || 'ACTIVE'),
      });
      return;
    }
    if (entity === 'shift') {
      const name = String(form.name || '').trim();
      if (!name) return;
      await onSave({
        shift_id: (record as Shift).shift_id,
        name,
        start_time: String(form.start_time || ''),
        attendance_open: String(form.attendance_open || ''),
        attendance_close: String(form.attendance_close || ''),
        checkout_open: String(form.checkout_open || ''),
        checkout_close: String(form.checkout_close || ''),
        auto_checkout_time: String(form.auto_checkout_time || ''),
        status: String(form.status || 'ACTIVE'),
      });
      return;
    }
    const password = String(form.password || '');
    if (password.length < 8) return;
    await onSave({ user_id: (record as User).user_id, password });
  };

  return (
    <div className="admin-edit-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section className={`admin-edit-modal admin-edit-${entity}`} role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
        <header className="admin-edit-head">
          <div className="admin-edit-title-wrap">
            <div className="admin-edit-icon"><Icon name={entity === 'employee' ? 'users' : entity === 'project' ? 'projects' : entity === 'shift' ? 'attendance' : 'lock'} size={20} /></div>
            <div>
              <div className="admin-edit-kicker">إدارة النظام</div>
              <h2 id="admin-edit-title">{titles[entity]}</h2>
              <p>{subtitles[entity]}</p>
            </div>
          </div>
          <button className="admin-edit-close" onClick={onClose} disabled={busy} aria-label="إغلاق">×</button>
        </header>

        <div className="admin-edit-body">
          {entity === 'employee' && (
            <>
              <div className="admin-edit-section-head"><span>البيانات الأساسية</span><small>يتم تسجيل التعديلات في سجل المراجعة</small></div>
              <div className="admin-edit-grid">
                <Field label="اسم الموظف *"><input autoFocus value={String(form.name || '')} onChange={e => set('name', e.target.value)} /></Field>
                <Field label="المسمى الوظيفي"><input value={String(form.job_title || '')} onChange={e => set('job_title', e.target.value)} /></Field>
                <Field label="القسم"><input value={String(form.department || '')} onChange={e => set('department', e.target.value)} /></Field>
                <Field label="رقم الهاتف"><input inputMode="tel" value={String(form.phone || '')} onChange={e => set('phone', e.target.value)} /></Field>
                <Field label="نوع الإقامة"><select value={String(form.residency_type)} onChange={e => set('residency_type', e.target.value)}><option value="RESIDENT">مقيم</option><option value="EXPATRIATE">وافد</option></select></Field>
                <Field label="حالة الموظف"><select value={String(form.status)} onChange={e => set('status', e.target.value)}>{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
              </div>
              <div className="admin-edit-note"><strong>تنبيه:</strong> المشروع والوردية لا يتم تعديلهما من هنا حتى لا تتأثر التعيينات التاريخية. استخدم شاشة التعيينات.</div>
            </>
          )}

          {entity === 'project' && (
            <>
              <div className="admin-edit-section-head"><span>بيانات المشروع</span><small>تأكد من الإحداثيات قبل الحفظ</small></div>
              <div className="admin-edit-grid">
                <Field label="اسم المشروع *"><input autoFocus value={String(form.name || '')} onChange={e => set('name', e.target.value)} /></Field>
                <Field label="العميل"><input value={String(form.client || '')} onChange={e => set('client', e.target.value)} /></Field>
                <Field label="اسم الموقع" wide><input value={String(form.location_name || '')} onChange={e => set('location_name', e.target.value)} /></Field>
                <Field label="خط العرض" hint="مثال: 30.0444"><input type="number" step="any" value={String(form.latitude ?? '')} onChange={e => set('latitude', e.target.value)} /></Field>
                <Field label="خط الطول" hint="مثال: 31.2357"><input type="number" step="any" value={String(form.longitude ?? '')} onChange={e => set('longitude', e.target.value)} /></Field>
                <Field label="نطاق الحضور بالمتر" hint="يُستخدم مع دقة جهاز الـGPS"><input type="number" min="50" step="10" value={String(form.geofence_radius_m ?? 200)} onChange={e => set('geofence_radius_m', e.target.value)} /></Field>
                <Field label="حالة المشروع"><select value={String(form.status)} onChange={e => set('status', e.target.value)}>{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
              </div>
              <div className="admin-edit-location-card"><div><span>نقطة الموقع</span><strong>{String(form.latitude || '—')} ، {String(form.longitude || '—')}</strong></div><div><span>نطاق الحضور</span><strong>{String(form.geofence_radius_m || 200)} متر</strong></div></div>
            </>
          )}

          {entity === 'shift' && (
            <>
              <div className="admin-edit-section-head"><span>تعريف الوردية</span><small>يمكنك ضبط جميع النوافذ الزمنية في شاشة واحدة</small></div>
              <div className="admin-edit-grid admin-edit-grid-2">
                <Field label="اسم الوردية *" wide><input autoFocus value={String(form.name || '')} onChange={e => set('name', e.target.value)} /></Field>
                <Field label="بداية العمل"><input type="time" value={String(form.start_time || '')} onChange={e => set('start_time', e.target.value)} /></Field>
              </div>
              <div className="admin-edit-time-group"><div className="admin-edit-time-title"><span>نافذة الحضور</span><small>الفترة التي يسمح فيها بتسجيل الحضور</small></div><div className="admin-edit-grid admin-edit-grid-2"><Field label="فتح الحضور"><input type="time" value={String(form.attendance_open || '')} onChange={e => set('attendance_open', e.target.value)} /></Field><Field label="إغلاق الحضور"><input type="time" value={String(form.attendance_close || '')} onChange={e => set('attendance_close', e.target.value)} /></Field></div></div>
              <div className="admin-edit-time-group"><div className="admin-edit-time-title"><span>نافذة الانصراف</span><small>الفترة التي يسمح فيها بتسجيل الانصراف</small></div><div className="admin-edit-grid admin-edit-grid-2"><Field label="فتح الانصراف"><input type="time" value={String(form.checkout_open || '')} onChange={e => set('checkout_open', e.target.value)} /></Field><Field label="إغلاق الانصراف"><input type="time" value={String(form.checkout_close || '')} onChange={e => set('checkout_close', e.target.value)} /></Field></div></div>
              <div className="admin-edit-shift-bottom"><Field label="الإغلاق التلقائي" hint="يغلق السجل تلقائيًا بعد انتهاء الوردية"><input type="time" value={String(form.auto_checkout_time || '')} onChange={e => set('auto_checkout_time', e.target.value)} /></Field><Field label="حالة الوردية"><select value={String(form.status)} onChange={e => set('status', e.target.value)}>{statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field></div>
            </>
          )}

          {entity === 'user-password' && (
            <>
              <div className="admin-edit-account-card"><span>الحساب</span><strong>{(record as User).username}</strong><small>{(record as User).status === 'ACTIVE' ? 'الحساب نشط' : 'الحساب غير نشط'}</small></div>
              <div className="admin-edit-section-head"><span>بيانات كلمة المرور</span><small>لن تظهر كلمة المرور القديمة في أي مكان</small></div>
              <Field label="كلمة المرور الجديدة *" hint="8 أحرف على الأقل"><input autoFocus type="password" value={String(form.password || '')} onChange={e => set('password', e.target.value)} placeholder="اكتب كلمة المرور الجديدة" /></Field>
            </>
          )}
        </div>

        <footer className="admin-edit-footer">
          <div className="admin-edit-security"><span className="admin-edit-security-dot" /> سيتم حفظ التعديل بشكل آمن مع تسجيل العملية</div>
          <div className="admin-edit-footer-actions">
            <button className="secondary" onClick={onClose} disabled={busy}>إلغاء</button>
            <button className="primary admin-edit-save" onClick={() => void submit()} disabled={busy}>{busy ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
