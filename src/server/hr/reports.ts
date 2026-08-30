import { supabase, success, errorResponse, getManagedProjectIds } from "./core";
import type { SessionContext } from "./core";

const LABELS: Record<string,string> = {
  PRESENT: "حاضر", LATE: "متأخر", ABSENT: "غائب", LEAVE: "إجازة", PERMISSION: "إذن",
  WEEKEND: "راحة / يوم غير عمل", HOLIDAY: "عطلة رسمية", NOT_STARTED: "لم يبدأ التسجيل", INCOMPLETE: "انصراف غير مكتمل",
  AUTO_CLOSED: "انصراف تلقائي", NOT_EMPLOYED: "ليس على رأس العمل",
};

function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("صيغة الشهر غير صحيحة");
  const [y,m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2,"0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${y}-${String(m).padStart(2,"0")}-${String(last).padStart(2,"0")}`, days:last };
}
function addDays(date:string, n:number){ const d=new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function dateLE(a:string,b:string){ return a <= b; }
function normalizeStatus(row:any): string {
  if (!row) return "ABSENT";
  if (row.auto_closed) return "AUTO_CLOSED";
  if (row.check_in && !row.check_out) return "INCOMPLETE";
  if (row.status === "LATE" || Number(row.late_minutes||0) > 0) return "LATE";
  return "PRESENT";
}

export async function attendanceMonthlyReport(session: SessionContext, body: Record<string,unknown> = {}) {
  try {
    const {start,end} = monthRange(String(body.month || new Date().toISOString().slice(0,7)));
    let employeesQuery = supabase.from("employees").select("employee_id,name,job_title,department,hire_date,status").order("name");
    if (session.user.role === "EMPLOYEE") employeesQuery = employeesQuery.eq("employee_id", session.user.employee_id);
    const {data: employees, error: employeesError} = await employeesQuery;
    if (employeesError) return errorResponse(employeesError.message,500);
    const ids = (employees||[]).map((e:any)=>String(e.employee_id)).filter(Boolean);
    if (!ids.length) return success({start,end,summary:{},employeeSummary:[],rows:[]});

    let attendanceQuery = supabase.from("attendance").select("attendance_id,employee_id,project_id,shift_id,date,check_in,check_out,status,late_minutes,auto_closed").in("employee_id",ids).gte("date",start).lte("date",end);
    let leaveQuery = supabase.from("leave_requests").select("request_id,employee_id,from_date,to_date,status,leave_type_id").in("employee_id",ids).eq("status","APPROVED").lte("from_date",end).gte("to_date",start);
    let permissionQuery = supabase.from("permission_requests").select("request_id,employee_id,date,start_time,end_time,status").in("employee_id",ids).eq("status","APPROVED").gte("date",start).lte("date",end);
    if (["SECTOR_MANAGER","PROJECT_MANAGER"].includes(session.user.role)) {
      const projectIds = await getManagedProjectIds(session.user);
      if (!projectIds.length) return success({start,end,summary:{},employeeSummary:[],rows:[]});
      attendanceQuery = attendanceQuery.in("project_id",projectIds);
    }
    const [a,l,p,calendarResult,calendarSettingsResult] = await Promise.all([
    attendanceQuery,
    leaveQuery,
    permissionQuery,
    supabase.from("company_calendar").select("calendar_date,day_type,name,is_working_day").gte("calendar_date", start).lte("calendar_date", end),
    supabase.from("company_calendar_settings").select("weekend_day_1,weekend_day_2").limit(1).maybeSingle(),
  ]);
    if (a.error) return errorResponse(a.error.message,500);
    if (l.error) return errorResponse(l.error.message,500);
    if (p.error) return errorResponse(p.error.message,500);
    if (calendarResult.error) return errorResponse(calendarResult.error.message,500);
    if (calendarSettingsResult.error) return errorResponse(calendarSettingsResult.error.message,500);

    const attendance = new Map<string,any>();
    for (const r of a.data||[]) attendance.set(`${r.employee_id}|${r.date}`,r);
    const leaves = (l.data||[]) as any[];
    const permissions = (p.data||[]) as any[];
    const calendar = new Map((calendarResult.data||[]).map((r:any)=>[String(r.calendar_date).slice(0,10),r]));
    const weekend1 = Number(calendarSettingsResult.data?.weekend_day_1 ?? 5);
    const weekend2Raw = calendarSettingsResult.data?.weekend_day_2;
    const weekend2 = weekend2Raw === null || weekend2Raw === undefined || weekend2Raw === ""
      ? null
      : Number(weekend2Raw);
    const today = new Date().toISOString().slice(0,10);
    const summary:Record<string,number> = {};
    const employeeSummary:any[] = [];
    const rows:any[] = [];

    for (const employee of employees||[]) {
      const counts:Record<string,number> = {};
      for (let i=0;i<monthRange(String(body.month || new Date().toISOString().slice(0,7))).days;i++) {
        const date = addDays(start,i);
        const hire = employee.hire_date ? String(employee.hire_date).slice(0,10) : null;
        let status = "NOT_STARTED";
        let source:any = null;
        if (hire && date < hire) status = "NOT_EMPLOYED";
        else {
          const calendarDay = calendar.get(date);
          const utcDay = new Date(`${date}T00:00:00Z`).getUTCDay();
          const nonWorking = calendarDay
            ? (String(calendarDay.day_type) === "HOLIDAY" || calendarDay.is_working_day === false)
            : (utcDay === weekend1 || (weekend2 !== null && utcDay === weekend2));
          if (calendarDay && String(calendarDay.day_type) === "HOLIDAY") status = "HOLIDAY";
          else if (nonWorking) status = "WEEKEND";
          else {
          const leave = leaves.find(r=>r.employee_id===employee.employee_id && dateLE(String(r.from_date).slice(0,10),date) && dateLE(date,String(r.to_date).slice(0,10)));
          const permission = permissions.find(r=>r.employee_id===employee.employee_id && String(r.date).slice(0,10)===date);
          const att = attendance.get(`${employee.employee_id}|${date}`);
          if (leave) { status="LEAVE"; source=leave; }
          else if (att) { status=normalizeStatus(att); source=att; }
          else if (permission) { status="PERMISSION"; source=permission; }
          else if (date <= today) status="ABSENT";
          }
        }
        counts[status]=(counts[status]||0)+1; summary[status]=(summary[status]||0)+1;
        rows.push({date,employee_id:employee.employee_id,employee_name:employee.name,status,status_label:LABELS[status]||status,check_in:source?.check_in||null,check_out:source?.check_out||null,late_minutes:Number(source?.late_minutes||0),shift_name:null});
      }
      employeeSummary.push({employee_id:employee.employee_id,name:employee.name,job_title:employee.job_title,department:employee.department,counts});
    }
    return success({start,end,summary,employeeSummary,rows});
  } catch (e:any) { return errorResponse(e?.message || "تعذر إنشاء التقرير الشهري",500); }
}

export { LABELS };
