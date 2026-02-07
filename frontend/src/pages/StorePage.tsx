import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicStoreApi, orderApi, promoCodeApi, resolveImageUrl } from '@/lib/api';
import type { Product, Pharmacy, PaymentGateway } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import Loader from '@/components/Loader';
import { Pill, ShoppingCart, LogIn, Package } from 'lucide-react';

function productImageUrl(p: Product): string | undefined {
  const images = p.images ?? [];
  return (images.find((i) => i.is_primary) ?? images[0])?.url;
}

export default function StorePage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
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
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [selectedPaymentGatewayId, setSelectedPaymentGatewayId] = useState<string | null>(null);
  const { user } = useAuth();
  const { items, addItem, removeItem, updateQuantity, clearCart, totalCount, totalAmount } = useCart();
  const navigate = useNavigate();

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
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPharmacyId) return;
    setLoading(true);
    publicStoreApi
      .listProducts(selectedPharmacyId, { in_stock: 'true' })
      .then(setProducts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load products'))
      .finally(() => setLoading(false));
  }, [selectedPharmacyId]);

  useEffect(() => {
    if (!selectedPharmacyId) return;
    publicStoreApi
      .listPaymentGateways(selectedPharmacyId)
      .then(setPaymentGateways)
      .catch(() => setPaymentGateways([]));
  }, [selectedPharmacyId]);

  // When user logs in, switch to their pharmacy so place-order works
  useEffect(() => {
    if (user?.pharmacy_id && pharmacies.some((p) => p.id === user.pharmacy_id)) {
      setSelectedPharmacyId(user.pharmacy_id);
    }
  }, [user?.pharmacy_id, pharmacies]);

  const requireLogin = (action: () => void) => {
    if (!user) {
      navigate('/login?returnTo=/store');
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
        alert(e instanceof Error ? e.message : 'Failed to place order');
      } finally {
        setPlacing(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-careplus-primary text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/store" className="flex items-center gap-2 font-semibold text-lg">
            <Pill className="w-8 h-8" />
            CarePlus Store
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-sm text-white/90 hover:underline"
                >
                  Dashboard
                </Link>
                <span className="text-sm text-white/90">{user.email}</span>
              </>
            ) : (
              <Link
                to="/login?returnTo=/store"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30"
              >
                <LogIn className="w-4 h-4" />
                Login to order
              </Link>
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 relative"
            >
              <ShoppingCart className="w-5 h-5" />
              Cart
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-careplus-secondary text-xs flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {pharmacies.length > 1 && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mr-2">Pharmacy:</label>
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

        {loading && <Loader variant="inline" message="Loading products…" />}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No products available.</p>
          </div>
        )}
        {!loading && !error && products.length > 0 && (
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
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                  <p className="mt-2 text-careplus-primary font-semibold">
                    {p.currency} {p.unit_price.toFixed(2)}
                    {p.unit && <span className="text-gray-500 font-normal"> / {p.unit}</span>}
                  </p>
                  <p className="text-xs text-gray-400">In stock: {p.stock_quantity}</p>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddToCart(p);
                  }}
                  disabled={p.stock_quantity < 1}
                  className="mt-auto py-2 px-3 rounded-lg bg-careplus-primary text-white text-sm font-medium hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {user ? 'Add to cart' : 'Login to add to cart'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {cartOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setCartOpen(false)} />
          <div className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-xl z-50 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cart ({totalCount} items)</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-500 hover:text-gray-700">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty.</p>
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
                          Remove
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
                        Remove
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
              {items.length > 0 && paymentGateways.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Payment method</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {paymentGateways.map((gw) => (
                      <label
                        key={gw.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPaymentGatewayId === gw.id
                            ? 'border-careplus-primary bg-careplus-primary/10'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-gateway"
                          value={gw.id}
                          checked={selectedPaymentGatewayId === gw.id}
                          onChange={() => setSelectedPaymentGatewayId(gw.id)}
                          className="rounded-full border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                        />
                        <span className="text-sm font-medium text-gray-800">{gw.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="font-semibold text-gray-800 mb-2">
                {appliedPromo ? (
                  <>
                    Subtotal: NPR {totalAmount.toFixed(2)} · Discount: -NPR {appliedPromo.discountAmount.toFixed(2)}<br />
                    Total: NPR {orderTotal.toFixed(2)}
                  </>
                ) : (
                  <>Total: NPR {totalAmount.toFixed(2)}</>
                )}
              </p>
              <button
                onClick={handlePlaceOrder}
                disabled={items.length === 0 || placing}
                className="w-full py-2.5 bg-careplus-primary text-white font-medium rounded-lg hover:bg-careplus-secondary disabled:opacity-50"
              >
                {placing ? 'Placing...' : user ? 'Place order' : 'Login to place order'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
