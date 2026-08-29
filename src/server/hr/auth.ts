import crypto from "crypto";
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
  writeسجل التدقيق,
  SESSION_MAX_AGE,
} from "./core";
import type { SessionContext } from "./core";

export const SESSION_COOKIE = "elnuby_hr_session";

function sessionCookieOptions() {
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    expires,
  };
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
    await writeسجل التدقيق(String(user.id), "LOGIN_FAILED", "auth", String(user.id), { username }, false);
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

  await writeسجل التدقيق(String(user.id), "LOGIN", "auth", String(user.id), { username, role: user.role });

  // Set the persistent auth cookie on the actual Login response. This avoids
  // relying on implicit cookie mutations from a nested helper and makes the
  // Set-Cookie header observable and reliable on Vercel/Next.js.
  const response = success({
    authenticated: true,
    user: {
      user_id: String(user.id),
      employee_id: user.employee_id ?? null,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export async function logout(session: SessionContext | null) {
  if (session) {
    await publicSupabase
      .from("app_sessions")
      .update({ revoked_at: nowISO() })
      .eq("token_hash", sha256(session.token))
      .is("revoked_at", null);
    await writeسجل التدقيق(session.user.user_id, "LOGOUT", "auth", session.user.user_id);
  }
  const response = success({ logged_out: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export async function getMe(session: SessionContext) {
  const employeeId = session.user.employee_id;
  let employee = null;
  let project = null;
  let shift = null;

  if (employeeId) {
    const [employeeResult, assignment] = await Promise.all([
      supabase
        .from("employees")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle(),
      getCurrentAssignment(employeeId),
    ]);

    employee = employeeResult.data;

    if (assignment?.project_id) {
      const [{ data: projectData }, employeeShift] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("project_id", assignment.project_id)
          .maybeSingle(),
        getCurrentEmployeeShift(employeeId, assignment.project_id),
      ]);
      project = projectData;
      shift = employeeShift?.shifts || null;
    }
  }

  return success({
    user: session.user,
    employee,
    project,
    shift,
  });
}
