'use client';
import { useMemo, useState } from 'react';
import type { Employee, Project, Shift } from './types';
import { Table, Empty, Badge, FormField } from './common';

export default function Employees({employees,projects,shifts,managerMode,employeeForm,setEmployeeForm,createEmployee,selectedEmployee,setSelectedEmployee,selectedProject,setSelectedProject,selectedShift,setSelectedShift,assignProject,busy,onEdit}:any){
 const safeEmployees:Employee[]=Array.isArray(employees)?employees:[]; const safeProjects:Project[]=Array.isArray(projects)?projects:[]; const safeShifts:Shift[]=Array.isArray(shifts)?shifts:[];
 const [query,setQuery]=useState(''); const [status,setStatus]=useState('ALL');
 const filtered=useMemo(()=>safeEmployees.filter((e:any)=>{const q=!query||String(e.name||'').includes(query)||String(e.employee_id||'').includes(query)||String(e.job_title||'').includes(query);const s=status==='ALL'||String(e.status||'ACTIVE')===status;return q&&s}),[safeEmployees,query,status]);
 return <section className="panel page-panel">
  <div className="panel-head"><div><span className="eyebrow">إدارة الموظفين</span><h2>الموظفون</h2><p>ملفات الموظفين والتعيينات الحالية مع بحث وفلترة سريعة.</p></div><span className="count-pill">{filtered.length} موظف</span></div>
  {!managerMode&&<div className="smart-form">
    <div className="smart-form-title"><div><span>إضافة موظف</span><h3>بيانات الموظف والتعيين الأول</h3></div><span className="form-step">خطوة واحدة</span></div>
    <div className="ui-form-grid">
      <FormField label="الاسم بالكامل" required><input value={employeeForm.name||''} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})} placeholder="الاسم بالكامل"/></FormField>
      <FormField label="الوظيفة" required><input value={employeeForm.job_title||''} onChange={e=>setEmployeeForm({...employeeForm,job_title:e.target.value})} placeholder="المسمى الوظيفي"/></FormField>
      <FormField label="القسم"><input value={employeeForm.department||''} onChange={e=>setEmployeeForm({...employeeForm,department:e.target.value})} placeholder="القسم"/></FormField>
      <FormField label="رقم الهاتف"><input value={employeeForm.phone||''} onChange={e=>setEmployeeForm({...employeeForm,phone:e.target.value})} placeholder="رقم الهاتف"/></FormField>
      <FormField label="الرقم القومي"><input value={employeeForm.national_id||''} inputMode="numeric" onChange={e=>setEmployeeForm({...employeeForm,national_id:e.target.value})} placeholder="الرقم القومي"/></FormField>
      <FormField label="تاريخ الميلاد"><input type="date" value={employeeForm.birth_date||''} onChange={e=>setEmployeeForm({...employeeForm,birth_date:e.target.value})}/></FormField>
      <FormField label="تاريخ التعيين"><input type="date" value={employeeForm.hire_date||''} onChange={e=>setEmployeeForm({...employeeForm,hire_date:e.target.value})}/></FormField>
      <FormField label="نوع الموظف" required><select value={employeeForm.residency_type||'RESIDENT'} onChange={e=>setEmployeeForm({...employeeForm,residency_type:e.target.value})}><option value="RESIDENT">مقيم</option><option value="EXPATRIATE">وافد</option></select></FormField>
      <FormField label="المشروع الحالي" required><select value={employeeForm.project_id||''} onChange={e=>setEmployeeForm({...employeeForm,project_id:e.target.value})}><option value="">اختر المشروع</option>{safeProjects.map(p=><option key={p.project_id} value={p.project_id}>{p.name}</option>)}</select></FormField>
      <FormField label="الوردية الحالية" required><select value={employeeForm.shift_id||''} onChange={e=>setEmployeeForm({...employeeForm,shift_id:e.target.value})}><option value="">اختر الوردية</option>{safeShifts.map(s=><option key={s.shift_id} value={s.shift_id}>{s.name} — {String(s.start_time||'').slice(0,5)}</option>)}</select></FormField>
    </div>
    <div className="form-actions"><button className="primary" disabled={busy||!employeeForm.name||!employeeForm.job_title||!employeeForm.project_id||!employeeForm.shift_id} onClick={createEmployee}>{busy?'جاري الحفظ...':'حفظ الموظف وتعيينه'}</button></div>
  </div>}
  <div className="request-card compact"><div className="filters-panel"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بالاسم أو الرقم أو الوظيفة"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">كل الحالات</option><option value="ACTIVE">نشط</option><option value="INACTIVE">غير نشط</option></select><button className="secondary" onClick={()=>{setQuery('');setStatus('ALL')}}>مسح</button></div></div>
  <div className="request-card compact"><h3>{managerMode?'تعديل تعيينات الفريق':'نقل موظف أو تغيير ورديته'}</h3><div className="ui-form-grid"><FormField label="الموظف"><select value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}><option value="">اختر الموظف</option>{safeEmployees.map(e=><option key={e.employee_id} value={e.employee_id}>{e.name} — {e.employee_id}</option>)}</select></FormField><FormField label="المشروع"><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">اختر المشروع</option>{safeProjects.map(p=><option key={p.project_id} value={p.project_id}>{p.name}</option>)}</select></FormField><FormField label="الوردية"><select value={selectedShift} onChange={e=>setSelectedShift(e.target.value)}><option value="">اختر الوردية</option>{safeShifts.map(s=><option key={s.shift_id} value={s.shift_id}>{s.name}</option>)}</select></FormField></div><div className="form-actions"><button className="secondary" disabled={busy||!selectedEmployee||!selectedProject||!selectedShift} onClick={assignProject}>حفظ التعيين</button></div></div>
  {!filtered.length?<Empty text="لا توجد نتائج مطابقة للبحث الحالي."/>:<Table headers={['الاسم','الوظيفة','القسم','المشروع','الوردية','نوع الموظف','الحالة','إجراء']} rows={filtered.map((e:any)=>[e.name,e.job_title||'—',e.department||'—',e.project_name||'غير معين',e.shift_name||'غير معين',e.residency_type==='EXPATRIATE'?'وافد':'مقيم',<Badge status={e.status||'ACTIVE'}/>,onEdit?<button className="table-action" onClick={(ev:any)=>{ev.stopPropagation();onEdit(e.employee_id)}} disabled={busy}>تعديل</button>:null])}/>} 
 </section>
}
