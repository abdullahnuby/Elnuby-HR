'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Empty } from './common';

type Props = {
  rows: any[];
  role: string;
  employeeMode: boolean;
  leaveType: string;
  setLeaveType: (value: string) => void;
  leaveFrom: string;
  setLeaveFrom: (value: string) => void;
  leaveTo: string;
  setLeaveTo: (value: string) => void;
  leaveReason: string;
  setLeaveReason: (value: string) => void;
  createLeave: () => void;
  busy: boolean;
};

export default function LeaveSection(props: Props) {
  const {
    rows, role, employeeMode, leaveType, setLeaveType, leaveFrom, setLeaveFrom,
    leaveTo, setLeaveTo, leaveReason, setLeaveReason, createLeave, busy,
  } = props;

  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const manager = role === 'PROJECT_MANAGER';
  const hr = role === 'HR_MANAGER' || role === 'SYSTEM_ADMIN';

  useEffect(() => {
    let active = true;
    async function loadDetails() {
      if (!rows.length) return;
      const needsEmployeeFallback = rows.some((row) => !row.employee_name && row.employee_id);
      const needsProjectFallback = rows.some((row) => !row.project_name && row.project_id);
      if (!needsEmployeeFallback && !needsProjectFallback) return;

      setLoadingDetails(true);
      try {
        const [employeeRows, projectRows] = await Promise.all([
          needsEmployeeFallback ? api<any[]>('employees') : Promise.resolve([]),
          needsProjectFallback ? api<any[]>('projects') : Promise.resolve([]),
        ]);
        if (!active) return;
        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
        setProjects(Array.isArray(projectRows) ? projectRows : []);
      } catch {
        // The API row is still rendered using its IDs.
      } finally {
        if (active) setLoadingDetails(false);
      }
    }
    void loadDetails();
    return () => { active = false; };
  }, [rows]);

  const displayRows = useMemo(() => {
    const employeeMap = new Map(employees.map((e) => [String(e.employee_id), e]));
    const projectMap = new Map(projects.map((p) => [String(p.project_id), p]));

    return rows.map((row) => {
      const employee = employeeMap.get(String(row.employee_id));
      const project = projectMap.get(String(row.project_id));
      return {
        ...row,
        employee_name: row.employee_name || employee?.name || row.employee_id,
        job_title: row.job_title || employee?.job_title,
        department: row.department || employee?.department,
        employee_status: row.employee_status || employee?.status,
        project_name: row.project_name || project?.name || row.project_id,
      };
    });
  }, [rows, employees, projects]);

  async function decide(action: 'decide_leave_manager' | 'decide_leave_hr', requestId: string, decision: 'APPROVE' | 'REJECT') {
    try {
      await api(action, { request_id: requestId, decision });
      location.reload();
    } catch (error: any) {
      alert(error?.message || 'تعذر تنفيذ القرار');
    }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">LEAVE MANAGEMENT</div>
          <h2>الإجازات</h2>
          <p>عرض كامل لبيانات الموظف والمشروع والرصيد مع مسار اعتماد واضح من مدير المشروع إلى HR.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="count-pill">{displayRows.length} طلب</span>
          {loadingDetails && <span className="live">جاري تحميل بيانات الموظفين</span>}
        </div>
      </div>

      {employeeMode && (
        <div className="request-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>طلب إجازة جديد</h3>
              <p style={{ margin: '5px 0 0', color: '#8290a4', fontSize: 10 }}>حدد النوع والفترة والسبب ثم أرسل الطلب للاعتماد.</p>
            </div>
            <span className="live">طلب جديد</span>
          </div>

          <div className="formgrid">
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              <option value="LT-ANNUAL">سنوية</option>
              <option value="LT-CASUAL">عارضة</option>
              <option value="LT-SICK">مرضية</option>
              <option value="LT-UNPAID">بدون أجر</option>
              <option value="LT-OTHER">أخرى</option>
            </select>
            <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
            <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
            <input placeholder="سبب الإجازة" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
          </div>

          <button className="primary" disabled={busy} onClick={createLeave}>{busy ? 'جاري الإرسال...' : 'إرسال طلب الإجازة'}</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['الموظف','الوظيفة','القسم','المشروع','النوع','من','إلى','الأيام','الرصيد','المعلق','المستخدم','الحالة','إجراء'].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r: any) => (
              <tr key={r.request_id}>
                <td>
                  <strong style={{ display: 'block' }}>{r.employee_name || r.employee_id || 'غير محدد'}</strong>
                  <small style={{ color: '#8290a4' }}>{r.employee_id || '—'}</small>
                </td>
                <td>{r.job_title || 'غير محدد'}</td>
                <td>{r.department || 'غير محدد'}</td>
                <td>{r.project_name || r.project_id || 'غير محدد'}</td>
                <td>{r.leave_type_name || r.leave_type_id || 'غير محدد'}</td>
                <td>{r.from_date || '—'}</td>
                <td>{r.to_date || '—'}</td>
                <td>{r.days ?? '—'}</td>
                <td>{r.leave_balance?.remaining ?? 'غير متاح'}</td>
                <td>{r.leave_balance?.pending ?? '—'}</td>
                <td>{r.leave_balance?.used ?? '—'}</td>
                <td><span className={r.status === 'APPROVED' ? 'live' : r.status === 'REJECTED' ? 'alert danger' : 'count-pill'}>{r.status || 'غير محدد'}</span></td>
                <td>
                  {manager && r.status === 'PENDING_MANAGER' && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="tiny approve" onClick={() => void decide('decide_leave_manager', r.request_id, 'APPROVE')}>اعتماد</button>
                      <button className="tiny reject" onClick={() => void decide('decide_leave_manager', r.request_id, 'REJECT')}>رفض</button>
                    </div>
                  )}
                  {hr && r.status === 'PENDING_HR' && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="tiny approve" onClick={() => void decide('decide_leave_hr', r.request_id, 'APPROVE')}>اعتماد HR</button>
                      <button className="tiny reject" onClick={() => void decide('decide_leave_hr', r.request_id, 'REJECT')}>رفض</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!displayRows.length && <Empty text="لا توجد طلبات إجازة." />}
    </section>
  );
}
