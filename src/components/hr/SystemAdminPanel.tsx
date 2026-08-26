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
const [table, setTable] = useState<string>(TABLES[0].value);

const config = useMemo(
  () => TABLES.find((x) => x.value === table) ?? TABLES[0],
  [table]
);

const idColumn = config.idColumn;
export default function SystemAdminPanel() {
  const [table, setTable] = useState(TABLES[0][0]); const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null); const [json, setJson] = useState('{}');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const config = useMemo(() => TABLES.find((x) => x[0] === table)!, [table]); const idColumn = config[2];
  async function load() { setBusy(true); setError(''); try { setRows(await api<any[]>('admin_list', { table }) || []); setSelected(null); setJson('{}'); } catch (e:any) { setError(e.message); } finally { setBusy(false); } }
  useEffect(() => { load(); }, [table]);
  function selectRow(row:any) { setSelected(row); setJson(JSON.stringify(row, null, 2)); setError(''); setNotice(''); }
  async function save() { let parsed:any; try { parsed=JSON.parse(json); } catch { setError('بيانات JSON غير صحيحة'); return; } if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return setError('البيانات يجب أن تكون كائنًا'); setBusy(true); setError(''); setNotice(''); try { if (selected) { const id=String(selected[idColumn] ?? ''); if (!id) throw new Error(`لا يوجد مفتاح ${idColumn}`); delete parsed[idColumn]; if (table==='users') delete parsed.password_hash; await api('admin_update',{table,id_column:idColumn,id,changes:parsed}); setNotice('تم حفظ التعديل'); } else { await api('admin_insert',{table,row:parsed}); setNotice('تمت إضافة السجل'); } await load(); } catch(e:any) { setError(e.message); } finally { setBusy(false); } }
  async function remove() { if (!selected) return; const id=String(selected[idColumn] ?? ''); if (!id) return setError(`لا يوجد مفتاح ${idColumn}`); if (!window.confirm('تأكيد حذف السجل؟')) return; setBusy(true); setError(''); try { await api('admin_delete',{table,id_column:idColumn,id}); setNotice('تم حذف السجل'); await load(); } catch(e:any) { setError(e.message); } finally { setBusy(false); } }
  return <section className="panel page-panel">
    <div className="panel-head"><div><h2>مركز إدارة النظام</h2><p>مدير النظام يستطيع إضافة وتعديل وحذف بيانات النظام من داخل البرنامج بدون فتح Supabase.</p></div><span className="count-pill">CRUD كامل</span></div>
    <div className="request-card"><h3>إدارة البيانات</h3><div className="formgrid"><select value={table} onChange={e=>setTable(e.target.value)}>{TABLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="secondary" onClick={load} disabled={busy}>تحديث</button><button className="secondary" onClick={()=>{setSelected(null);setJson('{}');setNotice('وضع إضافة سجل جديد')}}>إضافة سجل جديد</button></div></div>
    {error && <div className="alert danger">{error}</div>}{notice && <div className="alert success">{notice}</div>}
    <div className="dashboard-grid">
      <section className="panel page-panel"><div className="panel-head"><div><h3>{config[1]}</h3><p>{rows.length} سجل</p></div></div><div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>المعرف</th><th>ملخص</th><th></th></tr></thead><tbody>{rows.map((r:any,i:number)=>{const id=String(r[idColumn]??''); const summary=Object.entries(r).filter(([k])=>k!=='password_hash').slice(0,5).map(([k,v])=>`${k}: ${String(v??'—')}`).join(' | '); return <tr key={`${id}-${i}`}><td>{id||'—'}</td><td>{summary}</td><td><button className="secondary" onClick={()=>selectRow(r)}>تعديل</button></td></tr>})}</tbody></table></div></section>
      <section className="panel page-panel"><div className="panel-head"><div><h3>{selected?'تعديل السجل':'إضافة سجل'}</h3><p>التعديلات تمر عبر Backend وتدخل مسار Audit.</p></div></div><textarea value={json} onChange={e=>setJson(e.target.value)} rows={22} style={{width:'100%',direction:'ltr',fontFamily:'monospace'}}/><div className="panel-actions" style={{marginTop:12}}><button className="primary" onClick={save} disabled={busy}>{selected?'حفظ التعديل':'إضافة السجل'}</button>{selected&&<button className="secondary" onClick={remove} disabled={busy}>حذف</button>}{selected&&<button className="secondary" onClick={()=>{setSelected(null);setJson('{}')}}>إلغاء</button>}</div></section>
    </div>
  </section>;
}
