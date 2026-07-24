import { useMemo, useState } from 'react';
import { useMall } from '../../context/MallContext';
import type { Product, ProductItemType } from '../../types';

const CATEGORY_SEARCH_ALIASES: Record<string, string> = {
  cat_food: '食品 饮料 粮油 零食 茶叶 咖啡 牛奶',
  cat_appliance: '家电 空气净化器 吸尘器 冰箱 洗衣机 厨房电器',
  cat_digital: '数码 办公 电脑 手机 键盘 鼠标 显示器',
  cat_home: '家居 日用 家具 床品 厨具 灯具 收纳',
  cat_personal: '个护 清洁 洗护 牙膏 美妆 纸品',
  cat_supermarket: '商超 文具 母婴 玩具 宠物 运动 户外',
  cat_apparel: '服饰 鞋靴 箱包 配饰 珠宝 首饰',
  cat_welfare_zone: '企业福利 员工福利 福利专区',
};

export function useCategoryCatalog() {
  const mall = useMall();
  const { routeParams, products } = mall;
  const [selectedCategory, setSelectedCategory] = useState(
    routeParams.categoryId || 'all'
  );
  const [selectedItemType, setSelectedItemType] = useState<ProductItemType | 'all'>(
    (routeParams.itemType as ProductItemType) || 'all'
  );
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [keyword, setKeyword] = useState(routeParams.keyword || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<
    'default' | 'sales' | 'priceAsc' | 'priceDesc' | 'newest'
  >('default');
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const pageSize = 15;

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = (keyword || routeParams.keyword || '')
      .trim()
      .toLowerCase();
    const result = products.filter((product) => {
      const searchable =
        `${product.title} ${product.subtitle} ${product.brand} ${product.categoryName} ${CATEGORY_SEARCH_ALIASES[product.categoryId] ?? ''}`.toLowerCase();
      if (normalizedKeyword && !searchable.includes(normalizedKeyword)) return false;
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) return false;
      if (selectedItemType !== 'all' && product.itemType !== selectedItemType) return false;
      if (selectedSupplier !== 'all' && product.supplierType !== selectedSupplier) return false;
      if (
        selectedAccount !== 'all' &&
        !product.allowedAccounts.includes(
          selectedAccount as 'welfare' | 'meal' | 'wechat' | 'cash'
        )
      ) return false;
      if (minPrice && product.priceWelfare < Number(minPrice)) return false;
      if (maxPrice && product.priceWelfare > Number(maxPrice)) return false;
      return !inStockOnly || product.stock > 0;
    });
    return [...result].sort((left, right) => {
      if (sortBy === 'sales') return right.salesCount - left.salesCount;
      if (sortBy === 'priceAsc') return left.priceWelfare - right.priceWelfare;
      if (sortBy === 'priceDesc') return right.priceWelfare - left.priceWelfare;
      if (sortBy === 'newest') {
        return Number(Boolean(right.isNewArrival)) - Number(Boolean(left.isNewArrival));
      }
      return (
        Number(Boolean(right.isEnterpriseExclusive)) -
        Number(Boolean(left.isEnterpriseExclusive))
      );
    });
  }, [
    keyword, routeParams.keyword, selectedCategory, selectedItemType,
    selectedSupplier, selectedAccount, minPrice, maxPrice, inStockOnly,
    sortBy, products
  ]);

  const availableBrands = useMemo(
    () => Array.from(new Set(filteredProducts.map((product) => product.brand))),
    [filteredProducts]
  );
  const finalProducts = useMemo(
    () =>
      selectedBrand === 'all'
        ? filteredProducts
        : filteredProducts.filter((product) => product.brand === selectedBrand),
    [filteredProducts, selectedBrand]
  );
  const totalPages = Math.ceil(finalProducts.length / pageSize) || 1;
  const paginatedProducts = finalProducts.slice(
    (currentPageNum - 1) * pageSize,
    currentPageNum * pageSize
  );

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedItemType('all');
    setSelectedSupplier('all');
    setSelectedAccount('all');
    setKeyword('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSelectedBrand('all');
    setSortBy('default');
    setCurrentPageNum(1);
  };
  const toggleCompare = (product: Product) => {
    if (compareList.some((item) => item.id === product.id)) {
      setCompareList((items) => items.filter((item) => item.id !== product.id));
      return;
    }
    if (compareList.length >= 3) {
      alert('最多支持对比3件商品');
      return;
    }
    setCompareList((items) => [...items, product]);
  };

  return {
    ...mall, selectedCategory, setSelectedCategory, selectedItemType,
    setSelectedItemType, selectedSupplier, setSelectedSupplier,
    selectedAccount, setSelectedAccount, keyword, setKeyword, minPrice,
    setMinPrice, maxPrice, setMaxPrice, inStockOnly, setInStockOnly,
    selectedBrand, setSelectedBrand, viewMode, setViewMode, sortBy, setSortBy,
    compareList, setCompareList, currentPageNum, setCurrentPageNum, pageSize,
    availableBrands, finalProducts, totalPages, paginatedProducts,
    resetFilters, toggleCompare
  };
}

export type CategoryCatalogModel = ReturnType<typeof useCategoryCatalog>;
