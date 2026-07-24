import { useMemo, useState } from 'react';
import { useMall } from '../../context/MallContext';
import type { Product, ProductItemType } from '../../types';

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
        `${product.title} ${product.subtitle} ${product.brand} ${product.categoryName}`.toLowerCase();
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
