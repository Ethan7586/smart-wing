import { describe, expect, it, vi } from 'vitest';
import { exchangeWechatCode } from './wechatAuthRoutes';

const env = {
  WECHAT_MINIAPP_APP_ID: 'wx-test-app',
  WECHAT_MINIAPP_APP_SECRET: 'server-only-secret',
};

describe('WeChat mini-program code exchange', () => {
  it('exchanges a one-time code without returning session_key', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe('api.weixin.qq.com');
      expect(url.searchParams.get('appid')).toBe('wx-test-app');
      expect(url.searchParams.get('secret')).toBe('server-only-secret');
      expect(url.searchParams.get('js_code')).toBe('one-time-code');
      return new Response(JSON.stringify({ openid: 'openid-1', unionid: 'unionid-1', session_key: 'must-not-leak' }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    await expect(exchangeWechatCode(env, 'one-time-code', fetcher as typeof fetch)).resolves.toEqual({ ok: true, openId: 'openid-1', unionId: 'unionid-1' });
  });

  it('maps an invalid code to a stable client error without provider detail', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), { headers: { 'content-type': 'application/json' } }));
    await expect(exchangeWechatCode(env, 'expired', fetcher as typeof fetch)).resolves.toEqual({
      ok: false,
      status: 401,
      code: 'INVALID_WECHAT_CODE',
      message: '微信登录凭证已失效，请重试',
    });
  });

  it('fails closed when WeChat cannot be reached', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network detail must not escape');
    });
    await expect(exchangeWechatCode(env, 'code', fetcher as typeof fetch)).resolves.toMatchObject({ ok: false, status: 502, code: 'WECHAT_AUTH_UNAVAILABLE' });
  });
});
