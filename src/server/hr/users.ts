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

  if (["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(session.user.role)) {
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

  // HR can manage workforce accounts, but only SYSTEM_ADMIN can create
  // another HR administrator or a full system administrator.
  if (session.user.role === "HR_MANAGER" && ["SYSTEM_ADMIN", "HR_MANAGER"].includes(role)) {
    return errorResponse("مدير HR لا يستطيع إنشاء حساب مدير نظام أو حساب HR إداري آخر", 403);
  }

  if (
    [
      "EMPLOYEE",
      "PROJECT_MANAGER",
      "SECTOR_MANAGER",
    ].includes(role) &&
    !employeeId
  ) {
    return errorResponse(
      "يجب اختيار الموظف المرتبط بالحساب"
    );
  }

  if (
    ["PROJECT_MANAGER"].includes(role) &&
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

  if (employeeId && status === "ACTIVE") {
    const { data: activeUser } = await supabase.from("users").select("id,username").eq("employee_id",employeeId).eq("status","ACTIVE").limit(1).maybeSingle();
    if (activeUser) return errorResponse(`الموظف لديه حساب نشط بالفعل: ${activeUser.username}`);
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

  const directorProjectIds = role === "SECTOR_MANAGER"
    ? [...new Set((Array.isArray(body.project_ids) ? body.project_ids : projectId ? [projectId] : []).map((v) => String(v).trim()).filter(Boolean))]
    : [];

  if (role === "SECTOR_MANAGER" && !directorProjectIds.length) {
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
            "SECTOR_MANAGER",
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

  if (role === "SECTOR_MANAGER") {
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

  if (!user || user.role !== "SECTOR_MANAGER") {
    return errorResponse("المستخدم المحدد ليس مدير قطاع");
  }

  if (user.status !== "ACTIVE") {
    return errorResponse("حساب مدير القطاع غير نشط");
  }

  // A project director may only add projects that they themselves already control
  // when a director is doing the assignment; HR/SYSTEM_ADMIN can assign any project.
  if (session.user.role === "SECTOR_MANAGER") {
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

const ADMIN_ID_COLUMNS: Record<string,string> = {
  employees: "employee_id", projects: "project_id", shifts: "shift_id", users: "id",
  employee_shifts: "assignment_id", project_assignments: "assignment_id", project_managers: "id",
  sector_manager_projects: "assignment_id", project_supervisors: "id", attendance: "attendance_id",
  leave_types: "leave_type_id", leave_balances: "balance_id", leave_requests: "leave_id",
  permission_requests: "permission_id", deductions: "id",
};

const BLOCKED_RELATION_COLUMNS = new Set([
  "employee_id", "project_id", "shift_id", "user_id", "assignment_id",
]);

export async function adminList(
  _session: SessionContext,
  body: Record<string, unknown>,
) {
  const table = validateAdminTable(body.table);
  if (!table) return errorResponse("الجدول غير مسموح بإدارته");
  const { data, error } = await supabase.from(table).select("*").limit(200);
  if (error) return errorResponse(error.message, 500);
  return success((data || []).map((row: any) => {
    const safe = { ...row };
    if (table === "users") delete safe.password_hash;
    return safe;
  }));
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
  if (!table || !idColumn || !id || !changes || typeof changes !== "object" || Array.isArray(changes)) return errorResponse("بيانات التعديل غير صحيحة");
  if (ADMIN_ID_COLUMNS[table] !== idColumn) return errorResponse("معرف السجل غير مسموح لهذا الجدول");
  const safeChanges = Object.fromEntries(Object.entries(changes as Record<string, unknown>).filter(([key]) => !BLOCKED_RELATION_COLUMNS.has(key) && key !== ADMIN_ID_COLUMNS[table]));
  if (!Object.keys(safeChanges).length) return errorResponse("لا توجد حقول آمنة للتعديل");
  const { data, error } = await supabase.from(table).update(safeChanges).eq(idColumn, id).select("*").maybeSingle();
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
  if (ADMIN_ID_COLUMNS[table] !== idColumn) return errorResponse("معرف السجل غير مسموح لهذا الجدول");

  if (table === "users") {
    if (id === session.user.user_id) return errorResponse("لا يمكن لمدير النظام تعطيل حسابه الحالي");
    const { data, error } = await supabase.from("users").update({status:"INACTIVE",updated_at:nowISO()}).eq("id",id).select("id,employee_id,username,role,status").maybeSingle();
    if (error) return errorResponse(error.message,500); if (!data) return errorResponse("السجل غير موجود",404);
    await writeAudit(session.user.user_id,"ADMIN_DELETE","users",id,{soft_delete:true,status:"INACTIVE"}); return success(data);
  }

  if (table === "employees") {
    const { count } = await supabase.from("attendance").select("attendance_id",{count:"exact",head:true}).eq("employee_id",id);
    if ((count || 0) > 0) return errorResponse("لا يمكن حذف موظف لديه سجل حضور تاريخي. استخدم تعطيل الموظف.",409);
  }
  if (table === "projects") {
    const { count } = await supabase.from("project_assignments").select("assignment_id",{count:"exact",head:true}).eq("project_id",id);
    if ((count || 0) > 0) return errorResponse("لا يمكن حذف مشروع لديه تعيينات موظفين. استخدم تعطيل المشروع.",409);
  }
  if (table === "shifts") {
    const { count } = await supabase.from("employee_shifts").select("assignment_id",{count:"exact",head:true}).eq("shift_id",id);
    if ((count || 0) > 0) return errorResponse("لا يمكن حذف وردية مستخدمة في تعيينات تاريخية. استخدم تعطيل الوردية.",409);
  }

  const { data, error } = await supabase.from(table).delete().eq(idColumn, id).select("*").maybeSingle();
  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("السجل غير موجود", 404);
  await writeAudit(session.user.user_id, "ADMIN_DELETE", table, id, { id_column: idColumn, deleted: data });
  return success(data);
}


export async function updateUser(session: SessionContext, body: Record<string, unknown>) {
 const userId=String(body.user_id||'').trim(); if(!userId) return errorResponse('معرف المستخدم مطلوب'); const changes:Record<string,unknown>={};
 if(body.status!==undefined){const status=String(body.status).toUpperCase();if(!['ACTIVE','INACTIVE'].includes(status))return errorResponse('حالة الحساب غير صحيحة');if(userId===session.user.user_id&&status!=='ACTIVE')return errorResponse('لا يمكن تعطيل حسابك الحالي');changes.status=status;}
 if(body.password!==undefined){const password=String(body.password||'');if(password.length<8)return errorResponse('كلمة المرور يجب أن تكون 8 أحرف على الأقل');changes.password_hash=securePasswordHash(password);}
 if(!Object.keys(changes).length)return errorResponse('لا توجد بيانات للتعديل'); const {data,error}=await supabase.from('users').update({...changes,updated_at:nowISO()}).eq('id',userId).select('id,employee_id,username,role,status,last_login,created_at,updated_at').maybeSingle();
 if(error)return errorResponse(error.message,500);if(!data)return errorResponse('المستخدم غير موجود',404);await writeAudit(session.user.user_id,'update_user','users',userId,{changes:Object.fromEntries(Object.entries(changes).map(([k,v])=>[k,k==='password_hash'?'[REDACTED]':v]))});return success({...data,user_id:data.id});
}

export async function deleteUser(session: SessionContext, body: Record<string, unknown>) {
 const userId=String(body.user_id||'').trim();if(!userId)return errorResponse('معرف المستخدم مطلوب');if(userId===session.user.user_id)return errorResponse('لا يمكن تعطيل حسابك الحالي');const {data,error}=await supabase.from('users').update({status:'INACTIVE',updated_at:nowISO()}).eq('id',userId).select('id,employee_id,username,role,status').maybeSingle();if(error)return errorResponse(error.message,500);if(!data)return errorResponse('المستخدم غير موجود',404);await writeAudit(session.user.user_id,'delete_user','users',userId,{soft_delete:true,status:'INACTIVE'});return success({...data,user_id:data.id});
}
