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


export async function apiFile(
  action: string,
  payload: Record<string, unknown>,
  file: File,
): Promise<any> {
  const form = new FormData();
  form.append("table", String(payload.table || ""));
  form.append("commit", String(payload.commit || false));
  form.append("file", file);
  const res = await fetch("/api/hr/excel", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    body: form,
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.ok) throw new Error(result?.error || `Server error (${res.status})`);
  return result.data;
}

export async function downloadExcel(action: "export" | "template", table: string) {
  const res = await fetch(`/api/hr/excel?action=${action}&table=${encodeURIComponent(table)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const result = await res.json().catch(() => null);
    throw new Error(result?.error || `Server error (${res.status})`);
  }
  return res.blob();
}

export async function apiMultipart(
  action: string,
  payload: Record<string, unknown>,
  file?: File,
  fileField = "medical_document",
): Promise<any> {
  const form = new FormData();
  form.append("action", action);
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  if (file) form.append(fileField, file);
  const res = await fetch("/api/hr", {method:"POST",credentials:"include",cache:"no-store",body:form});
  const result = await res.json().catch(()=>null);
  if (!res.ok || !result?.ok) throw new Error(result?.error || `Server error (${res.status})`);
  return result.data;
}
