import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type CurrentUser = {
  user_id: string;
  employee_id: string | null;
  username: string;
  role: string;
  status: string;
};

type SessionContext = {
  token: string;
  user: CurrentUser;
};

const ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "PROJECT_MANAGER",
  "SITE_SUPERVISOR",
  "EMPLOYEE",
];

const ADMIN_ROLES = ["SUPER_ADMIN", "HR_MANAGER"];

const MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
];

const PROJECT_VIEW_ROLES = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "PROJECT_MANAGER",
  "SITE_SUPERVISOR",
];

function success(data: unknown, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    { status }
  );
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status }
  );
}

function generateId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function passwordHash(salt: string, password: string) {
  return crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("base64");
}

function nowISO() {
  return new Date().toISOString();
}

function riyadhDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function riyadhTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) return 0;

  const [hours, minutes] = String(value)
    .substring(0, 5)
    .split(":")
    .map(Number);

  return (hours || 0) * 60 + (minutes || 0);
}

function minutesBetween(start: string, end: string) {
  let a = timeToMinutes(start);
  let b = timeToMinutes(end);

  if (b < a) {
    b += 24 * 60;
  }

  return Math.max(0, b - a);
}

function haversineDistance(
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

async function getSession(
  token: string
): Promise<SessionContext | null> {
  if (!token) return null;

  const tokenHash = sha256(token);

  const { data: session, error: sessionError } = await supabase
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
      "user_id,employee_id,username,role,status"
    )
    .eq("user_id", session.user_id)
    .maybeSingle();

  if (userError || !user) {
    return null;
  }

  if (user.status !== "ACTIVE") {
    return null;
  }

  await supabase
    .from("app_sessions")
    .update({
      last_used_at: nowISO(),
    })
    .eq("session_id", session.session_id);

  return {
    token,
    user: {
      user_id: user.user_id,
      employee_id: user.employee_id ?? null,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  };
}

function requireAuth(
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

function requireRole(
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
   PROJECT ACCESS
========================================================= */

async function getManagedProjectIds(
  user: CurrentUser
): Promise<string[]> {
  if (
    user.role === "SUPER_ADMIN" ||
    user.role === "HR_MANAGER"
  ) {
    const { data } = await supabase
      .from("projects")
      .select("project_id");

    return (data || []).map(
      (row: any) => row.project_id
    );
  }

  if (user.role !== "PROJECT_MANAGER") {
    return [];
  }

  const { data } = await supabase
    .from("project_managers")
    .select("project_id,start_date,end_date")
    .eq("user_id", user.user_id);

  const today = riyadhDate();

  return (data || [])
    .filter((row: any) => {
      if (!row.end_date) return true;

      return row.end_date >= today;
    })
    .map((row: any) => row.project_id);
}

async function canManageProject(
  user: CurrentUser,
  projectId: string
) {
  if (
    user.role === "SUPER_ADMIN" ||
    user.role === "HR_MANAGER"
  ) {
    return true;
  }

  if (user.role !== "PROJECT_MANAGER") {
    return false;
  }

  const projectIds =
    await getManagedProjectIds(user);

  return projectIds.includes(projectId);
}

/* =========================================================
   EMPLOYEE CURRENT ASSIGNMENT
========================================================= */

async function getCurrentAssignment(
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

async function getCurrentEmployeeShift(
  employeeId: string,
  projectId: string
) {
  const today = riyadhDate();

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

async function login(
  body: Record<string, unknown>
) {
  const username = String(
    body.username || ""
  ).trim();

  const password = String(
    body.password || ""
  );

  if (!username || !password) {
    return errorResponse(
      "اسم المستخدم وكلمة المرور مطلوبان"
    );
  }

  const { data: user, error } =
    await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

  if (error || !user) {
    return errorResponse(
      "اسم المستخدم أو كلمة المرور غير صحيحة",
      401
    );
  }

  if (user.status !== "ACTIVE") {
    return errorResponse(
      "الحساب غير نشط",
      403
    );
  }

  const storedHash = String(
    user.password_hash || ""
  );

  const separatorIndex =
    storedHash.indexOf("$");

  if (separatorIndex <= 0) {
    console.error(
      "Invalid password_hash format for user:",
      user.user_id
    );

    return errorResponse(
      "بيانات كلمة المرور للحساب غير صالحة",
      500
    );
  }

  const salt = storedHash.substring(
    0,
    separatorIndex
  );

  const expectedHash =
    storedHash.substring(
      separatorIndex + 1
    );

  const actualHash =
    passwordHash(salt, password);

  if (actualHash !== expectedHash) {
    await supabase
      .from("users")
      .update({
        failed_attempts:
          Number(user.failed_attempts || 0) + 1,
      })
      .eq("user_id", user.user_id);

    return errorResponse(
      "اسم المستخدم أو كلمة المرور غير صحيحة",
      401
    );
  }

  const token = crypto.randomUUID();

  const sessionId = generateId("SES");

  const { error: sessionError } =
    await supabase
      .from("app_sessions")
      .insert({
        session_id: sessionId,
        token_hash: sha256(token),
        user_id: user.user_id,
        expires_at: new Date(
          Date.now() +
            7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        last_used_at: nowISO(),
      });

  if (sessionError) {
    console.error(
      "create session:",
      sessionError
    );

    return errorResponse(
      "تعذر إنشاء جلسة الدخول",
      500
    );
  }

  await supabase
    .from("users")
    .update({
      last_login: nowISO(),
      failed_attempts: 0,
    })
    .eq("user_id", user.user_id);

  return success({
    token,
    user: {
      user_id: user.user_id,
      employee_id:
        user.employee_id ?? null,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  });
}

/* =========================================================
   ME
========================================================= */

async function getMe(
  session: SessionContext
) {
  const employeeId =
    session.user.employee_id;

  let employee = null;
  let project = null;
  let shift = null;

  if (employeeId) {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    employee = data;

    const assignment =
      await getCurrentAssignment(
        employeeId
      );

    if (assignment) {
      const { data: projectData } =
        await supabase
          .from("projects")
          .select("*")
          .eq(
            "project_id",
            assignment.project_id
          )
          .maybeSingle();

      project = projectData;

      if (project) {
        const employeeShift =
          await getCurrentEmployeeShift(
            employeeId,
            project.project_id
          );

        shift =
          employeeShift?.shifts ||
          null;
      }
    }
  }

  return success({
    user: {
      user_id:
        session.user.user_id,
      employee_id:
        session.user.employee_id,
      username:
        session.user.username,
      role: session.user.role,
      status:
        session.user.status,
    },
    employee,
    project,
    shift,
  });
}

/* =========================================================
   DASHBOARD
========================================================= */

async function getDashboard(
  session: SessionContext
) {
  const today = riyadhDate();

  let employeeIds: string[] = [];

  if (
    session.user.role === "EMPLOYEE"
  ) {
    if (session.user.employee_id) {
      employeeIds = [
        session.user.employee_id,
      ];
    }
  } else if (
    session.user.role ===
    "PROJECT_MANAGER"
  ) {
    const projectIds =
      await getManagedProjectIds(
        session.user
      );

    if (projectIds.length) {
      const { data } =
        await supabase
          .from("project_assignments")
          .select("employee_id")
          .in(
            "project_id",
            projectIds
          )
          .eq(
            "is_current",
            true
          );

      employeeIds = [
        ...new Set(
          (data || []).map(
            (row: any) =>
              row.employee_id
          )
        ),
      ];
    }
  } else {
    const { data } =
      await supabase
        .from("employees")
        .select("employee_id");

    employeeIds =
      (data || []).map(
        (row: any) =>
          row.employee_id
      );
  }

  if (!employeeIds.length) {
    return success({
      employees: 0,
      present: 0,
      late: 0,
      missingCheckout: 0,
      serverTime: nowISO(),
    });
  }

  const { data: attendance } =
    await supabase
      .from("attendance")
      .select(
        "attendance_id,employee_id,status,check_in,check_out"
      )
      .eq("date", today)
      .in(
        "employee_id",
        employeeIds
      );

  const rows =
    attendance || [];

  return success({
    employees:
      employeeIds.length,

    present:
      rows.length,

    late:
      rows.filter(
        (row: any) =>
          row.status === "LATE"
      ).length,

    missingCheckout:
      rows.filter(
        (row: any) =>
          !row.check_out
      ).length,

    serverTime:
      nowISO(),
  });
}

/* =========================================================
   PROJECT MANAGER DASHBOARD
========================================================= */

async function getProjectManagerDashboard(
  session: SessionContext
) {
  const projectIds =
    await getManagedProjectIds(
      session.user
    );

  if (!projectIds.length) {
    return success({
      summary: {
        employees: 0,
        present: 0,
        late: 0,
        onLeave: 0,
        absent: 0,
        pendingLeaves: 0,
        pendingPermissions: 0,
      },
      projects: [],
      team: [],
      pendingLeaves: [],
      pendingPermissions: [],
    });
  }

  const [
    projectsResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .in(
        "project_id",
        projectIds
      ),

    supabase
      .from("project_assignments")
      .select("*")
      .in(
        "project_id",
        projectIds
      )
      .eq(
        "is_current",
        true
      ),
  ]);

  const projects =
    projectsResult.data || [];

  const assignments =
    assignmentsResult.data || [];

  const employeeIds = [
    ...new Set(
      assignments.map(
        (row: any) =>
          row.employee_id
      )
    ),
  ];

  let employees: any[] = [];

  if (employeeIds.length) {
    const { data } =
      await supabase
        .from("employees")
        .select("*")
        .in(
          "employee_id",
          employeeIds
        );

    employees = data || [];
  }

  const today = riyadhDate();

  const [
    attendanceResult,
    leaveResult,
    permissionResult,
  ] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("date", today)
      .in(
        "project_id",
        projectIds
      ),

    supabase
      .from("leave_requests")
      .select("*")
      .in(
        "project_id",
        projectIds
      )
      .in(
        "status",
        [
          "PENDING_MANAGER",
          "PENDING_HR",
          "APPROVED",
        ]
      ),

    supabase
      .from("permission_requests")
      .select("*")
      .in(
        "project_id",
        projectIds
      )
      .eq(
        "status",
        "PENDING"
      ),
  ]);

  const attendance =
    attendanceResult.data || [];

  const leaves =
    leaveResult.data || [];

  const permissions =
    permissionResult.data || [];

  const presentEmployees =
    new Set(
      attendance.map(
        (row: any) =>
          row.employee_id
      )
    );

  const employeesOnLeave =
    new Set(
      leaves
        .filter(
          (row: any) =>
            row.status ===
              "APPROVED" &&
            row.from_date <=
              today &&
            row.to_date >=
              today
        )
        .map(
          (row: any) =>
            row.employee_id
        )
    );

  const absentEmployees =
    employeeIds.filter(
      (employeeId) =>
        !presentEmployees.has(
          employeeId
        ) &&
        !employeesOnLeave.has(
          employeeId
        )
    );

  return success({
    summary: {
      employees:
        employeeIds.length,

      present:
        attendance.length,

      late:
        attendance.filter(
          (row: any) =>
            row.status === "LATE"
        ).length,

      onLeave:
        employeesOnLeave.size,

      absent:
        absentEmployees.length,

      pendingLeaves:
        leaves.filter(
          (row: any) =>
            row.status ===
            "PENDING_MANAGER"
        ).length,

      pendingPermissions:
        permissions.length,
    },

    projects,

    team: employees.map(
      (employee: any) => ({
        ...employee,
        assignment:
          assignments.find(
            (assignment: any) =>
              assignment.employee_id ===
              employee.employee_id
          ) || null,
        attendance:
          attendance.find(
            (attendanceRow: any) =>
              attendanceRow.employee_id ===
              employee.employee_id
          ) || null,
      })
    ),

    pendingLeaves:
      leaves.filter(
        (row: any) =>
          row.status !==
          "APPROVED"
      ),

    pendingPermissions:
      permissions,
  });
}

/* =========================================================
   EMPLOYEES
========================================================= */

async function listEmployees(
  session: SessionContext
) {
  let employeeIds: string[] | null = null;

  if (session.user.role === "PROJECT_MANAGER") {
    const projectIds = await getManagedProjectIds(session.user);

    if (!projectIds.length) {
      return success([]);
    }

    const { data: assignments, error: assignmentError } =
      await supabase
        .from("project_assignments")
        .select("employee_id")
        .in("project_id", projectIds)
        .eq("is_current", true);

    if (assignmentError) {
      console.error("employees assignments:", assignmentError);
      return errorResponse("تعذر تحميل ربط الموظفين بالمشروعات", 500);
    }

    employeeIds = [
      ...new Set(
        (assignments || [])
          .map((row: any) => row.employee_id)
          .filter(Boolean)
      ),
    ];
  }

  let employeeQuery = supabase
    .from("employees")
    .select("*")
    .order("name");

  if (employeeIds !== null) {
    if (!employeeIds.length) {
      return success([]);
    }

    employeeQuery = employeeQuery.in(
      "employee_id",
      employeeIds
    );
  }

  const {
    data: employees,
    error: employeeError,
  } = await employeeQuery;

  if (employeeError) {
    console.error("employees:", employeeError);

    return errorResponse(
      "تعذر تحميل الموظفين",
      500
    );
  }

  if (!employees?.length) {
    return success([]);
  }

  const ids = employees
    .map((employee: any) => employee.employee_id)
    .filter(Boolean);

  const today = riyadhDate();

  const [
    assignmentsResult,
    shiftsResult,
  ] = await Promise.all([
    supabase
      .from("project_assignments")
      .select(
        "assignment_id,employee_id,project_id,start_date,end_date,is_current"
      )
      .in("employee_id", ids)
      .eq("is_current", true),

    supabase
      .from("employee_shifts")
      .select(
        `
        assignment_id,
        employee_id,
        project_id,
        shift_id,
        start_date,
        end_date,
        shifts(*)
        `
      )
      .in("employee_id", ids)
      .lte("start_date", today)
      .or(
        `end_date.is.null,end_date.gte.${today}`
      )
      .order("start_date", {
        ascending: false,
      }),
  ]);

  if (assignmentsResult.error) {
    console.error(
      "employee project assignments:",
      assignmentsResult.error
    );

    return errorResponse(
      "تعذر تحميل مشروعات الموظفين",
      500
    );
  }

  if (shiftsResult.error) {
    console.error(
      "employee shifts:",
      shiftsResult.error
    );

    return errorResponse(
      "تعذر تحميل ورديات الموظفين",
      500
    );
  }

  const assignments =
    assignmentsResult.data || [];

  const shifts =
    shiftsResult.data || [];

  const projectIds = [
    ...new Set(
      assignments
        .map((row: any) => row.project_id)
        .filter(Boolean)
    ),
  ];

  let projects: any[] = [];

  if (projectIds.length) {
    const {
      data: projectData,
      error: projectError,
    } = await supabase
      .from("projects")
      .select(
        `
        project_id,
        name,
        client,
        location_name,
        latitude,
        longitude,
        geofence_radius_m,
        status
        `
      )
      .in("project_id", projectIds);

    if (projectError) {
      console.error(
        "employee projects:",
        projectError
      );

      return errorResponse(
        "تعذر تحميل بيانات المشروعات",
        500
      );
    }

    projects = projectData || [];
  }

  const assignmentMap = new Map<
    string,
    any
  >();

  for (const assignment of assignments) {
    if (
      !assignmentMap.has(
        assignment.employee_id
      )
    ) {
      assignmentMap.set(
        assignment.employee_id,
        assignment
      );
    }
  }

  const shiftMap = new Map<
    string,
    any
  >();

  for (const employeeShift of shifts) {
    if (
      !shiftMap.has(
        employeeShift.employee_id
      )
    ) {
      shiftMap.set(
        employeeShift.employee_id,
        employeeShift
      );
    }
  }

  const projectMap = new Map<
    string,
    any
  >();

  for (const project of projects) {
    projectMap.set(
      project.project_id,
      project
    );
  }

  const result = employees.map(
    (employee: any) => {
      const assignment =
        assignmentMap.get(
          employee.employee_id
        ) || null;

      const project =
        assignment
          ? projectMap.get(
              assignment.project_id
            ) || null
          : null;

      const employeeShift =
        shiftMap.get(
          employee.employee_id
        ) || null;

      const shift =
        employeeShift?.shifts ||
        null;

      return {
        ...employee,

        project_id:
          assignment?.project_id ??
          null,

        project_name:
          project?.name ??
          null,

        current_project_name:
          project?.name ??
          null,

        assignment_start:
          assignment?.start_date ??
          null,

        assignment_id:
          assignment?.assignment_id ??
          null,

        shift_id:
          employeeShift?.shift_id ??
          null,

        shift_name:
          shift?.name ??
          null,

        shift_start:
          shift?.start_time ??
          null,

        attendance_open:
          shift?.attendance_open ??
          null,

        attendance_close:
          shift?.attendance_close ??
          null,

        checkout_open:
          shift?.checkout_open ??
          null,

        checkout_close:
          shift?.checkout_close ??
          null,

        auto_checkout_time:
          shift?.auto_checkout_time ??
          null,
      };
    }
  );

  return success(result);
}

/* =========================================================
   CREATE EMPLOYEE
========================================================= */

async function createEmployee(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId = String(
    body.employee_id ||
      generateId("EMP")
  );

  const name = String(
    body.name || ""
  ).trim();

  if (!name) {
    return errorResponse(
      "اسم الموظف مطلوب"
    );
  }

  const { data: existing } =
    await supabase
      .from("employees")
      .select("employee_id")
      .eq(
        "employee_id",
        employeeId
      )
      .maybeSingle();

  if (existing) {
    return errorResponse(
      "رقم الموظف موجود بالفعل"
    );
  }

  const { data: employee, error } =
    await supabase
      .from("employees")
      .insert({
        employee_id: employeeId,
        name,
        job_title:
          body.job_title || null,
        department:
          body.department || null,
        phone:
          body.phone || null,
        national_id:
          body.national_id || null,
        birth_date:
          body.birth_date || null,
        hire_date:
          body.hire_date || null,
        status:
          body.status || "ACTIVE",
      })
      .select("*")
      .single();

  if (error) {
    console.error(
      "create_employee:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  const projectId = body.project_id
    ? String(body.project_id)
    : "";

  const shiftId = body.shift_id
    ? String(body.shift_id)
    : "";

  const startDate = String(
    body.start_date ||
      riyadhDate()
  );

  if (projectId) {
    const { data: project } =
      await supabase
        .from("projects")
        .select("project_id")
        .eq(
          "project_id",
          projectId
        )
        .maybeSingle();

    if (!project) {
      return errorResponse(
        "المشروع غير موجود"
      );
    }

    const { error: assignmentError } =
      await supabase
        .from("project_assignments")
        .insert({
          assignment_id:
            generateId("ASN"),
          employee_id:
            employeeId,
          project_id:
            projectId,
          start_date:
            startDate,
          is_current:
            true,
          created_by:
            session.user.user_id,
          created_at:
            nowISO(),
        });

    if (assignmentError) {
      console.error(
        "employee assignment:",
        assignmentError
      );

      return errorResponse(
        `تم إنشاء الموظف لكن فشل تعيين المشروع: ${assignmentError.message}`,
        500
      );
    }

    if (shiftId) {
      const { data: shift } =
        await supabase
          .from("shifts")
          .select("shift_id")
          .eq(
            "shift_id",
            shiftId
          )
          .maybeSingle();

      if (!shift) {
        return errorResponse(
          "الوردية غير موجودة"
        );
      }

      const { error: shiftError } =
        await supabase
          .from("employee_shifts")
          .insert({
            assignment_id:
              generateId("ESH"),
            employee_id:
              employeeId,
            project_id:
              projectId,
            shift_id:
              shiftId,
            start_date:
              startDate,
            end_date:
              null,
            created_by:
              session.user.user_id,
            created_at:
              nowISO(),
          });

      if (shiftError) {
        console.error(
          "employee shift:",
          shiftError
        );

        return errorResponse(
          `تم إنشاء الموظف والمشروع لكن فشل تعيين الوردية: ${shiftError.message}`,
          500
        );
      }
    }
  }

  return success(
    employee,
    201
  );
}

/* =========================================================
   PROJECTS
========================================================= */

async function listProjects(
  session: SessionContext
) {
  let query = supabase
    .from("projects")
    .select("*")
    .order("name");

  if (session.user.role === "PROJECT_MANAGER") {
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
      .select("user_id,employee_id,username,role,status")
      .in("user_id", userIds);

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
    users.map((u: any) => [String(u.user_id), u])
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

async function createProject(
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

async function listShifts() {
  const { data, error } =
    await supabase
      .from("shifts")
      .select("*")
      .order("name");

  if (error) {
    return errorResponse(
      "تعذر تحميل الورديات",
      500
    );
  }

  return success(data || []);
}

async function createShift(
  body: Record<string, unknown>
) {
  const name = String(
    body.name || ""
  ).trim();

  if (!name) {
    return errorResponse(
      "اسم الوردية مطلوب"
    );
  }

  const required = [
    "start_time",
    "attendance_open",
    "attendance_close",
    "checkout_open",
    "checkout_close",
    "auto_checkout_time",
  ];

  for (const field of required) {
    if (!body[field]) {
      return errorResponse(
        `الحقل ${field} مطلوب`
      );
    }
  }

  const { data, error } =
    await supabase
      .from("shifts")
      .insert({
        shift_id:
          String(
            body.shift_id ||
              generateId("SHF")
          ),
        name,
        start_time:
          String(
            body.start_time
          ),
        attendance_open:
          String(
            body.attendance_open
          ),
        attendance_close:
          String(
            body.attendance_close
          ),
        checkout_open:
          String(
            body.checkout_open
          ),
        checkout_close:
          String(
            body.checkout_close
          ),
        auto_checkout_time:
          String(
            body.auto_checkout_time
          ),
        status:
          body.status ||
          "ACTIVE",
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
   EMPLOYEE SHIFTS
========================================================= */

async function listEmployeeShifts(
  session: SessionContext
) {
  let query = supabase
    .from("employee_shifts")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(1000);

  if (session.user.role === "PROJECT_MANAGER") {
    const ids = await getManagedProjectIds(session.user);

    if (!ids.length) {
      return success([]);
    }

    query = query.in("project_id", ids);
  }

  if (session.user.role === "EMPLOYEE") {
    if (!session.user.employee_id) {
      return success([]);
    }

    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  const { data: assignments, error } = await query;

  if (error) {
    console.error("employee_shifts:", error);

    return errorResponse(
      error.message,
      500
    );
  }

  if (!assignments?.length) {
    return success([]);
  }

  const employeeIds = [...new Set(
    assignments.map((r: any) => r.employee_id).filter(Boolean)
  )];

  const projectIds = [...new Set(
    assignments.map((r: any) => r.project_id).filter(Boolean)
  )];

  const shiftIds = [...new Set(
    assignments.map((r: any) => r.shift_id).filter(Boolean)
  )];

  const [employeesResult, projectsResult, shiftsResult] =
    await Promise.all([
      employeeIds.length
        ? supabase
            .from("employees")
            .select("employee_id,name,job_title,department,status")
            .in("employee_id", employeeIds)
        : Promise.resolve({ data: [], error: null } as any),

      projectIds.length
        ? supabase
            .from("projects")
            .select("project_id,name,location_name,status")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [], error: null } as any),

      shiftIds.length
        ? supabase
            .from("shifts")
            .select("*")
            .in("shift_id", shiftIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

  if (employeesResult.error || projectsResult.error || shiftsResult.error) {
    console.error(
      "employee shift lookup:",
      employeesResult.error ||
        projectsResult.error ||
        shiftsResult.error
    );

    return errorResponse(
      "تعذر تحميل تفاصيل تعيينات الورديات",
      500
    );
  }

  const employeeMap = new Map(
    (employeesResult.data || []).map((e: any) => [e.employee_id, e])
  );

  const projectMap = new Map(
    (projectsResult.data || []).map((p: any) => [p.project_id, p])
  );

  const shiftMap = new Map(
    (shiftsResult.data || []).map((s: any) => [s.shift_id, s])
  );

  return success(
    assignments.map((row: any) => {
      const employee = employeeMap.get(row.employee_id);
      const project = projectMap.get(row.project_id);
      const shift = shiftMap.get(row.shift_id);

      return {
        ...row,
        employee_name: employee?.name ?? row.employee_id,
        job_title: employee?.job_title ?? null,
        department: employee?.department ?? null,
        employee_status: employee?.status ?? null,
        project_name: project?.name ?? row.project_id,
        project_location: project?.location_name ?? null,
        project_status: project?.status ?? null,
        shift_name: shift?.name ?? row.shift_id,
        shift_start: shift?.start_time ?? null,
        attendance_open: shift?.attendance_open ?? null,
        attendance_close: shift?.attendance_close ?? null,
        checkout_open: shift?.checkout_open ?? null,
        checkout_close: shift?.checkout_close ?? null,
        auto_checkout_time: shift?.auto_checkout_time ?? null,
        assignment_status: row.end_date ? "HISTORY" : "CURRENT",
      };
    })
  );
}

async function assignEmployeeShift(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId = String(
    body.employee_id || ""
  );

  const projectId = String(
    body.project_id || ""
  );

  const shiftId = String(
    body.shift_id || ""
  );

  if (
    !employeeId ||
    !projectId ||
    !shiftId
  ) {
    return errorResponse(
      "الموظف والمشروع والوردية مطلوبة"
    );
  }

  if (!(await canManageProject(session.user, projectId))) {
    return errorResponse(
      "ليس لديك صلاحية إدارة موظفين وورديات هذا المشروع",
      403
    );
  }

  // Validate employee
  const { data: employee } =
    await supabase
      .from("employees")
      .select("employee_id")
      .eq(
        "employee_id",
        employeeId
      )
      .maybeSingle();

  if (!employee) {
    return errorResponse(
      "الموظف غير موجود"
    );
  }

  // Validate project
  const { data: project } =
    await supabase
      .from("projects")
      .select("project_id")
      .eq(
        "project_id",
        projectId
      )
      .maybeSingle();

  if (!project) {
    return errorResponse(
      "المشروع غير موجود"
    );
  }

  // Validate shift
  const { data: shift } =
    await supabase
      .from("shifts")
      .select("shift_id")
      .eq(
        "shift_id",
        shiftId
      )
      .maybeSingle();

  if (!shift) {
    return errorResponse(
      "الوردية غير موجودة"
    );
  }

  /*
   * IMPORTANT:
   * Employee must have a current project assignment.
   */

  let {
    data: currentProject,
    error: currentProjectError,
  } = await supabase
    .from("project_assignments")
    .select(
      "assignment_id,project_id"
    )
    .eq(
      "employee_id",
      employeeId
    )
    .eq(
      "is_current",
      true
    )
    .maybeSingle();

  if (currentProjectError) {
    console.error(
      "current project assignment:",
      currentProjectError
    );

    return errorResponse(
      currentProjectError.message,
      500
    );
  }

  /*
   * If employee is currently assigned
   * to another project, close it.
   */
  if (
    currentProject &&
    currentProject.project_id !==
      projectId
  ) {
    const { error } =
      await supabase
        .from("project_assignments")
        .update({
          is_current: false,
          end_date: riyadhDate(),
        })
        .eq(
          "assignment_id",
          currentProject.assignment_id
        );

    if (error) {
      console.error(
        "close old project assignment:",
        error
      );

      return errorResponse(
        error.message,
        500
      );
    }
  }

  /*
   * Create project assignment if
   * employee doesn't already have the
   * requested project as current.
   */
  if (
    !currentProject ||
    currentProject.project_id !==
      projectId
  ) {
    const {
      data: projectAssignment,
      error: projectAssignmentError,
    } = await supabase
      .from("project_assignments")
      .insert({
        assignment_id:
          generateId("ASN"),

        employee_id:
          employeeId,

        project_id:
          projectId,

        start_date:
          String(
            body.start_date ||
              riyadhDate()
          ),

        end_date:
          body.end_date ||
          null,

        is_current:
          true,

        created_by:
          session.user.user_id,

        created_at:
          nowISO(),
      })
      .select("*")
      .single();

    if (projectAssignmentError) {
      console.error(
        "create project assignment:",
        projectAssignmentError
      );

      return errorResponse(
        projectAssignmentError.message,
        500
      );
    }

    currentProject = projectAssignment;
  }

  /*
   * Close previous active shifts
   * for this employee.
   */
  const {
    error: closeShiftError,
  } = await supabase
    .from("employee_shifts")
    .update({
      end_date:
        riyadhDate(),
    })
    .eq(
      "employee_id",
      employeeId
    )
    .is(
      "end_date",
      null
    );

  if (closeShiftError) {
    console.error(
      "close employee shifts:",
      closeShiftError
    );

    return errorResponse(
      closeShiftError.message,
      500
    );
  }

  /*
   * Create the new active shift.
   */
  const {
    data,
    error,
  } = await supabase
    .from("employee_shifts")
    .insert({
      assignment_id:
        generateId("ESH"),

      employee_id:
        employeeId,

      project_id:
        projectId,

      shift_id:
        shiftId,

      start_date:
        String(
          body.start_date ||
            riyadhDate()
        ),

      end_date:
        body.end_date ||
        null,

      created_by:
        session.user.user_id,

      created_at:
        nowISO(),
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "assign employee shift:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  return success({
    project_assignment:
      currentProject,

    shift_assignment:
      data,
  });
}

/* =========================================================
   PROJECT ASSIGNMENT
========================================================= */

async function assignEmployeeProject(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId = String(
    body.employee_id || ""
  );

  const projectId = String(
    body.project_id || ""
  );

  if (!employeeId || !projectId) {
    return errorResponse(
      "الموظف والمشروع مطلوبان"
    );
  }

  if (!(await canManageProject(session.user, projectId))) {
    return errorResponse(
      "ليس لديك صلاحية إدارة موظفين هذا المشروع",
      403
    );
  }

  const { data: project } =
    await supabase
      .from("projects")
      .select("project_id")
      .eq(
        "project_id",
        projectId
      )
      .maybeSingle();

  if (!project) {
    return errorResponse(
      "المشروع غير موجود"
    );
  }

  await supabase
    .from("project_assignments")
    .update({
      is_current: false,
      end_date:
        riyadhDate(),
    })
    .eq(
      "employee_id",
      employeeId
    )
    .eq(
      "is_current",
      true
    );

  const { data, error } =
    await supabase
      .from("project_assignments")
      .insert({
        assignment_id:
          generateId("ASN"),
        employee_id:
          employeeId,
        project_id:
          projectId,
        start_date:
          String(
            body.start_date ||
              riyadhDate()
          ),
        end_date:
          body.end_date ||
          null,
        is_current:
          true,
        created_by:
          session.user.user_id,
        created_at:
          nowISO(),
      })
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  if (body.shift_id) {
    await supabase
      .from("employee_shifts")
      .update({
        end_date:
          riyadhDate(),
      })
      .eq(
        "employee_id",
        employeeId
      )
      .is(
        "end_date",
        null
      );

    const { error: shiftError } =
      await supabase
        .from("employee_shifts")
        .insert({
          assignment_id:
            generateId("ESH"),
          employee_id:
            employeeId,
          project_id:
            projectId,
          shift_id:
            String(
              body.shift_id
            ),
          start_date:
            String(
              body.start_date ||
                riyadhDate()
            ),
          end_date:
            null,
          created_by:
            session.user.user_id,
          created_at:
            nowISO(),
        });

    if (shiftError) {
      return errorResponse(
        `تم تعيين المشروع لكن فشل تعيين الوردية: ${shiftError.message}`,
        500
      );
    }
  }

  return success(data);
}

/* =========================================================
   PROJECT MANAGER ASSIGNMENT
========================================================= */

async function assignManagerProject(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const userId = String(
    body.user_id || ""
  );

  const projectId = String(
    body.project_id || ""
  );

  if (!userId || !projectId) {
    return errorResponse(
      "المستخدم والمشروع مطلوبان"
    );
  }

  const { data: user } =
    await supabase
      .from("users")
      .select(
        "user_id,role"
      )
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

  if (!user) {
    return errorResponse(
      "المستخدم غير موجود"
    );
  }

  if (
    user.role !==
    "PROJECT_MANAGER"
  ) {
    return errorResponse(
      "المستخدم ليس مدير مشروع"
    );
  }

  const { data: project } =
    await supabase
      .from("projects")
      .select("project_id")
      .eq(
        "project_id",
        projectId
      )
      .maybeSingle();

  if (!project) {
    return errorResponse(
      "المشروع غير موجود"
    );
  }

  const { data: existing } =
    await supabase
      .from("project_managers")
      .select("id")
      .eq(
        "user_id",
        userId
      )
      .eq(
        "project_id",
        projectId
      )
      .is(
        "end_date",
        null
      )
      .maybeSingle();

  if (existing) {
    return success(
      existing
    );
  }

  const { data, error } =
    await supabase
      .from("project_managers")
      .insert({
        id:
          generateId("PM"),
        user_id:
          userId,
        project_id:
          projectId,
        start_date:
          String(
            body.start_date ||
              riyadhDate()
          ),
        end_date:
          body.end_date ||
          null,
        created_at:
          nowISO(),
      })
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   ATTENDANCE LIST
========================================================= */

async function attendanceList(
  session: SessionContext
) {
  let query = supabase
    .from("attendance")
    .select("*")
    .order(
      "date",
      {
        ascending: false,
      }
    )
    .order(
      "check_in",
      {
        ascending: false,
      }
    )
    .limit(500);

  if (
    session.user.role ===
    "EMPLOYEE"
  ) {
    if (
      !session.user.employee_id
    ) {
      return success([]);
    }

    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  if (
    session.user.role ===
    "PROJECT_MANAGER"
  ) {
    const ids =
      await getManagedProjectIds(
        session.user
      );

    if (!ids.length) {
      return success([]);
    }

    query = query.in(
      "project_id",
      ids
    );
  }

  const { data, error } =
    await query;

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

/* =========================================================
   GPS ATTENDANCE
========================================================= */

async function attendanceAction(
  session: SessionContext,
  action: string,
  body: Record<string, unknown>
) {
  if (
    session.user.role !==
    "EMPLOYEE"
  ) {
    return errorResponse(
      "فقط الموظف يستطيع تسجيل الحضور والانصراف",
      403
    );
  }

  const employeeId =
    session.user.employee_id;

  if (!employeeId) {
    return errorResponse(
      "الحساب غير مرتبط بموظف"
    );
  }

  const assignment =
    await getCurrentAssignment(
      employeeId
    );

  if (!assignment) {
    return errorResponse(
      "لا يوجد مشروع حالي للموظف"
    );
  }

  const { data: project } =
    await supabase
      .from("projects")
      .select("*")
      .eq(
        "project_id",
        assignment.project_id
      )
      .maybeSingle();

  if (!project) {
    return errorResponse(
      "المشروع الحالي غير موجود"
    );
  }

  const employeeShift =
    await getCurrentEmployeeShift(
      employeeId,
      assignment.project_id
    );

  if (!employeeShift) {
    return errorResponse(
      "لا توجد وردية حالية للموظف"
    );
  }

  const shift =
    employeeShift.shifts;

  if (!shift) {
    return errorResponse(
      "الوردية غير موجودة"
    );
  }

  const latitude = Number(
    body.latitude
  );

  const longitude = Number(
    body.longitude
  );

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    return errorResponse(
      "إحداثيات GPS غير صحيحة"
    );
  }

  if (
    project.latitude == null ||
    project.longitude == null
  ) {
    return errorResponse(
      "موقع المشروع غير محدد"
    );
  }

  const distance =
    haversineDistance(
      latitude,
      longitude,
      Number(project.latitude),
      Number(project.longitude)
    );

  const radius = Number(
    project.geofence_radius_m ||
      0
  );

  if (
    radius > 0 &&
    distance > radius
  ) {
    return errorResponse(
      `أنت خارج نطاق موقع المشروع (${Math.round(
        distance
      )} متر)`
    );
  }

  const today =
    riyadhDate();

  const currentTime =
    riyadhTime();

  const { data: existing } =
    await supabase
      .from("attendance")
      .select("*")
      .eq(
        "employee_id",
        employeeId
      )
      .eq(
        "date",
        today
      )
      .maybeSingle();

  /* ======================
     CHECK IN
  ====================== */

  if (
    action === "check_in"
  ) {
    if (
      existing?.check_in
    ) {
      return errorResponse(
        "تم تسجيل الحضور بالفعل"
      );
    }

    const current =
      timeToMinutes(
        currentTime
      );

    const open =
      timeToMinutes(
        shift.attendance_open
      );

    const close =
      timeToMinutes(
        shift.attendance_close
      );

    if (
      current < open ||
      current > close
    ) {
      return errorResponse(
        "الحضور غير متاح في هذا الوقت"
      );
    }

    const shiftStart =
      timeToMinutes(
        shift.start_time
      );

    const isLate =
      current > shiftStart;

    const lateMinutes =
      isLate
        ? Math.max(
            0,
            current -
              shiftStart
          )
        : 0;

    const { data, error } =
      await supabase
        .from("attendance")
        .insert({
          attendance_id:
            generateId("ATT"),
          employee_id:
            employeeId,
          project_id:
            assignment.project_id,
          shift_id:
            employeeShift.shift_id,
          date:
            today,
          check_in:
            currentTime,
          check_in_lat:
            latitude,
          check_in_lng:
            longitude,
          check_in_distance_m:
            Math.round(
              distance
            ),
          status:
            isLate
              ? "LATE"
              : "PRESENT",
          late_minutes:
            lateMinutes,
          created_at:
            nowISO(),
        })
        .select("*")
        .single();

    if (error) {
      console.error(
        "check_in:",
        error
      );

      return errorResponse(
        error.message,
        500
      );
    }

    return success(data);
  }

  /* ======================
     CHECK OUT
  ====================== */

  if (!existing?.check_in) {
    return errorResponse(
      "لم يتم تسجيل الحضور"
    );
  }

  if (
    existing.check_out
  ) {
    return errorResponse(
      "تم تسجيل الانصراف بالفعل"
    );
  }

  const current =
    timeToMinutes(
      currentTime
    );

  const open =
    timeToMinutes(
      shift.checkout_open
    );

  const close =
    timeToMinutes(
      shift.checkout_close
    );

  if (
    current < open ||
    current > close
  ) {
    return errorResponse(
      "الانصراف غير متاح في هذا الوقت"
    );
  }

  const workedMinutes =
    minutesBetween(
      String(
        existing.check_in
      ),
      currentTime
    );

  const { data, error } =
    await supabase
      .from("attendance")
      .update({
        check_out:
          currentTime,
        check_out_lat:
          latitude,
        check_out_lng:
          longitude,
        check_out_distance_m:
          Math.round(
            distance
          ),
        worked_minutes:
          workedMinutes,
        updated_at:
          nowISO(),
      })
      .eq(
        "attendance_id",
        existing.attendance_id
      )
      .select("*")
      .single();

  if (error) {
    console.error(
      "check_out:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   LEAVE LIST
========================================================= */

async function leaveList(
  session: SessionContext
) {
  let query = supabase
    .from("leave_requests")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(500);

  if (
    session.user.role ===
    "EMPLOYEE"
  ) {
    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  if (
    session.user.role ===
    "PROJECT_MANAGER"
  ) {
    const ids =
      await getManagedProjectIds(
        session.user
      );

    if (!ids.length) {
      return success([]);
    }

    query = query.in(
      "project_id",
      ids
    );
  }

  const { data, error } =
    await query;

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

/* =========================================================
   CREATE LEAVE
========================================================= */

async function createLeave(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId =
    session.user.employee_id;

  if (!employeeId) {
    return errorResponse(
      "الحساب غير مرتبط بموظف"
    );
  }

  const assignment =
    await getCurrentAssignment(
      employeeId
    );

  if (!assignment) {
    return errorResponse(
      "لا يوجد مشروع حالي للموظف"
    );
  }

  const fromDate = String(
    body.from_date || ""
  );

  const toDate = String(
    body.to_date || ""
  );

  if (
    !fromDate ||
    !toDate
  ) {
    return errorResponse(
      "تاريخ بداية ونهاية الإجازة مطلوبان"
    );
  }

  const from =
    new Date(
      `${fromDate}T00:00:00`
    );

  const to =
    new Date(
      `${toDate}T00:00:00`
    );

  const days =
    Math.floor(
      (to.getTime() -
        from.getTime()) /
        86400000
    ) + 1;

  if (
    !Number.isFinite(
      days
    ) ||
    days < 1
  ) {
    return errorResponse(
      "تواريخ الإجازة غير صحيحة"
    );
  }

  const leaveTypeId =
    String(
      body.leave_type_id ||
        ""
    );

  if (!leaveTypeId) {
    return errorResponse(
      "نوع الإجازة مطلوب"
    );
  }

  const { data: leaveType } =
    await supabase
      .from("leave_types")
      .select("*")
      .eq(
        "leave_type_id",
        leaveTypeId
      )
      .maybeSingle();

  if (!leaveType) {
    return errorResponse(
      "نوع الإجازة غير موجود"
    );
  }

  const { data, error } =
    await supabase
      .from("leave_requests")
      .insert({
        request_id:
          generateId("LV"),
        employee_id:
          employeeId,
        project_id:
          assignment.project_id,
        leave_type_id:
          leaveTypeId,
        from_date:
          fromDate,
        to_date:
          toDate,
        days,
        reason:
          body.reason ||
          null,
        status:
          "PENDING_MANAGER",
        created_at:
          nowISO(),
        updated_at:
          nowISO(),
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
   MANAGER LEAVE DECISION
========================================================= */

async function decideLeaveManager(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const requestId = String(
    body.request_id || ""
  );

  const decision =
    String(
      body.decision || ""
    ).toUpperCase();

  if (
    !requestId ||
    !["APPROVE", "REJECT"].includes(
      decision
    )
  ) {
    return errorResponse(
      "بيانات القرار غير صحيحة"
    );
  }

  const { data: request } =
    await supabase
      .from("leave_requests")
      .select("*")
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

  if (!request) {
    return errorResponse(
      "طلب الإجازة غير موجود",
      404
    );
  }

  if (
    request.status !==
    "PENDING_MANAGER"
  ) {
    return errorResponse(
      "الطلب ليس في انتظار اعتماد مدير المشروع"
    );
  }

  const allowed =
    await canManageProject(
      session.user,
      request.project_id
    );

  if (!allowed) {
    return errorResponse(
      "الطلب غير تابع لمشروعك",
      403
    );
  }

  const newStatus =
    decision === "APPROVE"
      ? "PENDING_HR"
      : "REJECTED";

  const { data, error } =
    await supabase
      .from("leave_requests")
      .update({
        status:
          newStatus,
        manager_id:
          session.user.user_id,
        manager_decision_at:
          nowISO(),
        manager_comment:
          body.comment ||
          null,
        updated_at:
          nowISO(),
      })
      .eq(
        "request_id",
        requestId
      )
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   HR LEAVE DECISION
========================================================= */

async function decideLeaveHR(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const requestId = String(
    body.request_id || ""
  );

  const decision =
    String(
      body.decision || ""
    ).toUpperCase();

  if (
    !requestId ||
    !["APPROVE", "REJECT"].includes(
      decision
    )
  ) {
    return errorResponse(
      "بيانات القرار غير صحيحة"
    );
  }

  const { data: request } =
    await supabase
      .from("leave_requests")
      .select("*")
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

  if (!request) {
    return errorResponse(
      "طلب الإجازة غير موجود",
      404
    );
  }

  if (
    request.status !==
    "PENDING_HR"
  ) {
    return errorResponse(
      "الطلب ليس في انتظار اعتماد HR"
    );
  }

  const newStatus =
    decision === "APPROVE"
      ? "APPROVED"
      : "REJECTED";

  const { data, error } =
    await supabase
      .from("leave_requests")
      .update({
        status:
          newStatus,
        hr_decision:
          decision,
        hr_decision_at:
          nowISO(),
        hr_comment:
          body.comment ||
          null,
        updated_at:
          nowISO(),
      })
      .eq(
        "request_id",
        requestId
      )
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   PERMISSIONS
========================================================= */

async function permissionList(
  session: SessionContext
) {
  let query = supabase
    .from("permission_requests")
    .select("*")
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(500);

  if (
    session.user.role ===
    "EMPLOYEE"
  ) {
    query = query.eq(
      "employee_id",
      session.user.employee_id
    );
  }

  if (
    session.user.role ===
    "PROJECT_MANAGER"
  ) {
    const ids =
      await getManagedProjectIds(
        session.user
      );

    if (!ids.length) {
      return success([]);
    }

    query = query.in(
      "project_id",
      ids
    );
  }

  const { data, error } =
    await query;

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

async function createPermission(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const employeeId =
    session.user.employee_id;

  if (!employeeId) {
    return errorResponse(
      "الحساب غير مرتبط بموظف"
    );
  }

  const assignment =
    await getCurrentAssignment(
      employeeId
    );

  if (!assignment) {
    return errorResponse(
      "لا يوجد مشروع حالي"
    );
  }

  const date = String(
    body.date ||
      riyadhDate()
  );

  const startTime = String(
    body.start_time || ""
  );

  const endTime = String(
    body.end_time || ""
  );

  if (
    !startTime ||
    !endTime
  ) {
    return errorResponse(
      "وقت بداية ونهاية الإذن مطلوبان"
    );
  }

  const minutes =
    minutesBetween(
      startTime,
      endTime
    );

  if (minutes <= 0) {
    return errorResponse(
      "وقت الإذن غير صحيح"
    );
  }

  const { data, error } =
    await supabase
      .from("permission_requests")
      .insert({
        request_id:
          generateId("PR"),
        employee_id:
          employeeId,
        project_id:
          assignment.project_id,
        date,
        start_time:
          startTime,
        end_time:
          endTime,
        minutes,
        reason:
          body.reason ||
          null,
        status:
          "PENDING",
        created_at:
          nowISO(),
        updated_at:
          nowISO(),
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

async function decidePermission(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const requestId = String(
    body.request_id || ""
  );

  const decision =
    String(
      body.decision || ""
    ).toUpperCase();

  if (
    !requestId ||
    !["APPROVE", "REJECT"].includes(
      decision
    )
  ) {
    return errorResponse(
      "بيانات القرار غير صحيحة"
    );
  }

  const { data: request } =
    await supabase
      .from("permission_requests")
      .select("*")
      .eq(
        "request_id",
        requestId
      )
      .maybeSingle();

  if (!request) {
    return errorResponse(
      "طلب الإذن غير موجود",
      404
    );
  }

  if (
    request.status !==
    "PENDING"
  ) {
    return errorResponse(
      "الطلب ليس في انتظار القرار"
    );
  }

  const allowed =
    await canManageProject(
      session.user,
      request.project_id
    );

  if (!allowed) {
    return errorResponse(
      "الطلب غير تابع لمشروعك",
      403
    );
  }

  const { data, error } =
    await supabase
      .from("permission_requests")
      .update({
        status:
          decision === "APPROVE"
            ? "APPROVED"
            : "REJECTED",
        manager_id:
          session.user.user_id,
        manager_decision_at:
          nowISO(),
        manager_comment:
          body.comment ||
          null,
        updated_at:
          nowISO(),
      })
      .eq(
        "request_id",
        requestId
      )
      .select("*")
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(data);
}

/* =========================================================
   DEDUCTIONS
========================================================= */

async function listDeductions(
  session: SessionContext
) {
  let query = supabase
    .from("deductions")
    .select("*")
    .order(
      "date",
      {
        ascending: false,
      }
    )
    .limit(1000);

  if (
    session.user.role ===
    "PROJECT_MANAGER"
  ) {
    const ids =
      await getManagedProjectIds(
        session.user
      );

    if (!ids.length) {
      return success([]);
    }

    const { data: assignments } =
      await supabase
        .from("project_assignments")
        .select(
          "employee_id"
        )
        .in(
          "project_id",
          ids
        )
        .eq(
          "is_current",
          true
        );

    const employeeIds = [
      ...new Set(
        (assignments || []).map(
          (row: any) =>
            row.employee_id
        )
      ),
    ];

    if (!employeeIds.length) {
      return success([]);
    }

    query = query.in(
      "employee_id",
      employeeIds
    );
  }

  const { data, error } =
    await query;

  if (error) {
    console.error(
      "deductions:",
      error
    );

    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

/* =========================================================
   USERS
========================================================= */

async function listUsers() {
  const { data, error } =
    await supabase
      .from("users")
      .select(
        "user_id,employee_id,username,role,status,last_login,created_at,updated_at"
      )
      .order("username");

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  return success(
    data || []
  );
}

async function createUser(
  session: SessionContext,
  body: Record<string, unknown>
) {
  const username = String(
    body.username || ""
  ).trim();

  const password = String(
    body.password || ""
  );

  const role =
    String(
      body.role ||
        "EMPLOYEE"
    ).toUpperCase();

  const status =
    String(
      body.status ||
        "ACTIVE"
    ).toUpperCase();

  const employeeId =
    String(
      body.employee_id ||
        ""
    ).trim();

  const projectId =
    String(
      body.project_id ||
        ""
    ).trim();

  if (
    username.length < 3
  ) {
    return errorResponse(
      "اسم المستخدم غير صالح"
    );
  }

  if (
    password.length < 8
  ) {
    return errorResponse(
      "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
    );
  }

  if (!ROLES.includes(role)) {
    return errorResponse(
      "صلاحية المستخدم غير صحيحة"
    );
  }

  if (
    [
      "EMPLOYEE",
      "PROJECT_MANAGER",
      "SITE_SUPERVISOR",
    ].includes(role) &&
    !employeeId
  ) {
    return errorResponse(
      "يجب اختيار الموظف المرتبط بالحساب"
    );
  }

  if (
    role ===
      "PROJECT_MANAGER" &&
    !projectId
  ) {
    return errorResponse(
      "يجب اختيار مشروع مدير المشروع"
    );
  }

  const { data: existing } =
    await supabase
      .from("users")
      .select("user_id")
      .ilike(
        "username",
        username
      )
      .maybeSingle();

  if (existing) {
    return errorResponse(
      "اسم المستخدم موجود بالفعل"
    );
  }

  if (employeeId) {
    const { data: employee } =
      await supabase
        .from("employees")
        .select(
          "employee_id"
        )
        .eq(
          "employee_id",
          employeeId
        )
        .maybeSingle();

    if (!employee) {
      return errorResponse(
        "الموظف المرتبط غير موجود"
      );
    }
  }

  if (projectId) {
    const { data: project } =
      await supabase
        .from("projects")
        .select(
          "project_id"
        )
        .eq(
          "project_id",
          projectId
        )
        .maybeSingle();

    if (!project) {
      return errorResponse(
        "المشروع غير موجود"
      );
    }
  }

  const salt =
    crypto.randomUUID();

  const hash =
    passwordHash(
      salt,
      password
    );

  const userId =
    generateId("USR");

  const { data, error } =
    await supabase
      .from("users")
      .insert({
        user_id:
          userId,

        employee_id:
          [
            "EMPLOYEE",
            "PROJECT_MANAGER",
            "SITE_SUPERVISOR",
          ].includes(role)
            ? employeeId
            : null,

        username,

        password_hash:
          `${salt}$${hash}`,

        role,

        status,

        last_login:
          null,

        failed_attempts:
          0,

        created_at:
          nowISO(),

        updated_at:
          nowISO(),
      })
      .select(
        "user_id,employee_id,username,role,status,last_login,created_at"
      )
      .single();

  if (error) {
    return errorResponse(
      error.message,
      500
    );
  }

  if (
    role ===
    "PROJECT_MANAGER"
  ) {
    const { error: managerError } =
      await supabase
        .from("project_managers")
        .insert({
          id:
            generateId("PM"),
          user_id:
            userId,
          project_id:
            projectId,
          start_date:
            riyadhDate(),
          end_date:
            null,
          created_at:
            nowISO(),
        });

    if (managerError) {
      return errorResponse(
        `تم إنشاء الحساب لكن فشل ربط مدير المشروع: ${managerError.message}`,
        500
      );
    }
  }

  return success(
    data,
    201
  );
}

/* =========================================================
   MAIN ROUTER
========================================================= */

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

/* =========================================================
   HTTP
========================================================= */

export async function GET() {
  return errorResponse(
    "Method not allowed",
    405
  );
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const action = String(
      body.action || ""
    ).trim();

    if (!action) {
      return errorResponse(
        "action is required"
      );
    }

    /*
      Login does not need a session.
      Every other action requires token.
    */

    let session:
      | SessionContext
      | null = null;

    if (action !== "login") {
      const token =
        typeof body.token ===
        "string"
          ? body.token
          : "";

      session =
        await getSession(
          token
        );

      if (!session) {
        return errorResponse(
          "الجلسة غير صالحة أو منتهية",
          401
        );
      }
    }

    return await handleAction(
      action,
      body,
      session
    );
  } catch (error) {
    console.error(
      "ELNUBY HR API ERROR:",
      error
    );

    return errorResponse(
      "حدث خطأ داخلي في الخادم",
      500
    );
  }
}