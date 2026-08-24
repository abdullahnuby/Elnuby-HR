import crypto from "crypto";
import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function login(
  body: Record<string, unknown>
) {
  const username = String(
    body.username || ""
  ).trim();

  const password = String(
    body.password || ""
  );

  if (!username || !password) {
    return errorResponse(
      "اسم المستخدم وكلمة المرور مطلوبان"
    );
  }

  const { data: user, error } =
    await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

  if (error || !user) {
    return errorResponse(
      "اسم المستخدم أو كلمة المرور غير صحيحة",
      401
    );
  }

  if (user.status !== "ACTIVE") {
    return errorResponse(
      "الحساب غير نشط",
      403
    );
  }

  const storedHash = String(
    user.password_hash || ""
  );

  const separatorIndex =
    storedHash.indexOf("$");

  if (separatorIndex <= 0) {
    console.error(
      "Invalid password_hash format for user:",
      user.user_id
    );

    return errorResponse(
      "بيانات كلمة المرور للحساب غير صالحة",
      500
    );
  }

  const salt = storedHash.substring(
    0,
    separatorIndex
  );

  const expectedHash =
    storedHash.substring(
      separatorIndex + 1
    );

  const actualHash =
    passwordHash(salt, password);

  if (actualHash !== expectedHash) {
    await supabase
      .from("users")
      .update({
        failed_attempts:
          Number(user.failed_attempts || 0) + 1,
      })
      .eq("user_id", user.user_id);

    return errorResponse(
      "اسم المستخدم أو كلمة المرور غير صحيحة",
      401
    );
  }

  const token = crypto.randomUUID();

  const sessionId = generateId("SES");

  const { error: sessionError } =
    await supabase
      .from("app_sessions")
      .insert({
        session_id: sessionId,
        token_hash: sha256(token),
        user_id: user.user_id,
        expires_at: new Date(
          Date.now() +
            7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        last_used_at: nowISO(),
      });

  if (sessionError) {
    console.error(
      "create session:",
      sessionError
    );

    return errorResponse(
      "تعذر إنشاء جلسة الدخول",
      500
    );
  }

  await supabase
    .from("users")
    .update({
      last_login: nowISO(),
      failed_attempts: 0,
    })
    .eq("user_id", user.user_id);

  return success({
    token,
    user: {
      user_id: user.user_id,
      employee_id:
        user.employee_id ?? null,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  });
}

/* =========================================================
   ME
========================================================= */

export async function getMe(
  session: SessionContext
) {
  const employeeId =
    session.user.employee_id;

  let employee = null;
  let project = null;
  let shift = null;

  if (employeeId) {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    employee = data;

    const assignment =
      await getCurrentAssignment(
        employeeId
      );

    if (assignment) {
      const { data: projectData } =
        await supabase
          .from("projects")
          .select("*")
          .eq(
            "project_id",
            assignment.project_id
          )
          .maybeSingle();

      project = projectData;

      if (project) {
        const employeeShift =
          await getCurrentEmployeeShift(
            employeeId,
            project.project_id
          );

        shift =
          employeeShift?.shifts ||
          null;
      }
    }
  }

  return success({
    user: {
      user_id:
        session.user.user_id,
      employee_id:
        session.user.employee_id,
      username:
        session.user.username,
      role: session.user.role,
      status:
        session.user.status,
    },
    employee,
    project,
    shift,
  });
}

/* =========================================================
   DASHBOARD
========================================================= */

