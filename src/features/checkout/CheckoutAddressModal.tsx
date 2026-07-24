import React from 'react';
import type { CheckoutModel } from './useCheckoutModel';

export const CheckoutAddressModal: React.FC<{ model: CheckoutModel }> = ({
  model
}) => {
  const {
    showAddAddrModal, setShowAddAddrModal, newAddrForm, setNewAddrForm,
    handleAddNewAddress
  } = model;
  if (!showAddAddrModal) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleAddNewAddress}
        className="bg-white rounded-md p-6 w-full max-w-lg space-y-4 shadow-2xl"
      >
        <div className="font-bold text-base border-b border-gray-100 pb-3">
          新增收货地址
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={newAddrForm.name}
            onChange={(event) =>
              setNewAddrForm({ ...newAddrForm, name: event.target.value })
            }
            placeholder="收货人"
            className="border border-gray-300 rounded px-3 py-2 text-xs"
          />
          <input
            value={newAddrForm.phone}
            onChange={(event) =>
              setNewAddrForm({ ...newAddrForm, phone: event.target.value })
            }
            placeholder="手机号"
            className="border border-gray-300 rounded px-3 py-2 text-xs"
          />
          <input
            value={newAddrForm.detail}
            onChange={(event) =>
              setNewAddrForm({ ...newAddrForm, detail: event.target.value })
            }
            placeholder="详细地址"
            className="col-span-2 border border-gray-300 rounded px-3 py-2 text-xs"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowAddAddrModal(false)}
            className="border border-gray-300 rounded px-4 py-2 text-xs"
          >
            取消
          </button>
          <button
            type="submit"
            className="bg-[#1F5EFF] text-white rounded px-4 py-2 text-xs font-bold"
          >
            保存地址
          </button>
        </div>
      </form>
    </div>
  );
};
