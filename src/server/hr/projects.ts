import { supabase, success, errorResponse, generateId, sha256, passwordHash, nowISO, riyadhDate, riyadhTime, timeToMinutes, minutesBetween, haversineDistance, requireAuth, requireRole, getManagedProjectIds, canManageProject, getCurrentAssignment, getCurrentEmployeeShift } from "./core";
import type { SessionContext, CurrentUser } from "./core";

export async function listProjects(
  session: SessionContext,
  _body: Record<string, unknown> = {},
) {
  let query = supabase
    .from("projects")
    .select("*")
    .order("name");

  if (["PROJECT_MANAGER", "SITE_SUPERVISOR"].includes(session.user.role)) {
    const ids = await getManagedProjectIds(session.user);

    if (!ids.length) {
      return success([]);
    }

    query = query.in("project_id", ids);
  }

  const { data: projects, error } = await query;

  if (error) {
    return errorResponse(
      "تعذر تحميل المشاريع",
      500
    );
  }

  if (!projects?.length) {
    return success([]);
  }

  const projectIds = projects.map((p: any) => p.project_id);

  const [
    managersResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase
      .from("project_managers")
      .select("id,user_id,project_id,start_date,end_date")
      .in("project_id", projectIds)
      .or(`end_date.is.null,end_date.gte.${riyadhDate()}`),

    supabase
      .from("project_assignments")
      .select("assignment_id,employee_id,project_id,start_date,end_date,is_current")
      .in("project_id", projectIds)
      .eq("is_current", true),
  ]);

  if (managersResult.error) {
    console.error("project managers:", managersResult.error);
    return errorResponse(
      "تعذر تحميل مديري المشاريع",
      500
    );
  }

  if (assignmentsResult.error) {
    console.error("project employee assignments:", assignmentsResult.error);
    return errorResponse(
      "تعذر تحميل موظفي المشاريع",
      500
    );
  }

  const managers = managersResult.data || [];
  const assignments = assignmentsResult.data || [];

  const userIds = [...new Set(
    managers.map((m: any) => m.user_id).filter(Boolean)
  )];

  let users: any[] = [];

  if (userIds.length) {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id,employee_id,username,role,status")
      .in("id", userIds);

    if (userError) {
      console.error("project manager users:", userError);
      return errorResponse(
        "تعذر تحميل بيانات مديري المشاريع",
        500
      );
    }

    users = userData || [];
  }

  const userMap = new Map<string, any>(
    users.map((u: any) => [String(u.id), u])
  );

  const managerMap = new Map<string, any[]>();

  for (const manager of managers) {
    const list = managerMap.get(manager.project_id) || [];
    const user = userMap.get(String(manager.user_id));

    list.push({
      id: manager.id,
      user_id: manager.user_id,
      employee_id: user?.employee_id ?? null,
      username: user?.username ?? null,
      name: user?.username ?? user?.employee_id ?? manager.user_id,
      role: user?.role ?? "PROJECT_MANAGER",
      start_date: manager.start_date,
      end_date: manager.end_date,
    });

    managerMap.set(manager.project_id, list);
  }

  const employeeCountMap = new Map<string, number>();

  for (const assignment of assignments) {
    employeeCountMap.set(
      assignment.project_id,
      (employeeCountMap.get(assignment.project_id) || 0) + 1
    );
  }

  return success(
    projects.map((project: any) => ({
      ...project,
      manager_count:
        (managerMap.get(project.project_id) || []).length,
      managers:
        managerMap.get(project.project_id) || [],
      employee_count:
        employeeCountMap.get(project.project_id) || 0,
    }))
  );
}

export async function createProject(
  body: Record<string, unknown>
) {
  const projectId = String(
    body.project_id ||
      generateId("PRJ")
  );

  const name = String(
    body.name || ""
  ).trim();

  if (!name) {
    return errorResponse(
      "اسم المشروع مطلوب"
    );
  }

  const { data, error } =
    await supabase
      .from("projects")
      .insert({
        project_id: projectId,
        name,
        client:
          body.client || null,
        location_name:
          body.location_name ||
          null,
        latitude:
          body.latitude == null
            ? null
            : Number(body.latitude),
        longitude:
          body.longitude == null
            ? null
            : Number(body.longitude),
        geofence_radius_m:
          body.geofence_radius_m ==
          null
            ? 200
            : Number(
                body.geofence_radius_m
              ),
        status:
          body.status || "ACTIVE",
      })
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data,
    201
  );
}

/* =========================================================
   SHIFTS
========================================================= */

