import { getSession, errorResponse } from "@/server/hr/core"
import { handleAction } from "@/server/hr/router";

export const runtime = "nodejs";

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
      const token = typeof body.token === "string" ? body.token : "";
      session = await getSession(token);
      if (!session) return errorResponse("الجلسة غير صالحة أو منتهية", 401);
    }

    return await handleAction(action, body, session);
  } catch (error) {
    console.error("ELNUBY HR API ERROR:", error);
    return errorResponse("حدث خطأ داخلي في الخادم", 500);
  }
}
