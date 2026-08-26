import { Table } from './common';
function formatServerTime(value:any){if(!value)return '—';const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';return new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short'}).format(d);}
export default function Reports({
  dash,
  managerDash,
}: any) {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>التقارير</h2>
          <p>
            ملخصات جاهزة للنموذج الأول من النظام.
          </p>
        </div>
      </div>

      <div className="report-grid">
        <div>
          <span>
            إجمالي الموظفين
          </span>
          <b>
            {dash?.employees ?? 0}
          </b>
        </div>

        <div>
          <span>
            حضور اليوم
          </span>
          <b>
            {dash?.present ?? 0}
          </b>
        </div>

        <div>
          <span>التأخير</span>
          <b>
            {dash?.late ?? 0}
          </b>
        </div>

        <div>
          <span>
            حالات بدون انصراف
          </span>
          <b>
            {dash?.missingCheckout ?? 0}
          </b>
        </div>
      </div>

      <div className="empty-note">
        آخر تحديث من الخادم:{' '}
        {formatServerTime(dash?.serverTime)} • يتم
        التحديث تلقائياً كل 15 ثانية.
      </div>

      {managerDash && (
        <>
          <div
            className="panel-head"
            style={{ marginTop: 24 }}
          >
            <div>
              <h3>
                تقرير فريق المشروع
              </h3>

              <p>
                الموظفون حسب الحالة اليومية
                والطلبات المعلقة.
              </p>
            </div>
          </div>

          <Table
            headers={[
              'الموظف',
              'المشروع',
              'الحالة',
              'حضور',
              'انصراف',
            ]}
            rows={(
              managerDash.team || []
            ).map((e: any) => [
              e.name,
              e.project_name || '—',
              (
                {
                  PRESENT: 'حاضر',
                  CHECKED_IN:
                    'حاضر ولم ينصرف',
                  LATE: 'متأخر',
                  ON_LEAVE: 'إجازة',
                  ABSENT: 'غائب',
                } as any
              )[e.state] ||
                e.state,
              e.attendance?.check_in ||
                '—',
              e.attendance?.check_out ||
                '—',
            ])}
          />
        </>
      )}
    </section>
  );
}

