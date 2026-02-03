import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  productApi,
  orderApi,
  invoiceApi,
  paymentApi,
  referralApi,
  promoCodeApi,
  type Product,
  type Customer,
  type Order,
  type Invoice,
} from '@/lib/api';
import Loader from '@/components/Loader';
import { Plus, Minus, Trash2, Search } from 'lucide-react';

type CartLine = {
  product_id: string;
  product: { name: string; unit_price: number; sku: string };
  quantity: number;
  unit_price: number;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function BillingPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFetched, setSearchFetched] = useState(false); // true after we ran a search (to show "no results")
  const [searchQuantities, setSearchQuantities] = useState<Record<string, number>>({}); // qty per product id in search results
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [lookedUpCustomer, setLookedUpCustomer] = useState<Customer | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
  const [manualDiscount, setManualDiscount] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [redeemPreview, setRedeemPreview] = useState<{ discount_amount: number; max_redeemable: number; points_balance: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const subTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unit_price * line.quantity, 0),
    [cart]
  );
  const manualDiscountNum = useMemo(() => {
    const n = parseFloat(manualDiscount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [manualDiscount]);
  const totalDiscount = useMemo(() => {
    let d = manualDiscountNum;
    if (promoDiscount != null) d += promoDiscount;
    if (redeemPreview?.discount_amount) d += redeemPreview.discount_amount;
    return Math.min(d, subTotal);
  }, [manualDiscountNum, promoDiscount, redeemPreview, subTotal]);
  const orderTotal = Math.max(0, subTotal - totalDiscount);

  const addToCart = useCallback((product: Product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product_id === product.id ? { ...l, quantity: l.quantity + qty } : l
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product: { name: product.name, unit_price: product.unit_price, sku: product.sku },
          quantity: qty,
          unit_price: product.unit_price,
        },
      ];
    });
  }, []);

  const updateCartQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product_id === productId ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((l) => l.product_id !== productId));
  }, []);

  const handleBarcodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const barcode = barcodeInput.trim();
      if (!barcode) return;
      setError(null);
      try {
        const product = await productApi.getByBarcode(barcode);
        addToCart(product);
        setBarcodeInput('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Product not found');
      }
    },
    [barcodeInput, addToCart]
  );

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) {
        setSearchResults([]);
        setSearchFetched(false);
        return;
      }
      setSearchLoading(true);
      setError(null);
      setSearchFetched(true);
      try {
        if (UUID_REGEX.test(q)) {
          const product = await productApi.get(q);
          addToCart(product);
          setSearchQuery('');
          setSearchResults([]);
          setSearchFetched(false);
        } else {
          const { items } = await productApi.listPaginated({ q, limit: 20 });
          setSearchResults(items);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [addToCart]
  );

  const handleSearch = useCallback(() => {
    runSearch(searchQuery);
  }, [searchQuery, runSearch]);

  // Debounced search: run search 300ms after user stops typing (when query is not a UUID)
  useEffect(() => {
    const q = searchQuery.trim();
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    if (!q) {
      setSearchResults([]);
      setSearchFetched(false);
      return;
    }
    if (UUID_REGEX.test(q)) {
      // Don't debounce UUID - user likely pasted an ID; they can press Enter or click Search
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      setSearchLoading(true);
      setError(null);
      setSearchFetched(true);
      productApi
        .listPaginated({ q, limit: 20 })
        .then(({ items }) => {
          setSearchResults(items);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : 'Search failed');
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const handleLookupCustomer = useCallback(async () => {
    const phone = customerPhone.trim();
    if (!phone) return;
    setError(null);
    setLookedUpCustomer(null);
    setRedeemPreview(null);
    try {
      const cust = await referralApi.getCustomerByPhone(phone);
      setLookedUpCustomer(cust);
      setCustomerName(cust.name || '');
      setCustomerEmail(cust.email || '');
    } catch {
      setLookedUpCustomer(null);
    }
  }, [customerPhone]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoCode.trim();
    if (!code || subTotal <= 0) return;
    setError(null);
    setPromoDiscount(null);
    try {
      const result = await promoCodeApi.validate(code, subTotal);
      setPromoDiscount(result.discount_amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid promo code');
      setPromoDiscount(null);
    }
  }, [promoCode, subTotal]);

  const handleRedeemPreview = useCallback(async () => {
    if (!lookedUpCustomer || subTotal <= 0) return;
    const points = parseInt(pointsToRedeem, 10);
    if (!Number.isInteger(points) || points <= 0) {
      setRedeemPreview(null);
      return;
    }
    setError(null);
    try {
      const result = await referralApi.redeemPreview({
        customer_id: lookedUpCustomer.id,
        points_to_redeem: points,
        sub_total: subTotal,
      });
      setRedeemPreview(result);
    } catch {
      setRedeemPreview(null);
    }
  }, [lookedUpCustomer, pointsToRedeem, subTotal]);

  const handleGenerateBill = useCallback(async () => {
    if (cart.length === 0) {
      setError(t('billing_no_items'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const order = await orderApi.create({
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        items: cart.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        notes: notes || undefined,
        discount_amount: manualDiscountNum > 0 ? manualDiscountNum : undefined,
        promo_code: promoCode.trim() || undefined,
        points_to_redeem:
          lookedUpCustomer && pointsToRedeem && parseInt(pointsToRedeem, 10) > 0
            ? parseInt(pointsToRedeem, 10)
            : undefined,
      });
      const invoice = await invoiceApi.createFromOrder(order.id);
      await invoiceApi.issue(invoice.id);
      setSuccessOrder(order);
      setSuccessInvoice(invoice);
      setPaymentAmount(String(order.total_amount));
      setCart([]);
      setPromoCode('');
      setPromoDiscount(null);
      setManualDiscount('');
      setPointsToRedeem('');
      setRedeemPreview(null);
      setShowPaymentModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order or invoice');
    } finally {
      setLoading(false);
    }
  }, [
    cart,
    customerName,
    customerPhone,
    customerEmail,
    notes,
    manualDiscountNum,
    promoCode,
    lookedUpCustomer,
    pointsToRedeem,
    t,
  ]);

  const handleRecordPayment = useCallback(async () => {
    if (!successOrder) return;
    const amount = parseFloat(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPaymentSubmitting(true);
    setError(null);
    try {
      const payment = await paymentApi.create({
        order_id: successOrder.id,
        amount,
        method: paymentMethod,
        status: 'pending',
      });
      await paymentApi.complete(payment.id);
      setShowPaymentModal(false);
      navigate(`/invoices/${successInvoice?.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  }, [successOrder, successInvoice, paymentAmount, paymentMethod, navigate]);

  const resetSuccess = useCallback(() => {
    setSuccessOrder(null);
    setSuccessInvoice(null);
    setShowPaymentModal(false);
    setError(null);
  }, []);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-theme-text mb-4">{t('nav_billing')}</h1>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-800 text-sm">{error}</div>
      )}

      {successOrder && successInvoice ? (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="font-medium text-green-800">{t('billing_success')}</p>
          <p className="text-sm text-green-700 mt-1">
            Order #{successOrder.order_number} · Invoice #{successInvoice.invoice_number}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              to={`/invoices/${successInvoice.id}`}
              className="text-sm font-medium text-careplus-primary hover:underline"
            >
              {t('billing_view_invoice')}
            </Link>
            <button
              type="button"
              onClick={resetSuccess}
              className="text-sm text-gray-600 hover:underline"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Product entry + Cart */}
        <div className="space-y-4">
          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <h2 className="font-semibold text-theme-text mb-3">{t('billing_scan_barcode')}</h2>
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Barcode"
                className="flex-1 rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
              />
              <button type="submit" className="btn-primary px-4 py-2 rounded">
                {t('billing_add_to_cart')}
              </button>
            </form>
          </section>

          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <h2 className="font-semibold text-theme-text mb-3">{t('billing_search_product')}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setSearchResults([]);
                    setSearchFetched(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder={t('billing_search_product_placeholder')}
                className="flex-1 rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
                aria-label={t('billing_search_product')}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searchLoading || !searchQuery.trim()}
                className="btn-primary px-4 py-2 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searchLoading ? <Loader variant="small" /> : <Search className="w-4 h-4" />}
                {t('billing_search_button')}
              </button>
            </div>
            {searchLoading && (
              <p className="mt-2 text-sm text-theme-muted">{t('billing_searching')}</p>
            )}
            {!searchLoading && searchFetched && searchResults.length === 0 && searchQuery.trim() && (
              <p className="mt-2 text-sm text-theme-muted">{t('billing_no_products_found')}</p>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div className="mt-2 border border-theme-border rounded overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-theme-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-theme-text">{t('inventory_product')}</th>
                        <th className="text-left px-2 py-2 font-medium text-theme-text hidden sm:table-cell">SKU</th>
                        <th className="text-right px-2 py-2 font-medium text-theme-text">{t('billing_unit_price')}</th>
                        <th className="text-right px-2 py-2 font-medium text-theme-text w-20">{t('billing_quantity')}</th>
                        <th className="text-right px-3 py-2 font-medium text-theme-text w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border">
                      {searchResults.map((p) => {
                        const qty = Math.max(1, Math.min(999, searchQuantities[p.id] ?? 1));
                        return (
                          <tr key={p.id} className="hover:bg-theme-muted/30">
                            <td className="px-3 py-2 text-theme-text font-medium">{p.name}</td>
                            <td className="px-2 py-2 text-theme-muted hidden sm:table-cell">{p.sku}</td>
                            <td className="px-2 py-2 text-theme-text text-right">NPR {p.unit_price.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right">
                              <input
                                type="number"
                                min={1}
                                max={999}
                                value={qty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  setSearchQuantities((prev) => ({ ...prev, [p.id]: Number.isFinite(v) && v >= 1 ? v : 1 }));
                                }}
                                className="w-14 rounded border border-theme-border px-2 py-1 text-center text-theme-text bg-theme-bg"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  addToCart(p, qty);
                                  setSearchQuantities((prev) => ({ ...prev, [p.id]: 1 }));
                                }}
                                className="btn-primary px-2 py-1 rounded text-xs font-medium"
                              >
                                {t('billing_add_button')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <h2 className="font-semibold text-theme-text mb-3">{t('billing_cart')}</h2>
            {cart.length === 0 ? (
              <p className="text-theme-muted text-sm">{t('billing_no_items')}</p>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => (
                  <div
                    key={line.product_id}
                    className="flex items-center justify-between py-2 border-b border-theme-border text-sm"
                  >
                    <div>
                      <span className="font-medium text-theme-text">{line.product.name}</span>
                      <span className="text-theme-muted ml-2">× {line.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-theme-text">NPR {(line.unit_price * line.quantity).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(line.product_id, -1)}
                        className="p-1 rounded hover:bg-theme-muted"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(line.product_id, 1)}
                        className="p-1 rounded hover:bg-theme-muted"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.product_id)}
                        className="p-1 rounded hover:bg-red-100 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="font-medium text-theme-text pt-2">
                  {t('billing_subtotal')}: NPR {subTotal.toFixed(2)}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right: Customer, Promo, Discounts, Generate */}
        <div className="space-y-4">
          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <h2 className="font-semibold text-theme-text mb-3">{t('billing_customer')}</h2>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={handleLookupCustomer}
                  placeholder={t('billing_phone')}
                  className="flex-1 rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
                />
                <button type="button" onClick={handleLookupCustomer} className="btn-primary px-3 py-2 rounded text-sm">
                  {t('billing_lookup')}
                </button>
              </div>
              {lookedUpCustomer && (
                <div className="text-sm text-theme-muted">
                  {lookedUpCustomer.membership && (
                    <span>{t('billing_membership')}: {lookedUpCustomer.membership.name}</span>
                  )}
                  {lookedUpCustomer.membership && lookedUpCustomer.points_balance !== undefined && ' · '}
                  {lookedUpCustomer.points_balance !== undefined && (
                    <span>{t('billing_points_balance')}: {lookedUpCustomer.points_balance}</span>
                  )}
                </div>
              )}
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('auth_name')}
                className="w-full rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
              />
              <input
                type="text"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
              />
            </div>
          </section>

          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <h2 className="font-semibold text-theme-text mb-3">{t('billing_promo_code')}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoDiscount(null);
                }}
                placeholder="Code"
                className="flex-1 rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
              />
              <button type="button" onClick={handleApplyPromo} className="btn-primary px-3 py-2 rounded text-sm">
                {t('billing_apply_promo')}
              </button>
            </div>
            {promoDiscount != null && promoDiscount > 0 && (
              <p className="text-sm text-green-600 mt-1">Discount: NPR {promoDiscount.toFixed(2)}</p>
            )}
          </section>

          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <label className="block font-semibold text-theme-text mb-2">{t('billing_manual_discount')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={manualDiscount}
              onChange={(e) => setManualDiscount(e.target.value)}
              className="w-full rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
            />
          </section>

          {lookedUpCustomer && lookedUpCustomer.points_balance > 0 && (
            <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
              <h2 className="font-semibold text-theme-text mb-2">{t('billing_redeem_points')}</h2>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={pointsToRedeem}
                  onChange={(e) => {
                    setPointsToRedeem(e.target.value);
                    setRedeemPreview(null);
                  }}
                  onBlur={handleRedeemPreview}
                  placeholder="Points"
                  className="w-32 rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
                />
                <button type="button" onClick={handleRedeemPreview} className="btn-primary px-3 py-2 rounded text-sm">
                  Preview
                </button>
              </div>
              {redeemPreview && (
                <p className="text-sm text-theme-muted mt-1">
                  Discount: NPR {redeemPreview.discount_amount.toFixed(2)} (max {redeemPreview.max_redeemable} points)
                </p>
              )}
            </section>
          )}

          <section className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <label className="block font-semibold text-theme-text mb-2">{t('billing_notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
            />
          </section>

          <div className="bg-theme-surface rounded-lg p-4 border border-theme-border">
            <p className="text-theme-text font-medium">
              {t('billing_total')}: NPR {orderTotal.toFixed(2)}
            </p>
            <button
              type="button"
              onClick={handleGenerateBill}
              disabled={loading || cart.length === 0}
              className="mt-3 w-full btn-primary py-3 rounded font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader variant="small" /> : null}
              {t('billing_generate_bill')}
            </button>
          </div>
        </div>
      </div>

      {/* Record payment modal */}
      {showPaymentModal && successOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-theme-bg rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-theme-text mb-4">{t('billing_record_payment')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-theme-muted mb-1">Amount (NPR)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
                />
              </div>
              <div>
                <label className="block text-sm text-theme-muted mb-1">{t('billing_payment_method')}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg"
                >
                  <option value="cash">{t('billing_cash')}</option>
                  <option value="card">{t('billing_card')}</option>
                  <option value="online">{t('billing_online')}</option>
                  <option value="other">{t('billing_other')}</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2 rounded border border-theme-border text-theme-text"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={paymentSubmitting}
                className="flex-1 btn-primary py-2 rounded"
              >
                {paymentSubmitting ? <Loader variant="small" /> : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
