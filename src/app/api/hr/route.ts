import { cookies } from "next/headers";
import { getSession, errorResponse, writeAudit, SessionStoreError } from "@/server/hr/core";
import { handleAction } from "@/server/hr/router";
import { createLeave } from "@/server/hr/leaves";
import { SESSION_COOKIE, clearSessionCookie } from "@/server/hr/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUDITED_ACTIONS = new Set([
  "check_in","check_out","create_employee","update_employee","create_project","update_project","create_shift","update_shift",
  "assign_employee_project","assign_employee_shift","assign_manager_project","assign_sector_manager_projects",
  "create_user","update_user","delete_user","create_leave","decide_leave_manager","decide_leave_hr","create_permission","decide_permission","create_deduction",
]);

export async function GET() {
  return errorResponse("Method not allowed", 405);
}

export async function POST(request: Request) {
  let requestAction = "";
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = {};
      form.forEach((value, key) => {
        if (key !== "medical_document") body[key] = typeof value === "string" ? value : value;
      });
      if (form.get("medical_document")) body.__document = form.get("medical_document");
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }
    const action = String(body.action || "").trim();
    requestAction = action;
    if (!action) return errorResponse("action is required");

    let session = null;
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(SESSION_COOKIE)?.value || "";

    if (action !== "login") {
      session = await getSession(cookieToken);

      // session_status is intentionally public and idempotent. It is used by
      // the browser on first load so an unauthenticated refresh does not
      // produce a noisy 401 or revive stale client state.
      if (action === "session_status") {
        // A status probe is read-only. Most importantly, distinguish an
        // actually missing/expired cookie from a temporary session-store
        // outage. The latter must be retried, not treated as logout.
        return Response.json({
          ok: true,
          data: {
            authenticated: Boolean(session),
            user: session?.user || null,
            degraded: false,
          },
        }, { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
      }

      // Logout is intentionally idempotent: even if the server-side session
      // has already expired/revoked, always remove the browser cookie.
      if (!session && action !== "logout") {
        return errorResponse("الجلسة غير صالحة أو منتهية", 401);
      }
    }

if (request.headers.get('x-offline-sync') === '1') body.__offline_sync = true;

const result = await handleAction(action, body, session);

const response =
  result instanceof Response
    ? result
    : Response.json(result);

// Re-issue the same valid session cookie on every authenticated request.
// This refreshes the browser Max-Age/Expires and makes normal page refreshes
// robust across browser cookie eviction policies while keeping the token
// HttpOnly and server-side validated.
if (session && action !== "logout") {
  try {
    const token = session.token;
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  } catch (cookieError) {
    console.warn("session cookie refresh failed:", cookieError);
  }
}

if (session && AUDITED_ACTIONS.has(action)) {
  const safeDetails = Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => !["password", "token", "__document"].includes(key)
    )
  );

  await writeAudit(
    session.user.user_id,
    action,
    "api",
    action,
    safeDetails,
    response.status < 400
  );
}

return response;
  } catch (error) {
    if (error instanceof SessionStoreError) {
      console.warn("ELNUBY HR SESSION STORE UNAVAILABLE:", {
        action: requestAction || undefined,
      });
      return Response.json(
        { ok: false, error: "خدمة تسجيل الدخول غير متاحة مؤقتًا. لم يتم تسجيل الخروج.", code: "SESSION_STORE_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Retry-After": "3" } },
      );
    }

    console.error("ELNUBY HR API ERROR:", {
      action: requestAction || undefined,
      error,
    });
    return errorResponse("حدث خطأ داخلي في الخادم", 500);
  }
}
