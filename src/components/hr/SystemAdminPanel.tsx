'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type AdminTable = {
  value: string;
  label: string;
  idColumn: string;
  group: 'workforce' | 'operations' | 'requests' | 'security';
};

type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'time' | 'number' | 'boolean' | 'textarea';
  readOnly?: boolean;
  hidden?: boolean;
};

type ApiRow = Record<string, unknown>;

const TABLES: AdminTable[] = [
  { value: 'employees', label: 'الموظفون', idColumn: 'employee_id', group: 'workforce' },
  { value: 'projects', label: 'المشاريع', idColumn: 'project_id', group: 'operations' },
  { value: 'shifts', label: 'الورديات', idColumn: 'shift_id', group: 'operations' },
  { value: 'users', label: 'حسابات المستخدمين', idColumn: 'id', group: 'security' },
  { value: 'project_assignments', label: 'تعيينات المشاريع', idColumn: 'assignment_id', group: 'operations' },
  { value: 'employee_shifts', label: 'تعيينات الورديات', idColumn: 'assignment_id', group: 'operations' },
  { value: 'project_managers', label: 'مديرو المشاريع', idColumn: 'id', group: 'security' },
  { value: 'sector_manager_projects', label: 'نطاقات مديري القطاعات', idColumn: 'assignment_id', group: 'security' },
  { value: 'attendance', label: 'الحضور والانصراف', idColumn: 'attendance_id', group: 'requests' },
  { value: 'leave_types', label: 'أنواع الإجازات', idColumn: 'leave_type_id', group: 'requests' },
  { value: 'leave_balances', label: 'أرصدة الإجازات', idColumn: 'id', group: 'requests' },
  { value: 'leave_requests', label: 'طلبات الإجازات', idColumn: 'request_id', group: 'requests' },
  { value: 'permission_requests', label: 'طلبات الأذونات', idColumn: 'request_id', group: 'requests' },
  { value: 'deductions', label: 'الخصومات', idColumn: 'deduction_id', group: 'requests' },
];

const FIELD_CONFIGS: Record<string, FieldDef[]> = {
  employees: [
    { key: 'name', label: 'اسم الموظف' }, { key: 'job_title', label: 'الوظيفة' },
    { key: 'department', label: 'القسم' }, { key: 'phone', label: 'رقم الهاتف' },
    { key: 'national_id', label: 'الرقم القومي' }, { key: 'birth_date', label: 'تاريخ الميلاد', type: 'date' },
    { key: 'hire_date', label: 'تاريخ التعيين', type: 'date' }, { key: 'status', label: 'الحالة' },
  ],
  projects: [
    { key: 'name', label: 'اسم المشروع' }, { key: 'client', label: 'العميل' },
    { key: 'location_name', label: 'الموقع' }, { key: 'latitude', label: 'خط العرض', type: 'number' },
    { key: 'longitude', label: 'خط الطول', type: 'number' }, { key: 'geofence_radius_m', label: 'نطاق GPS بالمتر', type: 'number' },
    { key: 'status', label: 'الحالة' },
  ],
  shifts: [
    { key: 'name', label: 'اسم الوردية' }, { key: 'start_time', label: 'بداية الوردية', type: 'time' },
    { key: 'attendance_open', label: 'فتح الحضور', type: 'time' }, { key: 'attendance_close', label: 'إغلاق الحضور', type: 'time' },
    { key: 'checkout_open', label: 'فتح الانصراف', type: 'time' }, { key: 'checkout_close', label: 'إغلاق الانصراف', type: 'time' },
    { key: 'auto_checkout_time', label: 'الانصراف التلقائي', type: 'time' }, { key: 'status', label: 'الحالة' },
  ],
  users: [
    { key: 'username', label: 'اسم المستخدم' }, { key: 'employee_id', label: 'الموظف' },
    { key: 'role', label: 'الصلاحية' }, { key: 'status', label: 'حالة الحساب' },
  ],
  project_assignments: [
    { key: 'employee_id', label: 'الموظف' }, { key: 'project_id', label: 'المشروع' },
    { key: 'start_date', label: 'من', type: 'date' }, { key: 'end_date', label: 'إلى', type: 'date' },
    { key: 'is_current', label: 'التعيين الحالي', type: 'boolean' },
  ],
  employee_shifts: [
    { key: 'employee_id', label: 'الموظف' }, { key: 'project_id', label: 'المشروع' },
    { key: 'shift_id', label: 'الوردية' }, { key: 'start_date', label: 'من', type: 'date' },
    { key: 'end_date', label: 'إلى', type: 'date' },
  ],
  project_managers: [
    { key: 'user_id', label: 'حساب مدير المشروع' }, { key: 'project_id', label: 'المشروع' },
    { key: 'start_date', label: 'من', type: 'date' }, { key: 'end_date', label: 'إلى', type: 'date' },
  ],
  sector_manager_projects: [
    { key: 'user_id', label: 'مدير القطاع' }, { key: 'project_id', label: 'المشروع' },
    { key: 'start_date', label: 'من', type: 'date' }, { key: 'end_date', label: 'إلى', type: 'date' },
  ],
  leave_types: [
    { key: 'name', label: 'اسم نوع الإجازة' }, { key: 'requires_balance', label: 'يحتاج رصيدًا', type: 'boolean' },
    { key: 'annual_entitlement', label: 'الرصيد السنوي', type: 'number' }, { key: 'status', label: 'الحالة' },
  ],
  leave_balances: [
    { key: 'employee_id', label: 'الموظف' }, { key: 'leave_type_id', label: 'نوع الإجازة' },
    { key: 'year', label: 'السنة', type: 'number' }, { key: 'entitlement', label: 'الاستحقاق', type: 'number' },
    { key: 'used', label: 'المستخدم', type: 'number' }, { key: 'pending', label: 'المعلق', type: 'number' },
    { key: 'remaining', label: 'المتبقي', type: 'number' },
  ],
  leave_requests: [
    { key: 'employee_id', label: 'الموظف', readOnly: true }, { key: 'project_id', label: 'المشروع', readOnly: true },
    { key: 'leave_type_id', label: 'نوع الإجازة' }, { key: 'from_date', label: 'من', type: 'date' },
    { key: 'to_date', label: 'إلى', type: 'date' }, { key: 'days', label: 'الأيام', type: 'number' },
    { key: 'reason', label: 'السبب', type: 'textarea' }, { key: 'status', label: 'الحالة' },
  ],
  permission_requests: [
    { key: 'employee_id', label: 'الموظف' }, { key: 'project_id', label: 'المشروع' },
    { key: 'date', label: 'التاريخ', type: 'date' }, { key: 'permission_type', label: 'نوع الإذن' },
    { key: 'start_time', label: 'من', type: 'time' }, { key: 'end_time', label: 'إلى', type: 'time' },
    { key: 'reason', label: 'السبب', type: 'textarea' }, { key: 'status', label: 'الحالة' },
  ],
  deductions: [
    { key: 'employee_id', label: 'الموظف' }, { key: 'date', label: 'التاريخ', type: 'date' },
    { key: 'amount', label: 'القيمة', type: 'number' }, { key: 'reason', label: 'السبب', type: 'textarea' },
    { key: 'status', label: 'الحالة' },
  ],
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'حدث خطأ غير متوقع';
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function inputValue(value: unknown, type?: FieldDef['type']): string | boolean {
  if (type === 'boolean') return Boolean(value);
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (type === 'time') return text.slice(0, 5);
  if (type === 'date') return text.slice(0, 10);
  return text;
}

export default function SystemAdminPanel() {
  const [table, setTable] = useState(TABLES[0].value);
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [selected, setSelected] = useState<ApiRow | null>(null);
  const [form, setForm] = useState<ApiRow>({});
  const [advancedJson, setAdvancedJson] = useState('{}');
  const [advanced, setAdvanced] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const config = useMemo(() => TABLES.find((item) => item.value === table) ?? TABLES[0], [table]);
  const fields = FIELD_CONFIGS[table] ?? [];
  const idColumn = config.idColumn;

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => displayValue(value).toLowerCase().includes(term)));
  }, [rows, search]);

  async function load() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<ApiRow[]>('admin_list', { table });
      setRows(Array.isArray(result) ? result : []);
      setSelected(null); setForm({}); setAdvancedJson('{}');
    } catch (e: unknown) {
      setRows([]); setError(getErrorMessage(e));
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, [table]);

  function selectRow(row: ApiRow) {
    setSelected(row);
    const next: ApiRow = {};
    fields.forEach((field) => { next[field.key] = inputValue(row[field.key], field.type); });
    setForm(next);
    setAdvancedJson(JSON.stringify(row, null, 2));
    setAdvanced(false); setError(''); setNotice('');
  }

  function startInsert() {
    setSelected(null);
    const next: ApiRow = {};
    fields.forEach((field) => {
      if (!field.readOnly && !field.hidden) next[field.key] = field.type === 'boolean' ? false : '';
    });
    setForm(next); setAdvancedJson('{}'); setAdvanced(false); setError(''); setNotice('إضافة سجل جديد');
  }

  function updateField(field: FieldDef, value: string | boolean) {
    setForm((current) => ({ ...current, [field.key]: value }));
  }

  function normalize(source: ApiRow) {
    const result = { ...source };
    fields.forEach((field) => {
      if (!(field.key in result)) return;
      if (field.type === 'number') {
        const raw = String(result[field.key] ?? '').trim();
        result[field.key] = raw === '' ? null : Number(raw);
      }
      if (field.type === 'boolean') result[field.key] = Boolean(result[field.key]);
    });
    return result;
  }

  async function save() {
    let payload: ApiRow;
    try {
      if (advanced) {
        const parsed: unknown = JSON.parse(advancedJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('بيانات JSON يجب أن تكون كائنًا');
        payload = parsed as ApiRow;
      } else payload = normalize(form);
    } catch (e: unknown) {
      setError(getErrorMessage(e)); return;
    }

    setBusy(true); setError(''); setNotice('');
    try {
      if (selected) {
        const id = String(selected[idColumn] ?? '').trim();
        if (!id) throw new Error(`لا يوجد مفتاح ${idColumn} في السجل المحدد`);
        delete payload[idColumn];
        if (table === 'users') delete payload.password_hash;
        await api('admin_update', { table, id_column: idColumn, id, changes: payload });
        setNotice('تم حفظ التعديلات بنجاح');
      } else {
        if (table === 'users') delete payload.password_hash;
        await api('admin_insert', { table, row: payload });
        setNotice('تمت إضافة السجل بنجاح');
      }
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!selected) return setError('اختر سجلًا أولًا');
    const id = String(selected[idColumn] ?? '').trim();
    if (!id) return setError(`لا يوجد مفتاح ${idColumn} في السجل المحدد`);

    if (table === 'shifts') {
      if (!window.confirm('الوردية مرتبطة بموظفين. سيتم تعطيلها بدل حذفها للحفاظ على التعيينات والسجل التاريخي.')) return;
      setBusy(true); setError('');
      try {
        await api('admin_update', { table: 'shifts', id_column: 'shift_id', id, changes: { status: 'INACTIVE' } });
        setNotice('تم تعطيل الوردية بنجاح. السجلات التاريخية محفوظة.');
        await load();
      } catch (e: unknown) { setError(getErrorMessage(e)); }
      finally { setBusy(false); }
      return;
    }

    if (!window.confirm(`تأكيد حذف ${config.label}؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('admin_delete', { table, id_column: idColumn, id });
      setNotice('تم حذف السجل بنجاح'); await load();
    } catch (e: unknown) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  const groupLabels = { workforce: 'القوى العاملة', operations: 'التشغيل والتعيينات', requests: 'المعاملات والطلبات', security: 'الحسابات والصلاحيات' } as const;

  return (
    <section className="panel page-panel" style={{ minHeight: 650 }}>
      <div className="panel-head" style={{ alignItems: 'center' }}>
        <div>
          <div className="eyebrow">SYSTEM CONTROL CENTER</div>
          <h2 style={{ fontSize: 22, marginTop: 5 }}>مركز إدارة النظام</h2>
          <p>إدارة بيانات النظام بالكامل من داخل ELNUBY HR مع حماية العلاقات وسجل Audit.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="live"><b /> مدير النظام</span>
          <span className="count-pill">{rows.length} سجل</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
        {(['workforce', 'operations', 'requests', 'security'] as const).map((group) => (
          <div key={group} style={{ border: '1px solid var(--line)', borderRadius: 13, padding: 13, background: '#fbfcff' }}>
            <div style={{ color: 'var(--blue)', fontSize: 18, fontWeight: 900 }}>{TABLES.filter((x) => x.group === group).length}</div>
            <div style={{ fontSize: 11, fontWeight: 800, marginTop: 4 }}>{groupLabels[group]}</div>
          </div>
        ))}
      </div>

      <div className="request-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(180px,2fr) auto auto', gap: 10, alignItems: 'center' }}>
          <select value={table} onChange={(e) => setTable(e.target.value)} disabled={busy} aria-label="اختيار قسم الإدارة">
            {TABLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`بحث داخل ${config.label}...`} />
          <button type="button" className="secondary" onClick={() => void load()} disabled={busy}>تحديث</button>
          <button type="button" className="primary" onClick={startInsert} disabled={busy}>+ إضافة</button>
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(320px,.9fr)', gap: 14, alignItems: 'start' }}>
        <section style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '15px 17px', background: '#f8faff', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
            <div><strong>{config.label}</strong><div style={{ fontSize: 10, color: '#8290a4', marginTop: 4 }}>{filteredRows.length} نتيجة</div></div>
            <span style={{ fontSize: 10, color: '#8290a4' }}>المفتاح: {idColumn}</span>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 560 }}>
            <table className="data-table">
              <thead><tr><th>المعرف</th><th>البيانات الأساسية</th><th>الحالة</th><th>إجراء</th></tr></thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>{busy ? 'جاري التحميل...' : 'لا توجد سجلات'}</td></tr>
                ) : filteredRows.map((row, index) => {
                  const id = String(row[idColumn] ?? '');
                  const summary = fields.slice(0, 3).map((field) => `${field.label}: ${displayValue(row[field.key])}`).join(' • ');
                  return (
                    <tr key={`${id}-${index}`} style={{ background: selected === row ? '#f5f9ff' : undefined }}>
                      <td style={{ fontWeight: 800, color: 'var(--blue)' }}>{id || '—'}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 260 }}>{summary || Object.entries(row).filter(([k]) => k !== 'password_hash').slice(0, 3).map(([k,v]) => `${k}: ${displayValue(v)}`).join(' • ')}</td>
                      <td>{row.status ? <span className="live">{String(row.status)}</span> : '—'}</td>
                      <td><button type="button" className="secondary" onClick={() => selectRow(row)} disabled={busy}>فتح</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 17, background: '#fff', position: 'sticky', top: 90 }}>
          <div style={{ marginBottom: 15 }}>
            <div className="eyebrow">RECORD EDITOR</div>
            <h3 style={{ margin: '5px 0', fontSize: 17 }}>{selected ? 'تعديل السجل' : 'سجل جديد'}</h3>
            <p style={{ margin: 0, color: '#8290a4', fontSize: 10 }}>{selected ? `تعديل ${idColumn}: ${String(selected[idColumn] ?? '—')}` : `إضافة سجل إلى ${config.label}`}</p>
          </div>

          {fields.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {fields.filter((field) => !field.hidden).map((field) => (
                <label key={field.key} style={{ fontSize: 10, color: '#536177', fontWeight: 700, gridColumn: field.type === 'textarea' ? '1 / -1' : undefined }}>
                  {field.label}{field.readOnly && <span style={{ color: '#9aa6b7', marginRight: 5 }}>(قراءة فقط)</span>}
                  {field.type === 'textarea' ? (
                    <textarea value={String(form[field.key] ?? '')} onChange={(e) => updateField(field, e.target.value)} disabled={busy || field.readOnly} rows={3} style={{ width: '100%', marginTop: 5, border: '1px solid #dbe2ec', borderRadius: 10, padding: 10, resize: 'vertical' }} />
                  ) : field.type === 'boolean' ? (
                    <div style={{ marginTop: 5, border: '1px solid #dbe2ec', borderRadius: 10, padding: 9 }}><input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => updateField(field, e.target.checked)} disabled={busy || field.readOnly} /> <span style={{ marginRight: 6 }}>{Boolean(form[field.key]) ? 'نعم' : 'لا'}</span></div>
                  ) : (
                    <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'} value={String(form[field.key] ?? '')} onChange={(e) => updateField(field, e.target.value)} disabled={busy || field.readOnly} style={{ marginTop: 5 }} />
                  )}
                </label>
              ))}
            </div>
          ) : <div className="empty-note">لا يوجد نموذج مخصص لهذا الجدول. استخدم الوضع المتقدم.</div>}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <button type="button" className="secondary" onClick={() => setAdvanced((v) => !v)} disabled={busy}>{advanced ? 'إخفاء الوضع المتقدم' : 'بيانات متقدمة JSON'}</button>
            {advanced && <textarea value={advancedJson} onChange={(e) => setAdvancedJson(e.target.value)} rows={8} spellCheck={false} style={{ width: '100%', marginTop: 8, direction: 'ltr', fontFamily: 'monospace', border: '1px solid #dbe2ec', borderRadius: 10, padding: 10 }} />}
          </div>

          <div className="panel-actions" style={{ marginTop: 14 }}>
            <button type="button" className="primary" onClick={() => void save()} disabled={busy}>{busy ? 'جاري الحفظ...' : selected ? 'حفظ التعديلات' : 'إضافة السجل'}</button>
            {selected && <button type="button" className="secondary" onClick={() => void remove()} disabled={busy}>{table === 'shifts' ? 'تعطيل الوردية' : 'حذف'}</button>}
            <button type="button" className="secondary" onClick={startInsert} disabled={busy}>جديد</button>
          </div>

          {table === 'shifts' && selected && <div className="alert" style={{ background: '#fff9e8', color: '#8a6100', border: '1px solid #f4df9f', marginTop: 12 }}>الورديات المرتبطة بموظفين لا يتم حذفها فعليًا حتى لا تنكسر التعيينات أو السجلات التاريخية. استخدم تعطيل الوردية.</div>}
        </section>
      </div>
    </section>
  );
}
