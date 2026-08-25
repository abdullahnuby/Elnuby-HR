export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export async function api<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch('/api/hr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
