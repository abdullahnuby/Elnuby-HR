'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Icon from './Icon';

export function Kpi({title,value,icon,danger}:{title:string;value:any;icon:string;danger?:boolean}){
  return <div className={`kpi ${danger?'danger-kpi':''}`}><div className="kpi-icon"><Icon name={icon} size={21}/></div><div><span>{title}</span><strong>{value}</strong></div><em>اليوم</em></div>
}

function renderCell(value:any){
  if(value===null||value===undefined||value==='') return <span className="table-muted">—</span>;
  return value;
}

export function Table({headers,rows,onRowClick}:{headers:string[];rows:any[][];onRowClick?:(row:any[])=>void}){
  const safeRows=Array.isArray(rows)?rows:[];
  const safeHeaders=Array.isArray(headers)?headers:[];
  const [mobile,setMobile]=useState(false);
  useEffect(()=>{
    const m=window.matchMedia('(max-width: 800px)');
    const sync=()=>setMobile(m.matches); sync();
    m.addEventListener('change',sync); return()=>m.removeEventListener('change',sync)
  },[]);
  if(mobile) return <div className="hr-mobile-records">
    {safeRows.map((r,i)=><article className={`hr-mobile-record ${onRowClick?'clickable-row':''}`} key={i} onClick={()=>onRowClick?.(r)}>
      <div className="hr-mobile-record-head"><strong>{renderCell(r[0])}</strong><span>{renderCell(r[safeHeaders.length-1])}</span></div>
      {r.slice(1).map((v,j)=><div className="hr-mobile-field" key={j}><span>{safeHeaders[j+1]||''}</span><b>{renderCell(v)}</b></div>)}
    </article>)}
  </div>;
  return <div className="table-wrap hr-responsive-table"><table><thead><tr>{safeHeaders.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{safeRows.map((r,i)=><tr key={i} className={onRowClick?'clickable-row':''} onClick={()=>onRowClick?.(r)}>{r.map((v,j)=><td key={j}>{renderCell(v)}</td>)}</tr>)}</tbody></table></div>
}

export function Badge({status}:{status?:unknown}){
  const value=String(status??'').toUpperCase();
  const map:any={
    ACTIVE:['نشط','success'],INACTIVE:['غير نشط','muted'],APPROVED:['معتمد','success'],REJECTED:['مرفوض','danger'],
    PENDING_HR:['بانتظار الموارد البشرية','warning'],PENDING_MANAGER:['بانتظار المدير','warning'],PENDING:['بانتظار الاعتماد','warning'],
    PRESENT:['حاضر','success'],LATE:['متأخر','warning'],ABSENT:['غائب','danger'],AUTO_CLOSED:['انصراف تلقائي','info'],INCOMPLETE:['غير مكتمل','danger'],
    CURRENT:['حالي','success'],HISTORY:['سجل سابق','muted'],OPEN:['مفتوح','info'],ON_TRACK:['يسير حسب الخطة','success'],AT_RISK:['يحتاج متابعة','warning'],
    ACHIEVED:['تم الإنجاز','success'],CANCELLED:['ملغى','muted'],IN_PROGRESS:['قيد التنفيذ','warning'],COMPLETED:['مكتمل','success'],
    UNDER_INVESTIGATION:['قيد التحقيق','warning'],DECIDED:['تم اتخاذ القرار','info'],CLOSED:['مغلق','muted'],PLANNED:['مخطط','info'],
    NEW:['جديد','info'],SCREENING:['فرز أولي','warning'],INTERVIEW:['مقابلة','info'],OFFER:['عرض وظيفي','info'],HIRED:['تم التعيين','success'],
    ON_HOLD:['معلّق','warning'],LOW:['منخفضة','muted'],NORMAL:['عادية','info'],HIGH:['عالية','warning'],CRITICAL:['حرجة','danger'],ASSIGNED:['مُسند','info'],
    HR_CLOSED:['مغلق من الموارد البشرية','muted'],MANAGER_APPROVED:['معتمد من المدير','success'],SUBMITTED:['مُرسل','info'],DRAFT:['مسودة','muted']
  };
  const [label,kind]=map[value]||[status||'—','muted'];
  return <span className={`status-badge ${kind}`}>{label}</span>
}

export function Empty({text,action,onAction}:{text:string;action?:string;onAction?:()=>void}){return <div className="empty"><Icon name="search" size={26}/><strong>{text}</strong>{action&&<button className="secondary" onClick={onAction}>{action}</button>}</div>}
export function Skeleton({rows=5}:{rows?:number}){return <div className="skeleton-list" aria-label="جاري التحميل">{Array.from({length:rows}).map((_,i)=><div className="skeleton-row" key={i}><i/><span/><b/></div>)}</div>}
export function ErrorState({text,onRetry}:{text:string;onRetry?:()=>void}){return <div className="state-card error-state"><Icon name="alert" size={22}/><div><strong>تعذر تحميل البيانات</strong><span>{text}</span></div>{onRetry&&<button className="secondary" onClick={onRetry}>إعادة المحاولة</button>}</div>}

export function DetailsDrawer({open,title,subtitle,onClose,children,footer}:{open:boolean;title:string;subtitle?:string;onClose:()=>void;children:ReactNode;footer?:ReactNode}){
  useEffect(()=>{if(!open)return;const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[open,onClose]);
  if(!open)return null;
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="details-drawer" dir="rtl" role="dialog" aria-modal="true">
      <header className="drawer-head"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div><button className="drawer-close" onClick={onClose} aria-label="إغلاق">×</button></header>
      <div className="drawer-body">{children}</div>
      {footer&&<footer className="drawer-footer">{footer}</footer>}
    </aside>
  </div>
}

export function ConfirmDialog({open,title,description,confirmText='تأكيد',danger=false,busy=false,onClose,onConfirm,children}:{open:boolean;title:string;description?:string;confirmText?:string;danger?:boolean;busy?:boolean;onClose:()=>void;onConfirm:()=>void;children?:ReactNode}){
  useEffect(()=>{if(!open)return;const fn=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[open,onClose,busy]);
  if(!open)return null;
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
    <section className="confirm-dialog" dir="rtl" role="dialog" aria-modal="true">
      <div className={`confirm-icon ${danger?'danger':'info'}`}><Icon name={danger?'alert':'check'} size={20}/></div>
      <h3>{title}</h3>{description&&<p>{description}</p>}{children}
      <div className="confirm-actions"><button className="secondary" onClick={onClose} disabled={busy}>إلغاء</button><button className={danger?'danger-action':'primary'} onClick={onConfirm} disabled={busy}>{busy?'جاري التنفيذ...':confirmText}</button></div>
    </section>
  </div>
}

export function FormField({label,required,help,children}:{label:string;required?:boolean;help?:string;children:ReactNode}){
  return <label className="ui-field"><span>{label}{required&&<b> *</b>}</span>{children}{help&&<small>{help}</small>}</label>
}

export function SectionHeader({title,subtitle,count,action}:{title:string;subtitle?:string;count?:ReactNode;action?:ReactNode}){
  return <div className="section-header-pro"><div><h3>{title}</h3>{subtitle&&<p>{subtitle}</p>}</div><div className="section-header-side">{count}{action}</div></div>
}
