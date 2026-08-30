import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Employee, Project, Row, Shift } from './types';
import { Table, Empty, Badge } from './common';

type Props = { title:string; subtitle:string; rows:Row[]; type:string; onCloseAttendance?: (attendanceId:string)=>void; busy?:boolean; };

function formatMinutes(value: unknown) { const minutes=Number(value); if(!Number.isFinite(minutes)||minutes<=0)return '0 د'; const hours=Math.floor(minutes/60); const mins=minutes%60; if(!hours)return `${mins} د`; if(!mins)return `${hours} س`; return `${hours} س ${mins} د`; }
function formatWorkedMinutes(value: unknown) { const minutes=Number(value); if(!Number.isFinite(minutes)||minutes<0)return '—'; const hours=Math.floor(minutes/60); const mins=minutes%60; return `${hours}:${String(mins).padStart(2,'0')}`; }
function time12(value: unknown){if(!value)return '—';const text=String(value).slice(0,5);const [h,m]=text.split(':').map(Number);if(!Number.isFinite(h))return String(value);const ap=h>=12?'م':'ص';return `${(h%12)||12}:${String(m||0).padStart(2,'0')} ${ap}`;}
function statusLabel(value: unknown) { switch(String(value||'').toUpperCase()){case 'PRESENT':return 'حاضر';case 'LATE':return 'متأخر';case 'ABSENT':return 'غائب';case 'AUTO_CLOSED':return 'انصراف تلقائي';case 'INCOMPLETE':return 'غير مكتمل';default:return value?String(value):'—';} }

export default function DataSection({title,subtitle,rows,type,onCloseAttendance,busy}:Props){
 const safeRows=Array.isArray(rows)?rows:[];
 const [me,setMe]=useState<any>(null); const [employees,setEmployees]=useState<Employee[]>([]); const [projects,setProjects]=useState<Project[]>([]); const [shifts,setShifts]=useState<Shift[]>([]); const [lookupLoading,setLookupLoading]=useState(false);
 useEffect(()=>{ if(type!=='attendance')return; let cancelled=false; (async()=>{ try{const mine=await api<any>('me'); if(!cancelled)setMe(mine); if(['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'].includes(mine?.user?.role)){ setLookupLoading(true); const [es,ps,ss]=await Promise.all([api<Employee[]>('employees'),api<Project[]>('projects'),api<Shift[]>('shifts')]); if(!cancelled){setEmployees(es||[]);setProjects(ps||[]);setShifts(ss||[]);} } }catch(e){console.error('attendance lookup:',e)}finally{if(!cancelled)setLookupLoading(false)}})(); return()=>{cancelled=true}; },[type]);
 const employeeMap=useMemo(()=>new Map((Array.isArray(employees)?employees:[]).map(e=>[String(e.employee_id),e])),[employees]);
 const projectMap=useMemo(()=>new Map((Array.isArray(projects)?projects:[]).map(p=>[String(p.project_id),p])),[projects]);
 const shiftMap=useMemo(()=>new Map((Array.isArray(shifts)?shifts:[]).map(s=>[String(s.shift_id),s])),[shifts]);
 const headers=type==='attendance'?['الموظف','الوظيفة','القسم','المشروع','الوردية','التاريخ','الحضور','الانصراف','التأخير','ساعات العمل','الحالة','إجراء']:['الموظف','التاريخ','النوع','القيمة','السبب','الحالة'];
 const mapped=safeRows.map(r=>{ if(type!=='attendance')return [r.employee_name||r.employee_id,r.date,r.deduction_type||r.type||'—',r.amount??'—',r.reason||'—',r.status||'—']; const id=String(r.employee_id||''); const employee=employeeMap.get(id) || (String(me?.user?.employee_id||'')===id?me?.employee:null); const project=projectMap.get(String(r.project_id||'')) || (String(me?.project?.project_id||'')===String(r.project_id||'')?me?.project:null); const shift=shiftMap.get(String(r.shift_id||'')) || (String(me?.shift?.shift_id||'')===String(r.shift_id||'')?me?.shift:null); return [employee?.name||r.employee_name||r.employee_id||'—',employee?.job_title||r.job_title||'—',employee?.department||r.department||'—',project?.name||r.project_name||r.project_id||'—',shift?.name||r.shift_name||r.shift_id||'—',r.date||'—',time12(r.check_in),time12(r.check_out),formatMinutes(r.late_minutes),formatWorkedMinutes(r.worked_minutes),<Badge status={r.status}/>,r.check_in&&!r.check_out&&onCloseAttendance?<button className="table-action" disabled={busy} onClick={()=>onCloseAttendance(String(r.attendance_id))}>إغلاق السجل</button>:'—']; });
 return <section className="panel page-panel"><div className="panel-head"><div><div className="eyebrow">ATTENDANCE RECORDS</div><h2>{title}</h2><p>{subtitle}</p></div>{type==='attendance'&&lookupLoading&&<span className="count-pill">جاري تحديث بيانات الربط…</span>}</div><Table headers={headers} rows={mapped}/>{!rows.length&&<Empty text="لا توجد بيانات لعرضها حالياً."/>}</section>;
}
