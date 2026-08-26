import Icon from './Icon';
import { Kpi, Table, Empty } from './common';
export default function ManagerDashboard({
  me,
  dash,
  managerDash,
  roleLabels,
  setSection,
  locate,
  busy,
}: any) {
  const s = managerDash?.summary || {};
  const projects =
    managerDash?.projects || [];
  const team = managerDash?.team || [];
  const leaves =
    managerDash?.pendingLeaves || [];
  const permissions =
    managerDash?.pendingPermissions || [];

  const myEmployeeId = String(me?.user?.employee_id || '');
  const myTeamRecord = team.find(
    (employee: any) =>
      String(employee?.employee_id || '') === myEmployeeId,
  );
  const myAttendance = myTeamRecord?.attendance || null;
  const canSelfAttend =
    me?.user?.role === 'PROJECT_MANAGER' &&
    Boolean(me?.employee?.employee_id) &&
    Boolean(me?.project?.project_id) &&
    Boolean(me?.shift);

  const stateLabel = (v: string) =>
    (
      {
        PRESENT: 'حاضر',
        CHECKED_IN: 'حاضر ولم ينصرف',
        LATE: 'متأخر',
        ON_LEAVE: 'إجازة',
        ABSENT: 'غائب',
      } as any
    )[v] || v;

  return (
    <>
      {managerDash?.assignmentMissing && (
        <div className="alert danger">
          هذا الحساب مدير مشروع لكنه غير مربوط
          بأي مشروع. من حساب مدير النظام افتح
          «حسابات المستخدمين» ثم «ربط مدير مشروع
          بمشروع» واحفظ المشروع، وبعدها أعد تحميل
          الصفحة.
        </div>
      )}

      <div className="welcome">
        <div>
          <div className="eyebrow">
            PROJECT MANAGEMENT CENTER
          </div>

          <h1>
            لوحة مدير المشروع —{' '}
            {me.employee?.name ||
              me.user?.username}{' '}

          </h1>

          <p>
            إدارة ومتابعة مشروعك وموظفيك والحضور
            والطلبات من مكان واحد.
          </p>
        </div>

        <div className="welcome-role">
          <span>المشاريع التابعة</span>
          <b>{projects.length}</b>
        </div>
      </div>

      {canSelfAttend && (
        <section className="manager-attendance-card panel" aria-label="تسجيل حضور مدير المشروع">
          <div className="manager-attendance-main">
            <div className="manager-attendance-icon">
              <Icon name="attendance" size={24} />
            </div>
            <div>
              <div className="eyebrow">MY ATTENDANCE</div>
              <h2>حضورك وانصرافك اليوم</h2>
              <p>
                {me?.project?.name || 'المشروع الحالي'} •{' '}
                {me?.shift?.name || 'الوردية الحالية'}
                {me?.shift?.start_time
                  ? ` • تبدأ ${String(me.shift.start_time).slice(0, 5)}`
                  : ''}
              </p>
            </div>
          </div>

          <div className="manager-attendance-status">
            <div>
              <span>الحضور</span>
              <strong>{myAttendance?.check_in || 'لم يسجل'}</strong>
            </div>
            <div>
              <span>الانصراف</span>
              <strong>{myAttendance?.check_out || 'لم يسجل'}</strong>
            </div>
          </div>

          <div className="manager-attendance-actions">
            {!myAttendance?.check_in ? (
              <button
                className="primary attendance-primary-action"
                disabled={busy}
                onClick={() => locate?.('check_in')}
                type="button"
              >
                <Icon name="attendance" size={18} />
                {busy ? 'جاري تحديد الموقع…' : 'تسجيل الحضور'}
              </button>
            ) : !myAttendance?.check_out ? (
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
              onClick={() => setSection('attendance')}
            >
              عرض سجل الحضور
            </button>
          </div>
        </section>
      )}

      <div className="kpis">
        <Kpi
          title="موظفو المشروع"
          value={s.employees ?? 0}
          icon="users"
        />

        <Kpi
          title="حاضر اليوم"
          value={s.present ?? 0}
          icon="check"
        />

        <Kpi
          title="متأخرون"
          value={s.late ?? 0}
          icon="shifts"
        />

        <Kpi
          title="في إجازة"
          value={s.onLeave ?? 0}
          icon="leaves"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel page-panel">
          <div className="panel-head">
            <div>
              <h2>مشاريعي</h2>
              <p>
                المشاريع التي تم تعيينك عليها
                رسميًا.
              </p>
            </div>
          </div>

          <div className="project-cards">
            {projects.map((p: any) => (
              <div
                className="project-card"
                key={p.project_id}
              >
                <div className="project-icon">
                  <Icon name="projects" size={20} />
                </div>

                <div className="project-card-main">
                  <h3>{p.name}</h3>

                  <p>
                    {p.location_name ||
                      'الموقع غير محدد'}{' '}
                    {p.client
                      ? `• ${p.client}`
                      : ''}
                  </p>

                  <div className="project-meta">
                    <span>
                      <Icon name="users" size={13} /> {p.employee_count || 0}{' '}
                      موظف
                    </span>

                    <span>
                      GPS {p.latitude},{' '}
                      {p.longitude}
                    </span>

                    <span>
                      {p.geofence_radius_m ||
                        200}
                      m
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel today-panel">
          <div className="panel-head">
            <div>
              <h2>حالة اليوم</h2>
              <p>
                حالة القوة العاملة في مشروعك.
              </p>
            </div>
          </div>

          <div className="today-row">
            <span>غائب</span>
            <strong>{s.absent ?? 0}</strong>
          </div>

          <div className="today-row">
            <span>في إجازة</span>
            <strong>{s.onLeave ?? 0}</strong>
          </div>

          <div className="today-row">
            <span>
              طلبات إجازة معلقة
            </span>
            <strong>
              {s.pendingLeaves ?? 0}
            </strong>
          </div>

          <div className="today-row">
            <span>
              طلبات إذن معلقة
            </span>
            <strong>
              {s.pendingPermissions ?? 0}
            </strong>
          </div>
        </section>
      </div>

      <section className="panel page-panel">
        <div className="panel-head">
          <div>
            <h2>حالة الموظفين الآن</h2>
            <p>
              حاضر، متأخر، غائب أو في إجازة.
            </p>
          </div>

          <span className="count-pill">
            {team.length} موظف
          </span>
        </div>

        <Table
          headers={[
            'الموظف',
            'الوظيفة',
            'المشروع',
            'الحالة',
            'الحضور',
            'الانصراف',
          ]}
          rows={team.map((e: any) => [
            e.name,
            e.job_title || '—',
            e.project_name || '—',
            stateLabel(e.state),
            e.attendance?.check_in || '—',
            e.attendance?.check_out || '—',
          ])}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel page-panel">
          <div className="panel-head">
            <div>
              <h2>طلبات الإجازات</h2>
              <p>
                الطلبات التي تحتاج قرار مدير
                المشروع.
              </p>
            </div>
          </div>

          {leaves.length ? (
            <Table
              headers={[
                'الموظف',
                'النوع',
                'من',
                'إلى',
                'الحالة',
              ]}
              rows={leaves.map((r: any) => [
                r.employee_name,
                r.leave_type_name ||
                  r.leave_type_id,
                r.from_date,
                r.to_date,
                r.status,
              ])}
            />
          ) : (
            <Empty text="لا توجد طلبات إجازة معلقة." />
          )}

          <button
            className="secondary"
            onClick={() =>
              setSection('leaves')
            }
          >
            فتح كل الإجازات
          </button>
        </section>

        <section className="panel page-panel">
          <div className="panel-head">
            <div>
              <h2>طلبات الأذونات</h2>
              <p>
                طلبات الأذونات المنتظرة.
              </p>
            </div>
          </div>

          {permissions.length ? (
            <Table
              headers={[
                'الموظف',
                'البداية',
                'النهاية',
                'المدة',
                'الحالة',
              ]}
              rows={permissions.map(
                (r: any) => [
                  r.employee_name,
                  r.start_time,
                  r.end_time,
                  `${r.minutes} دقيقة`,
                  r.status,
                ],
              )}
            />
          ) : (
            <Empty text="لا توجد طلبات إذن معلقة." />
          )}

          <button
            className="secondary"
            onClick={() =>
              setSection('permissions')
            }
          >
            فتح كل الأذونات
          </button>
        </section>
      </div>
    </>
  );
}

