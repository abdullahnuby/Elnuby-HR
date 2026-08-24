import crypto from "crypto";
import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, ROLES, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listDeductions(
  session: SessionContext
) {
  let query = supabase
    .from("deductions")
    .select("*")
    .order(
      "date",
      {
        ascending: false,
      }
    )
    .limit(1000);

  if (["PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)) {
    const ids =
      await getManagedProjectIds(
        session.user
      );

    if (!ids.length) {
      return success([]);
    }

    const { data: assignments } =
      await supabase
        .from("project_assignments")
        .select(
          "employee_id"
        )
        .in(
          "project_id",
          ids
        )
        .eq(
          "is_current",
          true
        );

    const employeeIds = [
      ...new Set(
        (assignments || []).map(
          (row: any) =>
            row.employee_id
        )
      ),
    ];

    if (!employeeIds.length) {
      return success([]);
    }

    query = query.in(
      "employee_id",
      employeeIds
    );
  }

  const { data, error } =
    await query;

  if (error) {
    console.error(
      "deductions:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

/* =========================================================
   USERS
========================================================= */

export async function listUsers() {
  const { data, error } =
    await supabase
      .from("users")
      .select(
        "user_id,employee_id,username,role,status,last_login,created_at,updated_at"
      )
      .order("username");

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

export async function createUser(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const username = String(
    body.username || ""
  ).trim();

  const password = String(
    body.password || ""
  );

  const role =
    String(
      body.role ||
        "EMPLOYEE"
    ).toUpperCase();

  const status =
    String(
      body.status ||
        "ACTIVE"
    ).toUpperCase();

  const employeeId =
    String(
      body.employee_id ||
        ""
    ).trim();

  const projectId =
    String(
      body.project_id ||
        ""
    ).trim();

  if (
    username.length < 3
  ) {
    return errorResponse(
      "اسم المستخدم غير صالح"
    );
  }

  if (
    password.length < 8
  ) {
    return errorResponse(
      "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
    );
  }

  if (!ROLES.includes(role)) {
    return errorResponse(
      "صلاحية المستخدم غير صحيحة"
    );
  }

  if (
    [
      "EMPLOYEE",
      "PROJECT_MANAGER",
      "SITE_SUPERVISOR",
    ].includes(role) &&
    !employeeId
  ) {
    return errorResponse(
      "يجب اختيار الموظف المرتبط بالحساب"
    );
  }

  if (
    ["PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(role) &&
    !projectId
  ) {
    return errorResponse(
      "يجب اختيار مشروع مدير المشروع"
    );
  }

  const { data: existing } =
    await supabase
      .from("users")
      .select("user_id")
      .ilike(
        "username",
        username
      )
      .maybeSingle();

  if (existing) {
    return errorResponse(
      "اسم المستخدم موجود بالفعل"
    );
  }

  if (employeeId) {
    const { data: employee } =
      await supabase
        .from("employees")
        .select(
          "employee_id"
        )
        .eq(
          "employee_id",
          employeeId
        )
        .maybeSingle();

    if (!employee) {
      return errorResponse(
        "الموظف المرتبط غير موجود"
      );
    }
  }

  if (projectId) {
    const { data: project } =
      await supabase
        .from("projects")
        .select(
          "project_id"
        )
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
  }

  const salt =
    crypto.randomUUID();

  const hash =
    passwordHash(
      salt,
      password
    );

  const userId =
    generateId("USR");

  const { data, error } =
    await supabase
      .from("users")
      .insert({
        user_id:
          userId,

        employee_id:
          [
            "EMPLOYEE",
            "PROJECT_MANAGER",
            "SITE_SUPERVISOR",
          ].includes(role)
            ? employeeId
            : null,

        username,

        password_hash:
          `${salt}$${hash}`,

        role,

        status,

        last_login:
          null,

        failed_attempts:
          0,

        created_at:
          nowISO(),

        updated_at:
          nowISO(),
      })
      .select(
        "user_id,employee_id,username,role,status,last_login,created_at"
      )
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  if (role === "PROJECT_MANAGER") {
    const { error: managerError } =
      await supabase
        .from("project_managers")
        .insert({
          id: generateId("PM"),
          user_id: userId,
          project_id: projectId,
          start_date: riyadhDate(),
          end_date: null,
          created_at: nowISO(),
        });

    if (managerError) {
      return errorResponse(
        `تم إنشاء الحساب لكن فشل ربط مدير المشروع: ${managerError.message}`,
        500
      );
    }
  } else if (role === "SITE_SUPERVISOR") {
    const { error: supervisorError } =
      await supabase
        .from("project_supervisors")
        .insert({
          assignment_id: generateId("SUP"),
          user_id: userId,
          project_id: projectId,
          start_date: riyadhDate(),
          end_date: null,
          created_by: session.user.user_id,
          created_at: nowISO(),
        });

    if (supervisorError) {
      return errorResponse(
        `تم إنشاء الحساب لكن فشل ربط مشرف الموقع بالمشروع: ${supervisorError.message}`,
        500
      );
    }
  }

  return success(
    data,
    201
  );
}

/* =========================================================
   MAIN ROUTER
========================================================= */

