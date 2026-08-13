import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AccountLog, EnterpriseMall, Order, Product, UserProfile } from '../types';
import { productionApi, type ApiProduct } from '../services/productionApi';
import { mapApiOrder, mapApiProduct } from './mallMappers';
import type { SessionStatus } from './MallContext.types';
import { mergeAuthenticatedMemberProfile } from './storefrontMemberProfile';

interface ProductionSyncSetters {
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setUser: Dispatch<SetStateAction<UserProfile>>;
  setCurrentMall: Dispatch<SetStateAction<EnterpriseMall>>;
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setAccountLogs: Dispatch<SetStateAction<AccountLog[]>>;
  setSessionStatus: Dispatch<SetStateAction<SessionStatus>>;
}

async function loadCompleteCatalog(): Promise<ApiProduct[]> {
  const items = new Map<string, ApiProduct>();
  let cursor: number | null = 0;
  let pageCount = 0;

  while (cursor !== null && pageCount < 60) {
    const page = await productionApi.listProducts('smart-wing-demo', {
      cursor,
      limit: 100,
    });
    page.items.forEach((item) => items.set(item.id, item));
    if (page.pagination.nextCursor === cursor) break;
    cursor = page.pagination.nextCursor;
    pageCount += 1;
  }
  return [...items.values()];
}

export function useProductionSync(setters: ProductionSyncSetters) {
  const refreshProductionData = async () => {
    const catalogRequest = loadCompleteCatalog();
    const snapshot = await productionApi.getHomeSnapshot();
    const { bootstrap, accounts, orders: orderResult, accountLedgers: ledgerResult } = snapshot;
    const welfare = accounts.items.find((account) => account.type === 'welfare');
    const meal = accounts.items.find((account) => account.type === 'meal');
    setters.setUser((previous) => ({
      ...mergeAuthenticatedMemberProfile(previous, bootstrap),
      welfareBalance: (welfare?.balanceCents ?? 0) / 100,
      mealBalance: (meal?.balanceCents ?? 0) / 100,
    }));
    setters.setCurrentMall((previous) => ({
      ...previous,
      id: bootstrap.scope.mallId,
      enterpriseId: bootstrap.scope.enterpriseId,
      enterpriseName: bootstrap.scope.enterpriseName,
      mallName: bootstrap.scope.mallName,
      logoText: bootstrap.scope.brandName,
    }));
    setters.setOrders(orderResult.items.map((order) => mapApiOrder(order, bootstrap.scope)));
    setters.setAccountLogs(
      ledgerResult.items.map((ledger) => ({
        id: ledger.id,
        accountType: ledger.accountType,
        title: ledger.businessType === 'order_payment' ? '商城订单账户支付' : ledger.businessType === 'refund' ? '售后退款原路退回' : '企业福利额度发放',
        amount: ((ledger.direction === 'credit' ? 1 : -1) * ledger.amountCents) / 100,
        direction: ledger.direction === 'credit' ? 'in' : 'out',
        orderNo: ledger.orderNo ?? undefined,
        time: new Date(ledger.createdAt).toLocaleString('zh-CN', {
          hour12: false,
        }),
        balanceAfter: ledger.balanceAfterCents / 100,
      }))
    );
    setters.setProducts((await catalogRequest).map(mapApiProduct));
  };

  useEffect(() => {
    let active = true;
    // /home is both the authorization check and the initial data snapshot.
    // Avoid a separate /auth/session round trip before loading the page.
    void refreshProductionData()
      .then(() => {
        if (active) setters.setSessionStatus('authenticated');
      })
      .catch(() => {
        if (active) setters.setSessionStatus('guest');
      });
    return () => {
      active = false;
    };
  }, []);

  return { refreshProductionData };
}
