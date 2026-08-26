import Icon from './Icon';
import { Kpi } from './common';

function timeLabel(value: unknown) {
  if (!value) return 'لم يسجل';
  const raw = String(value).slice(0, 5);
  const [h, m] = raw.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(value);
  const period = h >= 12 ? 'م' : 'ص';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export default function DashboardHome({
  me,
  dash,
  locate,
  busy,
  setSection,
}: any) {
  const attendance = dash?.selfAttendance || null;
  const canSelfAttend =
    ['EMPLOYEE', 'PROJECT_MANAGER'].includes(me?.user?.role) &&
    Boolean(me?.employee?.employee_id || me?.user?.employee_id) &&
    Boolean(me?.project?.project_id) &&
    Boolean(me?.shift);

  return (
    <>
      <div className="welcome">
        <div>
          <div className="eyebrow">SITE HR CONTROL CENTER</div>
          <h1>صباح الخير، {me.employee?.name || me.user?.username}</h1>
          <p>إليك ملخص حالة القوى العاملة اليوم.</p>
        </div>
        <div className="welcome-role">
          <span>الصلاحية</span>
          <b>{me.user?.role}</b>
          {me.project?.name && <small>المشروع: {me.project.name}</small>}
          {me.shift?.name && (
            <small>
              الوردية: {me.shift.name}
              {me.shift.start_time ? ` • ${String(me.shift.start_time).slice(0, 5)}` : ''}
            </small>
          )}
        </div>
      </div>

      {canSelfAttend && (
        <section className="manager-attendance-card panel" aria-label="تسجيل حضور وانصراف الموظف">
          <div className="manager-attendance-main">
            <div className="manager-attendance-icon">
              <Icon name="attendance" size={24} />
            </div>
            <div>
              <div className="eyebrow">MY ATTENDANCE</div>
              <h2>حضورك وانصرافك اليوم</h2>
              <p>
                {me?.project?.name || 'المشروع الحالي'} • {me?.shift?.name || 'الوردية الحالية'}
                {me?.shift?.start_time ? ` • تبدأ ${String(me.shift.start_time).slice(0, 5)}` : ''}
              </p>
            </div>
          </div>

          <div className="manager-attendance-status">
            <div>
              <span>الحضور</span>
              <strong>{timeLabel(attendance?.check_in)}</strong>
            </div>
            <div>
              <span>الانصراف</span>
              <strong>{timeLabel(attendance?.check_out)}</strong>
            </div>
          </div>

          <div className="manager-attendance-actions">
            {!attendance?.check_in ? (
              <button
                className="primary attendance-primary-action"
                disabled={busy}
                onClick={() => locate?.('check_in')}
                type="button"
              >
                <Icon name="attendance" size={18} />
                {busy ? 'جاري تحديد الموقع…' : 'تسجيل الحضور'}
              </button>
            ) : !attendance?.check_out ? (
              <button
                className="primary attendance-primary-action"
                disabled={busy}
                onClick={() => locate?.('check_out')}
                type="button"
              >
                <Icon name="logout" size={18} />
                {busy ? 'جاري تحديد الموقع…' : 'تسجيل الانصراف'}
              </button>
            ) : (
              <span className="attendance-complete">
                <Icon name="check" size={17} />
                تم تسجيل الحضور والانصراف
              </span>
            )}

            <button
              className="secondary"
              type="button"
              onClick={() => setSection?.('attendance')}
            >
              عرض سجل الحضور
            </button>
          </div>
        </section>
      )}

      <div className="kpis">
        <Kpi title="إجمالي الموظفين" value={dash?.employees ?? 0} icon="users" />
        <Kpi title="حضور اليوم" value={dash?.present ?? 0} icon="check" />
        <Kpi title="متأخرون" value={dash?.late ?? 0} icon="shifts" />
        <Kpi title="بدون انصراف" value={dash?.missingCheckout ?? 0} icon="alert" danger />
      </div>
    </>
  );
}
