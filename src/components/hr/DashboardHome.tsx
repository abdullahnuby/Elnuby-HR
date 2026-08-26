import { Kpi } from './common';
export default function Dashboard({
  me,
  dash,
  roleLabels,
  locate,
  busy,
  setSection,
}: any) {
  return (
    <>
      <div className="welcome">
        <div>
          <div className="eyebrow">
            SITE HR CONTROL CENTER
          </div>

          <h1>
            صباح الخير،{' '}
            {me.employee?.name ||
              me.user?.username}{' '}
            👋
          </h1>

          <p>
            إليك ملخص حالة القوى العاملة اليوم.
          </p>
        </div>

        <div className="welcome-role">
          <span>الصلاحية</span>
          <b>
            {roleLabels[me.user?.role] ||
              me.user?.role}
          </b>
          {me.project?.name && (
            <small>المشروع: {me.project.name}</small>
          )}
          {me.shift?.name && (
            <small>
              الوردية: {me.shift.name}
              {me.shift.start_time
                ? ` • ${String(me.shift.start_time).slice(0, 5)}`
                : ''}
            </small>
          )}
        </div>
      </div>

      <div className="kpis">
        <Kpi
          title="إجمالي الموظفين"
          value={dash?.employees ?? 0}
          icon="♙"
        />

        <Kpi
          title="حضور اليوم"
          value={dash?.present ?? 0}
          icon="✓"
        />

        <Kpi
          title="متأخرون"
          value={dash?.late ?? 0}
          icon="◷"
        />

        <Kpi
          title="بدون انصراف"
          value={dash?.missingCheckout ?? 0}
          icon="!"
          danger
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel attendance-panel">
          <div className="panel-head">
            <div>
              <h2>
                الحضور والانصراف
              </h2>

              <p>
                التسجيل متاح حسب الوردية
                وموقع المشروع.
              </p>
            </div>

            <span className="live">
              <b /> LIVE
            </span>
          </div>

          {['EMPLOYEE', 'PROJECT_MANAGER', 'SECTOR_MANAGER', ].includes(me?.user?.role) && (
          <div className="attendance-actions">
            <button
              className="attendance-btn in"
              disabled={busy}
              onClick={() =>
                locate('check_in')
              }
            >
              <span>↘</span>
              <b>تسجيل الحضور</b>
              <small>
                GPS • موقع المشروع
              </small>
            </button>

            <button
              className="attendance-btn out"
              disabled={busy}
              onClick={() =>
                locate('check_out')
              }
            >
              <span>↗</span>
              <b>تسجيل الانصراف</b>
              <small>
                GPS • موقع المشروع
              </small>
            </button>
          </div>
          )}

          <div className="quick-links">
            <button
              onClick={() =>
                setSection('leaves')
              }
            >
              طلب إجازة <span>←</span>
            </button>

            <button
              onClick={() =>
                setSection('permissions')
              }
            >
              طلب إذن <span>←</span>
            </button>

            <button
              onClick={() =>
                setSection('attendance')
              }
            >
              عرض السجل <span>←</span>
            </button>
          </div>
        </section>

        <section className="panel today-panel">
          <div className="panel-head">
            <div>
              <h2>ملخص اليوم</h2>
              <p>
                نظرة سريعة على الموقع.
              </p>
            </div>
          </div>

          <div className="today-row">
            <span>حاضر</span>
            <strong>
              {dash?.present ?? 0}
            </strong>
          </div>

          <div className="today-row">
            <span>متأخر</span>
            <strong>
              {dash?.late ?? 0}
            </strong>
          </div>

          <div className="today-row">
            <span>
              بدون انصراف
            </span>
            <strong>
              {dash?.missingCheckout ?? 0}
            </strong>
          </div>

          <div className="today-row">
            <span>
              إجمالي الموظفين
            </span>
            <strong>
              {dash?.employees ?? 0}
            </strong>
          </div>
        </section>
      </div>
    </>
  );
}

