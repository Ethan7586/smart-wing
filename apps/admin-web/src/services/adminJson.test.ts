import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasArrayProperties, requestAdminJson } from './adminJson';

function respond(body: string, init: { status?: number } = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status: init.status ?? 200 }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin json transport', () => {
  it('returns the parsed object on success', async () => {
    respond(JSON.stringify({ members: [{ membershipId: 'm-1' }] }));
    await expect(requestAdminJson<{ members: unknown[] }>('/api/v1/admin/access-control', { label: '权限服务' })).resolves.toEqual({ members: [{ membershipId: 'm-1' }] });
  });

  it('rejects a 200 that returns the SPA shell instead of JSON', async () => {
    // The dev server and the CDN both answer unknown paths with index.html.
    respond('<!doctype html><html><body></body></html>');
    await expect(requestAdminJson('/api/v1/admin/access-control', { label: '权限服务' })).rejects.toThrow('权限服务返回了非预期内容');
  });

  it('rejects JSON that is missing fields required by a read model', async () => {
    respond(JSON.stringify({}));
    await expect(
      requestAdminJson<{ members: unknown[] }>('/api/v1/admin/access-control', {
        label: '权限服务',
        validate: (payload): payload is { members: unknown[] } => hasArrayProperties(payload, ['members']),
      })
    ).rejects.toThrow('权限服务返回了不完整的数据');
  });

  it('surfaces the server error message when the API rejects the request', async () => {
    respond(JSON.stringify({ error: { message: '没有查看会员的权限' } }), { status: 403 });
    await expect(requestAdminJson('/api/v1/admin/access-control', { label: '权限服务' })).rejects.toThrow('没有查看会员的权限');
  });

  it('falls back to a labelled message when the failure carries no detail', async () => {
    respond('', { status: 500 });
    await expect(requestAdminJson('/api/v1/admin/access-control', { label: '资格服务' })).rejects.toThrow('资格服务请求失败 (500)');
  });

  it('accepts 207 partial success without extra configuration', async () => {
    // Response.ok already spans 200-299, so member import partial results pass.
    respond(JSON.stringify({ imported: 3, skipped: 1 }), { status: 207 });
    await expect(requestAdminJson('/api/v1/admin/member-operations/imports', { label: '会员运营' })).resolves.toEqual({ imported: 3, skipped: 1 });
  });

  it('rejects a genuine non-2xx code', async () => {
    respond(JSON.stringify({}), { status: 404 });
    await expect(requestAdminJson('/api/v1/admin/access-control', { label: '权限服务' })).rejects.toThrow('权限服务请求失败 (404)');
  });
});
