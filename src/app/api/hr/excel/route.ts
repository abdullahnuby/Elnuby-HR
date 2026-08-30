import { cookies } from "next/headers";
import { getSession, errorResponse } from "@/server/hr/core";
import { exportExcel, importExcel, parseExcel, templateExcel } from "@/server/hr/excel";
import { SESSION_COOKIE } from "@/server/hr/auth";
import { attendanceMonthlyReport } from "@/server/hr/reports";
import * as XLSX from "xlsx-republish";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value || "";
  const session = await getSession(token);
  if (!session) return errorResponse("الجلسة غير صالحة أو منتهية", 401);
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "export";
  const table = url.searchParams.get("table") || "all";
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0,7);
  const reportRoles = ["SYSTEM_ADMIN","HR_MANAGER","SECTOR_MANAGER","PROJECT_MANAGER"];
  if (action === "monthly_report") {
    if (!reportRoles.includes(session.user.role)) return errorResponse("ليس لديك صلاحية لعرض التقرير",403);
  } else if (!["SYSTEM_ADMIN","HR_MANAGER"].includes(session.user.role)) {
    return errorResponse("ليس لديك صلاحية لاستخدام مركز Excel",403);
  }

  try {
    let buffer: Buffer;
    let filename: string;
    if (action === "monthly_report") {
      const result = await attendanceMonthlyReport(session, { month });
      const json = await result.json();
      if (!json.ok) return Response.json(json, { status: result.status });
      const data = json.data || {};
      const wb = XLSX.utils.book_new();
      const summaryRows = (data.employeeSummary || []).map((e:any) => ({
        "الموظف": e.name, "الوظيفة": e.job_title || "", "القسم": e.department || "",
        "حاضر": e.counts?.PRESENT || 0, "متأخر": e.counts?.LATE || 0, "غائب": e.counts?.ABSENT || 0,
        "إجازة": e.counts?.LEAVE || 0, "إذن": e.counts?.PERMISSION || 0, "غير مكتمل": e.counts?.INCOMPLETE || 0, "انصراف تلقائي": e.counts?.AUTO_CLOSED || 0,
      }));
      const dailyRows = (data.rows || []).map((r:any) => ({
        "التاريخ": r.date, "الموظف": r.employee_name, "الحالة": r.status_label, "الحضور": r.check_in || "", "الانصراف": r.check_out || "", "دقائق التأخير": r.late_minutes || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "ملخص الموظفين");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), "السجل اليومي");
      buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
      filename = `ELNUBY-HR-تقرير-${month}.xlsx`;
    } else {
      buffer = action === "template" ? templateExcel(table) : await exportExcel(session, table);
      filename = action === "template" ? `ELNUBY-${table}-template.xlsx` : `ELNUBY-HR-${table}-${new Date().toISOString().slice(0,10)}.xlsx`;
    }
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":"no-store",
      }
    });
  } catch (e:any) {
    return errorResponse(e?.message || "تعذر إنشاء ملف Excel",500);
  }
}

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value || "";
  const session = await getSession(token);
  if (!session) return errorResponse("الجلسة غير صالحة أو منتهية", 401);
  if (!["SYSTEM_ADMIN","HR_MANAGER"].includes(session.user.role)) return errorResponse("ليس لديك صلاحية لاستخدام مركز Excel",403);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const table = String(form.get("table") || "");
    const commit = String(form.get("commit") || "false") === "true";
    if (!(file instanceof File)) return errorResponse("ملف Excel مطلوب");
    if (!table) return errorResponse("حدد الجدول المطلوب استيراده");
    if (file.size > 20 * 1024 * 1024) return errorResponse("حجم الملف يجب ألا يتجاوز 20 ميجابايت");
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) return errorResponse("ارفع ملف Excel بصيغة XLSX أو XLS");
    const result = parseExcel(Buffer.from(await file.arrayBuffer()), table);
    if (!commit) return Response.json({ok:true,data:{table,total:result.valid.length+result.errors.length,valid:result.valid.length,errors:result.errors.slice(0,100),preview:result.valid.slice(0,10)}});
    return importExcel(session, table, result.valid, true);
  } catch (e:any) {
    return errorResponse(e?.message || "تعذر قراءة ملف Excel",400);
  }
}
