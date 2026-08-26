import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function getDashboard(
  session: SessionContext
) {
  const today = riyadhDate();

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
    ["PROJECT_DIRECTOR", "PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)
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

  return success({
    employees:
      employeeIds.length,

    present:
      rows.length,

    late:
      rows.filter(
        (row: any) =>
          row.status === "LATE"
      ).length,

    missingCheckout:
      rows.filter(
        (row: any) =>
          !row.check_out
      ).length,

    serverTime:
      nowISO(),
  });
}

/* =========================================================
   PROJECT MANAGER DASHBOARD
========================================================= */

export async function getProjectManagerDashboard(
  session: SessionContext
) {
  const projectIds =
    await getManagedProjectIds(
      session.user
    );

  if (!projectIds.length) {
    return success({
      summary: {
        employees: 0,
        present: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        pendingLeaves: 0,
        pendingPermissions: 0,
      },
      projects: [],
      team: [],
      pendingLeaves: [],
      pendingPermissions: [],
    });
  }

  const [
    projectsResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .in(
        "project_id",
        projectIds
      ),

    supabase
      .from("project_assignments")
      .select("*")
      .in(
        "project_id",
        projectIds
      )
      .eq(
        "is_current",
        true
      ),
  ]);

  const projects =
    projectsResult.data || [];

  const assignments =
    assignmentsResult.data || [];

  const employeeIds = [
    ...new Set(
      assignments.map(
        (row: any) =>
          row.employee_id
      )
    ),
  ];

  let employees: any[] = [];

  if (employeeIds.length) {
    const { data } =
      await supabase
        .from("employees")
        .select("*")
        .in(
          "employee_id",
          employeeIds
        );

    employees = data || [];
  }

  const today = riyadhDate();

  const [
    attendanceResult,
    leaveResult,
    permissionResult,
  ] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("date", today)
      .in(
        "project_id",
        projectIds
      ),

    supabase
      .from("leave_requests")
      .select("*")
      .in(
        "project_id",
        projectIds
      )
      .in(
        "status",
        [
          "PENDING_MANAGER",
          "PENDING_HR",
          "APPROVED",
        ]
      ),

    supabase
      .from("permission_requests")
      .select("*")
      .in(
        "project_id",
        projectIds
      )
      .eq(
        "status",
        "PENDING"
      ),
  ]);

  const attendance =
    attendanceResult.data || [];

  const leaves =
    leaveResult.data || [];

  const permissions =
    permissionResult.data || [];

  const presentEmployees =
    new Set(
      attendance.map(
        (row: any) =>
          row.employee_id
      )
    );

  const employeesOnLeave =
    new Set(
      leaves
        .filter(
          (row: any) =>
            row.status ===
              "APPROVED" &&
            row.from_date <=
              today &&
            row.to_date >=
              today
        )
        .map(
          (row: any) =>
            row.employee_id
        )
    );

  const absentEmployees =
    employeeIds.filter(
      (employeeId) =>
        !presentEmployees.has(
          employeeId
        ) &&
        !employeesOnLeave.has(
          employeeId
        )
    );

  return success({
    summary: {
      employees:
        employeeIds.length,

      present:
        attendance.length,

      late:
        attendance.filter(
          (row: any) =>
            row.status === "LATE"
        ).length,

      onLeave:
        employeesOnLeave.size,

      absent:
        absentEmployees.length,

      pendingLeaves:
        leaves.filter(
          (row: any) =>
            row.status ===
            "PENDING_MANAGER"
        ).length,

      pendingPermissions:
        permissions.length,
    },

    projects,

    team: employees.map(
      (employee: any) => ({
        ...employee,
        assignment:
          assignments.find(
            (assignment: any) =>
              assignment.employee_id ===
              employee.employee_id
          ) || null,
        attendance:
          attendance.find(
            (attendanceRow: any) =>
              attendanceRow.employee_id ===
              employee.employee_id
          ) || null,
      })
    ),

    pendingLeaves:
      leaves.filter(
        (row: any) =>
          row.status !==
          "APPROVED"
      ),

    pendingPermissions:
      permissions,
  });
}

/* =========================================================
   EMPLOYEES
========================================================= */

