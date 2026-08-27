'use client';

type CacheEntry = { key: string; value: unknown; updatedAt: number };
type QueueItem = {
  id: string;
  action: 'check_in' | 'check_out';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
};

const DB_NAME = 'elnuby-hr-offline';
const DB_VERSION = 1;
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

export async function cacheSet(key: string, value: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ key, value, updatedAt: Date.now() } satisfies CacheEntry);
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
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.value as T | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch {
    return undefined;
  }
}

export async function queueAttendance(action: 'check_in' | 'check_out', payload: Record<string, unknown>) {
  const id = String(payload.client_event_id || crypto.randomUUID());
  const item: QueueItem = { id, action, payload: { ...payload, client_event_id: id }, createdAt: Date.now(), attempts: 0 };
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

export async function getQueuedAttendance(): Promise<QueueItem[]> {
  const db = await openDb();
  const rows = await new Promise<QueueItem[]>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt));
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

export async function pendingAttendanceCount() {
  return (await getQueuedAttendance()).length;
}

export async function syncAttendanceQueue(sender: (action: string, payload: Record<string, unknown>) => Promise<unknown>) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, pending: await pendingAttendanceCount() };
  const items = await getQueuedAttendance();
  let synced = 0;
  for (const item of items) {
    try {
      await sender(item.action, item.payload);
      await removeQueueItem(item.id);
      synced += 1;
    } catch (error: any) {
      const message = String(error?.message || '');
      // Keep authentication, validation and server errors visible to the user.
      // We stop here to preserve strict chronological ordering (check-in before check-out).
      if (/جلسة|مصادقة|Authentication|session|401|403/i.test(message)) break;
      break;
    }
  }
  return { synced, pending: await pendingAttendanceCount() };
}

export function apiCacheKey(action: string, payload: Record<string, unknown>) {
  return `api:${action}:${JSON.stringify(payload || {})}`;
}
