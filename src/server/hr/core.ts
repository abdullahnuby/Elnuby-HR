import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}).schema("hr");

// Session storage intentionally remains outside the canonical HR business schema.
export const publicSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export type CurrentUser = {
  user_id: string;
  employee_id: string | null;
  username: string;
  role: string;
  status: string;
};

export type SessionContext = {
  token: string;
  user: CurrentUser;
};

export const ROLES = [
  "SYSTEM_ADMIN",
  "HR_MANAGER",
  "PROJECT_MANAGER",
  "SECTOR_MANAGER",
  "EMPLOYEE",
];

export const ADMIN_ROLES = ["SYSTEM_ADMIN", "HR_MANAGER"];

export const MANAGEMENT_ROLES = [
  "SYSTEM_ADMIN",
  "HR_MANAGER",
  "SECTOR_MANAGER",
  "PROJECT_MANAGER",
];

export const PROJECT_VIEW_ROLES = [
  "SYSTEM_ADMIN",
  "HR_MANAGER",
  "SECTOR_MANAGER",
  "PROJECT_MANAGER",
  "EMPLOYEE",
];

export const PROJECT_MANAGE_ROLES = [
  "SYSTEM_ADMIN",
  "HR_MANAGER",
  "SECTOR_MANAGER",
  "PROJECT_MANAGER",
];

export function success(data: unknown, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status }
  );
}

export function errorResponse(message: string, status = 400) {
  const safeMessage = status >= 500 ? "حدث خطأ داخلي. حاول مرة أخرى." : message;
  return NextResponse.json(
    {
      ok: false,
      error: safeMessage,
    },
    { status }
  );
}

export function generateId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function passwordHash(salt: string, password: string) {
  return crypto.createHash("sha256").update(salt + password).digest("base64");
}

export function securePasswordHash(password: string) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function verifyPassword(stored: string, password: string) {
  try {
    if (stored.startsWith("scrypt$")) {
      const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = stored.split("$");
      const n = Number(nRaw);
      const r = Number(rRaw);
      const p = Number(pRaw);
      const salt = Buffer.from(saltRaw, "base64url");
      const expected = Buffer.from(hashRaw, "base64url");
      const actual = crypto.scryptSync(password, salt, expected.length, { N: n, r, p });
      return crypto.timingSafeEqual(actual, expected);
    }

    const separatorIndex = stored.indexOf("$");
    if (separatorIndex <= 0) return false;
    const salt = stored.substring(0, separatorIndex);
    const expected = stored.substring(separatorIndex + 1);
    const actual = passwordHash(salt, password);
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parsePagination(body: Record<string, unknown>, maxLimit = 100) {
  const page = Math.max(1, Number(body.page || 1) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(body.limit || maxLimit) || maxLimit));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}

export function nowISO() {
  return new Date().toISOString();
}

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Cairo";

export function appDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function previousAppDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function appTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}


export function normalizeTimeInput(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:T|\s)?(\d{2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isTimeWithinWindow(current: string, open: string, close: string) {
  const c = timeToMinutes(current), o = timeToMinutes(open), cl = timeToMinutes(close);
  if (o === cl) return true;
  return cl > o ? c >= o && c <= cl : c >= o || c <= cl;
}

export function timeToMinutes(value: string | null | undefined) {
  if (!value) return 0;

  const [hours, minutes] = String(value)
    .substring(0, 5)
    .split(":")
    .map(Number);

  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesBetween(start: string, end: string) {
  let a = timeToMinutes(start);
  let b = timeToMinutes(end);

  if (b < a) {
    b += 24 * 60;
  }

  return Math.max(0, b - a);
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371000;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

/* =========================================================
   AUTH / SESSION
========================================================= */

export async function getSession(
  token: string
): Promise<SessionContext | null> {
  if (!token) return null;

  const tokenHash = sha256(token);

  const { data: session, error: sessionError } = await publicSupabase
    .from("app_sessions")
    .select(
      "session_id,user_id,token_hash,expires_at,revoked_at"
    )
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (sessionError || !session) {
    return null;
  }

  if (
    session.expires_at &&
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select(
      "id,employee_id,username,role,status"
    )
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    return null;
  }

  // Sliding server-side session: refreshing/using the app keeps an active
  // session alive while the browser cookie remains valid.
  const refreshedExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await publicSupabase
    .from("app_sessions")
    .update({
      last_used_at: nowISO(),
      expires_at: refreshedExpiry,
    })
    .eq("session_id", session.session_id);

  return {
    token,
    user: {
      user_id: user.id,
      employee_id: user.employee_id ?? null,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  };
}

export function requireAuth(
  session: SessionContext | null
) {
  if (!session) {
    return errorResponse(
      "Authentication required",
      401
    );
  }

  return null;
}

export function requireRole(
  session: SessionContext | null,
  roles: string[]
) {
  if (!session) {
    return errorResponse(
      "Authentication required",
      401
    );
  }

  if (!roles.includes(session.user.role)) {
    return errorResponse(
      "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
      403
    );
  }

  return null;
}

/* =========================================================
   AUDIT
========================================================= */

export async function writeAudit(
  actorUserId: string | null,
  action: string,
  entity = "api",
  entityId: string | null = null,
  details: Record<string, unknown> = {},
  successFlag = true
) {
  try {
    await supabase.from("audit_log").insert({
      log_id: generateId("AUD"),
      actor_user_id: actorUserId,
      action,
      entity,
      entity_id: entityId,
      new_value: details,
      reason: successFlag ? null : "request_failed",
      created_at: nowISO(),
    });
  } catch (error) {
    console.error("audit_log:", error);
  }
}

/* =========================================================
   PROJECT ACCESS
========================================================= */

export async function getManagedProjectIds(
  user: CurrentUser
): Promise<string[]> {
  if (
    user.role === "SYSTEM_ADMIN" ||
    user.role === "HR_MANAGER"
  ) {
    const { data } = await supabase
      .from("projects")
      .select("project_id");

    return (data || []).map(
      (row: any) => row.project_id
    );
  }

  if (!["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(user.role)) {
    return [];
  }

  const today = appDate();

  const tables = user.role === "SECTOR_MANAGER"
    ? ["sector_manager_projects"]
    : ["project_managers", "project_supervisors"];

  const results = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("project_id,start_date,end_date")
        .eq("user_id", user.user_id);

      if (error) {
        console.error(`getManagedProjectIds(${table}):`, error);
        return [];
      }

      return data || [];
    })
  );

  return Array.from(
    new Set(
      results
        .flat()
        .filter((row: any) => {
          const starts = !row.start_date || row.start_date <= today;
          const active = !row.end_date || row.end_date >= today;
          return starts && active;
        })
        .map((row: any) => String(row.project_id))
        .filter(Boolean)
    )
  );
}

export async function canManageProject(
  user: CurrentUser,
  projectId: string
) {
  if (
    user.role === "SYSTEM_ADMIN" ||
    user.role === "HR_MANAGER"
  ) {
    return true;
  }

  if (!["SECTOR_MANAGER", "PROJECT_MANAGER"].includes(user.role)) {
    return false;
  }

  const projectIds =
    await getManagedProjectIds(user);

  return projectIds.includes(projectId);
}

/* =========================================================
   EMPLOYEE CURRENT ASSIGNMENT
========================================================= */

export async function getCurrentAssignment(
  employeeId: string
) {
  const { data, error } = await supabase
    .from("project_assignments")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("is_current", true)
    .order("start_date", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "getCurrentAssignment:",
      error
    );
    return null;
  }

  return data;
}

/* =========================================================
   CURRENT SHIFT
========================================================= */

export async function getCurrentEmployeeShift(
  employeeId: string,
  projectId: string
) {
  const today = appDate();

  const { data, error } = await supabase
    .from("employee_shifts")
    .select(
      `
      *,
      shifts(*)
      `
    )
    .eq("employee_id", employeeId)
    .eq("project_id", projectId)
    .lte("start_date", today)
    .or(
      `end_date.is.null,end_date.gte.${today}`
    )
    .order("start_date", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "getCurrentEmployeeShift:",
      error
    );
    return null;
  }

  return data;
}

/* =========================================================
   LOGIN
========================================================= */

