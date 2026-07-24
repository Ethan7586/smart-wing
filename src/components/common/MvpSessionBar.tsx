import React, { useState } from "react";
import { LogIn, LogOut, ShieldCheck, X } from "lucide-react";
import { useMall } from "../../context/MallContext";

export const MvpSessionBar: React.FC = () => {
  const {
    sessionStatus,
    login,
    logout,
    sessionError,
  } = useMall();
  const [showLogin, setShowLogin] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const ok = await login(accessCode);
    setSubmitting(false);
    if (ok) {
      setAccessCode("");
      setShowLogin(false);
    }
  };

  if (sessionStatus === "checking") {
    return (
      <div className="bg-[#EAF1FF] border-b border-blue-200 text-[#143A8F] text-xs py-2 px-4 text-center">
        正在建立安全会话并同步商城数据…
      </div>
    );
  }

  return (
    <>
      <div
        data-test-preview-allowed="true"
        className={`border-b text-xs py-2 px-4 ${
          sessionStatus === "authenticated"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-200 text-amber-900"
        }`}
      >
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {sessionStatus === "authenticated"
              ? "MVP安全会话已连接，账户与订单数据来自生产型数据库"
              : "当前为商品访客预览；登录后可体验福利账户、下单和订单查询"}
          </span>
          {sessionStatus === "authenticated" ? (
            <button
              onClick={() => void logout()}
              className="font-bold flex items-center gap-1 hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" /> 退出
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="bg-[#143A8F] text-white rounded px-3 py-1.5 font-bold flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" /> 登录MVP
            </button>
          )}
        </div>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <form
            data-test-preview-allowed="true"
            onSubmit={submit}
            className="w-full max-w-sm bg-white rounded-lg shadow-2xl border border-gray-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">智慧翼MVP安全登录</h2>
                <p className="text-[11px] text-gray-500 mt-1">
                  当前使用阶段验收访问码，正式版将替换为企业SSO。
                </p>
              </div>
              <button type="button" onClick={() => setShowLogin(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
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
            {sessionError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">
                {sessionError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1F5EFF] disabled:bg-blue-300 text-white font-bold rounded py-2.5 text-xs"
            >
              {submitting ? "正在验证…" : "登录并同步账户"}
            </button>
          </form>
        </div>
      )}
    </>
  );
};
