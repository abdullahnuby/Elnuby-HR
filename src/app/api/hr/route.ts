import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Supabase server environment variables are missing');
}

const db = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

const authDb = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

type User = {
  id: string;
  legacy_user_id?: string | null;
  employee_id?: string | null;
  username: string;
  role: string;
  status: string;
};

type Session = {
  token: string;
  user: User;
};

function json(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function tokenFrom(body: Record<string, unknown>) {
  return typeof body.token === 'string' ? body.token : '';
}

async function sessionFromToken(token: string): Promise<Session | null> {
  if (!token) return null;

  // Supports the application session table used by the migration.
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: s, error } = await authDb
    .from('app_sessions')
    .select('session_id,user_id,expires_at,revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (error || !s) return null;
  if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) return null;

  const { data: user } = await authDb
    .from('users')
    .select('user_id,employee_id,username,role,status,last_login')
    .eq('user_id', s.user_id)
    .maybeSingle();

  if (!user || user.status !== 'ACTIVE') return null;

  await authDb
    .from('app_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('session_id', s.session_id);

  return {
    token,
    user: {
      id: user.user_id,
      legacy_user_id: user.user_id,
      employee_id: user.employee_id,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  };
}

function requireRole(session: Session | null, roles: string[]) {
  if (!session) return 'UNAUTHENTICATED';
  if (!roles.includes(session.user.role)) return 'FORBIDDEN';
  return null;
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function activeAssignment(employeeId: string) {
  const { data } = await db
    .from('project_assignments')
    .select('*,projects(*)')
    .eq('employee_id', employeeId)
    .eq('is_current', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function activeShift(employeeId: string, projectId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from('employee_shifts')
    .select('*,shifts(*)')
    .eq('employee_id', employeeId)
    .eq('project_id', projectId)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function managedProjects(user: User) {
  if (user.role === 'SUPER_ADMIN' || user.role === 'HR_MANAGER') {
    const { data } = await db.from('projects').select('*').order('name');
    return data || [];
  }

  if (user.role !== 'PROJECT_MANAGER') return [];

  const { data } = await db
    .from('project_managers')
    .select('project_id,projects(*)')
    .eq('user_id', user.id)
    .or('end_date.is.null,end_date.gte.' + new Date().toISOString().slice(0, 10));

  return (data || []).map((x: any) => x.projects).filter(Boolean);
}

async function canManageProject(user: User, projectId: string) {
  if (user.role === 'SUPER_ADMIN' || user.role === 'HR_MANAGER') return true;
  if (user.role !== 'PROJECT_MANAGER') return false;

  const { data } = await db
    .from('project_managers')
    .select('id')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .or('end_date.is.null,end_date.gte.' + new Date().toISOString().slice(0, 10))
    .maybeSingle();

  return !!data;
}

async function login(body: Record<string, unknown>) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) return fail('اسم المستخدم وكلمة المرور مطلوبان');

  // Passwords created by the legacy Google Apps Script are not Supabase Auth
  // passwords. This endpoint expects the migration to expose password_hash.
  const { data: user, error } = await authDb
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error || !user) return fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
  if (user.status !== 'ACTIVE') return fail('الحساب غير نشط', 403);

  // Legacy passwords are stored as salt$base64(sha256(password)).
  // The salt is the first segment.
  const stored = String(user.password_hash || '');
  const [salt, expected] = stored.split('$');
  if (!salt || !expected) return fail('بيانات الحساب تحتاج ترحيل كلمة المرور', 500);

  const actual = crypto.createHash('sha256').update(salt + password).digest('base64');
  if (actual !== expected) return fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);

  const token = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { error: sessionError } = await authDb.from('app_sessions').insert({
    session_id: uid('SES'),
    token_hash: tokenHash,
    user_id: user.user_id,
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    last_used_at: new Date().toISOString(),
  });

  if (sessionError) return fail(sessionError.message, 500);

  await authDb.from('users')
    .update({ last_login: new Date().toISOString(), failed_attempts: 0 })
    .eq('user_id', user.user_id);

  return json({
    token,
    user: {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      employee_id: user.employee_id,
    },
  });
}

async function handle(action: string, body: Record<string, unknown>, session: Session | null) {
  switch (action) {
    case 'employee_shifts': {
  const err = requireRole(session, [
    'SUPER_ADMIN',
    'HR_MANAGER',
    'PROJECT_MANAGER',
  ]);

  if (err) {
    return fail(err, err === 'FORBIDDEN' ? 403 : 401);
  }

  let query = db
    .from('employee_shifts_view')
    .select('*')
    .order('start_date', { ascending: false });

  if (session!.user.role === 'PROJECT_MANAGER') {
    const projects = await managedProjects(session!.user);
    const projectIds = projects.map((p: any) => p.project_id);

    if (!projectIds.length) {
      return json([]);
    }

    query = query.in('project_id', projectIds);
  }

  const { data, error } = await query.limit(1000);

  if (error) {
    return fail(error.message, 500);
  }

  return json(data || []);
}

case 'assign_employee_shift': {
  const err = requireRole(session, [
    'SUPER_ADMIN',
    'HR_MANAGER',
  ]);

  if (err) {
    return fail(err, err === 'FORBIDDEN' ? 403 : 401);
  }

  const employee_id = String(body.employee_id || '').trim();
  const project_id = String(body.project_id || '').trim();
  const shift_id = String(body.shift_id || '').trim();

  if (!employee_id || !project_id || !shift_id) {
    return fail('الموظف والمشروع والوردية مطلوبة');
  }

  const today = new Date().toISOString().slice(0, 10);

  // Close the current assignment for this employee/project.
  await db
    .from('employee_shifts')
    .update({
      end_date: today,
    })
    .eq('employee_id', employee_id)
    .eq('project_id', project_id)
    .is('end_date', null);

  const { data, error } = await db
    .from('employee_shifts')
    .insert({
      assignment_id: uid('ESH'),
      employee_id,
      project_id,
      shift_id,
      start_date: today,
      end_date: null,
      created_by: session!.user.id,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  return json(data);
}
    case 'login':
      return login(body);

    case 'logout': {
      if (session) {
        const tokenHash = crypto.createHash('sha256').update(session.token).digest('hex');
        await authDb.from('app_sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('token_hash', tokenHash)
          .is('revoked_at', null);
      }
      return json({ logged_out: true });
    }

    case 'me': {
      if (!session) return fail('جلسة غير صالحة', 401);
      let employee = null;
      let project = null;
      let shift = null;

      if (session.user.employee_id) {
        const { data: e } = await db.from('employees').select('*').eq('employee_id', session.user.employee_id).maybeSingle();
        employee = e;
        const a = await activeAssignment(session.user.employee_id);
        project = a?.projects || null;
        if (project) {
          const s = await activeShift(session.user.employee_id, project.project_id);
          shift = s?.shifts || null;
        }
      }

      return json({ user: session.user, employee, project, shift });
    }

    case 'employee_context': {
      if (!session?.user.employee_id) return fail('الحساب غير مرتبط بموظف', 400);
      const a = await activeAssignment(session.user.employee_id);
      if (!a) return fail('لا يوجد مشروع حالي للموظف', 404);
      const s = await activeShift(session.user.employee_id, a.project_id);
      return json({ employee_id: session.user.employee_id, project: a.projects, shift: s?.shifts || null });
    }

    case 'employees':
    case 'list_employees': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);

      if (session!.user.role === 'PROJECT_MANAGER') {
        const projects = await managedProjects(session!.user);
        const ids = projects.map((p: any) => p.project_id);
        if (!ids.length) return json([]);
        const { data } = await db.from('project_assignments_view').select('*').in('project_id', ids).eq('is_current', true);
        return json(data || []);
      }

      const { data, error } = await db.from('employee_directory').select('*').order('name');
      if (error) return fail(error.message, 500);
      return json(data || []);
    }

    case 'create_employee': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);

      const employee_id = String(body.employee_id || uid('EMP'));
      const { data, error } = await db.from('employees').insert({
        employee_id,
        name: body.name,
        job_title: body.job_title || null,
        department: body.department || null,
        phone: body.phone || null,
        national_id: body.national_id || null,
        birth_date: body.birth_date || null,
        hire_date: body.hire_date || null,
        status: body.status || 'ACTIVE',
      }).select('*').single();

      if (error) return fail(error.message);
      if (body.project_id) {
        await db.from('project_assignments').insert({
          assignment_id: uid('ASN'),
          employee_id,
          project_id: body.project_id,
          start_date: body.start_date || new Date().toISOString().slice(0, 10),
          is_current: true,
          created_by: session!.user.id,
          created_at: new Date().toISOString(),
        });
      }
      if (body.shift_id && body.project_id) {
        await db.from('employee_shifts').insert({
          assignment_id: uid('ESH'),
          employee_id,
          project_id: body.project_id,
          shift_id: body.shift_id,
          start_date: body.start_date || new Date().toISOString().slice(0, 10),
          created_by: session!.user.id,
          created_at: new Date().toISOString(),
        });
      }
      return json(data, 201);
    }

    case 'projects': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      return json(await managedProjects(session!.user));
    }

    case 'create_project': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      const project_id = String(body.project_id || uid('PRJ'));
      const { data, error } = await db.from('projects').insert({
        project_id,
        name: body.name,
        client: body.client || null,
        location_name: body.location_name || null,
        latitude: body.latitude == null ? null : Number(body.latitude),
        longitude: body.longitude == null ? null : Number(body.longitude),
        geofence_radius_m: body.geofence_radius_m == null ? 200 : Number(body.geofence_radius_m),
        status: body.status || 'ACTIVE',
      }).select('*').single();
      if (error) return fail(error.message);
      return json(data, 201);
    }

    case 'assign_employee_project': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      const employee_id = String(body.employee_id);
      const project_id = String(body.project_id);

      await db.from('project_assignments').update({ is_current: false, end_date: new Date().toISOString().slice(0, 10) })
        .eq('employee_id', employee_id).eq('is_current', true);

      const { data, error } = await db.from('project_assignments').insert({
        assignment_id: uid('ASN'),
        employee_id,
        project_id,
        start_date: body.start_date || new Date().toISOString().slice(0, 10),
        end_date: body.end_date || null,
        is_current: true,
        created_by: session!.user.id,
        created_at: new Date().toISOString(),
      }).select('*').single();

      if (error) return fail(error.message);
      return json(data);
    }

    case 'assign_manager_project': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      const { data, error } = await db.from('project_managers').insert({
        id: uid('PM'),
        user_id: body.user_id,
        project_id: body.project_id,
        start_date: body.start_date || new Date().toISOString().slice(0, 10),
        end_date: body.end_date || null,
      }).select('*').single();
      if (error) return fail(error.message);
      return json(data);
    }

    case 'shifts': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      const { data, error } = await db.from('shifts').select('*').order('name');
      if (error) return fail(error.message, 500);
      return json(data || []);
    }

    case 'assign_shift': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      const { data, error } = await db.from('employee_shifts').insert({
        assignment_id: uid('ESH'),
        employee_id: body.employee_id,
        project_id: body.project_id,
        shift_id: body.shift_id,
        start_date: body.start_date || new Date().toISOString().slice(0, 10),
        end_date: body.end_date || null,
        created_by: session!.user.id,
        created_at: new Date().toISOString(),
      }).select('*').single();
      if (error) return fail(error.message);
      return json(data);
    }

    case 'attendance_list': {
      if (!session) return fail('غير مصرح', 401);
      let q = db.from('attendance').select('*').order('date', { ascending: false }).order('check_in', { ascending: false });

      if (session.user.role === 'EMPLOYEE' && session.user.employee_id) {
        q = q.eq('employee_id', session.user.employee_id);
      } else if (session.user.role === 'PROJECT_MANAGER') {
        const projects = await managedProjects(session.user);
        const ids = projects.map((p: any) => p.project_id);
        if (!ids.length) return json([]);
        q = q.in('project_id', ids);
      }

      const { data, error } = await q.limit(500);
      if (error) return fail(error.message, 500);
      return json(data || []);
    }

    case 'check_in':
    case 'check_out': {
      if (!session?.user.employee_id) return fail('الحساب غير مرتبط بموظف', 400);

      const a = await activeAssignment(session.user.employee_id);
      if (!a) return fail('No active project', 400);

      const s = await activeShift(session.user.employee_id, a.project_id);
      if (!s?.shifts) return fail('No active shift', 400);

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const nowTime = now.toTimeString().slice(0, 5);

      const { data: existing } = await db.from('attendance')
        .select('*').eq('employee_id', session.user.employee_id).eq('date', today).maybeSingle();

      if (action === 'check_in') {
        if (existing?.check_in) return fail('تم تسجيل الحضور بالفعل');
        const open = String(s.shifts.attendance_open || '00:00').slice(0, 5);
        const close = String(s.shifts.attendance_close || '23:59').slice(0, 5);
        if (nowTime < open || nowTime > close) return fail('الحضور غير متاح في هذا الوقت');

        const { data, error } = await db.from('attendance').insert({
          attendance_id: uid('ATT'),
          employee_id: session.user.employee_id,
          project_id: a.project_id,
          shift_id: s.shift_id,
          date: today,
          check_in: nowTime,
          check_in_lat: body.latitude ?? null,
          check_in_lng: body.longitude ?? null,
          status: nowTime > String(s.shifts.start_time || '00:00').slice(0, 5) ? 'LATE' : 'PRESENT',
          created_at: now.toISOString(),
        }).select('*').single();

        if (error) return fail(error.message);
        return json(data);
      }

      if (!existing?.check_in) return fail('لم يتم تسجيل الحضور');
      if (existing.check_out) return fail('تم تسجيل الانصراف بالفعل');

      const open = String(s.shifts.checkout_open || '00:00').slice(0, 5);
      const close = String(s.shifts.checkout_close || '23:59').slice(0, 5);
      if (nowTime < open || nowTime > close) return fail('الانصراف غير متاح في هذا الوقت');

      const worked = Math.max(0, Math.round((Date.parse(`${today}T${nowTime}`) - Date.parse(`${today}T${existing.check_in}`)) / 60000));
      const { data, error } = await db.from('attendance').update({
        check_out: nowTime,
        check_out_lat: body.latitude ?? null,
        check_out_lng: body.longitude ?? null,
        worked_minutes: worked,
        updated_at: now.toISOString(),
      }).eq('attendance_id', existing.attendance_id).select('*').single();

      if (error) return fail(error.message);
      return json(data);
    }

    case 'leave_list': {
      if (!session) return fail('غير مصرح', 401);
      let q = db.from('leave_requests').select('*').order('created_at', { ascending: false });
      if (session.user.role === 'EMPLOYEE') q = q.eq('employee_id', session.user.employee_id);
      if (session.user.role === 'PROJECT_MANAGER') {
        const projects = await managedProjects(session.user);
        const ids = projects.map((p: any) => p.project_id);
        if (!ids.length) return json([]);
        q = q.in('project_id', ids);
      }
      const { data, error } = await q.limit(500);
      if (error) return fail(error.message, 500);
      return json(data || []);
    }

    case 'create_leave': {
      if (!session?.user.employee_id) return fail('الحساب غير مرتبط بموظف', 400);
      const a = await activeAssignment(session.user.employee_id);
      if (!a) return fail('لا يوجد مشروع حالي', 400);

      const from = new Date(String(body.from_date));
      const to = new Date(String(body.to_date));
      const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
      if (!Number.isFinite(days) || days < 1) return fail('تواريخ الإجازة غير صحيحة');

      const { data, error } = await db.from('leave_requests').insert({
        request_id: uid('LV'),
        employee_id: session.user.employee_id,
        project_id: a.project_id,
        leave_type_id: body.leave_type_id,
        from_date: body.from_date,
        to_date: body.to_date,
        days,
        reason: body.reason || null,
        status: 'PENDING_MANAGER',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('*').single();

      if (error) return fail(error.message);
      return json(data, 201);
    }

    case 'decide_leave_manager': {
      if (!session || session.user.role !== 'PROJECT_MANAGER') return fail('غير مصرح', 403);
      const { data: req } = await db.from('leave_requests').select('*').eq('request_id', body.request_id).maybeSingle();
      if (!req || !(await canManageProject(session.user, req.project_id))) return fail('الطلب غير تابع لمشروعك', 403);

      const decision = String(body.decision);
      const status = decision === 'APPROVE' ? 'PENDING_HR' : 'REJECTED';
      const { data, error } = await db.from('leave_requests').update({
        status,
        manager_id: session.user.id,
        manager_decision_at: new Date().toISOString(),
        manager_comment: body.comment || null,
        updated_at: new Date().toISOString(),
      }).eq('request_id', body.request_id).select('*').single();

      if (error) return fail(error.message);
      return json(data);
    }

    case 'decide_leave_hr': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      const decision = String(body.decision);
      const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const { data, error } = await db.from('leave_requests').update({
        status,
        hr_decision: decision,
        hr_decision_at: new Date().toISOString(),
        hr_comment: body.comment || null,
        updated_at: new Date().toISOString(),
      }).eq('request_id', body.request_id).select('*').single();

      if (error) return fail(error.message);
      return json(data);
    }

    case 'permission_list': {
      if (!session) return fail('غير مصرح', 401);
      let q = db.from('permission_requests').select('*').order('created_at', { ascending: false });
      if (session.user.role === 'EMPLOYEE') q = q.eq('employee_id', session.user.employee_id);
      if (session.user.role === 'PROJECT_MANAGER') {
        const projects = await managedProjects(session.user);
        const ids = projects.map((p: any) => p.project_id);
        if (!ids.length) return json([]);
        q = q.in('project_id', ids);
      }
      const { data, error } = await q.limit(500);
      if (error) return fail(error.message, 500);
      return json(data || []);
    }

    case 'create_permission': {
      if (!session?.user.employee_id) return fail('الحساب غير مرتبط بموظف', 400);
      const a = await activeAssignment(session.user.employee_id);
      if (!a) return fail('لا يوجد مشروع حالي', 400);

      const start = new Date(String(body.start_time));
      const end = new Date(String(body.end_time));
      const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      if (!minutes) return fail('وقت الإذن غير صحيح');

      const { data, error } = await db.from('permission_requests').insert({
        request_id: uid('PR'),
        employee_id: session.user.employee_id,
        project_id: a.project_id,
        date: body.date || String(body.start_time).slice(0, 10),
        start_time: body.start_time,
        end_time: body.end_time,
        minutes,
        reason: body.reason || null,
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select('*').single();

      if (error) return fail(error.message);
      return json(data, 201);
    }

    case 'decide_permission': {
      if (!session || session.user.role !== 'PROJECT_MANAGER') return fail('غير مصرح', 403);
      const { data: req } = await db.from('permission_requests').select('*').eq('request_id', body.request_id).maybeSingle();
      if (!req || !(await canManageProject(session.user, req.project_id))) return fail('الطلب غير تابع لمشروعك', 403);

      const status = String(body.decision) === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const { data, error } = await db.from('permission_requests').update({
        status,
        manager_id: session.user.id,
        manager_decision_at: new Date().toISOString(),
        manager_comment: body.comment || null,
        updated_at: new Date().toISOString(),
      }).eq('request_id', body.request_id).select('*').single();

      if (error) return fail(error.message);
      return json(data);
    }

    case 'create_user': {
  const err = requireRole(session, ['SUPER_ADMIN']);

  if (err) {
    return fail(err, err === 'FORBIDDEN' ? 403 : 401);
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const role = String(body.role || 'EMPLOYEE').trim().toUpperCase();
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();
  const employee_id = String(body.employee_id || '').trim();
  const project_id = String(body.project_id || '').trim();

  if (username.length < 3) {
    return fail('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
  }

  if (password.length < 8) {
    return fail('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }

  const allowedRoles = [
    'SUPER_ADMIN',
    'HR_MANAGER',
    'PROJECT_MANAGER',
    'EMPLOYEE',
  ];

  if (!allowedRoles.includes(role)) {
    return fail('صلاحية المستخدم غير صحيحة');
  }

  if (['EMPLOYEE', 'PROJECT_MANAGER'].includes(role) && !employee_id) {
    return fail('يجب اختيار الموظف المرتبط بالحساب');
  }

  if (role === 'PROJECT_MANAGER' && !project_id) {
    return fail('يجب اختيار مشروع مدير المشروع');
  }

  const { data: existing } = await db
    .from('users')
    .select('user_id')
    .ilike('username', username)
    .maybeSingle();

  if (existing) {
    return fail('اسم المستخدم موجود بالفعل');
  }

  if (employee_id) {
    const { data: employee } = await db
      .from('employees')
      .select('employee_id')
      .eq('employee_id', employee_id)
      .maybeSingle();

    if (!employee) {
      return fail('الموظف المرتبط غير موجود');
    }
  }

  if (project_id) {
    const { data: project } = await db
      .from('projects')
      .select('project_id')
      .eq('project_id', project_id)
      .maybeSingle();

    if (!project) {
      return fail('المشروع غير موجود');
    }
  }

  const salt = crypto.randomUUID();
  const passwordHash = crypto
    .createHash('sha256')
    .update(salt + password)
    .digest('base64');

  const user_id = uid('USR');

  const { data: created, error } = await db
    .from('users')
    .insert({
      user_id,
      employee_id:
        role === 'EMPLOYEE' || role === 'PROJECT_MANAGER'
          ? employee_id
          : null,
      username,
      password_hash: `${salt}$${passwordHash}`,
      role,
      status,
      last_login: null,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select(`
      user_id,
      employee_id,
      username,
      role,
      status,
      last_login,
      created_at
    `)
    .single();

  if (error) {
    return fail(error.message, 500);
  }

  if (role === 'PROJECT_MANAGER' && project_id) {
    const { error: pmError } = await db
      .from('project_managers')
      .insert({
        id: uid('PM'),
        user_id,
        project_id,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: null,
        created_at: new Date().toISOString(),
      });

    if (pmError) {
      return fail(`تم إنشاء الحساب لكن فشل ربط مدير المشروع: ${pmError.message}`, 500);
    }
  }

  return json(created, 201);
}

    case 'users': {
      const err = requireRole(session, ['SUPER_ADMIN']);
      if (err) {
        return fail(err, err === 'FORBIDDEN' ? 403 : 401);
      }

      const { data, error } = await db
        .from('users')
        .select(`
          user_id,
          employee_id,
          username,
          role,
          status,
          last_login,
          created_at,
          updated_at
        `)
        .order('username');

      if (error) {
        return fail(error.message, 500);
      }

      return json(data || []);
    }

    case 'dashboard':
    case 'reports': {
      const err = requireRole(session, ['SUPER_ADMIN', 'HR_MANAGER', 'PROJECT_MANAGER']);
      if (err) return fail(err, err === 'FORBIDDEN' ? 403 : 401);

      const today = new Date().toISOString().slice(0, 10);
      const projects = await managedProjects(session!.user);
      const projectIds = projects.map((p: any) => p.project_id);

      let employeesQuery = db.from('employees').select('employee_id', { count: 'exact', head: true });
      let attendanceQuery = db.from('attendance').select('attendance_id', { count: 'exact', head: true }).eq('date', today);
      if (session!.user.role === 'PROJECT_MANAGER') {
        if (!projectIds.length) return json({ employees: 0, present: 0, late: 0, missingCheckout: 0, projects: 0 });
        employeesQuery = employeesQuery.in('employee_id', (await db.from('project_assignments').select('employee_id').in('project_id', projectIds).eq('is_current', true)).data?.map((x: any) => x.employee_id) || ['__none__']);
        attendanceQuery = attendanceQuery.in('project_id', projectIds);
      }

      const [{ count: employees }, { count: present }] = await Promise.all([employeesQuery, attendanceQuery]);
      const { count: late } = await db.from('attendance').select('attendance_id', { count: 'exact', head: true }).eq('date', today).eq('status', 'LATE');
      const { count: missingCheckout } = await db.from('attendance').select('attendance_id', { count: 'exact', head: true }).eq('date', today).is('check_out', null);

      return json({ employees: employees || 0, present: present || 0, late: late || 0, missingCheckout: missingCheckout || 0, projects: projects.length });
    }

    default:
      return fail(`Unknown action: ${action}`, 400);
  }
}

export async function GET() {
  const { data, error } = await db.from('employees').select('*').order('name');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || '');
    if (!action) return fail('action is required');

    const session = action === 'login' ? null : await sessionFromToken(tokenFrom(body));
    return handle(action, body, session);
  } catch (e) {
    console.error('HR API error', e);
    return fail(e instanceof Error ? e.message : 'Internal Server Error', 500);
  }
}
