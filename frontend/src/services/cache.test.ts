import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getCached, invalidateCache } from './cache';

describe('request cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useRealTimers();
  });

  it('deduplicates concurrent requests for the same key', async () => {
    let resolveRequest!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((resolve) => {
      resolveRequest = resolve;
    }));

    const first = getCached('employees', loader);
    const second = getCached('employees', loader);
    resolveRequest('loaded');

    await expect(Promise.all([first, second])).resolves.toEqual(['loaded', 'loaded']);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('refreshes an entry after its TTL expires', async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValue('loaded');

    await getCached('equipment-types', loader, 1_000);
    await getCached('equipment-types', loader, 1_000);
    expect(loader).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1_001);
    await getCached('equipment-types', loader, 1_000);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('reloads an entry after it is invalidated', async () => {
    const loader = vi.fn().mockResolvedValue('loaded');

    await getCached('employees', loader);
    invalidateCache('employees');
    await getCached('employees', loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
