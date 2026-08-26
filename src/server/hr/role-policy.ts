/**
 * Canonical HR role policy.
 *
 * Business rules:
 * - SYSTEM_ADMIN: unrestricted system control.
 * - HR_MANAGER: HR-wide operational control; no system/security administration.
 * - SECTOR_MANAGER: manages assigned sectors/projects; NO attendance/checkout.
 * - PROJECT_MANAGER: is a company employee and therefore HAS attendance/checkout;
 *   additionally manages assigned project operations and its assigned employees.
 *
 * SITE_SUPERVISOR is intentionally not a supported role.
 */

export const HR_ROLES = [
  "SYSTEM_ADMIN",
  "HR_MANAGER",
  "SECTOR_MANAGER",
  "PROJECT_MANAGER",
  "EMPLOYEE",
] as const;

export type HrRole = (typeof HR_ROLES)[number];

export const ROLE_POLICY: Record<HrRole, {
  attendance: boolean;
  checkout: boolean;
  fullSystemCrud: boolean;
  manageUsers: boolean;
  manageSecurity: boolean;
  manageEmployees: boolean;
  manageProjects: boolean;
  manageAssignments: boolean;
  manageLeaves: boolean;
  managePermissions: boolean;
  manageDeductions: boolean;
  viewReports: boolean;
}> = {
  SYSTEM_ADMIN: {
    attendance: true,
    checkout: true,
    fullSystemCrud: true,
    manageUsers: true,
    manageSecurity: true,
    manageEmployees: true,
    manageProjects: true,
    manageAssignments: true,
    manageLeaves: true,
    managePermissions: true,
    manageDeductions: true,
    viewReports: true,
  },
  HR_MANAGER: {
    attendance: true,
    checkout: true,
    fullSystemCrud: false,
    manageUsers: false,
    manageSecurity: false,
    manageEmployees: true,
    manageProjects: false,
    manageAssignments: false,
    manageLeaves: true,
    managePermissions: true,
    manageDeductions: true,
    viewReports: true,
  },
  SECTOR_MANAGER: {
    attendance: false,
    checkout: false,
    fullSystemCrud: false,
    manageUsers: false,
    manageSecurity: false,
    manageEmployees: false,
    manageProjects: true,
    manageAssignments: true,
    manageLeaves: true,
    managePermissions: true,
    manageDeductions: false,
    viewReports: true,
  },
  PROJECT_MANAGER: {
    attendance: true,
    checkout: true,
    fullSystemCrud: false,
    manageUsers: false,
    manageSecurity: false,
    manageEmployees: true,
    manageProjects: true,
    manageAssignments: true,
    manageLeaves: true,
    managePermissions: true,
    manageDeductions: false,
    viewReports: true,
  },
  EMPLOYEE: {
    attendance: true,
    checkout: true,
    fullSystemCrud: false,
    manageUsers: false,
    manageSecurity: false,
    manageEmployees: false,
    manageProjects: false,
    manageAssignments: false,
    manageLeaves: true,
    managePermissions: true,
    manageDeductions: false,
    viewReports: false,
  },
};

export function isSupportedRole(value: unknown): value is HrRole {
  return typeof value === "string" &&
    (HR_ROLES as readonly string[]).includes(value);
}

export function can(role: unknown, permission: keyof typeof ROLE_POLICY[HrRole]): boolean {
  return isSupportedRole(role) && ROLE_POLICY[role][permission];
}

export function hasAttendance(role: unknown): boolean {
  return can(role, "attendance");
}

export function hasCheckout(role: unknown): boolean {
  return can(role, "checkout");
}
