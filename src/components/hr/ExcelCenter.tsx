import { useState } from "react";
import { apiFile, downloadExcel } from "@/lib/api";

const TABLES = [
  ["all","كل الجداول"],
  ["employees","الموظفون"],
  ["projects","المشروعات"],
  ["shifts","الورديات"],
  ["project_assignments","تعيينات المشروعات"],
  ["employee_shifts","تعيينات الورديات"],
  ["attendance","الحضور والانصراف"],
  ["leave_types","أنواع الإجازات"],
  ["leave_policies","لوائح الإجازات"],
  ["leave_balances","أرصدة الإجازات"],
  ["leave_requests","طلبات الإجازات"],
  ["permission_requests","طلبات الأذونات"],
  ["deductions","الخصومات"],
];

export default function ExcelCenter() {
  const [table,setTable]=useState("employees");
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function download(action:"export"|"template") {
    setBusy(true); setError(""); setMessage("");
    try {
      const blob=await downloadExcel(action, table);
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url;
      a.download=`ELNUBY-${table}-${action}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      setMessage(action==="export"?"تم تصدير ملف إكسل بنجاح":"تم تنزيل نموذج إكسل");
    } catch(e:any){setError(e.message||"تعذر تنفيذ العملية");}
    finally{setBusy(false);}
  }

  async function inspect() {
    if(!file) return setError("اختر ملف إكسل أولاً");
    setBusy(true); setError(""); setMessage("");
    try { setPreview(await apiFile("import",{table,commit:false},file)); }
    catch(e:any){setError(e.message||"تعذر قراءة الملف");}
    finally{setBusy(false);}
  }

  async function commit() {
    if(!file) return;
    if(preview?.errors?.length) return setError("أصلح أخطاء الملف قبل الاستيراد");
    setBusy(true); setError(""); setMessage("");
    try {
      const result=await apiFile("import",{table,commit:true},file);
      setMessage(`تم استيراد ${result.imported} سجل بنجاح`);
      setPreview(null); setFile(null);
    } catch(e:any){setError(e.message||"تعذر الاستيراد");}
    finally{setBusy(false);}
  }

  return <section className="excel-center">
    <div className="excel-hero">
      <div><div className="eyebrow">عمليات البيانات</div><h3>مركز إكسل</h3><p>استيراد وتصدير منظم مع فحص قبل الحفظ وسجل تدقيق للعمليات.</p></div>
      <div className="excel-badge">ملفات إكسل</div>
    </div>
    <div className="excel-grid">
      <div className="excel-card">
        <label>الجدول</label>
        <select value={table} onChange={e=>{setTable(e.target.value);setPreview(null);setError("");}}>
          {TABLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
        <div className="excel-actions">
          <button className="primary" disabled={busy} onClick={()=>download("export")}>تصدير إكسل</button>
          {table!=="all"&&<button className="secondary" disabled={busy} onClick={()=>download("template")}>تحميل النموذج</button>}
        </div>
      </div>
      {table!=="all"&&<div className="excel-card">
        <label>استيراد ملف</label>
        <input type="file" accept=".xlsx,.xls" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setError("");}} />
        <p className="excel-help">الملف لا يُحفظ مباشرة. سيظهر لك تقرير بالأخطاء أولًا.</p>
        <button className="primary" disabled={busy||!file} onClick={inspect}>فحص الملف</button>
      </div>}
    </div>
    {preview&&<div className="excel-preview">
      <div className="excel-preview-head"><div><strong>نتيجة الفحص</strong><span>{preview.valid} سجل صالح من {preview.total}</span></div><button className="primary" disabled={busy||preview.errors?.length} onClick={commit}>اعتماد الاستيراد</button></div>
      {!!preview.errors?.length&&<div className="excel-errors">{preview.errors.slice(0,12).map((x:any,i:number)=><div key={i}><b>صف {x.row}</b><span>{x.message}</span></div>)}</div>}
      {!preview.errors?.length&&<div className="excel-success">الملف سليم ويمكن استيراده.</div>}
    </div>}
    {message&&<div className="alert success">{message}</div>}
    {error&&<div className="alert danger">{error}</div>}
  </section>
}
