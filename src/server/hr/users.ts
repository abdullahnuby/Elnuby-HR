import { parsePagination } from "./core";
import crypto from "crypto";
import { supabase, success, errorResponse, generateId, sha256, passwordHash, securePasswordHash, nowISO, riyadhDate, previousRiyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, ROLES, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift, writeAudit } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listDeductions(
  session: SessionContext,
  body: Record<string, unknown> = {},
) {
  const { from, to } = parsePagination(body, 100);
  let query = supabase
    .from("deductions")
    .select("*")
    .order(
      "date",
      {
        ascending: false,
      }
    )
    .range(from, to);

  if (["PROJECT_DIRECTOR", "PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)) {
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
    (data || []).map((user: any) => ({
      ...user,
      user_id: user.id,
    }))
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
        "id,employee_id,username,role,status,last_login,created_at,updated_at"
      )
      .order("username");

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    (data || []).map((user: any) => ({
      ...user,
      user_id: user.id,
    }))
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

  // HR can manage workforce accounts, but only SUPER_ADMIN can create
  // another HR administrator or a full system administrator.
  if (session.user.role === "HR_MANAGER" && ["SUPER_ADMIN", "HR_MANAGER"].includes(role)) {
    return errorResponse("مدير HR لا يستطيع إنشاء حساب مدير نظام أو حساب HR إداري آخر", 403);
  }

  if (
    [
      "EMPLOYEE",
      "PROJECT_MANAGER",
      "PROJECT_DIRECTOR",
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
      "يجب اختيار المشروع المرتبط بالحساب"
    );
  }

  const { data: existing } =
    await supabase
      .from("users")
      .select("id")
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

  const directorProjectIds = role === "PROJECT_DIRECTOR"
    ? [...new Set((Array.isArray(body.project_ids) ? body.project_ids : projectId ? [projectId] : []).map((v) => String(v).trim()).filter(Boolean))]
    : [];

  if (role === "PROJECT_DIRECTOR" && !directorProjectIds.length) {
    return errorResponse("مدير القطاع يجب أن يتم إسناده إلى مشروع واحد على الأقل");
  }

  if (directorProjectIds.length) {
    const { data: directorProjects } = await supabase.from("projects").select("project_id").in("project_id", directorProjectIds);
    if ((directorProjects || []).length !== directorProjectIds.length) {
      return errorResponse("يوجد مشروع أو أكثر غير موجود");
    }
  }

  const hash = securePasswordHash(password);

  const userId =
    generateId("USR");

  const { data, error } =
    await supabase
      .from("users")
      .insert({
        id:
          userId,
        legacy_user_id:
          userId,

        employee_id:
          [
            "EMPLOYEE",
            "PROJECT_MANAGER",
            "PROJECT_DIRECTOR",
            "SITE_SUPERVISOR",
          ].includes(role)
            ? employeeId
            : null,

        username,

        password_hash:
          hash,

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
        "id,employee_id,username,role,status,last_login,created_at"
      )
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  if (role === "PROJECT_DIRECTOR") {
    const { error: scopeError } = await supabase.from("sector_manager_projects").insert(
      directorProjectIds.map((id) => ({
        assignment_id: generateId("SEC"),
        user_id: userId,
        project_id: id,
        start_date: riyadhDate(),
        end_date: null,
        created_by: session.user.user_id,
        created_at: nowISO(),
      }))
    );
    if (scopeError) return errorResponse(`تم إنشاء الحساب لكن فشل ربط مدير القطاع بالمشروعات: ${scopeError.message}`, 500);
  } else if (role === "PROJECT_MANAGER") {
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
    {
      ...(data || {}),
      user_id: data?.id,
    },
    201
  );
}

/* =========================================================
   MAIN ROUTER
========================================================= */


export async function assignSectorManagerProjects(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const userId = String(body.user_id || "").trim();
  const rawProjectIds = Array.isArray(body.project_ids)
    ? body.project_ids
    : body.project_id
      ? [body.project_id]
      : [];
  const projectIds = [...new Set(rawProjectIds.map((v) => String(v).trim()).filter(Boolean))];

  if (!userId || !projectIds.length) {
    return errorResponse("مدير القطاع والمشروعات مطلوبان");
  }

  const { data: user } = await supabase
    .from("users")
    .select("id,role,status,employee_id")
    .eq("id", userId)
    .maybeSingle();

  if (!user || user.role !== "PROJECT_DIRECTOR") {
    return errorResponse("المستخدم المحدد ليس مدير قطاع");
  }

  if (user.status !== "ACTIVE") {
    return errorResponse("حساب مدير القطاع غير نشط");
  }

  // A project director may only add projects that they themselves already control
  // when a director is doing the assignment; HR/SUPER_ADMIN can assign any project.
  if (session.user.role === "PROJECT_DIRECTOR") {
    const allowed = new Set(await getManagedProjectIds(session.user));
    if (projectIds.some((id) => !allowed.has(id))) {
      return errorResponse("مدير القطاع لا يستطيع إسناد مشروع خارج نطاقه", 403);
    }
  }

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("project_id")
    .in("project_id", projectIds);

  if (projectError) return errorResponse(projectError.message, 500);
  if ((projects || []).length !== projectIds.length) {
    return errorResponse("يوجد مشروع أو أكثر غير موجود");
  }

  // End previous active scope first, then create the requested current scope.
  await supabase
    .from("sector_manager_projects")
    .update({ end_date: previousRiyadhDate(riyadhDate()) })
    .eq("user_id", userId)
    .is("end_date", null)
    .not("project_id", "in", `(${projectIds.join(",")})`);

  const rows = projectIds.map((projectId) => ({
    assignment_id: generateId("SEC"),
    user_id: userId,
    project_id: projectId,
    start_date: String(body.start_date || riyadhDate()),
    end_date: null,
    created_by: session.user.user_id,
    created_at: nowISO(),
  }));

  const { data, error } = await supabase
    .from("sector_manager_projects")
    .insert(rows)
    .select("*");

  if (error) return errorResponse(error.message, 500);
  return success(data || []);
}


const ADMIN_MUTABLE_TABLES = new Set([
  "employees",
  "projects",
  "shifts",
  "employee_shifts",
  "project_assignments",
  "project_managers",
  "sector_manager_projects",
  "project_supervisors",
  "attendance",
  "leave_types",
  "leave_balances",
  "leave_requests",
  "permission_requests",
  "deductions",
  "users",
]);

function validateAdminTable(value: unknown) {
  const table = String(value || "").trim();
  return ADMIN_MUTABLE_TABLES.has(table) ? table : null;
}

export async function adminInsert(
  session: SessionContext,
  body: Record<string, unknown>,
) {
  const table = validateAdminTable(body.table);
  const row = body.row;
  if (!table || !row || typeof row !== "object" || Array.isArray(row)) {
    return errorResponse("جدول أو بيانات الإدخال غير صحيحة");
  }
  const { data, error } = await supabase.from(table).insert(row as Record<string, unknown>).select("*").single();
  if (error) return errorResponse(error.message, 500);
  await writeAudit(session.user.user_id, "ADMIN_INSERT", table, String((data as any)?.id || (data as any)?.employee_id || (data as any)?.project_id || ""), { row });
  return success(data, 201);
}

export async function adminUpdate(
  session: SessionContext,
  body: Record<string, unknown>,
) {
  const table = validateAdminTable(body.table);
  const idColumn = String(body.id_column || "").trim();
  const id = String(body.id ?? "").trim();
  const changes = body.changes;
  if (!table || !idColumn || !id || !changes || typeof changes !== "object" || Array.isArray(changes)) {
    return errorResponse("بيانات التعديل غير صحيحة");
  }
  const { data, error } = await supabase.from(table).update(changes as Record<string, unknown>).eq(idColumn, id).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("السجل غير موجود", 404);
  await writeAudit(session.user.user_id, "ADMIN_UPDATE", table, id, { id_column: idColumn, changes });
  return success(data);
}

export async function adminDelete(
  session: SessionContext,
  body: Record<string, unknown>,
) {
  const table = validateAdminTable(body.table);
  const idColumn = String(body.id_column || "").trim();
  const id = String(body.id ?? "").trim();
  if (!table || !idColumn || !id) return errorResponse("بيانات الحذف غير صحيحة");

  if (table === "users" && id === session.user.user_id) {
    return errorResponse("لا يمكن لمدير النظام حذف حسابه الحالي");
  }

  const { data, error } = await supabase.from(table).delete().eq(idColumn, id).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("السجل غير موجود", 404);
  await writeAudit(session.user.user_id, "ADMIN_DELETE", table, id, { id_column: idColumn, deleted: data });
  return success(data);
}
