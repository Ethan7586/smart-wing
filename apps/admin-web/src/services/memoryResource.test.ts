import { describe, expect, it, vi } from 'vitest';
import { createMemoryResource } from './memoryResource';

describe('memory resource', () => {
  it('deduplicates concurrent requests and reuses a fresh value', async () => {
    const loader = vi.fn(async () => ({ version: 1 }));
    const resource = createMemoryResource(loader);
    const [first, second] = await Promise.all([resource.load(), resource.load()]);
    expect(first).toEqual({ version: 1 });
    expect(second).toEqual({ version: 1 });
    expect(await resource.load()).toEqual({ version: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps stale data visible while a forced refresh is running', async () => {
    let release: ((value: { version: number }) => void) | undefined;
    const loader = vi
      .fn<() => Promise<{ version: number }>>()
      .mockResolvedValueOnce({ version: 1 })
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const resource = createMemoryResource(loader);
    await resource.load();
    const refresh = resource.load({ force: true });
    expect(resource.peek()).toEqual({ version: 1 });
    release?.({ version: 2 });
    await expect(refresh).resolves.toEqual({ version: 2 });
    expect(resource.peek()).toEqual({ version: 2 });
  });
});
