interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

export const getCached = <T>(key: string, loader: () => Promise<T>, ttlMs = 30_000): Promise<T> => {
  const cached = entries.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = loader().then((value) => {
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, request);
  return request;
};

export const invalidateCache = (...keys: string[]): void => {
  keys.forEach((key) => entries.delete(key));
};

export const clearCache = (): void => {
  entries.clear();
  pendingRequests.clear();
};
