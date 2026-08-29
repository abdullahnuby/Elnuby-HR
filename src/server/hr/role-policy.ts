export const الموارد البشرية_ROLES = ["SYSTEM_ADMIN","الموارد البشرية_MANAGER","SECTOR_MANAGER","PROJECT_MANAGER","EMPLOYEE"] as const;
export type HrRole = typeof الموارد البشرية_ROLES[number];
export const ROLE_POLICY = { SYSTEM_ADMIN:{attendance:false,fullSystemCrud:true}, الموارد البشرية_MANAGER:{attendance:false,fullSystemCrud:false}, SECTOR_MANAGER:{attendance:false,fullSystemCrud:false}, PROJECT_MANAGER:{attendance:true,fullSystemCrud:false}, EMPLOYEE:{attendance:true,fullSystemCrud:false} } as const;
export function isSupportedRole(value: unknown): value is HrRole { return typeof value === "string" && (الموارد البشرية_ROLES as readonly string[]).includes(value); }
export function hasAttendance(value: unknown) { return isSupportedRole(value) && ROLE_POLICY[value].attendance; }
