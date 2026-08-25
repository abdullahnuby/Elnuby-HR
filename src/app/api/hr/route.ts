import { cookies } from "next/headers";
import { getSession, errorResponse, writeAudit } from "@/server/hr/core";
import { handleAction } from "@/server/hr/router";
import { SESSION_COOKIE } from "@/server/hr/auth";

export const runtime = "nodejs";

const AUDITED_ACTIONS = new Set([
  "check_in", "check_out", "create_employee", "create_project", "create_shift",
  "assign_employee_project", "assign_employee_shift", "assign_manager_project",
  "create_user", "create_leave", "decide_leave_manager", "decide_leave_hr",
  "create_permission", "decide_permission", "create_deduction", "update_employee",
  "update_project", "update_shift", "update_user", "delete_user",
]);

export async function GET() {
  return errorResponse("Method not allowed", 405);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    if (!action) return errorResponse("action is required");

    let session = null;
    if (action !== "login") {
      const cookieStore = await cookies();
      const cookieToken = cookieStore.get(SESSION_COOKIE)?.value || "";
      const token = cookieToken;
      session = await getSession(token);
      if (!session) return errorResponse("الجلسة غير صالحة أو منتهية", 401);
    }

    const response = await handleAction(action, body, session);
    if (session && AUDITED_ACTIONS.has(action)) {
      const safeDetails = Object.fromEntries(
        Object.entries(body).filter(([key]) => !["password", "token"].includes(key))
      );
      await writeAudit(session.user.user_id, action, "api", action, safeDetails, response.status < 400);
    }
    return response;
  } catch (error) {
    console.error("ELNUBY HR API ERROR:", error);
    return errorResponse("حدث خطأ داخلي في الخادم", 500);
  }
}
