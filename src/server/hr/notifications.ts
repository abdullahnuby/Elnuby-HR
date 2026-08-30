import { supabase, success, errorResponse, appDate } from "./core";
import type { SessionContext } from "./core";

const HR_ROLES = ["SYSTEM_ADMIN", "HR_MANAGER"];

function daysFromToday(date: string) {
  const a = new Date(`${appDate()}T00:00:00Z`).getTime();
  const b = new Date(`${date.slice(0,10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export async function listNotifications(session: SessionContext) {
  try {
    if (!HR_ROLES.includes(session.user.role)) return errorResponse("ليس لديك صلاحية عرض التنبيهات", 403);
    const today = appDate();
    const notices: any[] = [];

    const [{ data: contracts, error: contractError }, { data: employees, error: employeeError }, { data: leaves, error: leaveError }, { data: permissions, error: permissionError }, { data: cases, error: casesError }, { data: documents, error: documentError }] = await Promise.all([
      supabase.from("employees").select("employee_id,name,contract_end_date,status").not("contract_end_date", "is", null).eq("status", "ACTIVE"),
      supabase.from("employees").select("employee_id,name,status").eq("status", "ACTIVE"),
      supabase.from("leave_requests").select("request_id,employee_id,from_date,to_date,status").in("status", ["PENDING_MANAGER", "PENDING_HR"]),
      supabase.from("permission_requests").select("request_id,employee_id,date,status").eq("status", "PENDING"),
      supabase.from("disciplinary_cases").select("case_id,employee_id,status,created_at").in("status", ["OPEN", "UNDER_INVESTIGATION"]),
      supabase.from("employee_documents").select("employee_id,document_name,expiry_date,status").not("expiry_date", "is", null),
    ]);
    const first = [contractError, employeeError, leaveError, permissionError, casesError, documentError].find(Boolean);
    if (first) return errorResponse(first.message, 500);

    const employeeNames = new Map((employees || []).map((e:any) => [e.employee_id, e.name]));
    for (const row of documents || []) {
      if (!row.expiry_date) continue;
      const days = daysFromToday(String(row.expiry_date));
      if (days < 0) notices.push({ type: "DOCUMENT_EXPIRED", priority: "HIGH", employee_id: row.employee_id, title: "مستند موظف منتهي", message: `${employeeNames.get(row.employee_id) || row.employee_id} — ${row.document_name} منتهي`, date: String(row.expiry_date).slice(0,10) });
      else if (days <= 30) notices.push({ type: "DOCUMENT_EXPIRY", priority: days <= 7 ? "HIGH" : "MEDIUM", employee_id: row.employee_id, title: "مستند يقترب من الانتهاء", message: `${employeeNames.get(row.employee_id) || row.employee_id} — ${row.document_name} ينتهي خلال ${days} يومًا`, date: String(row.expiry_date).slice(0,10) });
    }

    for (const row of contracts || []) {
      const days = daysFromToday(String(row.contract_end_date));
      if (days >= 0 && days <= 30) notices.push({ type: "CONTRACT_EXPIRY", priority: days <= 7 ? "HIGH" : "MEDIUM", employee_id: row.employee_id, title: "عقد يقترب من الانتهاء", message: `${row.name} — ينتهي العقد خلال ${days} يومًا`, date: String(row.contract_end_date).slice(0,10) });
    }
    for (const row of leaves || []) notices.push({ type: "PENDING_LEAVE", priority: "MEDIUM", request_id: row.request_id, employee_id: row.employee_id, title: "إجازة تنتظر الاعتماد", message: `طلب إجازة للموظف ${row.employee_id} يحتاج إلى مراجعة`, date: String(row.from_date).slice(0,10) });
    for (const row of permissions || []) notices.push({ type: "PENDING_PERMISSION", priority: "MEDIUM", request_id: row.request_id, employee_id: row.employee_id, title: "إذن ينتظر الاعتماد", message: `طلب إذن للموظف ${row.employee_id} يحتاج إلى مراجعة`, date: String(row.date).slice(0,10) });
    for (const row of cases || []) notices.push({ type: "OPEN_CASE", priority: "HIGH", case_id: row.case_id, employee_id: row.employee_id, title: "واقعة انضباطية مفتوحة", message: `توجد واقعة مفتوحة للموظف ${row.employee_id}`, date: String(row.created_at || today).slice(0,10) });

    const priorityRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    notices.sort((a,b) => (priorityRank[String(a.priority)] ?? 3) - (priorityRank[String(b.priority)] ?? 3) || String(a.date).localeCompare(String(b.date)));
    return success({ today, total: notices.length, high: notices.filter(n => n.priority === "HIGH").length, notices });
  } catch (e: any) {
    console.error("notifications:", e);
    return errorResponse("تعذر تحميل التنبيهات", 500);
  }
}
