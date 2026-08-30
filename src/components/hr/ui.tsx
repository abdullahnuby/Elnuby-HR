'use client';
import React, { ReactNode, useEffect } from 'react';
import Icon from './Icon';
import { Badge, Empty } from './common';

export function PageHeader({title,subtitle,eyebrow,actions,count}:{title:string;subtitle?:string;eyebrow?:string;actions?:ReactNode;count?:ReactNode}){
 return <div className="ux-page-head"><div><div className="ux-eyebrow">{eyebrow}</div><div className="ux-title-row"><h2>{title}</h2>{count}</div>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="ux-head-actions">{actions}</div>}</div>
}
export function Metric({label,value,caption,icon,tone='blue',onClick}:{label:string;value:ReactNode;caption?:string;icon?:string;tone?:string;onClick?:()=>void}){
 return <button type="button" className={`ux-metric ${tone} ${onClick?'clickable':''}`} onClick={onClick}><span className="ux-metric-icon"><Icon name={icon||'dashboard'} size={18}/></span><span className="ux-metric-copy"><small>{label}</small><strong>{value}</strong>{caption&&<em>{caption}</em>}</span></button>
}
export function Filters({children,onReset,onApply}:{children:ReactNode;onReset?:()=>void;onApply?:()=>void}){
 return <div className="ux-filters"><div className="ux-filters-fields">{children}</div><div className="ux-filter-actions">{onReset&&<button className="secondary" onClick={onReset}>مسح</button>}{onApply&&<button className="primary" onClick={onApply}>تطبيق</button>}</div></div>
}
function enhanceTableForMobile(children: ReactNode) {
 const childArray = React.Children.toArray(children);
 const table = childArray.find((child): child is React.ReactElement => React.isValidElement(child) && child.type === 'table');
 if (!table) return children;
 const tableChildren = React.Children.toArray(table.props.children);
 const thead = tableChildren.find((child): child is React.ReactElement => React.isValidElement(child) && child.type === 'thead');
 const tbody = tableChildren.find((child): child is React.ReactElement => React.isValidElement(child) && child.type === 'tbody');
 if (!thead || !tbody) return children;
 const headerRow = React.Children.toArray(thead.props.children).find((child): child is React.ReactElement => React.isValidElement(child) && child.type === 'tr');
 const labels = headerRow ? React.Children.toArray(headerRow.props.children).map(cell => React.isValidElement(cell) ? String(cell.props.children ?? '') : '') : [];
 const bodyRows = React.Children.toArray(tbody.props.children);
 const enhancedRows = bodyRows.map(row => {
   if (!React.isValidElement(row) || row.type !== 'tr') return row;
   const cells = React.Children.toArray(row.props.children);
   return React.cloneElement(row as React.ReactElement<any>, {
     children: cells.map((cell, index) => {
       if (!React.isValidElement(cell) || cell.type !== 'td') return cell;
       return React.cloneElement(cell as React.ReactElement<any>, {
         'data-label': labels[index] || '',
       });
     }),
   });
 });
 const enhancedTbody = React.cloneElement(tbody as React.ReactElement<any>, { children: enhancedRows });
 const enhancedTable = React.cloneElement(table as React.ReactElement<any>, {
   className: `${table.props.className || ''} ux-mobile-card-table`.trim(),
   children: tableChildren.map(child => child === tbody ? enhancedTbody : child),
 });
 return childArray.map(child => child === table ? enhancedTable : child);
}

export function TableShell({title,count,children,empty}:{title?:string;count?:ReactNode;children:ReactNode;empty?:string}){
 return <section className="ux-table-shell"><div className="ux-table-head">{title&&<div><h3>{title}</h3>{count!==undefined&&<span>{count}</span>}</div>}</div>{empty? <Empty text={empty}/> : <div className="ux-table-scroll">{enhanceTableForMobile(children)}</div>}</section>
}
export function Drawer({open,title,subtitle,children,onClose,footer}:{open:boolean;title:string;subtitle?:string;children:ReactNode;onClose:()=>void;footer?:ReactNode}){
 useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',onKey);const prev=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=prev}},[open,onClose]);
 if(!open)return null;
 return <div className="ux-drawer-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="ux-drawer" dir="rtl"><header className="ux-drawer-head"><div><span>تفاصيل</span><h2>{title}</h2>{subtitle&&<small>{subtitle}</small>}</div><button className="icon-close" onClick={onClose} aria-label="إغلاق">×</button></header><div className="ux-drawer-body">{children}</div>{footer&&<footer className="ux-drawer-footer">{footer}</footer>}</aside></div>
}
export function ConfirmDialog({open,title,description,confirmLabel='تأكيد',danger=false,requireReason=false,onConfirm,onClose}:{open:boolean;title:string;description?:string;confirmLabel?:string;danger?:boolean;requireReason?:boolean;onConfirm:(reason?:string)=>void;onClose:()=>void}){
 const [reason,setReason]=React.useState('');
 useEffect(()=>{if(!open)setReason('')},[open]);
 if(!open)return null;
 return <div className="ux-confirm-overlay"><div className="ux-confirm" role="dialog" aria-modal="true"><div className={`ux-confirm-icon ${danger?'danger':'info'}`}><Icon name={danger?'alert':'check'} size={20}/></div><h3>{title}</h3>{description&&<p>{description}</p>}{requireReason&&<label className="ux-field"><span>سبب الإجراء *</span><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="اكتب السبب" rows={4}/></label>}<div className="ux-confirm-actions"><button className="secondary" onClick={onClose}>إلغاء</button><button className={danger?'danger-button':'primary'} disabled={requireReason&&!reason.trim()} onClick={()=>onConfirm(reason.trim()||undefined)}>{confirmLabel}</button></div></div></div>
}
export function Detail({label,value,wide=false}:{label:string;value:ReactNode;wide?:boolean}){return <div className={`ux-detail ${wide?'wide':''}`}><span>{label}</span><strong>{value||'—'}</strong></div>}
export function Status({value}:{value?:unknown}){return <Badge status={value}/>}
