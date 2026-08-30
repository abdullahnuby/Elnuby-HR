import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Badge } from './common';
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
  const [localRows, setLocalRows] = useState(rows);
  useEffect(() => setLocalRows(rows), [rows]);

  async function decide(requestId: string, decision: 'APPROVE'|'REJECT') {
    try { await api('decide_permission', { request_id: requestId, decision }); setLocalRows((prev:any[]) => prev.map(r => r.request_id === requestId ? {...r, status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'} : r)); window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:decision==='APPROVE'?'تم اعتماد طلب الإذن':'تم رفض طلب الإذن'}})); }
    catch (error:any) { window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:error?.message||'تعذر تنفيذ القرار',type:'error'}})); }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>الأذونات</h2>

          <p>
            طلبات الأذونات تمر إلى مدير المشروع
            للموافقة.
          </p>
        </div>
      </div>

      {employeeMode && (
        <div className="request-card">
          <h3>
            طلب إذن جديد
          </h3>

          <div className="formgrid">
            <input
              value={permissionType}
              onChange={(e) =>
                setPermissionType(
                  e.target.value,
                )
              }
              placeholder="نوع الإذن"
            />

            <input
              type="datetime-local"
              value={permissionStart}
              onChange={(e) =>
                setPermissionStart(
                  e.target.value,
                )
              }
            />

            <input
              type="datetime-local"
              value={permissionEnd}
              onChange={(e) =>
                setPermissionEnd(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="السبب"
              value={permissionReason}
              onChange={(e) =>
                setPermissionReason(
                  e.target.value,
                )
              }
            />
          </div>

          <button
            className="primary"
            disabled={busy}
            onClick={
              createPermission
            }
          >
            إرسال الطلب
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                'الموظف',
                'البداية',
                'النهاية',
                'المدة',
                'الحالة',
                'السبب',
                'إجراء',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {localRows.map((r: any) => (
              <tr key={r.request_id}>
                <td>
                  {r.employee_id}
                </td>

                <td>
                  {r.start_time}
                </td>

                <td>
                  {r.end_time}
                </td>

                <td>
                  {r.minutes} دقيقة
                </td>

                <td><Badge status={r.status}/></td>

                <td>
                  {r.reason || '—'}
                </td>

                <td>
                  {r.status ===
                    'PENDING' && (
                    <>
                      <button
                        className="tiny approve"
                        onClick={async () => {
                          void decide(r.request_id, 'APPROVE');
                        }}
                      >
                        اعتماد
                      </button>

                      <button
                        className="tiny reject"
                        onClick={async () => {
                          void decide(r.request_id, 'REJECT');
                        }}
                      >
                        رفض
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && (
        <Empty text="لا توجد طلبات إذن." />
      )}
    </section>
  );
}

