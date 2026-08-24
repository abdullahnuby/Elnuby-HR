import { api } from '@/lib/api';
import { Empty } from './common';
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
            {rows.map((r: any) => (
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

                <td>{r.status}</td>

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
                          await api(
                            'decide_permission',
                            {
                              request_id:
                                r.request_id,
                              decision:
                                'APPROVE',
                            },
                          );

                          location.reload();
                        }}
                      >
                        اعتماد
                      </button>

                      <button
                        className="tiny reject"
                        onClick={async () => {
                          await api(
                            'decide_permission',
                            {
                              request_id:
                                r.request_id,
                              decision:
                                'REJECT',
                            },
                          );

                          location.reload();
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

