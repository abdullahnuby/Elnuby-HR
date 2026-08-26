import { api } from '@/lib/api';
import { Empty } from './common';
export default function LeaveSection({
  rows,
  role,
  employeeMode,
  leaveType,
  setLeaveType,
  leaveFrom,
  setLeaveFrom,
  leaveTo,
  setLeaveTo,
  leaveReason,
  setLeaveReason,
  createLeave,
  busy,
}: any) {
  const manager =
    role === 'PROJECT_MANAGER';

  const hr =
    role === 'HR_MANAGER' ||
    role === 'SYSTEM_ADMIN';

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>الإجازات</h2>

          <p>
            مسار الاعتماد: الموظف ← مدير المشروع
            ← الموارد البشرية. تظهر لمدير المشروع
            وHR حالة الموظف ورصيد الإجازة قبل
            القرار.
          </p>
        </div>
      </div>

      {employeeMode && (
        <div className="request-card">
          <h3>
            طلب إجازة جديد
          </h3>

          <div className="formgrid">
            <select
              value={leaveType}
              onChange={(e) =>
                setLeaveType(
                  e.target.value,
                )
              }
            >
              <option value="LT-ANNUAL">
                سنوية
              </option>

              <option value="LT-CASUAL">
                عارضة
              </option>

              <option value="LT-SICK">
                مرضية
              </option>

              <option value="LT-UNPAID">
                بدون أجر
              </option>

              <option value="LT-OTHER">
                أخرى
              </option>
            </select>

            <input
              type="date"
              value={leaveFrom}
              onChange={(e) =>
                setLeaveFrom(
                  e.target.value,
                )
              }
            />

            <input
              type="date"
              value={leaveTo}
              onChange={(e) =>
                setLeaveTo(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="سبب الإجازة"
              value={leaveReason}
              onChange={(e) =>
                setLeaveReason(
                  e.target.value,
                )
              }
            />
          </div>

          <button
            className="primary"
            disabled={busy}
            onClick={createLeave}
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
                'الوظيفة',
                'حالة الموظف',
                'النوع',
                'من',
                'إلى',
                'الأيام',
                'الرصيد المتاح',
                'المعلق',
                'المستخدم',
                'السبب',
                'الحالة',
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
                  {r.employee_name ||
                    r.employee_id}
                </td>

                <td>
                  {r.job_title || '—'}
                </td>

                <td>
                  {r.employee_status ||
                    '—'}
                </td>

                <td>
                  {r.leave_type_name ||
                    r.leave_type_id}
                </td>

                <td>
                  {r.from_date}
                </td>

                <td>
                  {r.to_date}
                </td>

                <td>
                  {r.days ?? '—'}
                </td>

                <td>
                  {r.leave_balance
                    ? r.leave_balance
                        .remaining
                    : 'غير متاح'}
                </td>

                <td>
                  {r.leave_balance
                    ? r.leave_balance
                        .pending
                    : '—'}
                </td>

                <td>
                  {r.leave_balance
                    ? r.leave_balance.used
                    : '—'}
                </td>

                <td>
                  {r.reason || '—'}
                </td>

                <td>{r.status}</td>

                <td>
                  {manager &&
                    r.status ===
                      'PENDING_MANAGER' && (
                      <>
                        <button
                          className="tiny approve"
                          onClick={async () => {
                            await api(
                              'decide_leave_manager',
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
                              'decide_leave_manager',
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

                  {hr &&
                    r.status ===
                      'PENDING_HR' && (
                      <>
                        <button
                          className="tiny approve"
                          onClick={async () => {
                            await api(
                              'decide_leave_hr',
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
                          اعتماد HR
                        </button>

                        <button
                          className="tiny reject"
                          onClick={async () => {
                            await api(
                              'decide_leave_hr',
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
        <Empty text="لا توجد طلبات إجازة." />
      )}
    </section>
  );
}

