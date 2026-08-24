import { supabase, success, errorResponse, sha256, nowISO, requireAuth, requireRole, ROLES, ADMIN_ROLES, MANAGEMENT_ROLES, PROJECT_VIEW_ROLES } from "./core";
import type { SessionContext } from "./core";
import { login, getMe } from "./auth";
import { getDashboard, getProjectManagerDashboard } from "./dashboard";
import { listEmployees, createEmployee } from "./employees";
import { listProjects, createProject } from "./projects";
import { listShifts, createShift } from "./shifts";
import { listEmployeeShifts, assignEmployeeShift, assignEmployeeProject, assignManagerProject } from "./assignments";
import { attendanceList, attendanceAction } from "./attendance";
import { leaveList, createLeave, decideLeaveManager, decideLeaveHR } from "./leaves";
import { permissionList, createPermission, decidePermission } from "./permissions";
import { listDeductions, listUsers, createUser } from "./users";

async function handleAction(
  action: string,
  body: Record<string, unknown>,
  session: SessionContext | null
) {
  switch (action) {
    /* AUTH */

    case "login":
      return login(body);

    case "logout": {
      if (!session) {
        return success({
          logged_out: true,
        });
      }

      await supabase
        .from("app_sessions")
        .update({
          revoked_at:
            nowISO(),
        })
        .eq(
          "token_hash",
          sha256(
            session.token
          )
        )
        .is(
          "revoked_at",
          null
        );

      return success({
        logged_out: true,
      });
    }

    case "me": {
      const auth =
        requireAuth(
          session
        );

      if (auth) return auth;

      return getMe(
        session!
      );
    }

    /* DASHBOARD */

    case "dashboard": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return getDashboard(
        session!
      );
    }

    case "project_manager_dashboard": {
      const auth =
        requireRole(
          session,
          ["PROJECT_MANAGER"]
        );

      if (auth) return auth;

      return getProjectManagerDashboard(
        session!
      );
    }

    /* USERS */

    case "users": {
      const auth =
        requireRole(
          session,
          ["SUPER_ADMIN"]
        );

      if (auth) return auth;

      return listUsers();
    }

    case "create_user": {
      const auth =
        requireRole(
          session,
          ["SUPER_ADMIN"]
        );

      if (auth) return auth;

      return createUser(
        session!,
        body
      );
    }

    /* EMPLOYEES */

    case "employees": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return listEmployees(
        session!
      );
    }

    case "create_employee": {
      const auth =
        requireRole(
          session,
          MANAGEMENT_ROLES
        );

      if (auth) return auth;

      return createEmployee(
        session!,
        body
      );
    }

    /* PROJECTS */

    case "projects": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return listProjects(
        session!
      );
    }

    case "create_project": {
      const auth =
        requireRole(
          session,
          MANAGEMENT_ROLES
        );

      if (auth) return auth;

      return createProject(
        body
      );
    }

    /* SHIFTS */

    case "shifts": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return listShifts();
    }

    case "create_shift": {
      const auth =
        requireRole(
          session,
          MANAGEMENT_ROLES
        );

      if (auth) return auth;

      return createShift(
        body
      );
    }

    /* EMPLOYEE SHIFTS */

    case "employee_shifts": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return listEmployeeShifts(
        session!
      );
    }

    case "assign_employee_shift": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return assignEmployeeShift(
        session!,
        body
      );
    }

    /* PROJECT ASSIGNMENT */

    case "assign_employee_project": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return assignEmployeeProject(
        session!,
        body
      );
    }

    case "assign_manager_project": {
      const auth =
        requireRole(
          session,
          MANAGEMENT_ROLES
        );

      if (auth) return auth;

      return assignManagerProject(
        session!,
        body
      );
    }

    /* ATTENDANCE */

    case "attendance_list": {
      const auth =
        requireRole(
          session,
          ROLES
        );

      if (auth) return auth;

      return attendanceList(
        session!
      );
    }

    case "check_in":
    case "check_out": {
      const auth =
        requireRole(
          session,
          ["EMPLOYEE"]
        );

      if (auth) return auth;

      return attendanceAction(
        session!,
        action,
        body
      );
    }

    /* LEAVES */

    case "leave_list": {
      const auth =
        requireRole(
          session,
          ROLES
        );

      if (auth) return auth;

      return leaveList(
        session!
      );
    }

    case "create_leave": {
      const auth =
        requireRole(
          session,
          ["EMPLOYEE"]
        );

      if (auth) return auth;

      return createLeave(
        session!,
        body
      );
    }

    case "decide_leave_manager": {
      const auth =
        requireRole(
          session,
          ["PROJECT_MANAGER"]
        );

      if (auth) return auth;

      return decideLeaveManager(
        session!,
        body
      );
    }

    case "decide_leave_hr": {
      const auth =
        requireRole(
          session,
          MANAGEMENT_ROLES
        );

      if (auth) return auth;

      return decideLeaveHR(
        session!,
        body
      );
    }

    /* PERMISSIONS */

    case "permission_list": {
      const auth =
        requireRole(
          session,
          ROLES
        );

      if (auth) return auth;

      return permissionList(
        session!
      );
    }

    case "create_permission": {
      const auth =
        requireRole(
          session,
          ["EMPLOYEE"]
        );

      if (auth) return auth;

      return createPermission(
        session!,
        body
      );
    }

    case "decide_permission": {
      const auth =
        requireRole(
          session,
          ["PROJECT_MANAGER"]
        );

      if (auth) return auth;

      return decidePermission(
        session!,
        body
      );
    }

    /* DEDUCTIONS */

    case "deductions": {
      const auth =
        requireRole(
          session,
          PROJECT_VIEW_ROLES
        );

      if (auth) return auth;

      return listDeductions(
        session!
      );
    }

    default:
      return errorResponse(
        `Unknown action: ${action}`,
        400
      );
  }
}

