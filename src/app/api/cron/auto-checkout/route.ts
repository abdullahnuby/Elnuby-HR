import { NextResponse } from "next/server";
import { autoCheckoutOpenAttendance } from "@/server/hr/attendance";
import { publicSupabase } from "@/server/hr/core";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret) return NextResponse.json({ ok:false, error:"Cron secret is not configured" }, {status:503});
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await autoCheckoutOpenAttendance();
    await publicSupabase.from("app_sessions").delete().lt("expires_at", new Date().toISOString());
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("AUTO_CHECKOUT_CRON:", error);
    return NextResponse.json({ ok: false, error: "Auto checkout failed" }, { status: 500 });
  }
}
