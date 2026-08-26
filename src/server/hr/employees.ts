import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listEmployees(
  session: SessionContext,
  _body: Record<string, unknown> = {},
) {
  let employeeIds: string[] | null = null;

  if (["PROJECT_DIRECTOR", "PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)) {
    const projectIds = await getManagedProjectIds(session.user);

    if (!projectIds.length) {
      return success([]);
    }

    const { data: assignments, error: assignmentError } =
      await supabase
        .from("project_assignments")
        .select("employee_id")
        .in("project_id", projectIds)
        .eq("is_current", true)
        .lte("start_date", riyadhDate())
        .or(`end_date.is.null,end_date.gte.${riyadhDate()}`);

    if (assignmentError) {
      console.error("employees assignments:", assignmentError);
      return errorResponse("تعذر تحميل ربط الموظفين بالمشروعات", 500);
    }

    employeeIds = Array.from(new Set(
      (assignments || [])
        .map((row: any) => String(row.employee_id))
        .filter(Boolean)
    ));
  }

  let employeeQuery = supabase
    .from("employees")
    .select("*")
    .order("name");

  if (employeeIds !== null) {
    if (!employeeIds.length) {
      return success([]);
    }

    employeeQuery = employeeQuery.in(
      "employee_id",
      employeeIds
    );
  }

  const {
    data: employees,
    error: employeeError,
  } = await employeeQuery;

  if (employeeError) {
    console.error("employees:", employeeError);

    return errorResponse(
      "تعذر تحميل الموظفين",
      500
    );
  }

  if (!employees?.length) {
    return success([]);
  }

  const ids = employees
    .map((employee: any) => employee.employee_id)
    .filter(Boolean);

  const today = riyadhDate();

  const [
    assignmentsResult,
    shiftsResult,
  ] = await Promise.all([
    supabase
      .from("project_assignments")
      .select(
        "assignment_id,employee_id,project_id,start_date,end_date,is_current"
      )
      .in("employee_id", ids)
      .eq("is_current", true)
      .lte("start_date", today)
      .or(`end_date.is.null,end_date.gte.${today}`),

    supabase
      .from("employee_shifts")
      .select(
        `
        assignment_id,
        employee_id,
        project_id,
        shift_id,
        start_date,
        end_date,
        shifts(*)
        `
      )
      .in("employee_id", ids)
      .lte("start_date", today)
      .or(
        `end_date.is.null,end_date.gte.${today}`
      )
      .order("start_date", {
        ascending: false,
      }),
  ]);

  if (assignmentsResult.error) {
    console.error(
      "employee project assignments:",
      assignmentsResult.error
    );

    return errorResponse(
      "تعذر تحميل مشروعات الموظفين",
      500
    );
  }

  if (shiftsResult.error) {
    console.error(
      "employee shifts:",
      shiftsResult.error
    );

    return errorResponse(
      "تعذر تحميل ورديات الموظفين",
      500
    );
  }

  const assignments =
    assignmentsResult.data || [];

  const shifts =
    shiftsResult.data || [];

  const projectIds = [
    ...new Set(
      assignments
        .map((row: any) => row.project_id)
        .filter(Boolean)
    ),
  ];

  let projects: any[] = [];

  if (projectIds.length) {
    const {
      data: projectData,
      error: projectError,
    } = await supabase
      .from("projects")
      .select(
        `
        project_id,
        name,
        client,
        location_name,
        latitude,
        longitude,
        geofence_radius_m,
        status
        `
      )
      .in("project_id", projectIds);

    if (projectError) {
      console.error(
        "employee projects:",
        projectError
      );

      return errorResponse(
        "تعذر تحميل بيانات المشروعات",
        500
      );
    }

    projects = projectData || [];
  }

  const assignmentMap = new Map<
    string,
    any
  >();

  for (const assignment of assignments) {
    if (
      !assignmentMap.has(
        assignment.employee_id
      )
    ) {
      assignmentMap.set(
        assignment.employee_id,
        assignment
      );
    }
  }

  const shiftMap = new Map<
    string,
    any
  >();

  for (const employeeShift of shifts) {
    if (
      !shiftMap.has(
        employeeShift.employee_id
      )
    ) {
      shiftMap.set(
        employeeShift.employee_id,
        employeeShift
      );
    }
  }

  const projectMap = new Map<
    string,
    any
  >();

  for (const project of projects) {
    projectMap.set(
      project.project_id,
      project
    );
  }

  const result = employees.map(
    (employee: any) => {
      const assignment =
        assignmentMap.get(
          employee.employee_id
        ) || null;

      const project =
        assignment
          ? projectMap.get(
              assignment.project_id
            ) || null
          : null;

      const employeeShift =
        shiftMap.get(
          employee.employee_id
        ) || null;

      const shift =
        employeeShift?.shifts ||
        null;

      return {
        ...employee,

        project_id:
          assignment?.project_id ??
          null,

        project_name:
          project?.name ??
          null,

        current_project_name:
          project?.name ??
          null,

        assignment_start:
          assignment?.start_date ??
          null,

        assignment_id:
          assignment?.assignment_id ??
          null,

        shift_id:
          employeeShift?.shift_id ??
          null,

        shift_name:
          shift?.name ??
          null,

        shift_start:
          shift?.start_time ??
          null,

        attendance_open:
          shift?.attendance_open ??
          null,

        attendance_close:
          shift?.attendance_close ??
          null,

        checkout_open:
          shift?.checkout_open ??
          null,

        checkout_close:
          shift?.checkout_close ??
          null,

        auto_checkout_time:
          shift?.auto_checkout_time ??
          null,
      };
    }
  );

  return success(result);
}

/* =========================================================
   CREATE EMPLOYEE
========================================================= */

export async function createEmployee(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId = String(
    body.employee_id ||
      generateId("EMP")
  );

  const name = String(
    body.name || ""
  ).trim();

  if (!name) {
    return errorResponse(
      "اسم الموظف مطلوب"
    );
  }

  const { data: existing } =
    await supabase
      .from("employees")
      .select("employee_id")
      .eq(
        "employee_id",
        employeeId
      )
      .maybeSingle();

  if (existing) {
    return errorResponse(
      "رقم الموظف موجود بالفعل"
    );
  }

  const { data: employee, error } =
    await supabase
      .from("employees")
      .insert({
        employee_id: employeeId,
        name,
        job_title:
          body.job_title || null,
        department:
          body.department || null,
        phone:
          body.phone || null,
        national_id:
          body.national_id || null,
        birth_date:
          body.birth_date || null,
        hire_date:
          body.hire_date || null,
        status:
          body.status || "ACTIVE",
      })
      .select("*")
      .single();

  if (error) {
    console.error(
      "create_employee:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  const projectId = body.project_id
    ? String(body.project_id)
    : "";

  const shiftId = body.shift_id
    ? String(body.shift_id)
    : "";

  const startDate = String(
    body.start_date ||
      riyadhDate()
  );

  if (projectId) {
    const { data: project } =
      await supabase
        .from("projects")
        .select("project_id")
        .eq(
          "project_id",
          projectId
        )
        .maybeSingle();

    if (!project) {
      return errorResponse(
        "المشروع غير موجود"
      );
    }

    const { error: assignmentError } =
      await supabase
        .from("project_assignments")
        .insert({
          assignment_id:
            generateId("ASN"),
          employee_id:
            employeeId,
          project_id:
            projectId,
          start_date:
            startDate,
          is_current:
            true,
          created_by:
            session.user.user_id,
          created_at:
            nowISO(),
        });

    if (assignmentError) {
      console.error(
        "employee assignment:",
        assignmentError
      );

      return errorResponse(
        `تم إنشاء الموظف لكن فشل تعيين المشروع: ${assignmentError.message}`,
        500
      );
    }

    if (shiftId) {
      const { data: shift } =
        await supabase
          .from("shifts")
          .select("shift_id")
          .eq(
            "shift_id",
            shiftId
          )
          .maybeSingle();

      if (!shift) {
        return errorResponse(
          "الوردية غير موجودة"
        );
      }

      const { error: shiftError } =
        await supabase
          .from("employee_shifts")
          .insert({
            assignment_id:
              generateId("ESH"),
            employee_id:
              employeeId,
            project_id:
              projectId,
            shift_id:
              shiftId,
            start_date:
              startDate,
            end_date:
              null,
            created_by:
              session.user.user_id,
            created_at:
              nowISO(),
          });

      if (shiftError) {
        console.error(
          "employee shift:",
          shiftError
        );

        return errorResponse(
          `تم إنشاء الموظف والمشروع لكن فشل تعيين الوردية: ${shiftError.message}`,
          500
        );
      }
    }
  }

  return success(
    employee,
    201
  );
}

/* =========================================================
   PROJECTS
========================================================= */

