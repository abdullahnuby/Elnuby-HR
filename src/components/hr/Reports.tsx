'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Table } from './common';
import { downloadExcel } from '@/lib/api';

const labels:any={PRESENT:'حاضر',LATE:'متأخر',ABSENT:'غائب',LEAVE:'إجازة',PERMISSION:'إذن',WEEKEND:'راحة أسبوعية',NOT_STARTED:'لم يبدأ التسجيل',INCOMPLETE:'انصراف غير مكتمل',AUTO_CLOSED:'انصراف تلقائي',NOT_EMPLOYED:'ليس على رأس العمل'};
export default function Reports({dash,managerDash}:any){
 const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
 const [report,setReport]=useState<any>(null); const [busy,setBusy]=useState(false);
 async function load(){setBusy(true);try{setReport(await api<any>('attendance_monthly_report',{month}));}catch(e:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message||'تعذر تحميل التقرير',type:'error'}}));}finally{setBusy(false)}}
 async function exportReport(){try{const blob=await downloadExcel('monthly_report',month);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ELNUBY-HR-تقرير-${month}.xlsx`;a.click();URL.revokeObjectURL(url);}catch(e:any){window.dispatchEvent(new CustomEvent('hr:toast',{detail:{message:e.message||'تعذر تصدير التقرير',type:'error'}}));}}
 useEffect(()=>{load()},[]);
 return <section className="panel page-panel">
  <div className="panel-head"><div><h2>التقارير</h2><p>تقارير الحضور والإجازات والأذونات والانضباط بصورة شهرية ويومية.</p></div></div>
  <div className="report-grid"><div><span>إجمالي الموظفين</span><b>{dash?.employees??0}</b></div><div><span>حضور اليوم</span><b>{dash?.present??0}</b></div><div><span>التأخير اليوم</span><b>{dash?.late??0}</b></div><div><span>حالات بدون انصراف</span><b>{dash?.missingCheckout??0}</b></div></div>
  <div className="report-month-toolbar"><label>الشهر<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button className="primary" disabled={busy} onClick={load}>{busy?'جاري التحميل…':'عرض التقرير'}</button><button className="secondary" disabled={!report||busy} onClick={exportReport}>تصدير إكسل</button></div>
  {report&&<>
   <div className="report-grid report-month-kpis">{Object.keys(labels).map(k=><div key={k}><span>{labels[k]}</span><b>{report.summary?.[k]??0}</b></div>)}</div>
   <div className="empty-note">الفترة: {report.start} إلى {report.end} • تم احتساب الإجازات والأذونات والحضور والراحة الأسبوعية داخل نفس التقرير.</div>
   <div className="panel-head" style={{marginTop:24}}><div><h3>ملخص الموظفين</h3><p>عدد الأيام لكل حالة خلال الشهر.</p></div></div>
   <Table headers={['الموظف','حاضر','متأخر','غائب','إجازة','إذن','غير مكتمل','انصراف تلقائي']} rows={(Array.isArray(report?.employeeSummary)?report.employeeSummary:[]).map((e:any)=>[e.name,e.counts?.PRESENT||0,e.counts?.LATE||0,e.counts?.ABSENT||0,e.counts?.LEAVE||0,e.counts?.PERMISSION||0,e.counts?.INCOMPLETE||0,e.counts?.AUTO_CLOSED||0])}/>
   <div className="panel-head" style={{marginTop:24}}><div><h3>السجل اليومي</h3><p>الحالة الفعلية لكل موظف في كل يوم.</p></div></div>
   <Table headers={['التاريخ','الموظف','الحالة','الحضور','الانصراف','التأخير']} rows={(Array.isArray(report?.rows)?report.rows:[]).map((r:any)=>[r.date,r.employee_name,r.status_label||labels[r.status]||r.status,r.check_in||'—',r.check_out||'—',r.late_minutes?r.late_minutes+' دقيقة':'—'])}/>
  </>}
  {managerDash&&<><div className="panel-head" style={{marginTop:24}}><div><h3>تقرير فريق المشروع</h3><p>الموظفون حسب الحالة اليومية والطلبات المعلقة.</p></div></div><Table headers={['الموظف','المشروع','الحالة','حضور','انصراف']} rows={(Array.isArray(managerDash?.team)?managerDash.team:[]).map((e:any)=>[e.name,e.project_name||'—',({PRESENT:'حاضر',CHECKED_IN:'حاضر ولم ينصرف',LATE:'متأخر',ON_LEAVE:'إجازة',ABSENT:'غائب'} as any)[e.state]||e.state,e.attendance?.check_in||'—',e.attendance?.check_out||'—'])}/></>}
 </section>
}
