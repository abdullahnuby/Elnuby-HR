import { apiCacheKey, cacheGet, cacheSet, queueAttendance, clearOfflineCache, setOfflineUserId } from './offline';

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const CACHEABLE_ACTIONS = new Set([
  'me','dashboard','project_manager_dashboard','employees','projects','shifts','users',
  'attendance_list','leave_list','permission_list','deductions','employee_shifts',
  'leave_policies','leave_balances','leave_types','settings',
]);

function offlineError() {
  return new Error('لا يوجد اتصال بالإنترنت. تم الاحتفاظ بالبيانات المحلية، ويمكن تسجيل الحضور والانصراف وسيتم مزامنتهما تلقائيًا عند عودة الشبكة.');
}

export type ApiOptions = { offlineSync?: boolean };

export async function api<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: ApiOptions = {},
): Promise<T> {
  const key = apiCacheKey(action, payload);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (offline && CACHEABLE_ACTIONS.has(action)) {
    const cached = await cacheGet<T>(key);
    if (cached !== undefined) return cached;
    throw offlineError();
  }

  if (offline && (action === 'check_in' || action === 'check_out')) {
    const item = await queueAttendance(action, payload);
    return { offlineQueued: true, queueId: item.id } as T;
  }

  try {
    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.offlineSync ? { 'X-Offline-Sync': '1' } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ action, ...payload }),
    });

    let result: ApiResponse<T>;
    try {
      result = await res.json();
    } catch {
      throw new Error(`Server error (${res.status})`);
    }

    if (!result.ok) {
      const message =
        result.error ||
        (res.status === 401
          ? 'انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى.'
          : res.status === 403
            ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
            : 'فشل تنفيذ الطلب.');

      // Authentication failure invalidates cached views, but NEVER deletes the
      // offline attendance queue. A later login must be able to resume sync.
      if (res.status === 401 || /الجلسة غير صالحة|انتهت جلسة|Authentication required|Invalid session|Session expired|User inactive/i.test(message)) {
        await clearOfflineCache();
      }

      throw new Error(message);
    }

    if (action === 'me' && (result.data as any)?.user?.user_id) {
      // Establish the cache namespace BEFORE storing the response. Otherwise
      // the first successful load is written under anonymous and cannot be
      // restored by an offline refresh.
      setOfflineUserId(String((result.data as any).user.user_id));
    }
    if (CACHEABLE_ACTIONS.has(action)) await cacheSet(key, result.data);
    return result.data as T;
  } catch (error: any) {
    const message = String(error?.message || '');

    // Auth failures must never be replaced by stale cached user data.
    const authFailure =
      /الجلسة غير صالحة|انتهت جلسة|Authentication required|Invalid session|Session expired|User inactive|401/i.test(message);

    if (authFailure) {
      await clearOfflineCache();
      throw error;
    }

    if (CACHEABLE_ACTIONS.has(action)) {
      const cached = await cacheGet<T>(key);
      if (cached !== undefined) return cached;
    }
    if (action === 'check_in' || action === 'check_out') {
      const networkFailure = /Failed to fetch|NetworkError|Load failed|fetch failed|ECONN|offline/i.test(String(error?.message || ''));
      if (networkFailure || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        const item = await queueAttendance(action, payload);
        return { offlineQueued: true, queueId: item.id } as T;
      }
    }
    throw error;
  }
}

export async function apiFile(action: string, payload: Record<string, unknown>, file: File): Promise<any> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw offlineError();
  const form = new FormData();
  form.append('table', String(payload.table || ''));
  form.append('commit', String(payload.commit || false));
  form.append('file', file);
  const res = await fetch('/api/hr/excel', { method: 'POST', credentials: 'include', cache: 'no-store', body: form });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.ok) throw new Error(result?.error || `Server error (${res.status})`);
  return result.data;
}

export async function downloadExcel(action: 'export' | 'template', table: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw offlineError();
  const res = await fetch(`/api/hr/excel?action=${action}&table=${encodeURIComponent(table)}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    const result = await res.json().catch(() => null);
    throw new Error(result?.error || `Server error (${res.status})`);
  }
  return res.blob();
}

export async function apiMultipart(action: string, payload: Record<string, unknown>, file?: File, fileField = 'medical_document'): Promise<any> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw offlineError();
  const form = new FormData();
  form.append('action', action);
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  if (file) form.append(fileField, file);
  const res = await fetch('/api/hr', { method: 'POST', credentials: 'include', cache: 'no-store', body: form });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.ok) throw new Error(result?.error || `Server error (${res.status})`);
  return result.data;
}
