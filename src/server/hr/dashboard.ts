import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, appDate, appTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function getDashboard(
  session: SessionContext
) {
  const today = appDate();

  let employeeIds: string[] = [];

  if (
    session.user.role === "EMPLOYEE"
  ) {
    if (session.user.employee_id) {
      employeeIds = [
        session.user.employee_id,
      ];
    }
  } else if (
    ["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(session.user.role)
  ) {
    const projectIds =
      await getManagedProjectIds(
        session.user
      );

    if (projectIds.length) {
      const { data } =
        await supabase
          .from("project_assignments")
          .select("employee_id")
          .in(
            "project_id",
            projectIds
          )
          .eq(
            "is_current",
            true
          );

      employeeIds = Array.from(new Set(
        (data || [])
          .map((row: any) => String(row.employee_id))
          .filter(Boolean)
      ));
    }
  } else {
    const { data } =
      await supabase
        .from("employees")
        .select("employee_id");

    employeeIds =
      (data || []).map(
        (row: any) =>
          row.employee_id
      );
  }

  if (!employeeIds.length) {
    return success({
      employees: 0,
      present: 0,
      late: 0,
      missingCheckout: 0,
      serverTime: nowISO(),
    });
  }

  const { data: attendance } =
    await supabase
      .from("attendance")
      .select(
        "attendance_id,employee_id,status,check_in,check_out"
      )
      .eq("date", today)
      .in(
        "employee_id",
        employeeIds
      );

  const rows =
    attendance || [];

  const selfAttendance = session.user.employee_id
    ? rows.find(
        (row: any) =>
          String(row.employee_id) === String(session.user.employee_id)
      ) || null
    : null;

  return success({
    employees: employeeIds.length,
    present: rows.length,
    late: rows.filter((row: any) => row.status === "LATE").length,
    missingCheckout: rows.filter((row: any) => row.check_in && !row.check_out).length,
    selfAttendance,
    serverTime: nowISO(),
  });
}

/* =========================================================
   PROJECT MANAGER DASHBOARD
========================================================= */

export async function getProjectManagerDashboard(
  session: SessionContext
) {
  const projectIds = await getManagedProjectIds(session.user);

  if (!projectIds.length) {
    return success({
      assignmentMissing: true,
      summary: {
        employees: 0,
        present: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        missingCheckout: 0,
        pendingLeaves: 0,
        pendingPermissions: 0,
      },
      projects: [],
      team: [],
      pendingLeaves: [],
      pendingPermissions: [],
      selfAttendance: null,
    });
  }

  const today = appDate();

  const [projectsResult, assignmentsResult, attendanceResult, leaveResult, permissionResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .in("project_id", projectIds),
      supabase
        .from("project_assignments")
        .select("*")
        .in("project_id", projectIds)
        .eq("is_current", true),
      supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .in("project_id", projectIds),
      supabase
        .from("leave_requests")
        .select("*")
        .in("project_id", projectIds)
        .in("status", ["PENDING_MANAGER", "PENDING_HR", "APPROVED"]),
      supabase
        .from("permission_requests")
        .select("*")
        .in("project_id", projectIds)
        .eq("status", "PENDING"),
    ]);

  const firstError = [
    projectsResult.error,
    assignmentsResult.error,
    attendanceResult.error,
    leaveResult.error,
    permissionResult.error,
  ].find(Boolean);

  if (firstError) {
    console.error("project manager dashboard:", firstError);
    return errorResponse("تعذر تحميل بيانات لوحة مدير المشروع", 500);
  }

  const projects = projectsResult.data || [];
  const assignments = assignmentsResult.data || [];
  const attendance = attendanceResult.data || [];
  const leaves = leaveResult.data || [];
  const permissions = permissionResult.data || [];

  const employeeIds = Array.from(
    new Set(
      assignments
        .map((row: any) => String(row.employee_id || ""))
        .filter(Boolean)
    )
  );

  let employees: any[] = [];
  if (employeeIds.length) {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .in("employee_id", employeeIds);
    if (error) {
      console.error("project manager employees:", error);
      return errorResponse("تعذر تحميل موظفي المشروع", 500);
    }
    employees = data || [];
  }

  const projectMap = new Map(
    projects.map((project: any) => [String(project.project_id), project])
  );

  const attendanceByEmployee = new Map<string, any>();
  for (const row of attendance) {
    const id = String(row.employee_id || "");
    if (id && !attendanceByEmployee.has(id)) attendanceByEmployee.set(id, row);
  }

  const employeesOnLeave = new Set(
    leaves
      .filter(
        (row: any) =>
          row.status === "APPROVED" &&
          row.from_date <= today &&
          row.to_date >= today
      )
      .map((row: any) => String(row.employee_id))
  );

  const presentEmployeeIds = new Set(
    attendance
      .map((row: any) => String(row.employee_id || ""))
      .filter(Boolean)
  );

  const absentEmployeeIds = employeeIds.filter(
    (id) => !presentEmployeeIds.has(id) && !employeesOnLeave.has(id)
  );

  const team = employees.map((employee: any) => {
    const assignment = assignments.find(
      (row: any) => String(row.employee_id) === String(employee.employee_id)
    ) || null;
    const record = attendanceByEmployee.get(String(employee.employee_id)) || null;
    const onLeave = employeesOnLeave.has(String(employee.employee_id));

    let state = "ABSENT";
    if (onLeave) state = "ON_LEAVE";
    else if (record?.status === "LATE") state = "LATE";
    else if (record?.check_in && !record?.check_out) state = "CHECKED_IN";
    else if (record?.check_in) state = "PRESENT";

    return {
      ...employee,
      project_id: assignment?.project_id || null,
      project_name: assignment
        ? projectMap.get(String(assignment.project_id))?.name || "—"
        : "—",
      assignment,
      attendance: record,
      state,
    };
  });

  const projectStats = projects.map((project: any) => ({
    ...project,
    employee_count: assignments.filter(
      (row: any) => String(row.project_id) === String(project.project_id)
    ).length,
  }));

  const pendingLeaves = leaves.filter(
    (row: any) => row.status === "PENDING_MANAGER"
  );

  return success({
    assignmentMissing: false,
    summary: {
      employees: employeeIds.length,
      present: presentEmployeeIds.size,
      late: attendance.filter((row: any) => row.status === "LATE").length,
      onLeave: employeesOnLeave.size,
      absent: absentEmployeeIds.length,
      missingCheckout: attendance.filter((row: any) => row.check_in && !row.check_out).length,
      pendingLeaves: pendingLeaves.length,
      pendingPermissions: permissions.length,
    },
    projects: projectStats,
    team,
    pendingLeaves,
    pendingPermissions: permissions,
    selfAttendance: session.user.employee_id
      ? attendanceByEmployee.get(String(session.user.employee_id)) || null
      : null,
  });
}

/* =========================================================
   EMPLOYEES
========================================================= */



export async function getHRExecutiveDashboard(session: SessionContext) {
  if (!["SYSTEM_ADMIN","HR_MANAGER"].includes(session.user.role)) return errorResponse("ليس لديك صلاحية عرض لوحة الموارد البشرية",403);
  const today = appDate();
  const [emp, att, leaves, perms, docs, workflows] = await Promise.all([
    supabase.from("employees").select("employee_id,status,employment_status").eq("employment_status","ACTIVE"),
    supabase.from("attendance").select("employee_id,status,check_in,check_out").eq("date",today),
    supabase.from("leave_requests").select("request_id,from_date,to_date,status").in("status",["PENDING_MANAGER","PENDING_HR","APPROVED"]),
    supabase.from("permission_requests").select("request_id,date,status").in("status",["PENDING","APPROVED"]),
    supabase.from("employee_documents").select("document_id,expiry_date,status").not("expiry_date","is",null),
    supabase.from("approval_workflows").select("id,due_at,status").eq("status","pending"),
  ]);
  const active = emp.data||[]; const attendance=att.data||[];
  const activeLeave = (leaves.data||[]).filter((r:any)=>r.status==='APPROVED'&&String(r.from_date)<=today&&String(r.to_date)>=today).length;
  const pendingLeaves = (leaves.data||[]).filter((r:any)=>["PENDING_MANAGER","PENDING_HR"].includes(r.status)).length;
  const pendingPermissions = (perms.data||[]).filter((r:any)=>r.status==='PENDING').length;
  const expiringDocs = (docs.data||[]).filter((r:any)=>r.expiry_date && String(r.expiry_date).slice(0,10) >= today).filter((r:any)=>{const d=(new Date(String(r.expiry_date).slice(0,10)).getTime()-new Date(today).getTime())/86400000; return d<=30;}).length;
  const overdueApprovals = (workflows.data||[]).filter((r:any)=>r.due_at && new Date(r.due_at)<new Date()).length;
  return success({active:active.length,present:attendance.filter((r:any)=>r.check_in).length,late:attendance.filter((r:any)=>r.status==='LATE').length,absent:Math.max(0,active.length-attendance.length-activeLeave),leave:activeLeave,permission:(perms.data||[]).filter((r:any)=>r.status==='APPROVED'&&String(r.date)===today).length,pendingLeaves,pendingPermissions,expiringDocs,overdueApprovals,today});
}
