import type { CSSProperties } from 'react';
import Icon from './Icon';
import { Empty } from './common';

type ManagerDashboardProps = {
  me: any;
  dash: any;
  managerDash: any;
  roleLabels: Record<string, string>;
  setSection: (section: string) => void;
  locate?: (action: string) => void;
  busy?: boolean;
};

const STATE_META: Record<string, { label: string; tone: string; icon: string }> = {
  PRESENT: { label: 'حاضر', tone: 'success', icon: 'check' },
  CHECKED_IN: { label: 'لم ينصرف', tone: 'warning', icon: 'attendance' },
  LATE: { label: 'متأخر', tone: 'danger', icon: 'alert' },
  ON_LEAVE: { label: 'إجازة', tone: 'info', icon: 'calendar' },
  ABSENT: { label: 'غائب', tone: 'muted', icon: 'users' },
};

function StatusBadge({ state, label }: { state?: string; label?: string }) {
  const meta = STATE_META[state || ''] || { label: label || state || '—', tone: 'muted', icon: 'dashboard' };
  return (
    <span className={`pm-status pm-status-${meta.tone}`}>
      <Icon name={meta.icon} size={13} />
      {label || meta.label}
    </span>
  );
}

function formatDate() {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

function timeValue(value: any) {
  if (!value) return '—';
  const raw = String(value).slice(0, 5);
  return raw;
}

export default function ManagerDashboard({ me, managerDash, setSection, locate, busy }: ManagerDashboardProps) {
  const summary = managerDash?.summary || {};
  const projects = Array.isArray(managerDash?.projects) ? managerDash.projects : [];
  const team = Array.isArray(managerDash?.team) ? managerDash.team : [];
  const leaves = Array.isArray(managerDash?.pendingLeaves) ? managerDash.pendingLeaves : [];
  const permissions = Array.isArray(managerDash?.pendingPermissions) ? managerDash.pendingPermissions : [];
  const selfAttendance = managerDash?.selfAttendance || null;
  const total = Math.max(Number(summary.employees) || 0, 1);
  const presentPct = Math.min(100, Math.round(((Number(summary.present) || 0) / total) * 100));
  const attendedPct = Math.min(100, Math.round((((Number(summary.present) || 0) + (Number(summary.onLeave) || 0)) / total) * 100));

  const firstName = String(me?.employee?.name || me?.user?.username || 'مدير المشروع').split(' ')[0];
  const attentionCount = (Number(summary.missingCheckout) || 0) + (Number(summary.pendingLeaves) || 0) + (Number(summary.pendingPermissions) || 0);

  return (
    <div className="pm-dashboard">
      {managerDash?.assignmentMissing && (
        <section className="pm-alert">
          <div className="pm-alert-icon"><Icon name="alert" size={19} /></div>
          <div>
            <strong>لا يوجد مشروع مرتبط بهذا الحساب</strong>
            <p>اربط مدير المشروع بمشروع من حسابات المستخدمين حتى تظهر بيانات الفريق والمؤشرات.</p>
          </div>
          <button className="secondary" onClick={() => setSection('users')}>فتح الحسابات</button>
        </section>
      )}

      <section className="pm-hero">
        <div className="pm-hero-copy">
          <div className="pm-eyebrow"><span className="pm-live-dot" /> مركز إدارة المشروع</div>
          <h1>صباح الخير، {firstName}</h1>
          <p>نظرة تشغيلية سريعة على مشاريعك، فريق العمل، الحضور والطلبات التي تحتاج قرارًا.</p>
          <div className="pm-hero-meta">
            <span><Icon name="calendar" size={15} /> {formatDate()}</span>
            <span><Icon name="projects" size={15} /> {projects.length} {projects.length === 1 ? 'مشروع' : 'مشاريع'} نشطة</span>
          </div>
        </div>
        <div className="pm-hero-actions">
          <button className="pm-action pm-action-primary" onClick={() => setSection('attendance')}>
            <Icon name="attendance" size={18} />
            <span>الحضور والانصراف</span>
          </button>
          <button className="pm-action" onClick={() => setSection('employees')}>
            <Icon name="users" size={18} />
            <span>فريق العمل</span>
          </button>
        </div>
      </section>

      <section className="pm-attendance-card">
        <div className="pm-attendance-main">
          <div className="pm-attendance-icon"><Icon name="attendance" size={23} /></div>
          <div>
            <div className="pm-section-kicker">حضورك الشخصي</div>
            <h2>سجل حضورك وانصرافك من الموقع</h2>
            <p>يتم التحقق من موقعك الجغرافي ونطاق المشروع قبل التسجيل.</p>
          </div>
        </div>
        <div className="pm-attendance-times">
          <div><span>الحضور</span><strong>{timeValue(selfAttendance?.check_in)}</strong></div>
          <div><span>الانصراف</span><strong>{timeValue(selfAttendance?.check_out)}</strong></div>
        </div>
        <div className="pm-attendance-cta">
          <StatusBadge
            state={selfAttendance?.check_out ? 'PRESENT' : selfAttendance?.check_in ? 'CHECKED_IN' : undefined}
            label={selfAttendance?.check_out ? 'اليوم مكتمل' : selfAttendance?.check_in ? 'تم تسجيل الحضور' : 'لم يتم التسجيل'}
          />
          <button
            className="pm-attendance-button"
            disabled={busy}
            onClick={() => {
              if (selfAttendance?.check_out) setSection('attendance');
              else if (locate) locate(selfAttendance?.check_in ? 'check_out' : 'check_in');
              else setSection('attendance');
            }}
          >
            {busy ? 'جاري التحقق...' : selfAttendance?.check_in && !selfAttendance?.check_out ? 'تسجيل الانصراف' : selfAttendance?.check_out ? 'فتح سجل اليوم' : 'تسجيل الحضور'}
            <Icon name="check" size={16} />
          </button>
        </div>
      </section>

      <section className="pm-kpi-grid">
        <div className="pm-kpi pm-kpi-blue">
          <div className="pm-kpi-icon"><Icon name="users" size={20} /></div>
          <div><span>إجمالي الفريق</span><strong>{summary.employees ?? 0}</strong><small>موظف على مشاريعك</small></div>
        </div>
        <div className="pm-kpi pm-kpi-green">
          <div className="pm-kpi-icon"><Icon name="check" size={20} /></div>
          <div><span>حاضر اليوم</span><strong>{summary.present ?? 0}</strong><small>{presentPct}% من الفريق</small></div>
        </div>
        <div className="pm-kpi pm-kpi-orange">
          <div className="pm-kpi-icon"><Icon name="shifts" size={20} /></div>
          <div><span>متأخرون</span><strong>{summary.late ?? 0}</strong><small>يحتاجون متابعة</small></div>
        </div>
        <div className="pm-kpi pm-kpi-purple">
          <div className="pm-kpi-icon"><Icon name="leaves" size={20} /></div>
          <div><span>في إجازة</span><strong>{summary.onLeave ?? 0}</strong><small>اليوم</small></div>
        </div>
      </section>

      <div className="pm-main-grid">
        <section className="pm-card pm-workforce-card">
          <div className="pm-card-head">
            <div><span className="pm-section-kicker">المؤشرات التشغيلية</span><h2>حالة القوة العاملة اليوم</h2></div>
            {attentionCount > 0 && <button className="pm-inline-alert" onClick={() => setSection('attendance')}><Icon name="alert" size={14} /> {attentionCount} تحتاج متابعة</button>}
          </div>
          <div className="pm-health-layout">
            <div className="pm-health-ring" style={{ '--pm-progress': `${attendedPct}%` } as CSSProperties}>
              <div><strong>{attendedPct}%</strong><span>متابعة اليوم</span></div>
            </div>
            <div className="pm-health-legend">
              <div><i className="pm-dot green" /><span>حاضر</span><strong>{summary.present ?? 0}</strong></div>
              <div><i className="pm-dot orange" /><span>متأخر</span><strong>{summary.late ?? 0}</strong></div>
              <div><i className="pm-dot blue" /><span>إجازة</span><strong>{summary.onLeave ?? 0}</strong></div>
              <div><i className="pm-dot gray" /><span>غائب</span><strong>{summary.absent ?? 0}</strong></div>
            </div>
          </div>
          <div className="pm-progress-block"><div><span>نسبة الحضور</span><strong>{presentPct}%</strong></div><div className="pm-progress"><span style={{ width: `${presentPct}%` }} /></div></div>
        </section>

        <section className="pm-card pm-alerts-card">
          <div className="pm-card-head"><div><span className="pm-section-kicker">يتطلب انتباهك</span><h2>المتابعات المفتوحة</h2></div></div>
          <div className="pm-alert-list">
            <button onClick={() => setSection('attendance')}><span className="pm-list-icon warning"><Icon name="attendance" size={16} /></span><span><b>{summary.missingCheckout ?? 0}</b> موظف بدون انصراف</span><Icon name="menu" size={14} /></button>
            <button onClick={() => setSection('leaves')}><span className="pm-list-icon info"><Icon name="leaves" size={16} /></span><span><b>{summary.pendingLeaves ?? 0}</b> طلب إجازة معلق</span><Icon name="menu" size={14} /></button>
            <button onClick={() => setSection('permissions')}><span className="pm-list-icon purple"><Icon name="permissions" size={16} /></span><span><b>{summary.pendingPermissions ?? 0}</b> طلب إذن معلق</span><Icon name="menu" size={14} /></button>
          </div>
        </section>
      </div>

      <section className="pm-card">
        <div className="pm-card-head">
          <div><span className="pm-section-kicker">نطاق الإدارة</span><h2>مشاريعك</h2><p>ملخص سريع لكل مشروع مرتبط بحسابك.</p></div>
          <button className="secondary" onClick={() => setSection('projects')}>عرض المشاريع</button>
        </div>
        {projects.length ? (
          <div className="pm-project-grid">
            {projects.map((project: any) => {
              const projectTeam = team.filter((e: any) => String(e.project_id) === String(project.project_id));
              const projectPresent = projectTeam.filter((e: any) => ['PRESENT', 'CHECKED_IN', 'LATE'].includes(e.state)).length;
              const pct = project.employee_count ? Math.round((projectPresent / project.employee_count) * 100) : 0;
              return (
                <article className="pm-project" key={project.project_id}>
                  <div className="pm-project-top"><span className="pm-project-icon"><Icon name="projects" size={18} /></span><StatusBadge label={project.status === 'ACTIVE' || !project.status ? 'نشط' : project.status} state="PRESENT" /></div>
                  <h3>{project.name}</h3>
                  <p>{project.location_name || 'الموقع غير محدد'}{project.client ? ` • ${project.client}` : ''}</p>
                  <div className="pm-project-stats"><span><Icon name="users" size={14} /> {project.employee_count || 0} موظف</span><span><Icon name="check" size={14} /> {projectPresent} حاضر</span></div>
                  <div className="pm-project-progress"><div><span>تغطية اليوم</span><b>{pct}%</b></div><div className="pm-progress"><span style={{ width: `${Math.min(100, pct)}%` }} /></div></div>
                </article>
              );
            })}
          </div>
        ) : <Empty text="لا توجد مشاريع مرتبطة بهذا الحساب." />}
      </section>

      <section className="pm-card">
        <div className="pm-card-head">
          <div><span className="pm-section-kicker">المتابعة اليومية</span><h2>فريق العمل</h2><p>آخر حالة معروفة لكل موظف على مشاريعك.</p></div>
          <div className="pm-team-summary"><span>{team.length} موظف</span><button className="secondary" onClick={() => setSection('attendance')}>سجل الحضور</button></div>
        </div>
        {team.length ? (
          <div className="pm-team-table-wrap">
            <table className="pm-team-table">
              <thead><tr><th>الموظف</th><th>المشروع</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th></tr></thead>
              <tbody>
                {team.slice(0, 10).map((employee: any) => (
                  <tr key={employee.employee_id}>
                    <td><div className="pm-employee"><span>{String(employee.name || '?').trim().charAt(0)}</span><div><strong>{employee.name}</strong><small>{employee.job_title || 'موظف'}</small></div></div></td>
                    <td>{employee.project_name || '—'}</td>
                    <td><StatusBadge state={employee.state} /></td>
                    <td className="pm-time">{timeValue(employee.attendance?.check_in)}</td>
                    <td className="pm-time">{timeValue(employee.attendance?.check_out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {team.length > 10 && <button className="pm-more" onClick={() => setSection('employees')}>عرض باقي الفريق ({team.length - 10})</button>}
          </div>
        ) : <Empty text="لا توجد بيانات موظفين لعرضها." />}
      </section>

      <div className="pm-request-grid">
        <section className="pm-card">
          <div className="pm-card-head"><div><span className="pm-section-kicker">القرارات</span><h2>إجازات تحتاج اعتمادك</h2></div><span className="pm-count">{leaves.length}</span></div>
          {leaves.length ? leaves.slice(0, 4).map((row: any) => <div className="pm-request" key={row.leave_id || `${row.employee_id}-${row.from_date}`}><span className="pm-request-avatar">{String(row.employee_name || '?').charAt(0)}</span><div><strong>{row.employee_name || 'موظف'}</strong><small>{row.leave_type_name || row.leave_type_id || 'إجازة'} • {row.from_date} إلى {row.to_date}</small></div><Icon name="calendar" size={16} /></div>) : <Empty text="لا توجد إجازات معلقة." />}
          <button className="secondary pm-full-button" onClick={() => setSection('leaves')}>فتح الإجازات</button>
        </section>
        <section className="pm-card">
          <div className="pm-card-head"><div><span className="pm-section-kicker">القرارات</span><h2>أذونات تحتاج متابعة</h2></div><span className="pm-count">{permissions.length}</span></div>
          {permissions.length ? permissions.slice(0, 4).map((row: any) => <div className="pm-request" key={row.permission_id || `${row.employee_id}-${row.start_time}`}><span className="pm-request-avatar purple">{String(row.employee_name || '?').charAt(0)}</span><div><strong>{row.employee_name || 'موظف'}</strong><small>{timeValue(row.start_time)} – {timeValue(row.end_time)} • {row.minutes || 0} دقيقة</small></div><Icon name="permissions" size={16} /></div>) : <Empty text="لا توجد أذونات معلقة." />}
          <button className="secondary pm-full-button" onClick={() => setSection('permissions')}>فتح الأذونات</button>
        </section>
      </div>
    </div>
  );
}
