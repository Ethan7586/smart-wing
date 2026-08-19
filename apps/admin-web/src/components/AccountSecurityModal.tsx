import React, { useEffect, useState } from 'react';
import { KeyRound, Laptop, Loader2, Phone, ShieldCheck, Smartphone, X } from 'lucide-react';
import { requestAdminJson } from '../services/adminJson';

type DeviceSession = { id: string; target: 'storefront' | 'admin'; deviceLabel: string; lastSeenAt: string; current: boolean };
type SecurityCenter = { hasLocalCredential: boolean; phoneMasked: string | null; passwordChangedAt: string | null; sessions: DeviceSession[] };

export const AccountSecurityModal: React.FC<{ open: boolean; onClose: () => void; onSignedOut: () => void }> = ({ open, onClose, onSignedOut }) => {
  const [data, setData] = useState<SecurityCenter | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [phone, setPhone] = useState({ newMobile: '', code: '', challengeId: '', currentPassword: '' });
  const load = async () => {
    setBusy(true);
    try {
      setData(await api<SecurityCenter>('/api/v1/auth/security-center'));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open) void load();
  }, [open]);
  if (!open) return null;
  const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirm) return setMessage('两次输入的新密码不一致');
    setBusy(true);
    try {
      await api('/api/v1/auth/password/change', { method: 'POST', body: JSON.stringify(passwords) });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage('密码已更新，其他设备已下线');
      await load();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const sendCode = async () => {
    setBusy(true);
    try {
      const result = await api<{ challengeId: string; debugCode?: string }>('/api/v1/auth/security/otp', { method: 'POST', body: JSON.stringify({ mobile: phone.newMobile, purpose: 'phone_change' }) });
      setPhone((current) => ({ ...current, challengeId: result.challengeId, code: result.debugCode ?? current.code }));
      setMessage(result.debugCode ? `开发环境验证码：${result.debugCode}` : '验证码已发送');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const changePhone = async () => {
    setBusy(true);
    try {
      await api('/api/v1/auth/phone/change', { method: 'POST', body: JSON.stringify(phone) });
      setPhone({ newMobile: '', code: '', challengeId: '', currentPassword: '' });
      setMessage('手机号已绑定，其他设备已下线');
      await load();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (session: DeviceSession) => {
    setBusy(true);
    try {
      await api(`/api/v1/auth/sessions/${session.id}`, { method: 'DELETE' });
      if (session.current) {
        onSignedOut();
        return;
      }
      setMessage('该设备已下线');
      await load();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-5 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
              <ShieldCheck className="h-5 w-5 text-[var(--sw-brand)]" />
              账号与会员安全中心
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">密码、手机号、二次验证和设备会话均由服务端保护</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-6">
          {message && <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">{message}</p>}
          {busy && !data && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在读取安全状态...
            </p>
          )}
          {data?.hasLocalCredential ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="修改密码" icon={<KeyRound className="h-4 w-4" />} note={`上次修改：${date(data.passwordChangedAt)}`}>
                <PasswordField label="当前密码" value={passwords.currentPassword} setValue={(currentPassword) => setPasswords({ ...passwords, currentPassword })} />
                <PasswordField label="新密码" value={passwords.newPassword} setValue={(newPassword) => setPasswords({ ...passwords, newPassword })} />
                <PasswordField label="确认新密码" value={passwords.confirm} setValue={(confirm) => setPasswords({ ...passwords, confirm })} />
                <Action disabled={busy} onClick={changePassword}>
                  更新密码并下线其他设备
                </Action>
              </Card>
              <Card title="绑定或更换手机号" icon={<Phone className="h-4 w-4" />} note={`当前绑定：${data.phoneMasked ?? '尚未绑定'}`}>
                <Field label="新手机号" value={phone.newMobile} setValue={(newMobile) => setPhone({ ...phone, newMobile })} />
                <div className="flex items-end gap-2">
                  <Field label="验证码" value={phone.code} setValue={(code) => setPhone({ ...phone, code })} />
                  <button onClick={sendCode} className="h-[34px] shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-bold text-blue-700">
                    获取验证码
                  </button>
                </div>
                <PasswordField label="当前密码" value={phone.currentPassword} setValue={(currentPassword) => setPhone({ ...phone, currentPassword })} />
                <Action disabled={busy || !phone.challengeId} onClick={changePhone}>
                  确认绑定手机号
                </Action>
              </Card>
            </div>
          ) : (
            data && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">当前身份尚未迁移到本地密码，只开放设备管理。</p>
          )}
          {data && (
            <Card title="登录设备" icon={<Laptop className="h-4 w-4" />} note={`${data.sessions.length} 个有效会话`}>
              <div className="divide-y rounded-xl border bg-white">
                {data.sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-3">
                      {session.deviceLabel.match(/Android|iOS/) ? <Smartphone className="h-4 w-4 text-blue-600" /> : <Laptop className="h-4 w-4 text-blue-600" />}
                      <div>
                        <div className="font-bold text-slate-900">
                          {session.deviceLabel}
                          {session.current && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">当前设备</span>}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          最近活动 {date(session.lastSeenAt)} · {session.target === 'admin' ? '管理后台' : '员工商城'}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => revoke(session)} className="text-[11px] font-bold text-rose-600">
                      强制下线
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api<{ revokedCount: number }>('/api/v1/auth/sessions/revoke-others', { method: 'POST' });
                    setMessage(`已下线其他 ${r.revokedCount} 个会话`);
                    await load();
                  } catch (error) {
                    setMessage(errorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-left text-xs font-bold text-rose-600"
              >
                下线其他全部设备
              </button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; icon: React.ReactNode; note: string; children: React.ReactNode }> = ({ title, icon, note, children }) => (
  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2 text-blue-700">
      {icon}
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-[10px] text-slate-400">{note}</p>
      </div>
    </div>
    {children}
  </section>
);
const Field: React.FC<{ label: string; value: string; setValue: (v: string) => void }> = ({ label, value, setValue }) => (
  <label className="block flex-1 text-[11px] font-medium text-slate-600">
    {label}
    <input value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
  </label>
);
const PasswordField: React.FC<{ label: string; value: string; setValue: (v: string) => void }> = ({ label, value, setValue }) => (
  <label className="block text-[11px] font-medium text-slate-600">
    {label}
    <input type="password" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
  </label>
);
const Action: React.FC<{ disabled: boolean; onClick: () => void; children: React.ReactNode }> = ({ disabled, onClick, children }) => (
  <button disabled={disabled} onClick={onClick} className="w-full rounded-lg bg-[var(--sw-brand)] px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300">
    {children}
  </button>
);
async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  return requestAdminJson<T>(path, { label: '账号安全服务', headers: { 'content-type': 'application/json' }, ...init });
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '安全服务暂时不可用';
}
function date(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '暂无记录';
}
