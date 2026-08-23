export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const AUTH_VERSION = 'supabase-auth-v3';

function clearAuth() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('hr_token');
  localStorage.setItem('hr_auth_version', AUTH_VERSION);
}

function prepareAuth() {
  if (typeof window === 'undefined') return;

  const version = localStorage.getItem('hr_auth_version');

  if (version !== AUTH_VERSION) {
    localStorage.removeItem('hr_token');
    localStorage.setItem('hr_auth_version', AUTH_VERSION);
  }
}

export async function api<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (typeof window !== 'undefined') {
    prepareAuth();
  }

  const token =
    typeof window !== 'undefined' && action !== 'login'
      ? localStorage.getItem('hr_token')
      : null;

  const body = {
    action,
    ...(token ? { token } : {}),
    ...payload,
  };

  const res = await fetch('/api/hr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  });

  let result: ApiResponse<T>;

  try {
    result = await res.json();
  } catch {
    throw new Error(`Server error (${res.status})`);
  }

  if (!result.ok) {
    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      action !== 'login'
    ) {
      clearAuth();
    }

    throw new Error(
      result.error ||
        (res.status === 401
          ? 'انتهت جلسة الدخول، برجاء تسجيل الدخول مرة أخرى.'
          : res.status === 403
            ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
            : 'فشل تنفيذ الطلب.'),
    );
  }

  return result.data as T;
}