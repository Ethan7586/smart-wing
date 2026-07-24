import React from 'react';
import { MapPin, Plus } from 'lucide-react';
import type { CheckoutModel } from './useCheckoutModel';

export const CheckoutAddressSelector: React.FC<{ model: CheckoutModel }> = ({
  model
}) => {
  const {
    addresses, selectedAddrId, setSelectedAddrId, setShowAddAddrModal
  } = model;
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#1F5EFF]" />
          <span>选择收货地址 / 配送地点</span>
        </div>
        <button
          onClick={() => setShowAddAddrModal(true)}
          className="text-xs text-[#1F5EFF] font-bold hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> 新增收货地址
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        {addresses.map((address) => {
          const selected = selectedAddrId === address.id;
          return (
            <button
              type="button"
              key={address.id}
              onClick={() => setSelectedAddrId(address.id)}
              className={`p-3 rounded border text-left transition-all ${
                selected
                  ? 'border-[#1F5EFF] bg-blue-50/60 ring-2 ring-blue-500/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <span className="font-bold text-gray-900">
                {address.name} ({address.phone})
              </span>
              <span className="block text-gray-600 leading-relaxed">
                {address.province}{address.city}{address.district}{address.detail}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
