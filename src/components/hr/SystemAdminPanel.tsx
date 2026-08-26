'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type AdminTable = {
  value: string;
  label: string;
  idColumn: string;
};

const TABLES: AdminTable[] = [
  { value: 'employees', label: 'الموظفون', idColumn: 'employee_id' },
  { value: 'projects', label: 'المشاريع', idColumn: 'project_id' },
  { value: 'shifts', label: 'الورديات', idColumn: 'shift_id' },
  { value: 'users', label: 'حسابات المستخدمين', idColumn: 'id' },
  { value: 'project_assignments', label: 'تعيينات الموظفين بالمشاريع', idColumn: 'assignment_id' },
  { value: 'employee_shifts', label: 'تعيينات الموظفين بالورديات', idColumn: 'assignment_id' },
  { value: 'project_managers', label: 'مديرو المشاريع', idColumn: 'id' },
  { value: 'sector_manager_projects', label: 'مديرو القطاعات ومشروعاتهم', idColumn: 'assignment_id' },
  { value: 'attendance', label: 'الحضور والانصراف', idColumn: 'attendance_id' },
  { value: 'leave_types', label: 'أنواع الإجازات', idColumn: 'leave_type_id' },
  { value: 'leave_balances', label: 'أرصدة الإجازات', idColumn: 'id' },
  { value: 'leave_requests', label: 'طلبات الإجازات', idColumn: 'request_id' },
  { value: 'permission_requests', label: 'طلبات الأذونات', idColumn: 'request_id' },
  { value: 'deductions', label: 'الخصومات', idColumn: 'deduction_id' },
];

type ApiRow = Record<string, unknown>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'حدث خطأ غير متوقع';
}

export default function SystemAdminPanel() {
  const [table, setTable] = useState<string>(TABLES[0].value);
  const [rows, setRows] = useState<ApiRow[]>([]);
  const [selected, setSelected] = useState<ApiRow | null>(null);
  const [json, setJson] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const config = useMemo<AdminTable>(
    () => TABLES.find((item) => item.value === table) ?? TABLES[0],
    [table]
  );

  const idColumn = config.idColumn;

  async function load() {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const result = await api<ApiRow[]>('admin_list', { table });
      setRows(Array.isArray(result) ? result : []);
      setSelected(null);
      setJson('{}');
    } catch (e: unknown) {
      setRows([]);
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [table]);

  function selectRow(row: ApiRow) {
    setSelected(row);
    setJson(JSON.stringify(row, null, 2));
    setError('');
    setNotice('');
  }

  function startInsert() {
    setSelected(null);
    setJson('{}');
    setError('');
    setNotice('وضع إضافة سجل جديد');
  }

  function cancelEdit() {
    setSelected(null);
    setJson('{}');
    setError('');
    setNotice('');
  }

  async function save() {
    let parsed: ApiRow;

    try {
      const value: unknown = JSON.parse(json);

      if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value)
      ) {
        setError('البيانات يجب أن تكون كائنًا JSON');
        return;
      }

      parsed = value as ApiRow;
    } catch {
      setError('بيانات JSON غير صحيحة');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (selected) {
        const selectedId = selected[idColumn];

        if (
          selectedId === undefined ||
          selectedId === null ||
          String(selectedId).trim() === ''
        ) {
          throw new Error(`لا يوجد مفتاح ${idColumn} في السجل المحدد`);
        }

        const changes: ApiRow = { ...parsed };
        delete changes[idColumn];

        // Never allow the system admin CRUD editor to overwrite
        // the password hash directly.
        if (table === 'users') {
          delete changes.password_hash;
        }

        await api('admin_update', {
          table,
          id_column: idColumn,
          id: String(selectedId),
          changes,
        });

        setNotice('تم حفظ التعديل بنجاح');
      } else {
        const row: ApiRow = { ...parsed };

        // Never accept password_hash through the generic CRUD editor.
        // User password changes should go through the dedicated auth flow.
        if (table === 'users') {
          delete row.password_hash;
        }

        await api('admin_insert', {
          table,
          row,
        });

        setNotice('تمت إضافة السجل بنجاح');
      }

      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) {
      setError('اختر سجلًا أولًا للحذف');
      return;
    }

    const selectedId = selected[idColumn];

    if (
      selectedId === undefined ||
      selectedId === null ||
      String(selectedId).trim() === ''
    ) {
      setError(`لا يوجد مفتاح ${idColumn} في السجل المحدد`);
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف السجل من "${config.label}"؟\nهذا الإجراء لا يمكن التراجع عنه.`
    );

    if (!confirmed) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api('admin_delete', {
        table,
        id_column: idColumn,
        id: String(selectedId),
      });

      setSelected(null);
      setJson('{}');
      setNotice('تم حذف السجل بنجاح');
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function renderSummary(row: ApiRow) {
    return Object.entries(row)
      .filter(([key]) => key !== 'password_hash')
      .slice(0, 5)
      .map(([key, value]) => `${key}: ${String(value ?? '—')}`)
      .join(' | ');
  }

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>مركز إدارة النظام</h2>
          <p>
            مدير النظام يستطيع إضافة وتعديل وحذف بيانات النظام من داخل
            البرنامج بدون فتح Supabase.
          </p>
        </div>
        <span className="count-pill">CRUD كامل</span>
      </div>

      <div className="request-card">
        <h3>إدارة البيانات</h3>

        <div className="formgrid">
          <select
            value={table}
            onChange={(event) => setTable(event.target.value)}
            disabled={busy}
            aria-label="اختيار جدول الإدارة"
          >
            {TABLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
            disabled={busy}
          >
            {busy ? 'جاري التنفيذ...' : 'تحديث'}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={startInsert}
            disabled={busy}
          >
            إضافة سجل جديد
          </button>
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="dashboard-grid">
        <section className="panel page-panel">
          <div className="panel-head">
            <div>
              <h3>{config.label}</h3>
              <p>{rows.length} سجل</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>المعرف</th>
                  <th>ملخص</th>
                  <th>الإجراء</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center' }}>
                      {busy ? 'جاري تحميل البيانات...' : 'لا توجد بيانات'}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const id = String(row[idColumn] ?? '');

                    return (
                      <tr key={`${id || 'row'}-${index}`}>
                        <td>{id || '—'}</td>
                        <td>{renderSummary(row) || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => selectRow(row)}
                            disabled={busy}
                          >
                            تعديل
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel page-panel">
          <div className="panel-head">
            <div>
              <h3>{selected ? 'تعديل السجل' : 'إضافة سجل'}</h3>
              <p>
                التعديلات تمر عبر Backend وتدخل مسار Audit.
              </p>
            </div>
          </div>

          <textarea
            value={json}
            onChange={(event) => setJson(event.target.value)}
            rows={22}
            disabled={busy}
            spellCheck={false}
            style={{
              width: '100%',
              direction: 'ltr',
              fontFamily: 'monospace',
            }}
            aria-label="بيانات السجل بصيغة JSON"
          />

          <div className="panel-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primary"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy
                ? 'جاري الحفظ...'
                : selected
                  ? 'حفظ التعديل'
                  : 'إضافة السجل'}
            </button>

            {selected && (
              <button
                type="button"
                className="secondary"
                onClick={() => void remove()}
                disabled={busy}
              >
                حذف
              </button>
            )}

            <button
              type="button"
              className="secondary"
              onClick={cancelEdit}
              disabled={busy}
            >
              إلغاء
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
