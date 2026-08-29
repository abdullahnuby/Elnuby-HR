'use client';

type CacheEntry = { key: string; value: unknown; updatedAt: number };
type QueueItem = {
  id: string;
  userId: string;
  action: 'check_in' | 'check_out';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
  state?: 'PENDING' | 'FAILED';
};

const DB_NAME = 'elnuby-hr-offline';
const DB_VERSION = 3;
const ACTIVE_USER_KEY = 'elnuby_hr_offline_user_id';
const CACHE_STORE = 'api_cache';
const QUEUE_STORE = 'attendance_queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB error'));
  });
}

export function setOfflineUserId(userId: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (userId) window.localStorage.setItem(ACTIVE_USER_KEY, userId);
    else window.localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {}
}

export function getOfflineUserId(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACTIVE_USER_KEY);
  } catch {
    return null;
  }
}

function scopedCacheKey(key: string) {
  const userId = getOfflineUserId();
  return userId ? `user:${userId}:${key}` : `anonymous:${key}`;
}

function legacyAnonymousKey(key: string) {
  return `anonymous:${key}`;
}

export async function cacheSet(key: string, value: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ key: scopedCacheKey(key), value, updatedAt: Date.now() } satisfies CacheEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* offline cache must never break the app */ }
}

export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    const value = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const primaryReq = store.get(scopedCacheKey(key));
      primaryReq.onsuccess = () => {
        if (primaryReq.result?.value !== undefined) {
          resolve(primaryReq.result.value as T);
          return;
        }
        // One-time compatibility path for installs upgraded from the older
        // anonymous-cache implementation. This is read-only; callers can
        // immediately write the value under the authenticated namespace.
        if (getOfflineUserId()) {
          const legacyReq = store.get(legacyAnonymousKey(key));
          legacyReq.onsuccess = () => resolve(legacyReq.result?.value as T | undefined);
          legacyReq.onerror = () => reject(legacyReq.error);
        } else {
          resolve(undefined);
        }
      };
      primaryReq.onerror = () => reject(primaryReq.error);
    });
    db.close();
    return value;
  } catch {
    return undefined;
  }
}

export async function queueAttendance(action: 'check_in' | 'check_out', payload: Record<string, unknown>) {
  const userId = getOfflineUserId();
  if (!userId) throw new Error('لا توجد جلسة مستخدم محفوظة لإجراء الحضور دون اتصال. افتح التطبيق مع الإنترنت وسجّل الدخول أولًا.');
  const id = String(payload.client_event_id || crypto.randomUUID());
  const item: QueueItem = { id, userId, action, payload: { ...payload, client_event_id: id }, createdAt: Date.now(), attempts: 0, state: 'PENDING' }; 
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return item;
}

export async function getQueuedAttendance(userId?: string | null): Promise<QueueItem[]> {
  const db = await openDb();
  const rows = await new Promise<QueueItem[]>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => {
        const rows = (req.result || []) as QueueItem[];
        resolve(rows.filter((row) => (!userId || row.userId === userId)).sort((a, b) => a.createdAt - b.createdAt));
      };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

async function removeQueueItem(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function pendingAttendanceCount(userId?: string | null) {
  const rows = await getQueuedAttendance(userId ?? getOfflineUserId());
  return rows.filter((row) => row.state !== 'FAILED').length;
}

export async function failedAttendanceCount(userId?: string | null) {
  const rows = await getQueuedAttendance(userId ?? getOfflineUserId());
  return rows.filter((row) => row.state === 'FAILED').length;
}

export async function lastFailedAttendance(userId?: string | null): Promise<QueueItem | null> {
  const rows = await getQueuedAttendance(userId ?? getOfflineUserId());
  return rows.filter((row) => row.state === 'FAILED').sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

export async function syncAttendanceQueue(
  sender: (action: QueueItem['action'], payload: Record<string, unknown>) => Promise<unknown>,
  userId = getOfflineUserId(),
) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0, pending: await pendingAttendanceCount(userId), lastError: null as string | null };
  }
  if (!userId) return { synced: 0, failed: 0, pending: 0, lastError: null as string | null };

  // Never delete pending attendance because of an expired session.
  // Never delete pending attendance because of any transient failure.
  // Permanent business rejections are marked FAILED so the user gets a clear result.
  const items = (await getQueuedAttendance(userId)).filter((item) => item.state !== 'FAILED');
  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const item of items) {
    try {
      await sender(item.action, item.payload);
      await removeQueueItem(item.id);
      synced += 1;
    } catch (error: any) {
      const message = String(error?.message || 'تعذر مزامنة العملية');
      const status = Number(error?.status || 0);
      const permanent = Boolean(error?.permanent) || [400, 403, 409, 422].includes(status);
      await updateQueueItem(item.id, {
        attempts: item.attempts + 1,
        lastError: message.slice(0, 500),
        state: permanent ? 'FAILED' : 'PENDING',
      });
      lastError = message.slice(0, 500);
      if (permanent) {
        failed += 1;
        // Continue so one rejected old event does not block later valid events.
        continue;
      }
      // Network/auth/transient errors stay pending and stop this sync pass.
      break;
    }
  }
  return { synced, failed, pending: await pendingAttendanceCount(userId), lastError };
}

async function updateQueueItem(id: string, patch: Partial<QueueItem>) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        const current = req.result as QueueItem | undefined;
        if (current) store.put({ ...current, ...patch });
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function apiCacheKey(action: string, payload: Record<string, unknown> = {}) {
  return `api:${action}:${JSON.stringify(payload || {})}`;
}

export function offlineCacheKey(action: string, payload: Record<string, unknown> = {}) {
  return apiCacheKey(action, payload);
}


/**
 * Clear all locally cached HR data when a user signs out or the server
 * rejects the current session. This prevents data from one account being
 * displayed to another account on the same browser.
 */
export async function clearOfflineCache() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}

export async function clearOfflineData() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CACHE_STORE, QUEUE_STORE], 'readwrite');
      tx.objectStore(CACHE_STORE).clear();
      tx.objectStore(QUEUE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
    db.close();
  } catch {
    // Local cleanup must never prevent logout.
  }

  try {
    if (typeof window !== 'undefined') {
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (/elnuby|hr|session|auth|user/i.test(key)) {
          window.localStorage.removeItem(key);
        }
      }
      const sessionKeys = Object.keys(window.sessionStorage);
      for (const key of sessionKeys) {
        if (/elnuby|hr|session|auth|user/i.test(key)) {
          window.sessionStorage.removeItem(key);
        }
      }
    }
    try { window.localStorage.removeItem(ACTIVE_USER_KEY); } catch {}
  } catch {
    // Storage cleanup is best-effort.
  }
}
