export interface MemoryResource<T> {
  peek: () => T | null;
  load: (options?: { force?: boolean }) => Promise<T>;
  prefetch: () => void;
  clear: () => void;
}

/**
 * Keeps protected admin data only for the lifetime of the current page. It
 * deduplicates concurrent requests and deliberately avoids localStorage so a
 * later account cannot inherit another administrator's cached member data.
 */
export function createMemoryResource<T>(loader: () => Promise<T>, freshForMs = 30_000, now = () => Date.now()): MemoryResource<T> {
  let value: T | null = null;
  let loadedAt = 0;
  let inFlight: Promise<T> | null = null;

  const load: MemoryResource<T>['load'] = ({ force = false } = {}) => {
    if (!force && value && now() - loadedAt < freshForMs) return Promise.resolve(value);
    if (inFlight) return inFlight;

    inFlight = loader()
      .then((next) => {
        value = next;
        loadedAt = now();
        return next;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    peek: () => value,
    load,
    prefetch: () => {
      void load().catch(() => undefined);
    },
    clear: () => {
      value = null;
      loadedAt = 0;
    },
  };
}
