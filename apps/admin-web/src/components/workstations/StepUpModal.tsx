import React, { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<void>;
  onVerified: () => void;
}

export function StepUpModal({ open, onClose, onVerify, onVerified }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
    }
  }, [open]);
  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || verifying) return;
    setVerifying(true);
    setError('');
    try {
      await onVerify(password);
      setPassword('');
      onVerified();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '身份验证失败');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="重新验证身份">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">重新验证身份</h3>
              <p className="text-xs text-slate-500 mt-1">敏感权限变更前，请输入当前账号密码。验证结果最多保留 15 分钟。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="关闭">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block text-xs font-bold text-slate-700">
            当前密码
            <input
              autoFocus
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="block mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        </div>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-600">
            取消
          </button>
          <button disabled={!password || verifying} className="px-4 py-2 rounded-xl bg-blue-600 disabled:bg-slate-300 text-white text-xs font-bold">
            {verifying ? '正在验证…' : '验证并继续'}
          </button>
        </div>
      </form>
    </div>
  );
}
