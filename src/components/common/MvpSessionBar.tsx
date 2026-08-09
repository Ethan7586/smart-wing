import React, { useState } from 'react';
import { LogIn, LogOut, ShieldCheck, X } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import type { LoginCredentials } from '../../context/MallContext.types';

export const MvpSessionBar: React.FC = () => {
  const { sessionStatus, login, logout, sessionError } = useMall();
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<'accessCode' | 'account'>('accessCode');
  const [accessCode, setAccessCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const credentials: LoginCredentials = loginMode === 'account' ? { username, password } : { accessCode };
    const ok = await login(credentials);
    setSubmitting(false);
    if (ok) {
      setAccessCode('');
      setUsername('');
      setPassword('');
      setShowLogin(false);
    }
  };

  if (sessionStatus === 'checking') {
    return <div className="bg-[#EAF1FF] border-b border-blue-200 text-[#143A8F] text-xs py-2 px-4 text-center">正在建立安全会话并同步商城数据…</div>;
  }

  return (
    <>
      <div className={`border-b text-xs py-2 px-4 ${sessionStatus === 'authenticated' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {sessionStatus === 'authenticated' ? 'MVP安全会话已连接，账户与订单数据来自生产型数据库' : '当前为商品访客预览；登录后可体验福利账户、下单和订单查询'}
          </span>
          {sessionStatus === 'authenticated' ? (
            <button onClick={() => void logout()} className="font-bold flex items-center gap-1 hover:underline">
              <LogOut className="w-3.5 h-3.5" /> 退出
            </button>
          ) : (
            <button onClick={() => setShowLogin(true)} className="bg-[#143A8F] text-white rounded px-3 py-1.5 font-bold flex items-center gap-1">
              <LogIn className="w-3.5 h-3.5" /> 登录MVP
            </button>
          )}
        </div>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-lg shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">智慧翼MVP安全登录</h2>
                <p className="text-[11px] text-gray-500 mt-1">当前可用“访问码”或“用户名+密码”登录。</p>
                <div className="mt-3 flex rounded border border-gray-200 bg-gray-50 text-xs text-gray-600 overflow-hidden">
                  <button type="button" className={`px-3 py-1.5 flex-1 ${loginMode === 'accessCode' ? 'bg-white font-bold text-[#143A8F]' : 'hover:bg-gray-100'}`} onClick={() => setLoginMode('accessCode')}>
                    访问码登录
                  </button>
                  <button type="button" className={`px-3 py-1.5 flex-1 ${loginMode === 'account' ? 'bg-white font-bold text-[#143A8F]' : 'hover:bg-gray-100'}`} onClick={() => setLoginMode('account')}>
                    账号密码登录
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setShowLogin(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {loginMode === 'accessCode' ? (
              <label className="block text-xs font-bold text-gray-700">
                阶段验收访问码
                <input
                  autoFocus
                  type="password"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete="current-password"
                  className="mt-2 w-full border border-gray-300 rounded px-3 py-2.5 outline-none focus:border-[#1F5EFF]"
                  placeholder="请输入雍彻科技提供的访问码"
                />
              </label>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-700">
                  账号
                  <input
                    autoFocus
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    autoComplete="username"
                    className="mt-2 w-full border border-gray-300 rounded px-3 py-2.5 outline-none focus:border-[#1F5EFF]"
                    placeholder="请输入账号（如 onewr / 李厚亿）"
                  />
                </label>
                <label className="block text-xs font-bold text-gray-700">
                  密码
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="mt-2 w-full border border-gray-300 rounded px-3 py-2.5 outline-none focus:border-[#1F5EFF]"
                    placeholder="请输入密码"
                  />
                </label>
              </div>
            )}
            {sessionError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">{sessionError}</p>}
            <button type="submit" disabled={submitting} className="w-full bg-[#1F5EFF] disabled:bg-blue-300 text-white font-bold rounded py-2.5 text-xs">
              {submitting ? '正在验证…' : '登录并同步账户'}
            </button>
          </form>
        </div>
      )}
    </>
  );
};
