import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AccountLog,
  EnterpriseMall,
  Order,
  Product,
  UserProfile,
} from '../types';
import { productionApi } from '../services/productionApi';
import { mapApiOrder, mapApiProduct } from './mallMappers';
import type { SessionStatus } from './MallContext.types';

interface ProductionSyncSetters {
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setUser: Dispatch<SetStateAction<UserProfile>>;
  setCurrentMall: Dispatch<SetStateAction<EnterpriseMall>>;
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setAccountLogs: Dispatch<SetStateAction<AccountLog[]>>;
  setSessionStatus: Dispatch<SetStateAction<SessionStatus>>;
}

export function useProductionSync(setters: ProductionSyncSetters) {
  const refreshProductionData = async () => {
    const [bootstrap, accounts, orderResult, ledgerResult] = await Promise.all([
      productionApi.getBootstrap(),
      productionApi.listAccounts(),
      productionApi.listOrders(),
      productionApi.listAccountLedgers(),
    ]);
    const welfare = accounts.items.find((account) => account.type === 'welfare');
    const meal = accounts.items.find((account) => account.type === 'meal');
    setters.setUser((previous) => ({
      ...previous,
      id: bootstrap.actor.userId,
      employeeId: bootstrap.actor.employeeNo,
      enterpriseId: bootstrap.scope.enterpriseId,
      enterpriseName: bootstrap.scope.enterpriseName,
      currentMallId: bootstrap.scope.mallId,
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
    setters.setOrders(
      orderResult.items.map((order) => mapApiOrder(order, bootstrap.scope))
    );
    setters.setAccountLogs(
      ledgerResult.items.map((ledger) => ({
        id: ledger.id,
        accountType: ledger.accountType,
        title:
          ledger.businessType === 'order_payment'
            ? '商城订单账户支付'
            : ledger.businessType === 'refund'
              ? '售后退款原路退回'
              : '企业福利额度发放',
        amount:
          (ledger.direction === 'credit' ? 1 : -1) *
          ledger.amountCents /
          100,
        direction: ledger.direction === 'credit' ? 'in' : 'out',
        orderNo: ledger.orderNo ?? undefined,
        time: new Date(ledger.createdAt).toLocaleString('zh-CN', {
          hour12: false,
        }),
        balanceAfter: ledger.balanceAfterCents / 100,
      }))
    );
  };

  useEffect(() => {
    let active = true;
    void productionApi
      .listProducts('smart-wing-demo', { limit: 100 })
      .then((response) => {
        if (active && response.items.length) {
          setters.setProducts(response.items.map(mapApiProduct));
        }
      })
      .catch(() => undefined);
    void productionApi
      .getSession()
      .then(async () => {
        if (!active) return;
        setters.setSessionStatus('authenticated');
        await refreshProductionData();
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
