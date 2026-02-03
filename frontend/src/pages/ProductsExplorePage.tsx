import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicStoreApi, orderApi, promoCodeApi, resolveImageUrl } from '@/lib/api';
import type { Product, Pharmacy, Category, CatalogSort, Promo } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getRecentProductIds } from '@/lib/recentlyViewed';
import WebsiteLayout from '@/components/WebsiteLayout';
import Loader from '@/components/Loader';
import { Package, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X, Tag, Megaphone, Calendar, ExternalLink, Star } from 'lucide-react';

const STORE_PAGE_SIZE = 12;
/** Products per category in catalog view (3 rows × 4 cols = 12). */
const CATALOG_PER_CATEGORY = 12;
const SEARCH_DEBOUNCE_MS = 300;
/** Description longer than this (plain-text length) shows "See more". */
const DESCRIPTION_SEE_MORE_LENGTH = 120;

function descriptionTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').trim().length;
}

function productImageUrl(p: Product): string | undefined {
  const images = p.images ?? [];
  return (images.find((i) => i.is_primary) ?? images[0])?.url;
}

const SORT_OPTIONS: { value: CatalogSort; labelKey: string }[] = [
  { value: 'name', labelKey: 'sort_name_az' },
  { value: 'price_asc', labelKey: 'sort_price_low_high' },
  { value: 'price_desc', labelKey: 'sort_price_high_low' },
  { value: 'newest', labelKey: 'sort_newest' },
];

export default function ProductsExplorePage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  /** Catalog grouped by category (used when no filters). Each section shows up to CATALOG_PER_CATEGORY products. */
  const [catalogByCategory, setCatalogByCategory] = useState<{ category: Category; products: Product[]; total: number }[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<CatalogSort>('name');
  const [hashtagFilter, setHashtagFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [labelKeyFilter, setLabelKeyFilter] = useState('');
  const [labelValueFilter, setLabelValueFilter] = useState('');
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountAmount: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState<number | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<Product[]>([]);
  const { user } = useAuth();
  const { setPublicPharmacyId } = useBrand();
  const { t } = useLanguage();
  const { items, addItem, removeItem, updateQuantity, clearCart, totalCount, totalAmount } = useCart();
  const navigate = useNavigate();

  const toggleDescriptionExpanded = useCallback((productId: string) => {
    setExpandedDescriptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user && selectedPharmacyId) setPublicPharmacyId(selectedPharmacyId);
  }, [user, selectedPharmacyId, setPublicPharmacyId]);

  useEffect(() => {
    publicStoreApi
      .listPharmacies()
      .then((list) => {
        setPharmacies(list);
        if (list.length > 0) {
          setSelectedPharmacyId((prev) => {
            if (prev) return prev;
            return user?.pharmacy_id && list.some((p) => p.id === user.pharmacy_id)
              ? user.pharmacy_id
              : list[0].id;
          });
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('failed_to_load')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPharmacyId) return;
    publicStoreApi
      .listCategories(selectedPharmacyId)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [selectedPharmacyId]);

  useEffect(() => {
    if (!selectedPharmacyId) return;
    publicStoreApi
      .listPromos(selectedPharmacyId)
      .then(setPromos)
      .catch(() => setPromos([]));
  }, [selectedPharmacyId]);

  useEffect(() => {
    const recentIds = getRecentProductIds().slice(0, 6);
    if (recentIds.length === 0) {
      setRecentlyViewedProducts([]);
      return;
    }
    Promise.all(recentIds.map((rid) => publicStoreApi.getProduct(rid)))
      .then((list) => setRecentlyViewedProducts(list.filter(Boolean)))
      .catch(() => setRecentlyViewedProducts([]));
  }, [selectedPharmacyId]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQ(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(() => {
    if (!selectedPharmacyId) return;
    setLoading(true);
    setError('');
    const offset = (page - 1) * STORE_PAGE_SIZE;
    const params = {
      limit: STORE_PAGE_SIZE,
      offset,
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(inStockOnly ? { in_stock: true } : {}),
      ...(searchQ ? { q: searchQ } : {}),
      ...(sort !== 'name' ? { sort } : {}),
      ...(hashtagFilter.trim() ? { hashtag: hashtagFilter.trim() } : {}),
      ...(brandFilter.trim() ? { brand: brandFilter.trim() } : {}),
      ...(labelKeyFilter.trim() && labelValueFilter.trim() ? { label_key: labelKeyFilter.trim(), label_value: labelValueFilter.trim() } : {}),
    };
    publicStoreApi
      .listProductsPaginated(selectedPharmacyId, params)
      .then((res) => {
        setProducts(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('failed_to_load_products')))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [selectedPharmacyId, page, categoryFilter, inStockOnly, searchQ, sort, hashtagFilter, brandFilter, labelKeyFilter, labelValueFilter, t]);

  const loadCatalogByCategory = useCallback(() => {
    if (!selectedPharmacyId || categories.length === 0) return;
    setLoadingCatalog(true);
    setError('');
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    Promise.all(
      sorted.map((c) =>
        publicStoreApi
          .listProductsPaginated(selectedPharmacyId, { category: c.name, limit: CATALOG_PER_CATEGORY })
          .then((res) => ({ category: c, products: res.items, total: res.total }))
      )
    )
      .then((results) => setCatalogByCategory(results.filter((r) => r.products.length > 0)))
      .catch((e) => setError(e instanceof Error ? e.message : t('failed_to_load_products')))
      .finally(() => setLoadingCatalog(false));
  }, [selectedPharmacyId, categories, t]);

  const hasActiveFilters =
    !!searchQ ||
    !!categoryFilter ||
    inStockOnly ||
    sort !== 'name' ||
    !!hashtagFilter.trim() ||
    !!brandFilter.trim() ||
    (!!labelKeyFilter.trim() && !!labelValueFilter.trim());

  useEffect(() => {
    if (hasActiveFilters) {
      loadProducts();
    } else if (selectedPharmacyId && categories.length > 0) {
      loadCatalogByCategory();
    } else {
      setCatalogByCategory([]);
      setLoadingCatalog(false);
    }
  }, [hasActiveFilters, loadProducts, loadCatalogByCategory, selectedPharmacyId, categories.length]);

  useEffect(() => {
    if (user?.pharmacy_id && pharmacies.some((p) => p.id === user.pharmacy_id)) {
      setSelectedPharmacyId(user.pharmacy_id);
    }
  }, [user?.pharmacy_id, pharmacies]);

  useEffect(() => {
    setPage(1);
  }, [selectedPharmacyId, categoryFilter, inStockOnly, searchQ, sort, hashtagFilter, brandFilter, labelKeyFilter, labelValueFilter]);

  const clearFilters = () => {
    setSearchInput('');
    setSearchQ('');
    setCategoryFilter('');
    setInStockOnly(false);
    setSort('name');
    setHashtagFilter('');
    setBrandFilter('');
    setLabelKeyFilter('');
    setLabelValueFilter('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / STORE_PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  const requireLogin = (action: () => void) => {
    if (!user) {
      navigate('/login?returnTo=/products');
      return;
    }
    action();
  };

  const handleAddToCart = (product: Product) => {
    requireLogin(() => {
      addItem(product, 1);
      setCartOpen(true);
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    publicStoreApi
      .listPharmacies()
      .then((list) => {
        setPharmacies(list);
        if (!selectedPharmacyId || !list.some((p) => p.id === selectedPharmacyId)) return Promise.resolve();
        if (hasActiveFilters) {
          loadProducts();
          return Promise.resolve();
        }
        if (categories.length > 0) {
          return Promise.all(
            [...categories].sort((a, b) => a.sort_order - b.sort_order).map((c) =>
              publicStoreApi
                .listProductsPaginated(selectedPharmacyId, { category: c.name, limit: CATALOG_PER_CATEGORY })
                .then((res) => ({ category: c, products: res.items, total: res.total }))
            )
          ).then((results) => setCatalogByCategory(results.filter((r) => r.products.length > 0)));
        }
        return Promise.resolve();
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('failed_to_load')))
      .finally(() => setRefreshing(false));
  };

  const handleApplyPromo = () => {
    const code = promoCodeInput.trim();
    if (!code || items.length === 0) return;
    setPromoError('');
    setApplyingPromo(true);
    promoCodeApi
      .validate(code, totalAmount)
      .then((res) => {
        setAppliedPromo({ code, discountAmount: res.discount_amount });
      })
      .catch((e) => {
        setPromoError(e instanceof Error ? e.message : 'Invalid or expired code');
        setAppliedPromo(null);
      })
      .finally(() => setApplyingPromo(false));
  };

  const clearPromo = () => {
    setPromoCodeInput('');
    setAppliedPromo(null);
    setPromoError('');
  };

  const orderTotal = appliedPromo ? Math.max(0, totalAmount - appliedPromo.discountAmount) : totalAmount;

  const handlePlaceOrder = () => {
    requireLogin(async () => {
      if (items.length === 0) return;
      setPlacing(true);
      try {
        await orderApi.create({
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.unit_price,
          })),
          customer_name: user?.name ?? '',
          customer_email: user?.email ?? '',
          ...(customerPhone.trim() ? { customer_phone: customerPhone.trim() } : {}),
          ...(appliedPromo ? { promo_code: appliedPromo.code } : {}),
          ...(referralCodeInput.trim() ? { referral_code: referralCodeInput.trim() } : {}),
          ...(pointsToRedeem != null && pointsToRedeem > 0 ? { points_to_redeem: pointsToRedeem } : {}),
        });
        clearCart();
        clearPromo();
        setCartOpen(false);
        navigate('/orders');
      } catch (e) {
        alert(e instanceof Error ? e.message : t('failed_place_order'));
      } finally {
        setPlacing(false);
      }
    });
  };

  return (
    <WebsiteLayout
      showCart
      cartCount={totalCount}
      onCartClick={() => setCartOpen(true)}
    >
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('product_catalog')}</h1>
            <p className="text-gray-600">
              {t('product_catalog_subtitle_before')}
              <Link to="/login" className="text-careplus-primary hover:underline">{t('nav_login')}</Link>
              {t('product_catalog_subtitle_mid')}
              <Link to="/register" className="text-careplus-primary hover:underline">{t('nav_register')}</Link>
              {t('product_catalog_subtitle_after')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50 shrink-0"
            title={t('refresh')}
            aria-label={t('refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {pharmacies.length > 1 && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mr-2">{t('pharmacy_label')}</label>
            <select
              value={selectedPharmacyId ?? ''}
              onChange={(e) => setSelectedPharmacyId(e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Offers, announcements & events – informative promos like ads */}
        {promos.length > 0 && (
          <section className="mb-8" aria-label="Offers, announcements and events">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('whats_on')}</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              {promos.map((promo) => {
                const Icon =
                  promo.type === 'offer'
                    ? Tag
                    : promo.type === 'announcement'
                      ? Megaphone
                      : Calendar;
                const typeLabel =
                  promo.type === 'offer'
                    ? t('offer')
                    : promo.type === 'announcement'
                      ? t('announcement')
                      : t('event');
                const card = (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
                      {promo.image_url ? (
                        <img
                          src={promo.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Icon className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <span className="text-xs font-medium text-careplus-primary uppercase tracking-wide">
                        {typeLabel}
                      </span>
                      <h3 className="font-semibold text-gray-900 mt-0.5 line-clamp-1">{promo.title}</h3>
                      {promo.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2 flex-1">
                          {promo.description}
                        </p>
                      )}
                      {(promo.end_at || promo.start_at) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {promo.end_at
                            ? `Offer ends ${new Date(promo.end_at).toLocaleDateString(undefined, { dateStyle: 'short' })}`
                            : promo.start_at
                              ? `Starts ${new Date(promo.start_at).toLocaleDateString(undefined, { dateStyle: 'short' })}`
                              : null}
                        </p>
                      )}
                      {promo.link_url ? (
                        <a
                          href={promo.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-careplus-primary hover:underline"
                        >
                          {t('learn_more')}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
                return (
                  <div key={promo.id} className="flex-shrink-0 w-[280px] snap-start">
                    {card}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {recentlyViewedProducts.length > 0 && (
          <section className="mb-8" aria-label="Recently viewed">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Recently viewed</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentlyViewedProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="flex-shrink-0 w-40 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:ring-2 hover:ring-careplus-primary"
                >
                  <div className="aspect-square bg-gray-50">
                    {productImageUrl(p) ? (
                      <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-sm text-careplus-primary font-semibold">
                      {p.currency} {p.unit_price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Catalog filters */}
        {pharmacies.length > 0 && selectedPharmacyId && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder={t('search_products')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-careplus-primary/20 focus:border-careplus-primary"
                  aria-label={t('search_products_aria')}
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
                aria-label={t('category')}
              >
                <option value="">{t('all_categories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as CatalogSort)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]"
                aria-label={t('sort_by')}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                />
                <span className="text-sm text-gray-700">{t('in_stock_only')}</span>
              </label>
              <input
                type="text"
                placeholder="Hashtag"
                value={hashtagFilter}
                onChange={(e) => setHashtagFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[100px] max-w-[120px]"
                aria-label="Filter by hashtag"
              />
              <input
                type="text"
                placeholder="Brand"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[90px] max-w-[120px]"
                aria-label="Filter by brand"
              />
              <input
                type="text"
                placeholder="Label key"
                value={labelKeyFilter}
                onChange={(e) => setLabelKeyFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24"
                aria-label="Label key"
              />
              <input
                type="text"
                placeholder="Label value"
                value={labelValueFilter}
                onChange={(e) => setLabelValueFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24"
                aria-label="Label value"
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" /> {t('clear_filters')}
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-gray-500">
                {searchQ && <>Search: &quot;{searchQ}&quot;</>}
                {categoryFilter && <> · Category: {categoryFilter}</>}
                {inStockOnly && <> · In stock only</>}
                {sort !== 'name' && <> · Sort: {t(SORT_OPTIONS.find((o) => o.value === sort)?.labelKey ?? 'sort_by')}</>}
                {hashtagFilter.trim() && <> · Hashtag: {hashtagFilter}</>}
                {brandFilter.trim() && <> · Brand: {brandFilter}</>}
                {labelKeyFilter.trim() && labelValueFilter.trim() && <> · Label: {labelKeyFilter}={labelValueFilter}</>}
              </p>
            )}
          </div>
        )}

        {(loading || loadingCatalog) && <Loader variant="inline" message={t('loading')} />}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !loadingCatalog && !error && pharmacies.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('no_store_available')}</p>
          </div>
        )}
        {!loading && !loadingCatalog && !error && pharmacies.length > 0 && !hasActiveFilters && catalogByCategory.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('no_products_available')}</p>
          </div>
        )}
        {!loading && !loadingCatalog && !error && pharmacies.length > 0 && hasActiveFilters && products.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('no_products_match')}</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-careplus-primary hover:underline text-sm font-medium"
            >
              {t('clear_filters')}
            </button>
          </div>
        )}
        {/* Catalog by category: show category name, 8–12 products (3 rows), then See more */}
        {!loading && !loadingCatalog && !error && pharmacies.length > 0 && !hasActiveFilters && catalogByCategory.length > 0 && (
          <div className="space-y-10">
            {catalogByCategory.map(({ category, products: catProducts, total: catTotal }) => (
              <section key={category.id} className="space-y-4" aria-labelledby={`category-${category.id}`}>
                <h2 id={`category-${category.id}`} className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catProducts.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col overflow-hidden group"
                    >
                      <Link
                        to={`/products/${p.id}`}
                        className="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-inset rounded-xl"
                      >
                        <div className="aspect-square -mx-4 -mt-4 mb-3 bg-gray-100 rounded-t-xl overflow-hidden">
                          {productImageUrl(p) ? (
                            <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Package className="w-12 h-12" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {p.requires_rx ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Prescription</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">OTC</span>
                          )}
                          {p.labels && Object.entries(p.labels).slice(0, 3).map(([k, v]) => (
                            <span key={k} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}{v !== 'true' ? `: ${v}` : ''}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-medium text-gray-900 truncate group-hover:text-careplus-primary">{p.name}</h3>
                        {(p.review_count != null && p.review_count > 0) && (
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className={`w-4 h-4 ${(p.rating_avg ?? 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} aria-hidden />
                              ))}
                            </div>
                            <span>({p.review_count} {p.review_count === 1 ? 'review' : 'reviews'})</span>
                          </div>
                        )}
                        {p.description && (
                          <div className="mt-1 text-sm text-gray-500">
                            <div
                              className={`overflow-hidden text-gray-500 [&_mark]:bg-careplus-primary/20 [&_mark]:rounded [&_p]:mb-0.5 ${expandedDescriptionIds.has(p.id) ? '' : 'max-h-[2.8rem]'}`}
                              dangerouslySetInnerHTML={{ __html: p.description }}
                            />
                            {descriptionTextLength(p.description) > DESCRIPTION_SEE_MORE_LENGTH && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleDescriptionExpanded(p.id); }}
                                className="text-careplus-primary text-xs font-medium mt-0.5 hover:underline"
                              >
                                {expandedDescriptionIds.has(p.id) ? t('see_less') : t('see_more')}
                              </button>
                            )}
                          </div>
                        )}
                        <p className="mt-2 text-careplus-primary font-semibold">
                          {p.currency} {p.unit_price.toFixed(2)}
                          {p.unit && <span className="text-gray-500 font-normal"> / {p.unit}</span>}
                        </p>
                        <p className={`text-xs ${p.stock_quantity > 0 ? 'text-gray-500' : 'text-amber-600'}`}>
                          {p.stock_quantity > 0 ? `${t('in_stock')}: ${p.stock_quantity}` : t('out_of_stock')}
                        </p>
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); handleAddToCart(p); }}
                        disabled={p.stock_quantity < 1}
                        className="mt-auto py-2 px-3 rounded-lg bg-careplus-primary text-white text-sm font-medium hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {user ? (p.stock_quantity > 0 ? t('add_to_cart') : t('out_of_stock')) : t('login_to_add_to_cart')}
                      </button>
                    </div>
                  ))}
                </div>
                {catTotal > CATALOG_PER_CATEGORY && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(category.name)}
                      className="text-careplus-primary font-medium hover:underline inline-flex items-center gap-1"
                    >
                      {t('see_more')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        {!loading && !loadingCatalog && !error && products.length > 0 && hasActiveFilters && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col overflow-hidden group"
                >
                  <Link
                    to={`/products/${p.id}`}
                    className="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-inset rounded-xl"
                  >
                    <div className="aspect-square -mx-4 -mt-4 mb-3 bg-gray-100 rounded-t-xl overflow-hidden">
                      {productImageUrl(p) ? (
                        <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {p.requires_rx ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          Prescription
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          OTC
                        </span>
                      )}
                      {p.labels && Object.entries(p.labels).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}{v !== 'true' ? `: ${v}` : ''}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-medium text-gray-900 truncate group-hover:text-careplus-primary">{p.name}</h3>
                    {(p.review_count != null && p.review_count > 0) && (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${(p.rating_avg ?? 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                              aria-hidden
                            />
                          ))}
                        </div>
                        <span>({p.review_count} {p.review_count === 1 ? 'review' : 'reviews'})</span>
                      </div>
                    )}
                    {p.description && (
                      <div className="mt-1 text-sm text-gray-500">
                        <div
                          className={`overflow-hidden text-gray-500 [&_mark]:bg-careplus-primary/20 [&_mark]:rounded [&_p]:mb-0.5 ${expandedDescriptionIds.has(p.id) ? '' : 'max-h-[2.8rem]'}`}
                          dangerouslySetInnerHTML={{ __html: p.description }}
                        />
                        {descriptionTextLength(p.description) > DESCRIPTION_SEE_MORE_LENGTH && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleDescriptionExpanded(p.id); }}
                            className="text-careplus-primary text-xs font-medium mt-0.5 hover:underline"
                          >
                            {expandedDescriptionIds.has(p.id) ? t('see_less') : t('see_more')}
                          </button>
                        )}
                      </div>
                    )}
                    <p className="mt-2 text-careplus-primary font-semibold">
                      {p.currency} {p.unit_price.toFixed(2)}
                      {p.unit && <span className="text-gray-500 font-normal"> / {p.unit}</span>}
                    </p>
                    <p className={`text-xs ${p.stock_quantity > 0 ? 'text-gray-500' : 'text-amber-600'}`}>
                      {p.stock_quantity > 0 ? `${t('in_stock')}: ${p.stock_quantity}` : t('out_of_stock')}
                    </p>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleAddToCart(p);
                    }}
                    disabled={p.stock_quantity < 1}
                    className="mt-auto py-2 px-3 rounded-lg bg-careplus-primary text-white text-sm font-medium hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {user ? (p.stock_quantity > 0 ? t('add_to_cart') : t('out_of_stock')) : t('login_to_add_to_cart')}
                  </button>
                </div>
              ))}
            </div>
            {total > STORE_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 py-4">
                <span className="text-sm text-gray-600 mr-2">
                  {t('page_of', { page: String(page), totalPages: String(totalPages), total: String(total) })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    disabled={!canPrev}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="First page"
                  >
                    <ChevronsLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={!canPrev}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-gray-700 min-w-[4rem] text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={!canNext}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(totalPages)}
                    disabled={!canNext}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Last page"
                  >
                    <ChevronsRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {cartOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setCartOpen(false)} />
          <div className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-xl z-50 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('cart_items', { count: totalCount })}</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl leading-none">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('your_cart_empty')}</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((i) => (
                    <li key={i.product.id} className="flex gap-3 items-center border-b pb-2">
                      {productImageUrl(i.product) ? (
                        <img src={resolveImageUrl(productImageUrl(i.product))} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{i.product.name}</p>
                        <p className="text-sm text-gray-500">
                          {i.product.currency} {i.product.unit_price.toFixed(2)} × {i.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={i.product.stock_quantity}
                          value={i.quantity}
                          onChange={(e) => updateQuantity(i.product.id, parseInt(e.target.value, 10) || 1)}
                          className="w-14 border rounded px-2 py-1 text-center"
                        />
                        <button
                          onClick={() => removeItem(i.product.id)}
                          className="text-red-600 text-sm hover:underline"
                        >
                          {t('remove')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t">
              {user && items.length > 0 && (
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-gray-500">First order? Try a welcome code if you have one.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Promo code"
                      value={promoCodeInput}
                      onChange={(e) => { setPromoCodeInput(e.target.value); setPromoError(''); }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      disabled={!!appliedPromo}
                    />
                    {appliedPromo ? (
                      <button type="button" onClick={clearPromo} className="px-3 py-2 text-sm text-gray-600 hover:underline">
                        {t('remove')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={applyingPromo || !promoCodeInput.trim()}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        {applyingPromo ? 'Applying...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {promoError && <p className="text-sm text-red-600">{promoError}</p>}
                  {appliedPromo && (
                    <p className="text-sm text-green-600">Code applied: NPR {appliedPromo.discountAmount.toFixed(2)} off</p>
                  )}
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Phone (for points & referral)</label>
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Referral code</label>
                    <input
                      type="text"
                      placeholder="Friend's referral code"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  {pointsToRedeem != null && pointsToRedeem > 0 && (
                    <p className="text-sm text-gray-600">Using {pointsToRedeem} points</p>
                  )}
                </div>
              )}
              <p className="font-semibold text-gray-800 mb-2">
                {appliedPromo ? (
                  <>
                    Subtotal: NPR {totalAmount.toFixed(2)} · Discount: -NPR {appliedPromo.discountAmount.toFixed(2)}<br />
                    {t('total')} NPR {orderTotal.toFixed(2)}
                  </>
                ) : (
                  <>{t('total')} NPR {totalAmount.toFixed(2)}</>
                )}
              </p>
              <button
                onClick={handlePlaceOrder}
                disabled={items.length === 0 || placing}
                className="w-full py-2.5 bg-careplus-primary text-white font-medium rounded-lg hover:bg-careplus-secondary disabled:opacity-50"
              >
                {placing ? t('placing') : user ? t('place_order') : t('login_to_place_order')}
              </button>
            </div>
          </div>
        </>
      )}
    </WebsiteLayout>
  );
}
