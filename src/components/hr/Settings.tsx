import { useEffect, useState } from 'react';
import Icon from './Icon';
import ExcelCenter from './ExcelCenter';
import { api } from '@/lib/api';

type Policy = any;
const roleCards=[
 {role:'SYSTEM_ADMIN',title:'مدير النظام',tone:'blue',text:'تحكم كامل في النظام والبيانات الحساسة.'},
 {role:'HR_MANAGER',title:'مدير الموارد البشرية',tone:'green',text:'إدارة الموظفين والإجازات واللوائح والأذونات والخصومات.'},
 {role:'SECTOR_MANAGER',title:'مدير القطاع',tone:'amber',text:'إدارة المشروعات المسندة إليه ومتابعة مديري المشاريع والطلبات.'},
 {role:'PROJECT_MANAGER',title:'مدير المشروع',tone:'navy',text:'إدارة فريق مشروعاته والحضور والطلبات داخل نطاقه.'},
 {role:'EMPLOYEE',title:'الموظف',tone:'slate',text:'الحضور والانصراف وطلبات الإجازات والأذونات الخاصة به.'},
];

export default function Settings({role='HR_MANAGER'}:{role?:string}){
 const [tab,setTab]=useState<'overview'|'attendance'|'leaves'|'excel'|'roles'>('overview');
 const [policies,setPolicies]=useState<Policy[]>([]);
 const [types,setTypes]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [form,setForm]=useState<any>({name:'',leave_type_id:'LT-ANNUAL',residency_type:'RESIDENT',accrual_method:'ANNUAL',accrual_basis:'CALENDAR_DAYS',accrual_period_days:'',accrual_days:'',annual_entitlement:'21',max_carryover_days:'0',requires_document:false,allow_partial:false,effective_from:new Date().toISOString().slice(0,10),status:'ACTIVE'});
 const canEdit=['SYSTEM_ADMIN','HR_MANAGER'].includes(role);

 async function loadPolicies(){
   try{const [p,t]=await Promise.all([api<any[]>('leave_policies'),api<any[]>('leave_types')]);setPolicies(p||[]);setTypes(t||[]);}
   catch(e:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message||'تعذر تحميل لوائح الإجازات',type:'error'}}));}
 }
 useEffect(()=>{if(tab==='leaves'&&canEdit) void loadPolicies();},[tab,canEdit]);

 async function savePolicy(){
   if(!form.name||!form.leave_type_id) return;
   setBusy(true);
   try{
     await api(editingId?'update_leave_policy':'create_leave_policy',{...(editingId?{policy_id:editingId}:{}),...form,accrual_period_days:form.accrual_period_days===''?null:Number(form.accrual_period_days),accrual_days:Number(form.accrual_days||0),annual_entitlement:Number(form.annual_entitlement||0),max_carryover_days:Number(form.max_carryover_days||0)});
     setForm({...form,name:''}); setEditingId(null); await loadPolicies();
     window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:'تم حفظ لائحة الإجازات بنجاح'}}));
   }catch(e:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message||'تعذر حفظ اللائحة',type:'error'}}));}
   finally{setBusy(false);}
 }

 return <section className="panel page-panel hr-settings">
  <div className="hr-settings-hero"><div><div className="eyebrow">ELNUBY HR • CONTROL CENTER</div><h2>إعدادات النظام</h2><p>قواعد التشغيل ولوائح الإجازات ومركز Excel في مكان واحد.</p></div><div className="hr-system-status"><span className="status-dot"/> النظام متصل</div></div>
  <div className="hr-settings-tabs">
   {[
    ['overview','نظرة عامة','dashboard'],['attendance','الحضور والورديات','attendance'],
    ...(canEdit?[['leaves','لوائح الإجازات','leaves'],['excel','استيراد وتصدير Excel','reports']]:[]),
    ['roles','الأدوار والصلاحيات','users']
   ].map(([id,label,icon]:any)=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon name={icon} size={16}/><b>{label}</b></button>)}
  </div>
  {tab==='overview'&&<div className="hr-settings-body">
   <div className="hr-stat-grid"><div><span>التوقيت</span><strong>Africa/Cairo</strong><small>قابل للتهيئة من APP_TIMEZONE</small></div><div><span>الحضور</span><strong>GPS + Geofence</strong><small>تحقق من Backend</small></div><div><span>الإجازات</span><strong>Policy Engine</strong><small>حسب نوع الإقامة واللائحة</small></div><div><span>Excel</span><strong>Import / Export</strong><small>فحص قبل الحفظ + Audit</small></div></div>
   <div className="hr-settings-columns"><section><div className="hr-section-title"><span>01</span><div><h3>قواعد الإجازات</h3><p>الرصيد لا يعتمد على رقم ثابت داخل الواجهة.</p></div></div>{[['مغترب','7 أيام لكل 35 يوم حسب اللائحة الحالية.'],['مقيم','21 يوم سنويًا حسب اللائحة الحالية.'],['مرضية','لا تستهلك الرصيد السنوي وتحتاج مستندًا طبيًا.'],['التغيير','HR يستطيع إصدار لائحة جديدة بتاريخ سريان دون كسر التاريخ السابق.']].map(([a,b])=><div className="hr-rule" key={a}><b>{a}</b><span>{b}</span></div>)}</section><aside><div className="hr-section-title"><span>02</span><div><h3>حوكمة البيانات</h3><p>كل تغيير إداري مهم قابل للمراجعة.</p></div></div>{[['المستندات الطبية','Bucket خاص + روابط مؤقتة'],['Excel','Validation قبل Commit'],['الرصيد','حساب قابل للتتبع'],['التدقيق','Audit لكل عملية إدارة']].map(([a,b])=><div className="hr-source" key={a}><span>{a}</span><b>{b}</b></div>)}</aside></div>
  </div>}
  {tab==='attendance'&&<div className="hr-settings-body"><div className="hr-feature"><div className="feature-icon blue"><Icon name="attendance" /></div><div><h3>محرك الحضور والانصراف</h3><p>الوقت والموقع والوردية يتم التحقق منها في Backend، مع دعم الورديات التي تعبر منتصف الليل.</p></div></div><div className="hr-rule-grid">{[['فتح الحضور','attendance_open → attendance_close'],['التأخير','start_time + late_minutes'],['الانصراف','checkout_open → checkout_close'],['الإغلاق التلقائي','auto_checkout_time'],['الموقع','GPS + geofence_radius_m'],['التوقيت','Africa/Cairo']].map(([a,b])=><div className="hr-rule-card" key={a}><b>{a}</b><span>{b}</span></div>)}</div></div>}
  {tab==='leaves'&&<div className="hr-settings-body">
   <div className="policy-toolbar"><div><h3>لوائح الإجازات</h3><p>غيّر اللائحة من هنا بدون تعديل الكود.</p></div><span className="count-pill">{policies.length} لائحة</span></div>
   <div className="policy-form">
    <label>اسم اللائحة<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="مثال: إجازة المغتربين"/></label>
    <label>نوع الإجازة<select value={form.leave_type_id} onChange={e=>setForm({...form,leave_type_id:e.target.value})}>{types.map(t=><option key={t.leave_type_id} value={t.leave_type_id}>{t.name}</option>)}</select></label>
    <label>الفئة<select value={form.residency_type} onChange={e=>setForm({...form,residency_type:e.target.value})}><option value="RESIDENT">مقيم</option><option value="EXPATRIATE">مغترب</option></select></label>
    <label>طريقة الاستحقاق<select value={form.accrual_method} onChange={e=>setForm({...form,accrual_method:e.target.value})}><option value="ANNUAL">سنوي</option><option value="PERIODIC">دوري</option><option value="MANUAL">يدوي</option></select></label>
    {form.accrual_method==='PERIODIC'&&<><label>مدة الدورة بالأيام<input type="number" min="1" value={form.accrual_period_days} onChange={e=>setForm({...form,accrual_period_days:e.target.value})}/></label><label>أيام الإجازة المكتسبة<input type="number" min="0" step="0.5" value={form.accrual_days} onChange={e=>setForm({...form,accrual_days:e.target.value})}/></label></>}
    {form.accrual_method==='ANNUAL'&&<label>الاستحقاق السنوي<input type="number" min="0" step="0.5" value={form.annual_entitlement} onChange={e=>setForm({...form,annual_entitlement:e.target.value})}/></label>}
    <label>تاريخ السريان<input type="date" value={form.effective_from} onChange={e=>setForm({...form,effective_from:e.target.value})}/></label>
    <label className="check-field"><input type="checkbox" checked={form.requires_document} onChange={e=>setForm({...form,requires_document:e.target.checked})}/> يتطلب مستندًا</label>
    <button className="primary" disabled={busy} onClick={savePolicy}>{busy?'جاري الحفظ...':editingId?'حفظ تعديل اللائحة':'إضافة إصدار لائحة'}</button>{editingId&&<button className="secondary" onClick={()=>setEditingId(null)}>إلغاء التعديل</button>}
   </div>
   <div className="policy-list">{policies.map((p:any)=><article className="policy-card" key={p.policy_id}><div><span className="policy-code">{p.policy_id}</span><h4>{p.name}</h4><p>{p.residency_type==='EXPATRIATE'?'مغترب':p.residency_type==='RESIDENT'?'مقيم':'كل الفئات'} • {p.leave_types?.name||p.leave_type_id}</p></div><div className="policy-value">{p.accrual_method==='PERIODIC'?<><strong>{p.accrual_days} يوم</strong><small>كل {p.accrual_period_days} يوم</small></>:p.accrual_method==='ANNUAL'?<><strong>{p.annual_entitlement} يوم</strong><small>سنويًا</small></>:<><strong>يدوي</strong><small>يحدده HR</small></>}</div><div className="policy-card-actions"><span className={`badge ${p.status==='ACTIVE'?'success':'muted'}`}>{p.status==='ACTIVE'?'فعالة':'غير فعالة'}</span><button className="tiny secondary" onClick={()=>{setEditingId(p.policy_id);setForm({name:p.name,leave_type_id:p.leave_type_id,residency_type:p.residency_type||'RESIDENT',accrual_method:p.accrual_method,accrual_basis:p.accrual_basis,accrual_period_days:p.accrual_period_days??'',accrual_days:p.accrual_days??'',annual_entitlement:p.annual_entitlement??'',max_carryover_days:p.max_carryover_days??0,requires_document:!!p.requires_document,allow_partial:!!p.allow_partial,effective_from:p.effective_from,status:p.status})}}>تعديل</button></div></article>)}</div>
  </div>}
  {tab==='excel'&&<div className="hr-settings-body"><ExcelCenter/></div>}
  {tab==='roles'&&<div className="hr-settings-body"><div className="hr-role-grid">{roleCards.map(c=><article className={`hr-role-card ${c.tone}`} key={c.role}><div className="role-code">{c.role}</div><h3>{c.title}</h3><p>{c.text}</p></article>)}</div></div>}
 </section>
}
