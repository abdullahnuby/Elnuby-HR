'use client';

import { useMemo, useState } from 'react';

type SettingCard = {
  title: string;
  description: string;
  value: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'slate';
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'security'>('overview');

  const cards: SettingCard[] = [
    { title: 'نظام الحضور', description: 'الحضور والانصراف يعتمد على الوردية والتعيين والموقع.', value: 'مفعل', icon: '◷', tone: 'blue' },
    { title: 'صلاحيات النظام', description: 'التحقق من الصلاحيات يتم في Backend قبل تنفيذ العمليات.', value: 'محمي', icon: '✓', tone: 'green' },
    { title: 'المنطقة الزمنية', description: 'التوقيت التشغيلي المستخدم في النظام.', value: 'Africa/Cairo', icon: '⌚', tone: 'slate' },
    { title: 'سجل التدقيق', description: 'العمليات الإدارية الحساسة تمر عبر Audit Trail.', value: 'مفعل', icon: '▤', tone: 'amber' },
  ];

  const tabs = [
    ['overview', 'نظرة عامة'],
    ['attendance', 'الحضور والورديات'],
    ['security', 'الأمان والصلاحيات'],
  ] as const;

  const toneClass = useMemo(() => ({
    blue: { background: '#eef4ff', color: '#1769e0' },
    green: { background: '#eaf9f3', color: '#08744f' },
    amber: { background: '#fff8e7', color: '#9a6a00' },
    slate: { background: '#f3f5f8', color: '#526178' },
  }), []);

  return (
    <section className="panel page-panel" style={{ minHeight: 600 }}>
      <div className="panel-head" style={{ alignItems: 'center' }}>
        <div>
          <div className="eyebrow">SYSTEM SETTINGS</div>
          <h2 style={{ fontSize: 22, marginTop: 5 }}>إعدادات النظام</h2>
          <p>مركز معلومات وتشغيل إعدادات ELNUBY HR بشكل واضح ومنظم.</p>
        </div>
        <span className="live"><b /> النظام متصل</span>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 6, background: '#f5f7fb', border: '1px solid var(--line)', borderRadius: 13, marginBottom: 18 }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={activeTab === id ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
            {cards.map((card) => (
              <div key={card.title} style={{ border: '1px solid var(--line)', borderRadius: 15, padding: 16, background: '#fff', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 900, ...toneClass[card.tone] }}>{card.icon}</div>
                  <span style={{ fontSize: 10, color: toneClass[card.tone].color, fontWeight: 800 }}>{card.value}</span>
                </div>
                <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>{card.title}</h3>
                <p style={{ fontSize: 10, lineHeight: 1.8, color: '#8290a4', margin: 0 }}>{card.description}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 14 }}>
            <section className="request-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: 14 }}>كيف يعمل النظام؟</h3>
              {[
                ['01', 'الموظف', 'يتم ربط الموظف بمشروع ووردية فعالة.'],
                ['02', 'الحضور', 'تتحكم الوردية في فتح وإغلاق الحضور والانصراف.'],
                ['03', 'الإجازات والأذونات', 'الطلبات تمر بمسار الاعتماد حسب الدور والصلاحيات.'],
                ['04', 'الإدارة', 'العمليات الحساسة يتم تسجيلها ومراجعتها.'],
              ].map(([n, title, text]) => (
                <div key={n} style={{ display: 'grid', gridTemplateColumns: '42px 120px 1fr', gap: 10, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e9edf4' }}>
                  <strong style={{ color: '#1769e0' }}>{n}</strong>
                  <strong style={{ fontSize: 11 }}>{title}</strong>
                  <span style={{ fontSize: 10, color: '#8290a4' }}>{text}</span>
                </div>
              ))}
            </section>

            <section className="request-card" style={{ margin: 0 }}>
              <h3 style={{ fontSize: 14 }}>حالة التشغيل</h3>
              {['قاعدة البيانات', 'Backend API', 'نظام الصلاحيات', 'Audit Trail'].map((item) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #e9edf4', fontSize: 11 }}>
                  <span>{item}</span><b style={{ color: '#08744f' }}>● يعمل</b>
                </div>
              ))}
            </section>
          </div>
        </>
      )}

      {activeTab === 'attendance' && (
        <div className="dashboard-grid">
          <section className="request-card">
            <h3>قواعد الحضور والانصراف</h3>
            {[
              ['فتح الحضور', 'يتم تحديده من الوردية المعينة للموظف.'],
              ['إغلاق الحضور', 'بعد هذه النقطة يسجل الحضور كمتأخر حسب محرك الحضور.'],
              ['فتح الانصراف', 'لا يظهر الانصراف قبل وقت الوردية المحدد.'],
              ['الانصراف التلقائي', 'يستخدم لإغلاق السجل عند انتهاء يوم العمل إذا لم يسجل الموظف انصرافه.'],
              ['GPS', 'يتم التحقق من موقع الموظف مقابل نطاق المشروع.'],
            ].map(([title, text]) => (
              <div key={title} style={{ padding: '13px 0', borderBottom: '1px solid #e9edf4' }}>
                <strong style={{ display: 'block', fontSize: 11 }}>{title}</strong>
                <span style={{ display: 'block', color: '#8290a4', fontSize: 10, marginTop: 4 }}>{text}</span>
              </div>
            ))}
          </section>
          <section className="request-card">
            <h3>مصدر الإعداد</h3>
            <p style={{ fontSize: 11, lineHeight: 1.9, color: '#66758b' }}>قيم أوقات الورديات الفعلية يتم إدارتها من شاشة <b>الورديات</b> وليس من إعداد ثابت داخل الواجهة.</p>
            <div className="alert success">التصميم يمنع وجود إعدادات متضاربة بين الشاشة وقاعدة البيانات.</div>
          </section>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="dashboard-grid">
          <section className="request-card">
            <h3>نموذج الصلاحيات</h3>
            {[
              ['SYSTEM_ADMIN', 'تحكم كامل في بيانات النظام والإدارة.'],
              ['HR_MANAGER', 'إدارة الموارد البشرية والطلبات وفق نطاق HR.'],
              ['SECTOR_MANAGER', 'إدارة المشروعات المسندة إليه دون حضور وانصراف.'],
              ['PROJECT_MANAGER', 'موظف له حضور وانصراف، ويدير موظفي مشروعاته.'],
              ['EMPLOYEE', 'حضور وانصراف وطلبات الموظف الخاصة.'],
            ].map(([role, text]) => (
              <div key={role} style={{ padding: '12px 0', borderBottom: '1px solid #e9edf4' }}>
                <strong style={{ display: 'block', fontSize: 11 }}>{role}</strong>
                <span style={{ display: 'block', color: '#8290a4', fontSize: 10, marginTop: 4 }}>{text}</span>
              </div>
            ))}
          </section>
          <section className="request-card">
            <h3>حماية البيانات</h3>
            <div className="alert success">التحقق من الدور والنطاق يتم في Backend، وليس في إخفاء عناصر الواجهة فقط.</div>
            <p style={{ fontSize: 10, lineHeight: 1.9, color: '#8290a4' }}>لا تستخدم هذه الشاشة لتغيير الصلاحيات مباشرة. إدارة الحسابات والأدوار تتم من قسم حسابات المستخدمين، بينما مدير النظام يملك مركز CRUD الكامل.</p>
          </section>
        </div>
      )}
    </section>
  );
}
