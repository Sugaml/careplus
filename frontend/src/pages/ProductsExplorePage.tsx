import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicStoreApi, orderApi, promoCodeApi, resolveImageUrl } from '@/lib/api';
import type { Product, Pharmacy, Category, CatalogSort, Promo, PaymentGateway } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getRecentProductIds } from '@/lib/recentlyViewed';
import WebsiteLayout from '@/components/WebsiteLayout';
import { Package, RefreshCw, ChevronLeft, ChevronRight, ChevronsRight, Search, X, Tag, Megaphone, Calendar, ExternalLink, Star, ShoppingCart, ChevronsLeft, Filter, Check, Sparkles } from 'lucide-react';

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

interface ProductsExplorePageProps {
  /** When true, render without WebsiteLayout (e.g. inside dashboard Layout for buyers). */
  embedded?: boolean;
}

export default function ProductsExplorePage({ embedded = false }: ProductsExplorePageProps) {
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
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedPaymentGatewayId, setSelectedPaymentGatewayId] = useState<string | null>(null);
  const [justAddedToCartId, setJustAddedToCartId] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
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
      .listPaymentGateways(selectedPharmacyId)
      .then(setPaymentGateways)
      .catch(() => setPaymentGateways([]));
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
      setJustAddedToCartId(product.id);
      setTimeout(() => setJustAddedToCartId(null), 2000);
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
          ...(selectedPaymentGatewayId ? { payment_gateway_id: selectedPaymentGatewayId } : {}),
        });
        clearCart();
        clearPromo();
        setSelectedPaymentGatewayId(null);
        setCartOpen(false);
        navigate('/orders');
      } catch (e) {
        alert(e instanceof Error ? e.message : t('failed_place_order'));
      } finally {
        setPlacing(false);
      }
    });
  };

  const cartProps = {
    showCart: true as const,
    cartCount: totalCount,
    onCartClick: () => setCartOpen(true),
  };

  const content = (
    <>
      <div className={embedded ? 'min-h-0' : 'min-h-screen bg-theme-bg catalog-page'}>
        {/* Hero – teal gradient; compact so products get more space */}
        <section className="catalog-hero relative overflow-hidden bg-careplus-primary">
          <div className="catalog-hero-bg absolute inset-0 pointer-events-none" aria-hidden />
          <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 relative">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white" aria-hidden />
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm">{t('product_catalog')}</h1>
                </div>
                <p className="text-xs sm:text-sm max-w-xl leading-snug text-white/95">
                  {user
                    ? t('product_catalog_subtitle_logged_in')
                    : (
                      <>
                        {t('product_catalog_subtitle_before')}
                        <Link to="/login" className="underline font-semibold text-white hover:text-white/95 transition-colors duration-200 decoration-2 underline-offset-2">{t('nav_login')}</Link>
                        {t('product_catalog_subtitle_mid')}
                        <Link to="/register" className="underline font-semibold text-white hover:text-white/95 transition-colors duration-200 decoration-2 underline-offset-2">{t('nav_register')}</Link>
                        {t('product_catalog_subtitle_after')}
                      </>
                    )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {embedded && user && (
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/25 hover:bg-white/35 text-sm font-semibold text-white border border-white/30 transition-all duration-200 relative shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    aria-label={t('nav_cart')}
                  >
                    <ShoppingCart className="w-5 h-5 shrink-0" />
                    <span className="hidden sm:inline">{t('nav_cart')}</span>
                    {totalCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-white text-careplus-primary text-xs flex items-center justify-center font-bold">
                        {totalCount}
                      </span>
                    )}
                  </button>
                )}
                {pharmacies.length > 1 && (
                  <select
                    value={selectedPharmacyId ?? ''}
                    onChange={(e) => setSelectedPharmacyId(e.target.value || null)}
                    className="catalog-hero-select bg-white/20 border border-white/40 rounded-xl px-3 py-2.5 text-sm font-medium text-white focus:ring-2 focus:ring-white/50 focus:outline-none [&>option]:text-gray-900 [&>option]:bg-white"
                    aria-label={t('pharmacy_label')}
                  >
                    {pharmacies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading || refreshing}
                  className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 active:scale-95 transition-colors disabled:opacity-60 shrink-0"
                  title={t('refresh')}
                  aria-label={t('refresh')}
                >
                  <RefreshCw className={`w-5 h-5 shrink-0 ${refreshing || loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            {/* Search in hero – surface bg so input text is readable */}
            {pharmacies.length > 0 && selectedPharmacyId && (
              <div className="relative max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-theme-muted pointer-events-none" aria-hidden />
                <input
                  type="search"
                  placeholder={t('search_products')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="catalog-search-input w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-theme-input-border text-sm sm:text-base shadow-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary focus:outline-none"
                  aria-label={t('search_products_aria')}
                />
              </div>
            )}
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 py-4 sm:py-5 relative z-10">
        {/* Offers, announcements & events */}
        {promos.length > 0 && (
          <section className="mb-10" aria-label="Offers, announcements and events">
            <h2 className="text-xl font-bold text-theme-text mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-careplus-primary rounded-full" />
              {t('whats_on')}
            </h2>
            <div className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth scrollbar-thin -mx-1 px-1">
              {promos.map((promo, idx) => {
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
                return (
                  <div key={promo.id} className="flex-shrink-0 w-[300px] sm:w-[340px] snap-start">
                    <div
                      className="rounded-2xl border border-theme-border bg-theme-surface shadow-lg hover:shadow-xl hover:-translate-y-1.5 overflow-hidden flex flex-col min-h-0 transition-all duration-300 animate-scale-in group"
                      style={{ animationDelay: `${idx * 0.08}s` }}
                    >
                      <div className="aspect-[16/10] bg-theme-bg overflow-hidden relative">
                        {promo.image_url ? (
                          <img
                            src={promo.image_url}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-theme-muted bg-gradient-to-br from-theme-border-subtle to-theme-bg">
                            <Icon className="w-12 h-12 opacity-70" />
                          </div>
                        )}
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-theme-bg/90 text-careplus-primary shadow">
                          {typeLabel}
                        </span>
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-semibold text-theme-text mt-0 line-clamp-1">{promo.title}</h3>
                        {promo.description && (
                          <p className="text-sm text-theme-text-secondary mt-1 line-clamp-2 flex-1">
                            {promo.description}
                          </p>
                        )}
                        {(promo.end_at || promo.start_at) && (
                          <p className="text-xs text-theme-muted mt-2">
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
                            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-careplus-primary hover:underline"
                          >
                            {t('learn_more')}
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {recentlyViewedProducts.length > 0 && (
          <section className="mb-10" aria-label="Recently viewed">
            <h2 className="text-xl font-bold text-theme-text mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-careplus-primary rounded-full" />
              Recently viewed
            </h2>
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin -mx-1 px-1">
              {recentlyViewedProducts.map((p, idx) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="flex-shrink-0 w-36 sm:w-44 snap-start rounded-xl sm:rounded-2xl border border-theme-border bg-theme-surface shadow-md overflow-hidden hover:shadow-lg hover:ring-2 hover:ring-careplus-primary/40 hover:-translate-y-1 transition-all duration-300 animate-scale-in group"
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  <div className="aspect-[4/3] bg-theme-bg overflow-hidden">
                    {productImageUrl(p) ? (
                      <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-theme-muted">
                        <Package className="w-8 h-8 sm:w-10 sm:h-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 sm:p-3">
                    <p className="text-xs sm:text-sm font-medium text-theme-text truncate">{p.name}</p>
                    <p className="text-xs sm:text-sm text-careplus-primary font-semibold mt-0.5">
                      {p.currency} {p.unit_price.toFixed(2)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Category quick-jump pills (when browsing by category, no filters) */}
        {pharmacies.length > 0 && selectedPharmacyId && !hasActiveFilters && catalogByCategory.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">{t('category')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('')}
                className="px-4 py-2 rounded-full text-sm font-medium bg-theme-surface border border-theme-border text-theme-text hover:border-careplus-primary hover:text-careplus-primary transition-colors"
              >
                {t('all_categories')}
              </button>
              {catalogByCategory.map(({ category }) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryFilter(category.name)}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-theme-surface border border-theme-border text-theme-text hover:border-careplus-primary hover:text-careplus-primary hover:shadow-md transition-all duration-200"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Catalog filters – compact bar + collapsible advanced */}
        {pharmacies.length > 0 && selectedPharmacyId && (
          <div className="mb-8 p-4 sm:p-5 bg-theme-surface rounded-2xl border border-theme-border shadow-sm catalog-filters">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-theme-input-bg border border-theme-input-border rounded-xl px-4 py-2.5 text-sm text-theme-text min-w-[140px] focus:ring-2 focus:ring-careplus-primary/30 focus:border-careplus-primary transition-colors"
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
                className="bg-theme-input-bg border border-theme-input-border rounded-xl px-4 py-2.5 text-sm text-theme-text min-w-[160px] focus:ring-2 focus:ring-careplus-primary/30 focus:border-careplus-primary"
                aria-label={t('sort_by')}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey)}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl hover:bg-theme-surface-hover transition-colors">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-theme-input-border text-careplus-primary focus:ring-careplus-primary"
                />
                <span className="text-sm text-theme-text">{t('in_stock_only')}</span>
              </label>
              <button
                type="button"
                onClick={() => setFiltersExpanded((e) => !e)}
                className="inline-flex items-center gap-2 px-3 py-2.5 text-sm text-theme-text bg-theme-input-bg border border-theme-input-border rounded-xl hover:border-careplus-primary/50 transition-colors"
                aria-expanded={filtersExpanded}
              >
                <Filter className="w-4 h-4" />
                {filtersExpanded ? 'Less filters' : 'More filters'}
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-careplus-primary hover:bg-careplus-primary/10 rounded-xl transition-colors font-medium"
                >
                  <X className="w-4 h-4" /> {t('clear_filters')}
                </button>
              )}
            </div>
            {filtersExpanded && (
              <div className="mt-4 pt-4 border-t border-theme-border flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Hashtag"
                  value={hashtagFilter}
                  onChange={(e) => setHashtagFilter(e.target.value)}
                  className="bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2 text-sm text-theme-text min-w-[100px] max-w-[120px] focus:ring-2 focus:ring-careplus-primary/30"
                  aria-label="Filter by hashtag"
                />
                <input
                  type="text"
                  placeholder="Brand"
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2 text-sm text-theme-text min-w-[90px] max-w-[120px] focus:ring-2 focus:ring-careplus-primary/30"
                  aria-label="Filter by brand"
                />
                <input
                  type="text"
                  placeholder="Label key"
                  value={labelKeyFilter}
                  onChange={(e) => setLabelKeyFilter(e.target.value)}
                  className="bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2 text-sm text-theme-text w-24 focus:ring-2 focus:ring-careplus-primary/30"
                  aria-label="Label key"
                />
                <input
                  type="text"
                  placeholder="Label value"
                  value={labelValueFilter}
                  onChange={(e) => setLabelValueFilter(e.target.value)}
                  className="bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2 text-sm text-theme-text w-24 focus:ring-2 focus:ring-careplus-primary/30"
                  aria-label="Label value"
                />
              </div>
            )}
            {hasActiveFilters && (
              <p className="text-xs text-theme-muted mt-3">
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

        {(loading || loadingCatalog) && (
          <div className="space-y-10">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-theme-surface rounded-xl sm:rounded-2xl border border-theme-border overflow-hidden catalog-card-skeleton animate-fade-in">
                  <div className="aspect-[4/3] bg-theme-border-subtle animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 bg-theme-border-subtle rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-theme-border-subtle rounded w-1/2 animate-pulse" />
                    <div className="h-9 bg-theme-border-subtle rounded-lg w-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-theme-muted">{t('loading')}</p>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-center">
            {error}
          </div>
        )}
        {!loading && !loadingCatalog && !error && pharmacies.length === 0 && (
          <div className="text-center py-20 bg-theme-surface rounded-2xl border border-theme-border shadow-sm">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-careplus-primary/10 flex items-center justify-center">
              <Package className="w-10 h-10 text-careplus-primary" />
            </div>
            <p className="text-theme-text font-semibold text-lg">{t('no_store_available')}</p>
            <p className="text-sm text-theme-muted mt-2 max-w-sm mx-auto">Check back later for available pharmacies.</p>
          </div>
        )}
        {!loading && !loadingCatalog && !error && pharmacies.length > 0 && !hasActiveFilters && catalogByCategory.length === 0 && (
          <div className="text-center py-20 bg-theme-surface rounded-2xl border border-theme-border shadow-sm">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-careplus-primary/10 flex items-center justify-center">
              <Package className="w-10 h-10 text-careplus-primary" />
            </div>
            <p className="text-theme-text font-semibold text-lg">{t('no_products_available')}</p>
            <p className="text-sm text-theme-muted mt-2 max-w-sm mx-auto">Products will appear here once added.</p>
          </div>
        )}
        {!loading && !loadingCatalog && !error && pharmacies.length > 0 && hasActiveFilters && products.length === 0 && (
          <div className="text-center py-20 bg-theme-surface rounded-2xl border border-theme-border shadow-sm">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-careplus-primary/10 flex items-center justify-center">
              <Package className="w-10 h-10 text-careplus-primary" />
            </div>
            <p className="text-theme-text font-semibold text-lg">{t('no_products_match')}</p>
            <p className="text-sm text-theme-muted mt-2 max-w-sm mx-auto">Try changing your filters or search term.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 px-5 py-2.5 bg-careplus-primary text-theme-text-inverse font-semibold rounded-xl hover:bg-careplus-secondary transition-colors shadow-md hover:shadow-lg"
            >
              {t('clear_filters')}
            </button>
          </div>
        )}
        {/* Catalog by category: show category name, 8–12 products (3 rows), then See more */}
        {!loading && !loadingCatalog && !error && pharmacies.length > 0 && !hasActiveFilters && catalogByCategory.length > 0 && (
          <div className="space-y-14">
            {catalogByCategory.map(({ category, products: catProducts, total: catTotal }) => (
              <section key={category.id} className="space-y-5" aria-labelledby={`category-${category.id}`}>
                <h2 id={`category-${category.id}`} className="text-2xl font-bold text-theme-text flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-careplus-primary rounded-full shrink-0" />
                  <span>{category.name}</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {catProducts.map((p, idx) => (
                    <article
                      key={p.id}
                      className="catalog-product-card bg-theme-surface rounded-xl sm:rounded-2xl border border-theme-border shadow-md hover:shadow-xl hover:-translate-y-1 p-0 flex flex-col overflow-hidden group transition-all duration-300 animate-scale-in"
                      style={{ animationDelay: `${Math.min(idx, 11) * 0.05}s` }}
                    >
                      <Link
                        to={`/products/${p.id}`}
                        className="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-inset rounded-xl sm:rounded-2xl"
                      >
                        <div className="aspect-[4/3] bg-theme-bg overflow-hidden relative rounded-t-xl sm:rounded-t-2xl flex-shrink-0">
                          {productImageUrl(p) ? (
                            <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-theme-muted">
                              <Package className="w-10 h-10 sm:w-14 sm:h-14" />
                            </div>
                          )}
                          {p.stock_quantity > 0 && p.stock_quantity <= 10 && (
                            <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/95 text-white shadow">Low stock</span>
                          )}
                        </div>
                        <div className="p-3 flex flex-col flex-1 min-h-0">
                          <div className="flex flex-wrap items-center gap-1 mb-1.5">
                            {p.requires_rx ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400">Rx</span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">OTC</span>
                            )}
                            {p.labels && Object.entries(p.labels).slice(0, 2).map(([k, v]) => (
                              <span key={k} className="inline-flex px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-theme-bg text-theme-text-secondary truncate max-w-[4rem] sm:max-w-none">
                                {String(v).slice(0, 8)}{v !== 'true' && String(v).length > 8 ? '…' : ''}
                              </span>
                            ))}
                          </div>
                          <h3 className="font-semibold text-sm sm:text-base text-theme-text truncate group-hover:text-careplus-primary transition-colors leading-tight">{p.name}</h3>
                          {(p.review_count != null && p.review_count > 0) && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-theme-muted">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star key={star} className={`w-3 h-3 sm:w-4 sm:h-4 ${(p.rating_avg ?? 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-theme-border'}`} aria-hidden />
                                ))}
                              </div>
                              <span>({p.review_count})</span>
                            </div>
                          )}
                          <p className="mt-2 text-base sm:text-lg font-bold text-careplus-primary leading-tight">
                            {p.currency} {p.unit_price.toFixed(2)}
                            {p.unit && <span className="text-xs sm:text-sm font-normal text-theme-muted"> / {p.unit}</span>}
                          </p>
                          <p className={`text-[10px] sm:text-xs mt-0.5 ${p.stock_quantity > 0 ? 'text-theme-muted' : 'text-amber-600 dark:text-amber-400'}`}>
                            {p.stock_quantity > 0 ? `${t('in_stock')}: ${p.stock_quantity}` : t('out_of_stock')}
                          </p>
                        </div>
                      </Link>
                      <div className="p-3 pt-0 flex-shrink-0">
                        <button
                          onClick={(e) => { e.preventDefault(); handleAddToCart(p); }}
                          disabled={p.stock_quantity < 1}
                          className={`w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 btn-press flex items-center justify-center gap-1.5 ${
                            justAddedToCartId === p.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-careplus-primary text-theme-text-inverse hover:bg-careplus-secondary hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                        >
                          {justAddedToCartId === p.id ? (
                            <>
                              <Check className="w-4 h-4 sm:w-5 sm:h-5" /> Added
                            </>
                          ) : (
                            user ? (p.stock_quantity > 0 ? t('add_to_cart') : t('out_of_stock')) : t('login_to_add_to_cart')
                          )}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {catTotal > CATALOG_PER_CATEGORY && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(category.name)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-careplus-primary font-semibold hover:bg-careplus-primary/10 rounded-xl transition-all duration-200 btn-press border border-careplus-primary/30 hover:border-careplus-primary"
                    >
                      {t('see_more')} in {category.name}
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((p, idx) => (
                <article
                  key={p.id}
                  className="catalog-product-card bg-theme-surface rounded-xl sm:rounded-2xl border border-theme-border shadow-md hover:shadow-xl hover:-translate-y-1 p-0 flex flex-col overflow-hidden group transition-all duration-300 animate-scale-in"
                  style={{ animationDelay: `${Math.min(idx, 11) * 0.05}s` }}
                >
                  <Link
                    to={`/products/${p.id}`}
                    className="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-inset rounded-xl sm:rounded-2xl"
                  >
                    <div className="aspect-[4/3] bg-theme-bg overflow-hidden relative rounded-t-xl sm:rounded-t-2xl flex-shrink-0">
                      {productImageUrl(p) ? (
                        <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-theme-muted">
                          <Package className="w-10 h-10 sm:w-14 sm:h-14" />
                        </div>
                      )}
                      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-wrap gap-1">
                        {(p.discount_percent ?? 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-600 text-white shadow">
                            {Math.round(p.discount_percent)}% off
                          </span>
                        )}
                        {p.stock_quantity > 0 && p.stock_quantity <= 10 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-500/95 text-white shadow">Low stock</span>
                        )}
                        {p.created_at && (() => {
                          const daysSince = (Date.now() - new Date(p.created_at).getTime()) / (24 * 60 * 60 * 1000);
                          return daysSince <= 30 ? <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-careplus-primary/95 text-white shadow">New</span> : null;
                        })()}
                      </div>
                    </div>
                    <div className="p-3 flex flex-col flex-1 min-h-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1.5">
                        {p.requires_rx ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-400">Rx</span>
                        ) : (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">OTC</span>
                        )}
                        {p.labels && Object.entries(p.labels).slice(0, 2).map(([k, v]) => (
                          <span key={k} className="inline-flex px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-theme-bg text-theme-text-secondary truncate max-w-[4rem] sm:max-w-none">
                            {String(v).slice(0, 8)}{v !== 'true' && String(v).length > 8 ? '…' : ''}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base text-theme-text truncate group-hover:text-careplus-primary transition-colors leading-tight">{p.name}</h3>
                      {(p.review_count != null && p.review_count > 0) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-theme-muted">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`w-3 h-3 sm:w-4 sm:h-4 ${(p.rating_avg ?? 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-theme-border'}`} aria-hidden />
                            ))}
                          </div>
                          <span>({p.review_count})</span>
                        </div>
                      )}
                      <div className="mt-2">
                        {(p.discount_percent ?? 0) > 0 ? (
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="text-xs sm:text-sm text-theme-muted line-through">
                              {p.currency} {(p.unit_price / (1 - (p.discount_percent! / 100))).toFixed(2)}
                            </span>
                            <span className="text-base sm:text-lg font-bold text-careplus-primary">
                              {p.currency} {p.unit_price.toFixed(2)}
                              {p.unit && <span className="text-xs sm:text-sm font-normal text-theme-muted"> / {p.unit}</span>}
                            </span>
                          </div>
                        ) : (
                          <p className="text-base sm:text-lg font-bold text-careplus-primary leading-tight">
                            {p.currency} {p.unit_price.toFixed(2)}
                            {p.unit && <span className="text-xs sm:text-sm font-normal text-theme-muted"> / {p.unit}</span>}
                          </p>
                        )}
                      </div>
                      <p className={`text-[10px] sm:text-xs mt-0.5 ${p.stock_quantity > 0 ? 'text-theme-muted' : 'text-amber-600 dark:text-amber-400'}`}>
                        {p.stock_quantity > 0 ? `${t('in_stock')}: ${p.stock_quantity}` : t('out_of_stock')}
                      </p>
                    </div>
                  </Link>
                  <div className="p-3 pt-0 flex-shrink-0">
                    <button
                      onClick={(e) => { e.preventDefault(); handleAddToCart(p); }}
                      disabled={p.stock_quantity < 1}
                      className={`w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 btn-press flex items-center justify-center gap-1.5 ${
                        justAddedToCartId === p.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-careplus-primary text-theme-text-inverse hover:bg-careplus-secondary hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {justAddedToCartId === p.id ? (
                        <>
                          <Check className="w-4 h-4 sm:w-5 sm:h-5" /> Added
                        </>
                      ) : (
                        user ? (p.stock_quantity > 0 ? t('add_to_cart') : t('out_of_stock')) : t('login_to_add_to_cart')
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {total > STORE_PAGE_SIZE && (
              <nav className="flex flex-wrap items-center justify-center gap-4 mt-10 py-6 bg-theme-surface rounded-2xl border border-theme-border shadow-sm" aria-label="Pagination">
                <span className="text-sm text-theme-muted">
                  {t('page_of', { page: String(page), totalPages: String(totalPages), total: String(total) })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToPage(1)}
                    disabled={!canPrev}
                    className="p-2.5 rounded-xl text-theme-muted hover:bg-careplus-primary/10 hover:text-careplus-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="First page"
                  >
                    <ChevronsLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={!canPrev}
                    className="p-2.5 rounded-xl text-theme-muted hover:bg-careplus-primary/10 hover:text-careplus-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm font-semibold text-theme-text min-w-[4rem] text-center bg-theme-bg rounded-xl">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={!canNext}
                    className="p-2.5 rounded-xl text-theme-muted hover:bg-careplus-primary/10 hover:text-careplus-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goToPage(totalPages)}
                    disabled={!canNext}
                    className="p-2.5 rounded-xl text-theme-muted hover:bg-careplus-primary/10 hover:text-careplus-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Last page"
                  >
                    <ChevronsRight className="w-5 h-5" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
        </div>
      </div>

      {cartOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-fade-in" onClick={() => setCartOpen(false)} aria-hidden />
          <div className="fixed top-0 right-0 w-full max-w-md h-full bg-theme-surface shadow-2xl z-50 flex flex-col border-l border-theme-border animate-slide-in-right">
            <div className="p-5 border-b border-theme-border flex items-center justify-between bg-theme-bg">
              <h2 className="text-xl font-bold text-theme-text">{t('cart_items', { count: totalCount })}</h2>
              <button onClick={() => setCartOpen(false)} className="p-2 rounded-xl text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition-colors text-2xl leading-none" aria-label="Close cart">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-theme-bg flex items-center justify-center">
                    <Package className="w-8 h-8 text-theme-muted" />
                  </div>
                  <p className="text-theme-text font-medium">{t('your_cart_empty')}</p>
                  <p className="text-sm text-theme-muted mt-1">Add items from the catalog to get started.</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((i) => (
                    <li key={i.product.id} className="flex gap-4 items-center p-3 rounded-xl bg-theme-bg border border-theme-border">
                      {productImageUrl(i.product) ? (
                        <img src={resolveImageUrl(productImageUrl(i.product))} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-theme-surface flex items-center justify-center shrink-0">
                          <Package className="w-7 h-7 text-theme-muted" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-theme-text truncate">{i.product.name}</p>
                        <p className="text-sm text-theme-muted mt-0.5">
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
                          className="w-14 bg-theme-input-bg border border-theme-input-border rounded-lg px-2 py-1.5 text-center text-theme-text text-sm"
                        />
                        <button
                          onClick={() => removeItem(i.product.id)}
                          className="text-red-600 dark:text-red-400 text-sm font-medium hover:underline"
                        >
                          {t('remove')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-5 border-t border-theme-border bg-theme-bg">
              {user && items.length > 0 && (
                <div className="mb-4 space-y-3">
                  <p className="text-xs text-theme-muted">First order? Try a welcome code if you have one.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Promo code"
                      value={promoCodeInput}
                      onChange={(e) => { setPromoCodeInput(e.target.value); setPromoError(''); }}
                      className="flex-1 bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2.5 text-sm text-theme-text focus:ring-2 focus:ring-careplus-primary/30"
                      disabled={!!appliedPromo}
                    />
                    {appliedPromo ? (
                      <button type="button" onClick={clearPromo} className="px-4 py-2.5 text-sm text-theme-muted hover:text-theme-text font-medium rounded-xl hover:bg-theme-surface-hover transition-colors">
                        {t('remove')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={applyingPromo || !promoCodeInput.trim()}
                        className="px-4 py-2.5 bg-theme-surface-hover text-theme-text text-sm font-medium rounded-xl hover:bg-theme-border disabled:opacity-50 transition-colors"
                      >
                        {applyingPromo ? 'Applying...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {promoError && <p className="text-sm text-red-600 dark:text-red-400">{promoError}</p>}
                  {appliedPromo && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Code applied: NPR {appliedPromo.discountAmount.toFixed(2)} off</p>
                  )}
                  <div>
                    <label className="text-sm text-theme-muted block mb-1">Phone (for points & referral)</label>
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2.5 text-sm text-theme-text focus:ring-2 focus:ring-careplus-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-theme-muted block mb-1">Referral code</label>
                    <input
                      type="text"
                      placeholder="Friend's referral code"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value)}
                      className="w-full bg-theme-input-bg border border-theme-input-border rounded-xl px-3 py-2.5 text-sm text-theme-text focus:ring-2 focus:ring-careplus-primary/30"
                    />
                  </div>
                  {pointsToRedeem != null && pointsToRedeem > 0 && (
                    <p className="text-sm text-theme-muted">Using {pointsToRedeem} points</p>
                  )}
                </div>
              )}
              {items.length > 0 && paymentGateways.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-theme-text mb-2">{t('payment_method')}</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {paymentGateways.map((gw) => (
                      <label
                        key={gw.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          selectedPaymentGatewayId === gw.id
                            ? 'border-careplus-primary bg-careplus-primary/10'
                            : 'border-theme-border hover:bg-theme-bg'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-gateway"
                          value={gw.id}
                          checked={selectedPaymentGatewayId === gw.id}
                          onChange={() => setSelectedPaymentGatewayId(gw.id)}
                          className="rounded-full border-theme-border text-careplus-primary focus:ring-careplus-primary"
                        />
                        <span className="text-sm font-medium text-theme-text">{gw.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="font-bold text-theme-text text-lg mb-3">
                {appliedPromo ? (
                  <>
                    <span className="text-theme-muted font-normal text-sm">Subtotal NPR {totalAmount.toFixed(2)} · Discount -NPR {appliedPromo.discountAmount.toFixed(2)}</span>
                    <br />
                    {t('total')} NPR {orderTotal.toFixed(2)}
                  </>
                ) : (
                  <>{t('total')} NPR {totalAmount.toFixed(2)}</>
                )}
              </p>
              <button
                onClick={handlePlaceOrder}
                disabled={items.length === 0 || placing}
                className="w-full py-3.5 bg-careplus-primary text-theme-text-inverse font-semibold rounded-xl hover:bg-careplus-secondary hover:shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all duration-200 btn-press"
              >
                {placing ? t('placing') : user ? t('place_order') : t('login_to_place_order')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col min-h-0 flex-1">{content}</div>;
  }
  return <WebsiteLayout {...cartProps}>{content}</WebsiteLayout>;
}
