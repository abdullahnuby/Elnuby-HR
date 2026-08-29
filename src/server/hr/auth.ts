import crypto from "crypto";
import { cookies } from "next/headers";
import {
  supabase,
  publicSupabase,
  success,
  errorResponse,
  generateId,
  sha256,
  nowISO,
  appDate,
  getCurrentAssignment,
  getCurrentEmployeeShift,
  verifyPassword,
  securePasswordHash,
  writeAudit,
} from "./core";
import type { SessionContext } from "./core";

export const SESSION_COOKIE = "elnuby_hr_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function login(body: Record<string, unknown>) {
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return errorResponse("اسم المستخدم وكلمة المرور مطلوبان");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id,employee_id,username,role,status,password_hash,failed_attempts,locked_until")
    .eq("username", username)
    .maybeSingle();

  if (error || !user) {
    return errorResponse("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
  }

  if (user.status !== "ACTIVE") {
    return errorResponse("الحساب غير نشط", 403);
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return errorResponse("تم تعليق الحساب مؤقتًا بسبب محاولات دخول فاشلة. حاول لاحقًا.", 423);
  }

  const storedHash = String(user.password_hash || "");
  const valid = verifyPassword(storedHash, password);

  if (!valid) {
    const failedAttempts = Number(user.failed_attempts || 0) + 1;
    const lock = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await supabase
      .from("users")
      .update({ failed_attempts: failedAttempts, locked_until: lock, updated_at: nowISO() })
      .eq("id", user.id);
    await writeAudit(String(user.id), "LOGIN_FAILED", "auth", String(user.id), { username }, false);
    return errorResponse("اسم المستخدم أو كلمة المرور غير صحيحة", 401);
  }

  // Upgrade old SHA-256 password records after a successful login.
  const upgradedHash = storedHash.startsWith("scrypt$") ? storedHash : securePasswordHash(password);
  const token = crypto.randomBytes(32).toString("base64url");
  const sessionId = generateId("SES");

  const { error: sessionError } = await publicSupabase
    .from("app_sessions")
    .insert({
      session_id: sessionId,
      token_hash: sha256(token),
      user_id: String(user.id),
      expires_at: new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
      last_used_at: nowISO(),
    });

  if (sessionError) {
    console.error("create session:", {
      message: sessionError.message,
      code: sessionError.code,
      details: sessionError.details,
      hint: sessionError.hint,
      user_id: String(user.id),
    });
    return errorResponse("تعذر إنشاء جلسة الدخول", 500);
  }

  await supabase
    .from("users")
    .update({
      password_hash: upgradedHash,
      last_login: nowISO(),
      failed_attempts: 0,
      locked_until: null,
      updated_at: nowISO(),
    })
    .eq("id", user.id);

  await setSessionCookie(token);
  await writeAudit(String(user.id), "LOGIN", "auth", String(user.id), { username, role: user.role });

  return success({
    authenticated: true,
    user: {
      user_id: String(user.id),
      employee_id: user.employee_id ?? null,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  });
}

export async function logout(session: SessionContext | null) {
  if (session) {
    await publicSupabase
      .from("app_sessions")
      .update({ revoked_at: nowISO() })
      .eq("token_hash", sha256(session.token))
      .is("revoked_at", null);
    await writeAudit(session.user.user_id, "LOGOUT", "auth", session.user.user_id);
  }
  await clearSessionCookie();
  return success({ logged_out: true });
}

export async function getMe(session: SessionContext) {
  const employeeId = session.user.employee_id;
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

    const assignment = await getCurrentAssignment(employeeId);
    if (assignment) {
      const { data: projectData } = await supabase
        .from("projects")
        .select("*")
        .eq("project_id", assignment.project_id)
        .maybeSingle();
      project = projectData;

      if (project) {
        const employeeShift = await getCurrentEmployeeShift(employeeId, project.project_id);
        shift = employeeShift?.shifts || null;
      }
    }
  }

  return success({
    user: session.user,
    employee,
    project,
    shift,
  });
}
