import * as XLSX from "xlsx-republish";
import { supabase, errorResponse, success, generateId, nowISO, writeAudit } from "./core";
import type { SessionContext } from "./core";

type TableConfig = {
  label: string;
  columns: string[];
  required: string[];
  key: string;
  importable: boolean;
};

export const EXCEL_TABLES: Record<string, TableConfig> = {
  employees: {
    label: "الموظفون",
    columns: ["employee_id","name","job_title","department","phone","national_id","birth_date","hire_date","residency_type","status"],
    required: ["employee_id","name","job_title","residency_type"],
    key: "employee_id", importable: true,
  },
  employee_residency_history: {
    label: "تاريخ نوع إقامة الموظفين",
    columns: ["id","employee_id","residency_type","effective_from","effective_to","created_at"],
    required: ["id","employee_id","residency_type","effective_from"],
    key: "id", importable: true,
  },
  projects: {
    label: "المشروعات",
    columns: ["project_id","name","client","location_name","latitude","longitude","geofence_radius_m","status"],
    required: ["project_id","name","latitude","longitude","geofence_radius_m"],
    key: "project_id", importable: true,
  },
  shifts: {
    label: "الورديات",
    columns: ["shift_id","name","start_time","attendance_open","attendance_close","checkout_open","checkout_close","auto_checkout_time","status"],
    required: ["shift_id","name","start_time","attendance_open","attendance_close","checkout_open","checkout_close","auto_checkout_time"],
    key: "shift_id", importable: true,
  },
  project_assignments: {
    label: "تعيينات المشروعات",
    columns: ["assignment_id","employee_id","project_id","start_date","end_date","is_current","created_by","created_at"],
    required: ["assignment_id","employee_id","project_id","start_date","is_current"],
    key: "assignment_id", importable: true,
  },
  employee_shifts: {
    label: "تعيينات الورديات",
    columns: ["assignment_id","employee_id","project_id","shift_id","start_date","end_date","created_by","created_at"],
    required: ["assignment_id","employee_id","project_id","shift_id","start_date"],
    key: "assignment_id", importable: true,
  },
  attendance: {
    label: "الحضور والانصراف",
    columns: ["attendance_id","employee_id","project_id","shift_id","date","check_in","check_out","status","late_minutes","worked_minutes","auto_closed","manual_modified","modification_reason","source","client_event_id","check_out_event_id","client_recorded_at","created_at","updated_at"],
    required: ["attendance_id","employee_id","project_id","shift_id","date"],
    key: "attendance_id", importable: true,
  },
  leave_types: {
    label: "أنواع الإجازات",
    columns: ["leave_type_id","name","requires_balance","annual_entitlement","status"],
    required: ["leave_type_id","name"],
    key: "leave_type_id", importable: true,
  },
  leave_policies: {
    label: "لوائح الإجازات",
    columns: ["policy_id","name","leave_type_id","residency_type","accrual_method","accrual_basis","accrual_period_days","accrual_days","annual_entitlement","max_carryover_days","requires_document","allow_partial","effective_from","effective_to","version","status"],
    required: ["policy_id","name","leave_type_id","effective_from","status"],
    key: "policy_id", importable: true,
  },
  leave_balances: {
    label: "أرصدة الإجازات",
    columns: ["id","employee_id","leave_type_id","year","entitlement","used","pending","remaining","policy_id","cycle_start","cycle_end","source","updated_at"],
    required: ["id","employee_id","leave_type_id","year"],
    key: "id", importable: true,
  },
  leave_requests: {
    label: "طلبات الإجازات",
    columns: ["request_id","employee_id","project_id","leave_type_id","policy_id","from_date","to_date","days","reason","status","manager_id","manager_decision_at","manager_comment","hr_decision","hr_decision_at","hr_comment","document_required","created_at","updated_at"],
    required: ["request_id","employee_id","project_id","leave_type_id","from_date","to_date","days","status"],
    key: "request_id", importable: true,
  },
  permission_requests: {
    label: "طلبات الأذونات",
    columns: ["request_id","employee_id","project_id","date","start_time","end_time","minutes","reason","status","manager_id","manager_decision_at","manager_comment","created_at","updated_at"],
    required: ["request_id","employee_id","project_id","date","start_time","end_time","minutes","status"],
    key: "request_id", importable: true,
  },
  deductions: {
    label: "الخصومات",
    columns: ["deduction_id","employee_id","date","type","amount","reason","status","created_by","created_at"],
    required: ["deduction_id","employee_id","date","type","amount","status"],
    key: "deduction_id", importable: true,
  },
  project_managers: {
    label: "مديرو المشروعات",
    columns: ["id","user_id","project_id","start_date","end_date","sector_manager_id","created_at"],
    required: ["id","user_id","project_id","start_date"],
    key: "id", importable: true,
  },
  project_supervisors: {
    label: "مشرفو المشروعات",
    columns: ["assignment_id","user_id","project_id","start_date","end_date","created_by","created_at"],
    required: ["assignment_id","project_id","start_date"],
    key: "assignment_id", importable: true,
  },
  sector_manager_projects: {
    label: "مشروعات مديري القطاعات",
    columns: ["assignment_id","user_id","project_id","start_date","end_date","created_by","created_at"],
    required: ["assignment_id","user_id","project_id","start_date"],
    key: "assignment_id", importable: true,
  },
  users: {
    label: "حسابات المستخدمين",
    columns: ["id","employee_id","username","role","status","last_login","created_at","updated_at"],
    required: ["id","username","role","status"],
    key: "id", importable: false,
  },
};

const NAME_TO_CONFIG = new Map(Object.entries(EXCEL_TABLES));

function cleanValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value === undefined ? null : value;
}

function sanitizeRows(table: string, rows: any[]) {
  const cfg = NAME_TO_CONFIG.get(table);
  if (!cfg) throw new Error("الجدول غير مسموح به");
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const c of cfg.columns) if (row[c] !== undefined && row[c] !== "") out[c] = cleanValue(row[c]);
    return out;
  });
}

function validateRows(table: string, rows: any[]) {
  const cfg = NAME_TO_CONFIG.get(table);
  if (!cfg) return { valid: [], errors: [{ row: 0, message: "الجدول غير مسموح به" }] };
  const valid: any[] = [];
  const errors: {row:number;message:string}[] = [];
  rows.forEach((raw, index) => {
    const rowNo = index + 2;
    const row = sanitizeRows(table, [raw])[0];
    const missing = cfg.required.filter((key) => row[key] === undefined || row[key] === null || String(row[key]).trim() === "");
    if (missing.length) {
      errors.push({ row: rowNo, message: `حقول مطلوبة ناقصة: ${missing.join(", ")}` });
      return;
    }
    if (table === "employees" && !["EXPATRIATE","RESIDENT"].includes(String(row.residency_type))) {
      errors.push({ row: rowNo, message: "residency_type يجب أن يكون EXPATRIATE أو RESIDENT" });
      return;
    }
    if (table === "leave_policies") {
      if (row.residency_type && !["EXPATRIATE","RESIDENT"].includes(String(row.residency_type))) {
        errors.push({row:rowNo,message:"نوع الإقامة غير صحيح"});
        return;
      }
      if (row.accrual_method && !["ANNUAL","PERIODIC","MANUAL"].includes(String(row.accrual_method))) {
        errors.push({row:rowNo,message:"طريقة الاستحقاق غير صحيحة"});
        return;
      }
    }
    valid.push(row);
  });
  return { valid, errors };
}

async function fetchTable(table: string) {
  const cfg = NAME_TO_CONFIG.get(table);
  if (!cfg) throw new Error("الجدول غير مسموح به");
  const { data, error } = await supabase.from(table).select(cfg.columns.join(","));
  if (error) throw error;
  return data || [];
}

export async function exportExcel(session: SessionContext, table = "all") {
  const workbook = XLSX.utils.book_new();
  const tables = table === "all" ? Object.keys(EXCEL_TABLES) : [table];
  for (const name of tables) {
    const cfg = NAME_TO_CONFIG.get(name);
    if (!cfg) continue;
    const rows = await fetchTable(name);
    const sheet = XLSX.utils.json_to_sheet(rows, { header: cfg.columns });
    XLSX.utils.book_append_sheet(workbook, sheet, cfg.label.slice(0, 31));
  }
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  await writeAudit(session.user.user_id, "excel_export", "excel", table, {tables});
  return buffer;
}

export function parseExcel(buffer: Buffer, table: string) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("ملف Excel لا يحتوي على ورقة بيانات");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  return validateRows(table, rows);
}

export async function importExcel(session: SessionContext, table: string, rows: any[], commit: boolean) {
  const cfg = NAME_TO_CONFIG.get(table);
  if (!cfg || !cfg.importable) return errorResponse("هذا الجدول غير متاح للاستيراد",403);
  const validation = validateRows(table, rows);
  if (!commit) return success({table, total:rows.length, valid:validation.valid.length, errors:validation.errors.slice(0,100), preview:validation.valid.slice(0,10)});
  if (validation.errors.length) return errorResponse("لا يمكن تنفيذ الاستيراد قبل إصلاح الأخطاء",400);
  let imported = 0;
  const rowErrors: any[] = [];
  for (const row of validation.valid) {
    try {
      const { error } = await supabase.from(table).upsert(row, { onConflict: cfg.key });
      if (error) throw error;
      imported++;
    } catch (e:any) {
      rowErrors.push({row: imported + 2, message: e?.message || "فشل حفظ السجل"});
    }
  }
  await writeAudit(session.user.user_id, "excel_import", table, table, {total:rows.length, imported, errors:rowErrors.length});
  return success({table,total:rows.length,imported,errors:rowErrors});
}

export function templateExcel(table: string) {
  const cfg = NAME_TO_CONFIG.get(table);
  if (!cfg) throw new Error("الجدول غير مسموح به");
  const workbook = XLSX.utils.book_new();
  const rows = [Object.fromEntries(cfg.columns.map(c => [c, ""]))];
  const sheet = XLSX.utils.json_to_sheet(rows, {header:cfg.columns});
  XLSX.utils.book_append_sheet(workbook, sheet, cfg.label.slice(0,31));
  return XLSX.write(workbook, {bookType:"xlsx",type:"buffer"}) as Buffer;
}
