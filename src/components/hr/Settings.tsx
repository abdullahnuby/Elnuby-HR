export default function Settings() {
  return (
    <section className="panel page-panel">
      <div className="panel-head">
        <div>
          <h2>
            إعدادات النظام
          </h2>

          <p>
            إعدادات أساسية مرتبطة بإعدادات النظام في Supabase.
          </p>
        </div>
      </div>

      <div className="settings-list">
        <div>
          <b>نطاق GPS</b>
          <span>
            يتم التحقق من موقع الموظف عند الحضور
            والانصراف.
          </span>
        </div>

        <div>
          <b>الوردية</b>
          <span>
            تُحدد حسب تعيين الموظف للمشروع
            والتاريخ.
          </span>
        </div>

        <div>
          <b>المنطقة الزمنية</b>
          <span>
            Africa/Cairo
          </span>
        </div>

        <div>
          <b>الأمان</b>
          <span>
            الصلاحيات يتم التحقق منها في Backend
            وليس في الواجهة فقط.
          </span>
        </div>
      </div>
    </section>
  );
}

