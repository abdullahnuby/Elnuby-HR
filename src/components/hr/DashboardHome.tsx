import Icon from './Icon';

function timeValue(value: any) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}

function formatDate() {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

export default function DashboardHome({
  me,
  dash,
  roleLabels,
  locate,
  busy,
  setSection,
}: any) {
  const attendance = dash?.selfAttendance || null;
  const onLeave = attendance?.status === 'LEAVE';
  const checkedIn = Boolean(attendance?.check_in);
  const checkedOut = Boolean(attendance?.check_out);
  const workedMinutes = Number(attendance?.worked_minutes || 0);
  const workedHours = workedMinutes > 0 ? `${Math.floor(workedMinutes / 60)}:${String(workedMinutes % 60).padStart(2, '0')}` : '—';
  const name = me?.employee?.name || me?.user?.username || 'الموظف';
  const projectName = me?.project?.name || 'لا يوجد مشروع مرتبط';
  const shiftName = me?.shift?.name || 'لا توجد وردية حالية';
  const canAttend = ['EMPLOYEE', 'PROJECT_MANAGER'].includes(me?.user?.role);

  return (
    <div className="employee-dashboard">
      <section className="employee-hero">
        <div>
          <span className="employee-eyebrow"><span className="employee-live-dot" /> لوحة الموظف</span>
          <h1>أهلاً بك، {name}</h1>
          <p>تابع حضورك اليوم وبيانات مشروعك ووردية العمل من مكان واحد.</p>
          <div className="employee-meta">
            <span><Icon name="calendar" size={15} /> {formatDate()}</span>
            <span><Icon name="projects" size={15} /> {projectName}</span>
            <span><Icon name="shifts" size={15} /> {shiftName}{me?.shift?.start_time ? ` • ${String(me.shift.start_time).slice(0, 5)}` : ''}</span>
          </div>
        </div>
        <div className="employee-role-card">
          <span>نوع الحساب</span>
          <strong>{roleLabels?.[me?.user?.role] || me?.user?.role || 'موظف'}</strong>
          <small>{me?.employee?.job_title || 'موظف'}</small>
        </div>
      </section>

      {canAttend && (
        <section className="employee-attendance-card">
          <div className="employee-attendance-head">
            <div className="employee-attendance-icon"><Icon name="attendance" size={23} /></div>
            <div>
              <span className="employee-kicker">الحضور والانصراف</span>
              <h2>سجّل حضورك من موقع العمل</h2>
              <p>سيتم التحقق من الموقع الجغرافي ونطاق موقع المشروع قبل اعتماد التسجيل.</p>
            </div>
          </div>

          {onLeave ? <div className="employee-leave-banner"><Icon name="calendar" size={18} /> <strong>اليوم إجازة معتمدة</strong><span>لن يتم تسجيل حضور أو انصراف</span></div> : null}

          <div className="employee-attendance-times">
            <div><span>وقت الحضور</span><strong>{timeValue(attendance?.check_in)}</strong></div>
            <div><span>وقت الانصراف</span><strong>{timeValue(attendance?.check_out)}</strong></div>
            <div><span>ساعات العمل</span><strong>{workedHours}</strong></div>
          </div>

          <div className="employee-attendance-actions">
            <span className={`employee-status ${onLeave ? 'success' : checkedOut ? 'success' : checkedIn ? 'warning' : 'muted'}`}>
              <Icon name={checkedOut || checkedIn ? 'check' : 'attendance'} size={14} />
              {onLeave ? 'إجازة معتمدة' : checkedOut ? 'تم إكمال اليوم' : checkedIn ? 'تم تسجيل الحضور' : 'لم يتم تسجيل الحضور'}
            </span>
            {!onLeave && !checkedIn && (
              <button className="employee-primary-action" disabled={busy} onClick={() => locate('check_in')}>
                <Icon name="check" size={17} />
                {busy ? 'جاري التحقق...' : 'تسجيل الحضور'}
              </button>
            )}
            {!onLeave && checkedIn && !checkedOut && (
              <button className="employee-primary-action checkout" disabled={busy} onClick={() => locate('check_out')}>
                <Icon name="attendance" size={17} />
                {busy ? 'جاري التحقق...' : 'تسجيل الانصراف'}
              </button>
            )}
            {!onLeave && checkedOut && (
              <button className="employee-secondary-action" onClick={() => setSection('attendance')}>
                فتح سجل اليوم
                <Icon name="menu" size={15} />
              </button>
            )}
          </div>
        </section>
      )}

      <section className="employee-kpi-grid">
        <article className="employee-kpi blue"><div><Icon name="projects" size={20} /></div><span>المشروع الحالي</span><strong>{projectName}</strong><small>{me?.project?.location_name || 'الموقع غير محدد'}</small></article>
        <article className="employee-kpi green"><div><Icon name="check" size={20} /></div><span>حالة اليوم</span><strong>{checkedOut ? 'مكتمل' : checkedIn ? 'حاضر' : 'لم يسجل'}</strong><small>{checkedIn ? `الحضور ${timeValue(attendance?.check_in)}` : 'بانتظار تسجيل الحضور'}</small></article>
        <article className="employee-kpi orange"><div><Icon name="shifts" size={20} /></div><span>الوردية</span><strong>{shiftName}</strong><small>{me?.shift?.start_time ? `${String(me.shift.start_time).slice(0, 5)} — ${String(me.shift.end_time || '').slice(0, 5)}` : 'غير محددة'}</small></article>
        <article className="employee-kpi purple"><div><Icon name="calendar" size={20} /></div><span>ملف الموظف</span><strong>{me?.employee?.job_title || 'موظف'}</strong><small>{me?.employee?.employee_id || ''}</small></article>
      </section>

      <section className="employee-quick-grid">
        <button onClick={() => setSection('attendance')}><Icon name="attendance" size={18} /><span><b>سجل الحضور</b><small>راجع حضورك وانصرافك</small></span><Icon name="menu" size={14} /></button>
        <button onClick={() => setSection('leaves')}><Icon name="leaves" size={18} /><span><b>الإجازات</b><small>قدم أو تابع طلباتك</small></span><Icon name="menu" size={14} /></button>
        <button onClick={() => setSection('permissions')}><Icon name="permissions" size={18} /><span><b>الأذونات</b><small>قدم أو تابع طلباتك</small></span><Icon name="menu" size={14} /></button>
      </section>
    </div>
  );
}
