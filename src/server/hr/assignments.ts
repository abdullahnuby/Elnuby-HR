import { parsePagination } from "./core";
import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, previousRiyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listEmployeeShifts(
  session: SessionContext,
  body: Record<string, unknown> = {},
) {
  const { from, to } = parsePagination(body, 100);
  let query = supabase
    .from("employee_shifts")
    .select("*")
    .order("start_date", { ascending: false })
    .range(from, to);

  if (["PROJECT_DIRECTOR", "PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)) {
    const ids = await getManagedProjectIds(session.user);

    if (!ids.length) {
      return success([]);
    }

    query = query.in("project_id", ids);
  }

  if (session.user.role === "EMPLOYEE") {
    if (!session.user.employee_id) {
      return success([]);
    }

    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  const { data: assignments, error } = await query;

  if (error) {
    console.error("employee_shifts:", error);

    return errorResponse(
      error.message,
      500
    );
  }

  if (!assignments?.length) {
    return success([]);
  }

  const employeeIds = [...new Set(
    assignments.map((r: any) => r.employee_id).filter(Boolean)
  )];

  const projectIds = [...new Set(
    assignments.map((r: any) => r.project_id).filter(Boolean)
  )];

  const shiftIds = [...new Set(
    assignments.map((r: any) => r.shift_id).filter(Boolean)
  )];

  const [employeesResult, projectsResult, shiftsResult] =
    await Promise.all([
      employeeIds.length
        ? supabase
            .from("employees")
            .select("employee_id,name,job_title,department,status")
            .in("employee_id", employeeIds)
        : Promise.resolve({ data: [], error: null } as any),

      projectIds.length
        ? supabase
            .from("projects")
            .select("project_id,name,location_name,status")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [], error: null } as any),

      shiftIds.length
        ? supabase
            .from("shifts")
            .select("*")
            .in("shift_id", shiftIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

  if (employeesResult.error || projectsResult.error || shiftsResult.error) {
    console.error(
      "employee shift lookup:",
      employeesResult.error ||
        projectsResult.error ||
        shiftsResult.error
    );

    return errorResponse(
      "تعذر تحميل تفاصيل تعيينات الورديات",
      500
    );
  }

  const employeeMap = new Map<string, any>(
    (employeesResult.data || []).map((e: any) => [e.employee_id, e])
  );
  
  const projectMap = new Map<string, any>(
    (projectsResult.data || []).map((p: any) => [p.project_id, p])
  );
  
  const shiftMap = new Map<string, any>(
    (shiftsResult.data || []).map((s: any) => [s.shift_id, s])
  );

  return success(
    assignments.map((row: any) => {
      const employee = employeeMap.get(row.employee_id);
      const project = projectMap.get(row.project_id);
      const shift = shiftMap.get(row.shift_id);

      return {
        ...row,
        employee_name: employee?.name ?? row.employee_id,
        job_title: employee?.job_title ?? null,
        department: employee?.department ?? null,
        employee_status: employee?.status ?? null,
        project_name: project?.name ?? row.project_id,
        project_location: project?.location_name ?? null,
        project_status: project?.status ?? null,
        shift_name: shift?.name ?? row.shift_id,
        shift_start: shift?.start_time ?? null,
        attendance_open: shift?.attendance_open ?? null,
        attendance_close: shift?.attendance_close ?? null,
        checkout_open: shift?.checkout_open ?? null,
        checkout_close: shift?.checkout_close ?? null,
        auto_checkout_time: shift?.auto_checkout_time ?? null,
        assignment_status: row.end_date ? "HISTORY" : "CURRENT",
      };
    })
  );
}

export async function assignEmployeeShift(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId = String(
    body.employee_id || ""
  );

  const projectId = String(
    body.project_id || ""
  );

  const shiftId = String(
    body.shift_id || ""
  );

  if (
    !employeeId ||
    !projectId ||
    !shiftId
  ) {
    return errorResponse(
      "الموظف والمشروع والوردية مطلوبة"
    );
  }

  const startDate = String(body.start_date || riyadhDate());

  if (!(await canManageProject(session.user, projectId))) {
    return errorResponse(
      "ليس لديك صلاحية إدارة موظفين وورديات هذا المشروع",
      403
    );
  }

  // Validate employee
  const { data: employee } =
    await supabase
      .from("employees")
      .select("employee_id")
      .eq(
        "employee_id",
        employeeId
      )
      .maybeSingle();

  if (!employee) {
    return errorResponse(
      "الموظف غير موجود"
    );
  }

  // Validate project
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

  // Validate shift
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

  /*
   * IMPORTANT:
   * Employee must have a current project assignment.
   */

  let {
    data: currentProject,
    error: currentProjectError,
  } = await supabase
    .from("project_assignments")
    .select(
      "assignment_id,project_id"
    )
    .eq(
      "employee_id",
      employeeId
    )
    .eq(
      "is_current",
      true
    )
    .maybeSingle();

  if (currentProjectError) {
    console.error(
      "current project assignment:",
      currentProjectError
    );

    return errorResponse(
      currentProjectError.message,
      500
    );
  }

  /*
   * If employee is currently assigned
   * to another project, close it.
   */
  if (
    currentProject &&
    currentProject.project_id !==
      projectId
  ) {
    const { error } =
      await supabase
        .from("project_assignments")
        .update({
          is_current: false,
          end_date: previousRiyadhDate(startDate),
        })
        .eq(
          "assignment_id",
          currentProject.assignment_id
        );

    if (error) {
      console.error(
        "close old project assignment:",
        error
      );

      return errorResponse(
        error.message,
        500
      );
    }
  }

  /*
   * Create project assignment if
   * employee doesn't already have the
   * requested project as current.
   */
  if (
    !currentProject ||
    currentProject.project_id !==
      projectId
  ) {
    const {
      data: projectAssignment,
      error: projectAssignmentError,
    } = await supabase
      .from("project_assignments")
      .insert({
        assignment_id:
          generateId("ASN"),

        employee_id:
          employeeId,

        project_id:
          projectId,

        start_date:
          String(
            startDate
          ),

        end_date:
          body.end_date ||
          null,

        is_current:
          true,

        created_by:
          session.user.user_id,

        created_at:
          nowISO(),
      })
      .select("*")
      .single();

    if (projectAssignmentError) {
      console.error(
        "create project assignment:",
        projectAssignmentError
      );

      return errorResponse(
        projectAssignmentError.message,
        500
      );
    }

    currentProject = projectAssignment;
  }

  /*
   * Close previous active shifts
   * for this employee.
   */
  const {
    error: closeShiftError,
  } = await supabase
    .from("employee_shifts")
    .update({
      end_date:
        previousRiyadhDate(startDate),
    })
    .eq(
      "employee_id",
      employeeId
    )
    .is(
      "end_date",
      null
    );

  if (closeShiftError) {
    console.error(
      "close employee shifts:",
      closeShiftError
    );

    return errorResponse(
      closeShiftError.message,
      500
    );
  }

  /*
   * Create the new active shift.
   */
  const {
    data,
    error,
  } = await supabase
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
        String(
          body.start_date ||
            riyadhDate()
        ),

      end_date:
        body.end_date ||
        null,

      created_by:
        session.user.user_id,

      created_at:
        nowISO(),
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "assign employee shift:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  return success({
    project_assignment:
      currentProject,

    shift_assignment:
      data,
  });
}

/* =========================================================
   PROJECT ASSIGNMENT
========================================================= */

export async function assignEmployeeProject(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId = String(
    body.employee_id || ""
  );

  const projectId = String(
    body.project_id || ""
  );

  const startDate = String(body.start_date || riyadhDate());

  if (!employeeId || !projectId) {
    return errorResponse(
      "الموظف والمشروع مطلوبان"
    );
  }

  if (!(await canManageProject(session.user, projectId))) {
    return errorResponse(
      "ليس لديك صلاحية إدارة موظفين هذا المشروع",
      403
    );
  }

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

  await supabase
    .from("project_assignments")
    .update({
      is_current: false,
      end_date:
        previousRiyadhDate(startDate),
    })
    .eq(
      "employee_id",
      employeeId
    )
    .eq(
      "is_current",
      true
    );

  const { data, error } =
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
          String(
            startDate
          ),
        end_date:
          body.end_date ||
          null,
        is_current:
          true,
        created_by:
          session.user.user_id,
        created_at:
          nowISO(),
      })
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  if (body.shift_id) {
    await supabase
      .from("employee_shifts")
      .update({
        end_date:
          previousRiyadhDate(startDate),
      })
      .eq(
        "employee_id",
        employeeId
      )
      .is(
        "end_date",
        null
      );

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
            String(
              body.shift_id
            ),
          start_date:
            String(
              body.start_date ||
                riyadhDate()
            ),
          end_date:
            null,
          created_by:
            session.user.user_id,
          created_at:
            nowISO(),
        });

    if (shiftError) {
      return errorResponse(
        `تم تعيين المشروع لكن فشل تعيين الوردية: ${shiftError.message}`,
        500
      );
    }
  }

  return success(data);
}

/* =========================================================
   PROJECT MANAGER ASSIGNMENT
========================================================= */

export async function assignManagerProject(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const userId = String(
    body.user_id || ""
  );

  const projectId = String(
    body.project_id || ""
  );
  const startDate = String(body.start_date || riyadhDate());

  if (!userId || !projectId) {
    return errorResponse(
      "المستخدم والمشروع مطلوبان"
    );
  }

  const { data: user } =
    await supabase
      .from("users")
      .select(
        "id,role"
      )
      .eq(
        "id",
        userId
      )
      .maybeSingle();

  if (!user) {
    return errorResponse(
      "المستخدم غير موجود"
    );
  }

  if (
    user.role !==
    "PROJECT_MANAGER"
  ) {
    return errorResponse(
      "المستخدم ليس مدير مشروع"
    );
  }

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

  if (session.user.role === "PROJECT_DIRECTOR" && !(await canManageProject(session.user, projectId))) {
    return errorResponse("مدير القطاع لا يستطيع إدارة مدير مشروع خارج نطاقه", 403);
  }

  const { data: existing } =
    await supabase
      .from("project_managers")
      .select("id")
      .eq(
        "user_id",
        userId
      )
      .eq(
        "project_id",
        projectId
      )
      .is(
        "end_date",
        null
      )
      .maybeSingle();

  if (existing) {
    return success(
      existing
    );
  }

  const { data, error } =
    await supabase
      .from("project_managers")
      .insert({
        id:
          generateId("PM"),
        user_id:
          userId,
        project_id:
          projectId,
        start_date:
          String(
            startDate
          ),
        end_date:
          body.end_date ||
          null,
        created_at:
          nowISO(),
      })
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   ATTENDANCE LIST
========================================================= */

