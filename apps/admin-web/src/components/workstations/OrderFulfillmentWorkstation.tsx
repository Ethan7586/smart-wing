import React, { useState } from 'react';
import { AlertTriangle, RotateCw, Clock, User, ShieldCheck, Building2, X, CreditCard, DollarSign, Ban, RefreshCw } from 'lucide-react';
import { Order } from '../../types';

interface OrderFulfillmentProps {
  orders: Order[];
  onUpdateOrders: (updatedOrders: Order[]) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
  initialProblemType?: string;
}

export const OrderFulfillmentWorkstation: React.FC<OrderFulfillmentProps> = ({ orders, onUpdateOrders, onOpenGuardrail, initialProblemType }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'ALL' | 'ARCHIVED'>('PENDING');
  const [problemFilter, setProblemFilter] = useState<string>(initialProblemType || 'ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orders.find((o) => o.isProblematic)?.id || orders[0]?.id || null);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Filtering
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'PENDING' && !o.isProblematic && o.status !== '退款申请中') return false;
    if (activeTab === 'ARCHIVED' && o.status !== '已签收' && o.status !== '已退款') return false;

    if (problemFilter !== 'ALL') {
      if (problemFilter === 'STOCK_CONFLICT' && o.problemType !== 'STOCK_CONFLICT') return false;
      if (problemFilter === 'SLA_TIMEOUT' && o.problemType !== 'SLA_TIMEOUT') return false;
      if (problemFilter === 'REFUND_DISPUTE' && o.problemType !== 'REFUND_DISPUTE') return false;
    }
    return true;
  });

  // Action 1: Refund Guardrail Modal
  const handleTriggerRefund = (ord: Order) => {
    onOpenGuardrail(`退款确认处理: 订单号 ${ord.id}`, '订单原路退款', `${ord.enterpriseName} - ${ord.employeeName}`, ord.id, ord.totalAmount, (reason, evidence) => {
      const updated = orders.map((o) => {
        if (o.id === ord.id) {
          return {
            ...o,
            status: '已退款' as const,
            isProblematic: false,
            timeline: [
              ...o.timeline,
              {
                id: `TL-RF-${Date.now()}`,
                nodeName: '退款',
                timestamp: new Date().toLocaleString('zh-CN'),
                status: 'success' as const,
                operator: '张立 (COO)',
                remark: `退款成功！资金解冻并返还企业与员工。原因: ${reason}. 凭证: ${evidence}`,
              },
            ],
          };
        }
        return o;
      });
      onUpdateOrders(updated);
      alert(`退款执行成功！¥${ord.totalAmount} 已原路解冻划拨。`);
    });
  };

  // Action 2: Compensation
  const handleTriggerCompensation = (ord: Order) => {
    onOpenGuardrail(`为超时订单开具赔付补发优惠券`, 'SLA发货超时赔付', ord.employeeName, ord.id, 50, (reason) => {
      alert(`已成功为员工 ${ord.employeeName} 补发 50 元关怀优惠券，写入补偿单！`);
    });
  };

  // Action 3: Force Close Order
  const handleForceClose = (ord: Order) => {
    onOpenGuardrail(`强制关单: 订单号 ${ord.id}`, '高风险强制关单', ord.enterpriseName, ord.id, ord.totalAmount, (reason) => {
      const updated = orders.map((o) => {
        if (o.id === ord.id) {
          return {
            ...o,
            status: '已退款' as const,
            isProblematic: false,
            timeline: [
              ...o.timeline,
              {
                id: `TL-[#FC]-${Date.now()}`,
                nodeName: '强制关单',
                timestamp: new Date().toLocaleString('zh-CN'),
                status: 'error' as const,
                operator: '张立 (COO)',
                remark: `超卖异常拦截，强制关单。理由: ${reason}`,
              },
            ],
          };
        }
        return o;
      });
      onUpdateOrders(updated);
      alert('已强制关闭该订单！');
    });
  };

  // Action 4: Manual Takeover Supplier Notification Retry
  const handleManualTakeoverSupplier = (ord: Order) => {
    const updated = orders.map((o) => {
      if (o.id === ord.id) {
        return {
          ...o,
          retryLogs: [
            ...o.retryLogs,
            {
              attempt: o.retryLogs.length + 1,
              timestamp: new Date().toLocaleString('zh-CN'),
              targetService: `${ord.supplierName} ERP`,
              status: 'SUCCESS' as const,
              httpCode: 200,
              message: '人工接管重试：已手动通过专线补发锁库和派单Token',
            },
          ],
        };
      }
      return o;
    });
    onUpdateOrders(updated);
    alert('人工接管重试成功！接口Token已重新灌入。');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Problem-Driven Tabs & Filters */}
      <div className="bg-white p-5 rounded-[14px] border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>订单履约工作台 (Fulfillment Workstation)</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">默认视图：异常与问题订单优先</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">监控从库存预占、供应商接单到资金分摊与退款争议的全链路节点</p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${activeTab === 'PENDING' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              待处理异常问题单 ({orders.filter((o) => o.isProblematic).length})
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'ALL' ? 'bg-[#1769ff] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              全部订单 ({orders.length})
            </button>

            <button
              onClick={() => setActiveTab('ARCHIVED')}
              className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'ARCHIVED' ? 'bg-[#1769ff] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              已归档历史
            </button>
          </div>
        </div>

        {/* Sub-Filters */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">问题维度子筛选：</span>
          <button onClick={() => setProblemFilter('ALL')} className={`px-2.5 py-1 rounded-lg border font-medium ${problemFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            全部问题
          </button>
          <button
            onClick={() => setProblemFilter('STOCK_CONFLICT')}
            className={`px-2.5 py-1 rounded-lg border font-medium ${problemFilter === 'STOCK_CONFLICT' ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
          >
            🔥 物理超卖 / 库存冲突
          </button>
          <button
            onClick={() => setProblemFilter('SLA_TIMEOUT')}
            className={`px-2.5 py-1 rounded-lg border font-medium ${problemFilter === 'SLA_TIMEOUT' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200'}`}
          >
            ⏱️ 48H SLA 发货超时
          </button>
          <button
            onClick={() => setProblemFilter('REFUND_DISPUTE')}
            className={`px-2.5 py-1 rounded-lg border font-medium ${problemFilter === 'REFUND_DISPUTE' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-50 text-purple-800 border-purple-200'}`}
          >
            💳 组合支付退款争议
          </button>
        </div>
      </div>

      {/* Main Split Layout: Orders List vs Single Order Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Orders List */}
        <div className="lg:col-span-5 bg-white rounded-[14px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[750px]">
          <div className="p-3 bg-slate-100/80 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>问题订单队列 ({filteredOrders.length})</span>
            <span className="text-[10px] text-slate-400">点击查看全维度时间线节点</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
            {filteredOrders.map((ord) => {
              const isSelected = selectedOrder?.id === ord.id;
              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer space-y-2 ${isSelected ? 'bg-white border-[#1769ff] shadow-md ring-2 ring-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{ord.id}</span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                        ord.status === '异常挂起'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : ord.status === '退款申请中'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold line-clamp-1">{ord.enterpriseName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-medium">{ord.employeeName}</span>
                  </div>

                  {ord.problemSummary && <div className="p-2 bg-rose-50/80 rounded-lg border border-rose-200/80 text-[11px] text-rose-900 font-medium">⚠️ {ord.problemSummary}</div>}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>金额: ¥{ord.totalAmount.toLocaleString('zh-CN')}</span>
                    <span className="font-mono">SLA: {ord.slaDeadline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Single Order Details */}
        {selectedOrder ? (
          <div className="lg:col-span-7 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-6 space-y-6 overflow-y-auto max-h-[750px]">
            {/* Header & Guardrail Action Buttons */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-mono font-bold text-slate-900">{selectedOrder.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-[#1769ff] font-semibold border border-blue-200">{selectedOrder.enterpriseName}</span>
                </div>
                <p className="text-xs text-slate-500">
                  下单时间：{selectedOrder.createdAt} · 运送地址：{selectedOrder.shippingAddress}
                </p>
              </div>

              {/* Guardrail Interaction Buttons (Refund, Compensation, Force Close) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTriggerCompensation(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  SLA超时赔付
                </button>

                <button
                  onClick={() => handleForceClose(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>强制关单</span>
                </button>

                <button onClick={() => handleTriggerRefund(selectedOrder)} className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-colors">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>极速原路退款</span>
                </button>
              </div>
            </div>

            {/* TIMELINE NODES (从上到下依次：创建 → 库存预占 → 支付 → 供应商接单 → 发货 → 签收 → 售后 → 退款) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#1769ff]" />
                <span>订单全生命周期履约时间线节点 (Full-Lifecycle Timeline)</span>
              </h3>

              <div className="space-y-3 border-l-2 border-slate-300 ml-3 pl-4 text-xs">
                {selectedOrder.timeline.map((node) => (
                  <div key={node.id} className="relative pb-1">
                    <div
                      className={`absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center ${
                        node.status === 'error' ? 'bg-rose-600 ring-2 ring-rose-200' : node.status === 'warning' ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-emerald-500 ring-2 ring-emerald-200'
                      }`}
                    />
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>节点：[{node.nodeName}]</span>
                      <span className="text-[10px] text-slate-400 font-mono">{node.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      操作主体: <span className="font-semibold text-slate-800">{node.operator}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-200/90 mt-1">{node.remark}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* THREE DETAIL CARDS: Benefits Card, Product Snapshot, Funds Allocation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Card 1: Customer Benefits Card */}
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1.5">
                <div className="font-bold text-blue-900 flex items-center gap-1">
                  <CreditCard className="w-4 h-4 text-[#1769ff]" />
                  <span>客户福利权益卡片</span>
                </div>
                <div className="text-slate-700 font-semibold text-[11px]">福利计划: {selectedOrder.benefitsCard.welfarePlanName}</div>
                <div className="text-[11px] text-slate-600">
                  本单扣减: <span className="font-bold text-blue-800">¥{selectedOrder.benefitsCard.quotaUsed}</span>
                </div>
                <div className="text-[10px] text-slate-400">员工个人扣后剩余: ¥{selectedOrder.benefitsCard.remainingQuota}</div>
              </div>

              {/* Card 2: Product Snapshot */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-800 block">商品交易快照</span>
                <div className="flex items-center gap-2">
                  <img src={selectedOrder.productImage} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                  <div>
                    <span className="font-semibold text-slate-900 line-clamp-1">{selectedOrder.productTitle}</span>
                    <span className="text-[10px] text-slate-500">{selectedOrder.specName}</span>
                  </div>
                </div>
                <div className="text-right font-bold text-slate-900">
                  x{selectedOrder.quantity} 件 · 单价 ¥{selectedOrder.unitPrice}
                </div>
              </div>

              {/* Card 3: Funds Allocation Table */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-800 block">资金分摊表 (Split Payment)</span>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">企业公户预算支付:</span>
                    <span className="font-bold text-slate-800">¥{selectedOrder.corporateBudgetPaid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">员工个人微信/支付宝自付:</span>
                    <span className="font-bold text-slate-800">¥{selectedOrder.employeeSelfPaid}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                    <span>订单应付总额:</span>
                    <span className="text-[#1769ff]">¥{selectedOrder.totalAmount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* EXTERNAL CALLING RETRY LOGS & MANUAL TAKEOVER */}
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>外部供应商 Call 重试记录与容错 (Idempotency Retry Logs)</span>
                </div>

                <button
                  onClick={() => handleManualTakeoverSupplier(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>人工接管与重试干预</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {selectedOrder.retryLogs.length > 0 ? (
                  selectedOrder.retryLogs.map((log, i) => (
                    <div key={i} className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between font-mono">
                      <div>
                        <span className="font-bold text-slate-800 mr-2">
                          第 {log.attempt} 次重试 [{log.targetService}]
                        </span>
                        <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                        <p className="text-slate-600 font-sans text-[11px] mt-0.5">{log.message}</p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {log.status} ({log.httpCode || 500})
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-[11px] italic">暂无接口失败重试调高记录，API 调用链路平稳。</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 bg-white rounded-[14px] border border-slate-200/90 shadow-xs p-12 flex items-center justify-center text-slate-400 text-xs">请在左侧选择一个订单以查看履约全貌</div>
        )}
      </div>
    </div>
  );
};
