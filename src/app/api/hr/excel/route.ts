import { cookies } from "next/headers";
import { getSession, errorResponse } from "@/server/hr/core";
import { exportExcel, importExcel, parseExcel, templateExcel } from "@/server/hr/excel";
import { SESSION_COOKIE } from "@/server/hr/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value || "";
  const session = await getSession(token);
  if (!session) return errorResponse("الجلسة غير صالحة أو منتهية", 401);
  if (!["SYSTEM_ADMIN","HR_MANAGER"].includes(session.user.role)) return errorResponse("ليس لديك صلاحية لاستخدام مركز Excel",403);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "export";
  const table = url.searchParams.get("table") || "all";

  try {
    const buffer = action === "template" ? templateExcel(table) : await exportExcel(session, table);
    const filename = action === "template" ? `ELNUBY-${table}-template.xlsx` : `ELNUBY-HR-${table}-${new Date().toISOString().slice(0,10)}.xlsx`;
    return new Response(buffer, {
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
