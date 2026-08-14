import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, X, History, RotateCcw, Check, Zap } from 'lucide-react';
import { Product, ProductStatus } from '../../types';

interface ProductGovernanceProps {
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  onOpenGuardrail: (title: string, actionType: string, targetName: string, entityId: string, amount: number, onConfirm: (reason: string, evidence: string) => void) => void;
  initialFilterStatus?: string;
  isLiveCatalog?: boolean;
  onSetProductStatus?: (productId: string, status: 'active' | 'inactive') => Promise<void>;
}

const STATUS_PIPELINE: ProductStatus[] = ['草稿', '已导入', '待补全', '待分类审核', '待发布审核', '已发布', '已下架'];

export const ProductGovernanceWorkstation: React.FC<ProductGovernanceProps> = ({ products, onUpdateProducts, onOpenGuardrail, initialFilterStatus, isLiveCatalog = false, onSetProductStatus }) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilterStatus || 'ALL');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'PUBLISH_CHECK' | 'AUDIT'>('QUEUE');
  const [isClassifyingAi, setIsClassifyingAi] = useState(false);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Filtered Product List
  const filteredProducts = products.filter((p) => {
    if (selectedStatus !== 'ALL' && p.status !== selectedStatus) return false;
    if (searchQuery && !p.title.includes(searchQuery) && !p.spuCode.includes(searchQuery) && !p.brand.includes(searchQuery)) {
      return false;
    }
    return true;
  });

  // Batch Select Toggle
  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter((item) => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  // Call Gemini API for AI Category Copilot
  const handleRunAiClassification = async (prd: Product) => {
    setIsClassifyingAi(true);
    try {
      const res = await fetch('/api/ai/classify-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prd.title,
          attributes: prd.skus,
          supplierCategory: prd.supplierCategory,
          price: prd.mallPrice,
        }),
      });
      const aiRes = await res.json();

      const updated = products.map((p) => {
        if (p.id === prd.id) {
          return {
            ...p,
            aiSuggestion: {
              categoryL1: aiRes.categoryL1,
              categoryL2: aiRes.categoryL2,
              categoryL3: aiRes.categoryL3,
              confidence: aiRes.confidence,
              reasoning: aiRes.reasoning,
              needsHumanReview: aiRes.confidence < 70,
            },
          };
        }
        return p;
      });
      onUpdateProducts(updated);
    } catch (err) {
      console.error('Classification AI Error', err);
    } finally {
      setIsClassifyingAi(false);
    }
  };

  // Batch Accept AI Classification & Advance to "待发布审核"
  const handleBatchAcceptAiCategory = () => {
    if (selectedProductIds.length === 0) return;

    onOpenGuardrail(`批量采纳 AI 品类建议并推进`, '分类治理与状态推进', `已选 ${selectedProductIds.length} 项商品`, 'BATCH-CLASSIFY', 0, (reason, evidence) => {
      const updated = products.map((p) => {
        if (selectedProductIds.includes(p.id)) {
          const sug = p.aiSuggestion || {
            categoryL1: '办公用品',
            categoryL2: '办公设备',
            categoryL3: '通用设备',
            confidence: 85,
          };
          return {
            ...p,
            categoryL1: sug.categoryL1,
            categoryL2: sug.categoryL2,
            categoryL3: sug.categoryL3,
            status: '待发布审核' as ProductStatus,
            checklist: { ...p.checklist, category: true },
            missingFields: p.missingFields.filter((f) => !f.startsWith('taxonomy')),
            versions: [
              ...p.versions,
              {
                version: `v1.${p.versions.length + 1}.0`,
                updatedAt: new Date().toLocaleString('zh-CN'),
                operator: '张立 (COO)',
                reason: `批量采纳AI类目 [${sug.categoryL1} > ${sug.categoryL2} > ${sug.categoryL3}]. 业务原因: ${reason}`,
                fieldChanges: [
                  { field: 'categoryL1', fieldName: '一级类目', oldValue: '未定义', newValue: sug.categoryL1 },
                  { field: 'categoryL2', fieldName: '二级类目', oldValue: '未定义', newValue: sug.categoryL2 },
                  { field: 'categoryL3', fieldName: '三级类目', oldValue: '未定义', newValue: sug.categoryL3 },
                  { field: 'status', fieldName: '商品状态', oldValue: p.status, newValue: '待发布审核' },
                ],
              },
            ],
          };
        }
        return p;
      });
      onUpdateProducts(updated);
      setSelectedProductIds([]);
      alert(`已成功将 ${selectedProductIds.length} 个商品推进行至【待发布审核】阶段！`);
    });
  };

  // Single Product Accept Classification
  const handleAcceptSingleClassification = (prd: Product) => {
    const sug = prd.aiSuggestion || {
      categoryL1: '办公用品',
      categoryL2: '办公家具',
      categoryL3: '人体工学椅',
    };

    onOpenGuardrail(`采纳分类建议并升级状态: ${prd.title.slice(0, 15)}...`, '品类分类确认', prd.spuCode, prd.id, 0, (reason) => {
      const updated = products.map((p) => {
        if (p.id === prd.id) {
          return {
            ...p,
            categoryL1: sug.categoryL1,
            categoryL2: sug.categoryL2,
            categoryL3: sug.categoryL3,
            status: '待发布审核' as ProductStatus,
            checklist: { ...p.checklist, category: true },
            missingFields: p.missingFields.filter((f) => !f.startsWith('taxonomy')),
            versions: [
              ...p.versions,
              {
                version: `v1.${p.versions.length + 1}.0`,
                updatedAt: new Date().toLocaleString('zh-CN'),
                operator: '张立 (COO)',
                reason: `采纳AI类目推荐: ${sug.categoryL1} > ${sug.categoryL2} > ${sug.categoryL3}. ${reason}`,
                fieldChanges: [
                  { field: 'categoryL1', fieldName: '一级类目', oldValue: '缺失', newValue: sug.categoryL1 },
                  { field: 'status', fieldName: '商品状态', oldValue: p.status, newValue: '待发布审核' },
                ],
              },
            ],
          };
        }
        return p;
      });
      onUpdateProducts(updated);
      alert('已完成分类打标，商品自动升级至【待发布审核】状态！');
    });
  };

  // Publish Product
  const handlePublishProduct = (prd: Product) => {
    // Validate Checklist
    const allPassed = Object.values(prd.checklist).every((v) => v === true);
    if (!allPassed) {
      alert('发布失败：校验清单尚未全绿（存在未满足项目），不允许发布！');
      return;
    }

    onOpenGuardrail(`正式发布商品全网上线: ${prd.title.slice(0, 15)}...`, '商品正式发布上线', prd.title, prd.id, prd.mallPrice, async (reason) => {
      if (isLiveCatalog && onSetProductStatus) {
        try {
          await onSetProductStatus(prd.id, 'active');
        } catch {
          window.alert('商品发布未成功，请刷新后重试。');
          return;
        }
      }
      const updated = products.map((p) => {
        if (p.id === prd.id) {
          return {
            ...p,
            status: '已发布' as ProductStatus,
            versions: [
              ...p.versions,
              {
                version: `v2.0.0`,
                updatedAt: new Date().toLocaleString('zh-CN'),
                operator: '张立 (COO)',
                reason: `校验全绿，审核通过正式上架发布。原因: ${reason}`,
                fieldChanges: [{ field: 'status', fieldName: '商品状态', oldValue: p.status, newValue: '已发布' }],
              },
            ],
          };
        }
        return p;
      });
      onUpdateProducts(updated);
      alert(isLiveCatalog ? '商品已通过服务端发布并写入审计记录。' : '商品发布成功！已对指定企业可见。');
    });
  };

  // Rollback Version
  const handleRollbackVersion = (prd: Product) => {
    if (prd.versions.length <= 1) {
      alert('无上一个历史版本可供回滚！');
      return;
    }

    onOpenGuardrail(`回滚商品版本至上一版本`, '版本一键回滚', prd.title, prd.id, 0, (reason) => {
      const prevVer = prd.versions[prd.versions.length - 2];
      const updated = products.map((p) => {
        if (p.id === prd.id) {
          return {
            ...p,
            status: '待分类审核' as ProductStatus,
            checklist: { ...p.checklist, category: false },
            versions: [
              ...p.versions,
              {
                version: `v1.0.0-RESTORED`,
                updatedAt: new Date().toLocaleString('zh-CN'),
                operator: '张立 (COO)',
                reason: `一键回滚至版本 ${prevVer.version}。原因: ${reason}`,
                fieldChanges: [{ field: 'status', fieldName: '商品状态', oldValue: p.status, newValue: '待分类审核' }],
              },
            ],
          };
        }
        return p;
      });
      onUpdateProducts(updated);
      alert(`已成功回滚商品至 ${prevVer.version} 状态！`);
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Status Machine Pipeline Progress Bar */}
      <div className="bg-white p-5 rounded-[14px] border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>商品生命周期治理管道 (Product Lifecycle State Machine)</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--sw-brand)] border border-blue-200">当前授权目录：{products.length} 个</span>
            {isLiveCatalog && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">生产目录实时读取</span>}
          </h2>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveTab('QUEUE')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'QUEUE' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              商品治理队列
            </button>
            <button
              onClick={() => setActiveTab('PUBLISH_CHECK')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'PUBLISH_CHECK' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              发布校验中心
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${activeTab === 'AUDIT' ? 'bg-[var(--sw-brand)] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              变更审计流水
            </button>
          </div>
        </div>

        {/* Pipeline Step Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100">
          {STATUS_PIPELINE.map((st) => {
            const count = products.filter((p) => p.status === st).length;
            const isSelected = selectedStatus === st;

            return (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected ? 'bg-[var(--sw-brand)] text-white border-[var(--sw-brand)] shadow-md ring-2 ring-blue-300' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-semibold opacity-90">{st}</div>
                <div className="text-lg font-bold mt-0.5">{count}</div>
                {st === '待分类审核' && count > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'QUEUE' && (
        <div className="bg-white rounded-[14px] border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          {/* Table Action Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索 SPU编码 / 商品名称 / 品牌..."
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />

              <div className="text-xs font-medium text-slate-500">
                当前筛选状态：
                <span className="font-bold text-slate-800 ml-1">{selectedStatus}</span>
                <span className="text-slate-400 ml-1">({filteredProducts.length} 件)</span>
              </div>
            </div>

            {/* Batch Action Buttons */}
            {selectedStatus === '待分类审核' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBatchAcceptAiCategory}
                  disabled={selectedProductIds.length === 0}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all ${
                    selectedProductIds.length > 0 ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>一键采纳 AI 分类 (已选 {selectedProductIds.length} 项)</span>
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="p-3 w-10 text-center">
                    <input type="checkbox" checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length} onChange={toggleSelectAll} className="rounded text-[var(--sw-brand)]" />
                  </th>
                  <th className="p-3">SPU编码 / 商品名称</th>
                  <th className="p-3">品牌 & 供应商</th>
                  <th className="p-3">三级电商类目</th>
                  <th className="p-3 text-right">商城价 / 专属价</th>
                  <th className="p-3 text-right">总库存</th>
                  <th className="p-3">风险等级 / 缺失项</th>
                  <th className="p-3">状态 & AI Copilot 预测</th>
                  <th className="p-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredProducts.map((prd) => {
                  const isChecked = selectedProductIds.includes(prd.id);
                  const isDrawerSelected = selectedProductId === prd.id;

                  return (
                    <tr key={prd.id} className={`hover:bg-blue-50/40 transition-colors ${isDrawerSelected ? 'bg-blue-50/80 font-medium' : ''}`}>
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelectOne(prd.id)} className="rounded text-[var(--sw-brand)]" />
                      </td>

                      {/* Title & Image */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img src={prd.mainImage} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 block">{prd.spuCode}</span>
                            <span className="font-semibold text-slate-900 line-clamp-1 max-w-xs">{prd.title}</span>
                          </div>
                        </div>
                      </td>

                      {/* Brand & Supplier */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{prd.brand}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-1">{prd.supplierName}</div>
                      </td>

                      {/* Taxonomy Category */}
                      <td className="p-3">
                        {prd.categoryL1 ? (
                          <span className="font-semibold text-slate-800">
                            {prd.categoryL1} &gt; {prd.categoryL2} &gt; {prd.categoryL3}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-200">未匹配 (缺失 Taxonomy)</span>
                        )}
                      </td>

                      {/* Prices */}
                      <td className="p-3 text-right">
                        <div className="font-bold text-slate-900">¥{prd.enterprisePrice.toLocaleString('zh-CN')}</div>
                        <div className="text-[10px] text-slate-400 line-through">¥{prd.mallPrice.toLocaleString('zh-CN')}</div>
                      </td>

                      {/* Stock */}
                      <td className="p-3 text-right">
                        <span className={`font-bold ${prd.stock === 0 ? 'text-rose-600 font-mono' : 'text-slate-800'}`}>{prd.stock} 件</span>
                      </td>

                      {/* Risk & Missing */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              prd.riskLevel === '高'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : prd.riskLevel === '中'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {prd.riskLevel}风险
                          </span>
                          {prd.missingFields.map((f, i) => (
                            <span key={i} className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                              缺: {f}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* AI Classification Copilot Box */}
                      <td className="p-3">
                        <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200 space-y-1 max-w-xs">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-indigo-900 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              Copilot 推荐
                            </span>
                            <span className="font-bold text-indigo-700">置信度: {prd.aiSuggestion?.confidence || 0}%</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-800">
                            {prd.aiSuggestion?.categoryL1} &gt; {prd.aiSuggestion?.categoryL2} &gt; {prd.aiSuggestion?.categoryL3}
                          </div>
                          {prd.aiSuggestion?.needsHumanReview && <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">需人工复核</span>}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {prd.status === '待分类审核' && (
                            <button onClick={() => handleAcceptSingleClassification(prd)} className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shadow-2xs transition-colors cursor-pointer">
                              采纳分类
                            </button>
                          )}

                          <button onClick={() => setSelectedProductId(prd.id)} className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer">
                            抽屉详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PUBLISH CHECKLIST CENTER */}
      {activeTab === 'PUBLISH_CHECK' && (
        <div className="bg-white rounded-[14px] p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">发布中心校验清单 (Pre-Publish Mandate Checklist)</h3>
              <p className="text-xs text-slate-500 mt-0.5">严禁未打勾强制发布 · 需满足类目/价格/库存/协议/图片/企业范围全绿方可上线</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products
              .filter((p) => p.status === '待发布审核' || p.status === '待分类审核')
              .map((prd) => {
                const allPassed = Object.values(prd.checklist).every((v) => v === true);

                return (
                  <div key={prd.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img src={prd.mainImage} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 block">{prd.spuCode}</span>
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{prd.title}</h4>
                          <span className="text-[11px] text-slate-500">
                            {prd.categoryL1} &gt; {prd.categoryL2} &gt; {prd.categoryL3}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Checklist Grid */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1.5">
                        {prd.checklist.category ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span className={prd.checklist.category ? 'text-slate-800' : 'text-rose-600 font-bold'}>三级类目匹配</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {prd.checklist.price ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>企业专属价格</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {prd.checklist.stock ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>库存配额同步</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {prd.checklist.agreement ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>供应商特供协议</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {prd.checklist.images ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>高清合规主图</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {prd.checklist.visibility ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        <span>企业可见范围</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => handleRollbackVersion(prd)} className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>回滚上一版本</span>
                      </button>

                      <button
                        onClick={() => handlePublishProduct(prd)}
                        disabled={!allPassed}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-md flex items-center gap-1 transition-all ${
                          allPassed ? 'bg-[var(--sw-brand)] hover:bg-blue-700 text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>{allPassed ? '校验通过 · 正式发布' : '校验未全绿 (不可发布)'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-[14px] p-6 border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--sw-brand)]" />
            <span>商品字段变更审计时间线 (Product Field Diffs Timeline)</span>
          </h3>

          <div className="space-y-4 border-l-2 border-slate-200 pl-4 text-xs">
            {products.flatMap((p) =>
              p.versions.map((v, i) => (
                <div key={i} className="relative pb-3">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-100" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {p.title} · {v.version}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{v.updatedAt}</span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    操作人: <span className="font-semibold text-slate-800">{v.operator}</span> · 变更原因: {v.reason}
                  </div>

                  {/* Red/Green Field Diff Box */}
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
                    {v.fieldChanges.map((fc, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-slate-500 font-sans font-medium w-20">{fc.fieldName}:</span>
                        <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 line-through">{fc.oldValue}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold border border-emerald-200">{fc.newValue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* RIGHT PRODUCT DETAIL DRAWER */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <span className="text-[10px] text-blue-300 font-mono font-bold block">{selectedProduct.spuCode}</span>
                <h3 className="font-bold text-sm text-white line-clamp-1">{selectedProduct.title}</h3>
              </div>
              <button onClick={() => setSelectedProductId(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Image & Price Header */}
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <img src={selectedProduct.mainImage} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                <div className="flex-1 space-y-1">
                  <span className="font-bold text-slate-800 block text-sm">品牌：{selectedProduct.brand}</span>
                  <div className="text-slate-500">供应商：{selectedProduct.supplierName}</div>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="font-bold text-slate-900 text-sm">企业专属价: ¥{selectedProduct.enterprisePrice}</span>
                    <span className="text-slate-400 line-through">商城价: ¥{selectedProduct.mallPrice}</span>
                  </div>
                </div>
              </div>

              {/* AI Copilot Category Assist Box */}
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Gemini AI 三级类目 Copilot 诊断
                  </span>
                  <button
                    onClick={() => handleRunAiClassification(selectedProduct)}
                    disabled={isClassifyingAi}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{isClassifyingAi ? '计算中...' : '重新推理分类'}</span>
                  </button>
                </div>

                <div className="text-slate-800 font-semibold bg-white p-2.5 rounded-lg border border-indigo-100">
                  三级分类建议：
                  <span className="text-indigo-700 ml-1 font-bold">
                    {selectedProduct.aiSuggestion?.categoryL1} &gt; {selectedProduct.aiSuggestion?.categoryL2} &gt; {selectedProduct.aiSuggestion?.categoryL3}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600">推理依据：{selectedProduct.aiSuggestion?.reasoning}</p>

                <div className="pt-2 flex justify-end">
                  <button onClick={() => handleAcceptSingleClassification(selectedProduct)} className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer">
                    采纳分类并推进至待发布
                  </button>
                </div>
              </div>

              {/* SKUs List */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800">SKU 变体列表</h4>
                <div className="border rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedProduct.skus.map((s) => (
                    <div key={s.id} className="p-2.5 bg-white flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 block">{s.specName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.skuCode}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">¥{s.enterprisePrice}</span>
                        <span className="text-[10px] text-slate-500">库存: {s.stock} 件</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Version History Diff Timeline */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800">历史版本变更Diff (Version History)</h4>
                <div className="space-y-2">
                  {selectedProduct.versions.map((v, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{v.version}</span>
                        <span className="text-[10px] text-slate-400">{v.updatedAt}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1">{v.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
