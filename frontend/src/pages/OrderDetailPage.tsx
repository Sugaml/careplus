import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  orderApi,
  orderFeedbackApi,
  uploadFile,
  Order,
  OrderFeedback,
  OrderReturnRequest,
  ORDER_NEXT_STATUS,
  invoiceApi,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  RotateCcw,
  ShoppingCart,
  Star,
} from 'lucide-react';

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'ready', 'completed'] as const;

function statusBadgeClass(status: string): string {
  const base = 'px-2 py-1 rounded-full text-xs font-medium capitalize ';
  switch (status) {
    case 'pending':
      return base + 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'confirmed':
      return base + 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'processing':
      return base + 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'ready':
      return base + 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'completed':
      return base + 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'cancelled':
      return base + 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    default:
      return base + 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

const STAFF_CAN_MANAGE_ORDERS = ['admin', 'manager', 'pharmacist'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageOrders = user?.role && STAFF_CAN_MANAGE_ORDERS.includes(user.role);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [createInvoiceId, setCreateInvoiceId] = useState<string | null>(null);
  const [acceptConfirmOrder, setAcceptConfirmOrder] = useState<Order | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ order: Order; newStatus: string } | null>(null);
  const [feedback, setFeedback] = useState<OrderFeedback | null | undefined>(undefined);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });
  const [returnRequest, setReturnRequest] = useState<OrderReturnRequest | null | undefined>(undefined);
  const [returnRequestLoading, setReturnRequestLoading] = useState(false);
  const [returnRequestError, setReturnRequestError] = useState('');
  const [submittingReturnRequest, setSubmittingReturnRequest] = useState(false);
  const [returnForm, setReturnForm] = useState({ notes: '', description: '' });
  const [returnVideoFile, setReturnVideoFile] = useState<File | null>(null);
  const [returnPhotoFiles, setReturnPhotoFiles] = useState<File[]>([]);

  const fetchOrder = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    orderApi
      .get(id)
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const isOrderOwner = user?.id && order?.created_by && order.created_by === user.id;
  const canGiveFeedback = isOrderOwner && order?.status === 'completed';

  useEffect(() => {
    if (!id || !canGiveFeedback) return;
    setFeedbackLoading(true);
    setFeedbackError('');
    orderFeedbackApi
      .getByOrder(id)
      .then((f) => setFeedback(f ?? null))
      .catch((e) => {
        setFeedbackError(e instanceof Error ? e.message : 'Failed to load feedback');
        setFeedback(null);
      })
      .finally(() => setFeedbackLoading(false));
  }, [id, canGiveFeedback]);

  const isCompleted = order?.status === 'completed';
  const completedAt = order?.completed_at || order?.updated_at;
  const isWithinReturnWindow =
    isCompleted &&
    !!completedAt &&
    Date.now() - new Date(completedAt).getTime() <= 3 * 24 * 60 * 60 * 1000;
  const canRequestReturn = isOrderOwner && isCompleted;

  useEffect(() => {
    if (!id || !canRequestReturn) return;
    setReturnRequestLoading(true);
    setReturnRequestError('');
    orderApi
      .getReturnRequest(id)
      .then((r) => setReturnRequest(r ?? null))
      .catch((e) => {
        setReturnRequestError(e instanceof Error ? e.message : 'Failed to load');
        setReturnRequest(null);
      })
      .finally(() => setReturnRequestLoading(false));
  }, [id, canRequestReturn]);

  const handleSubmitReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || submittingReturnRequest || returnRequest != null) return;
    const hasEvidence = returnVideoFile || returnPhotoFiles.length > 0;
    if (!hasEvidence) {
      setReturnRequestError('Please add at least one video or photo as evidence.');
      return;
    }
    if (!returnForm.notes.trim() || !returnForm.description.trim()) {
      setReturnRequestError('Please provide notes and description.');
      return;
    }
    setReturnRequestError('');
    setSubmittingReturnRequest(true);
    try {
      let videoUrl = '';
      const photoUrls: string[] = [];
      if (returnVideoFile) {
        const res = await uploadFile(returnVideoFile);
        videoUrl = res.url;
      }
      for (const f of returnPhotoFiles) {
        const res = await uploadFile(f);
        photoUrls.push(res.url);
      }
      const created = await orderApi.createReturnRequest(id, {
        video_url: videoUrl || undefined,
        photo_urls: photoUrls.length ? photoUrls : undefined,
        notes: returnForm.notes.trim(),
        description: returnForm.description.trim(),
      });
      setReturnRequest(created);
      setReturnForm({ notes: '', description: '' });
      setReturnVideoFile(null);
      setReturnPhotoFiles([]);
    } catch (e) {
      setReturnRequestError(e instanceof Error ? e.message : 'Failed to submit return request');
    } finally {
      setSubmittingReturnRequest(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || submittingFeedback || feedback != null) return;
    setFeedbackError('');
    setSubmittingFeedback(true);
    try {
      const created = await orderFeedbackApi.create(id, {
        rating: feedbackForm.rating,
        comment: feedbackForm.comment.trim() || undefined,
      });
      setFeedback(created);
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleAcceptClick = () => {
    setOpenDropdown(false);
    if (order) setAcceptConfirmOrder(order);
  };

  const handleAcceptConfirm = async () => {
    if (!acceptConfirmOrder) return;
    const o = acceptConfirmOrder;
    setActingId(o.id);
    setAcceptConfirmOrder(null);
    try {
      const updated = await orderApi.accept(o.id);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept order');
    } finally {
      setActingId(null);
    }
  };

  const handleStatusChangeClick = (newStatus: string) => {
    setOpenDropdown(false);
    if (order) setStatusConfirm({ order, newStatus });
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusConfirm) return;
    const { order: o, newStatus } = statusConfirm;
    setActingId(o.id);
    setStatusConfirm(null);
    try {
      const updated = await orderApi.updateStatus(o.id, newStatus);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setActingId(null);
    }
  };

  const handleCreateInvoice = async () => {
    if (!order) return;
    setCreateInvoiceId(order.id);
    setError('');
    try {
      const inv = await invoiceApi.createFromOrder(order.id);
      navigate(`/invoices/${inv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setCreateInvoiceId(null);
    }
  };

  const nextStatuses = (status: string) => ORDER_NEXT_STATUS[status] ?? [];

  if (loading && !order) return <Loader variant="page" message="Loading order…" />;
  if (error && !order) return <p className="text-red-600">{error}</p>;
  if (!order) return <p className="text-gray-600">Order not found.</p>;

  const next = nextStatuses(order.status);
  const isActing = actingId === order.id;
  const isDropdownOpen = openDropdown;
  const items = order.items ?? [];
  const isCancelled = order.status === 'cancelled';
  const currentIndex = STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors"
            aria-label="Back to orders"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Order {order.order_number}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(order.created_at).toLocaleString()} · {order.customer_name || order.customer_email || '—'}
            </p>
          </div>
        </div>
        {canManageOrders && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={createInvoiceId === order.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              title="Create invoice"
            >
              {createInvoiceId === order.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Invoice
            </button>
            {order.status === 'pending' && (
              <button
                type="button"
                onClick={handleAcceptClick}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Accept
              </button>
            )}
            {next.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(!isDropdownOpen)}
                  disabled={isActing}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Change status
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpenDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
                      {next.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStatusChangeClick(s)}
                          className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 capitalize"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Order status timeline – connected graph-like */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Order status
        </h2>
        <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {isCancelled ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                {STATUS_FLOW.map((status, i) => (
                  <span
                    key={status}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      i <= currentIndex
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 line-through'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              <span className={statusBadgeClass('cancelled')}>Cancelled</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-0">
              {STATUS_FLOW.map((status, i) => {
                const isDone = i < currentIndex;
                const isCurrent = i === currentIndex;
                const isPending = i > currentIndex;
                const showConnector = i < STATUS_FLOW.length - 1;
                return (
                  <div key={status} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                          isDone
                            ? 'bg-careplus-primary border-careplus-primary text-white'
                            : isCurrent
                              ? 'bg-careplus-primary/10 border-careplus-primary text-careplus-primary dark:bg-careplus-primary/20 dark:border-careplus-primary dark:text-careplus-primary'
                              : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {isDone ? <Check className="w-5 h-5" /> : i + 1}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium capitalize ${
                          isCurrent ? 'text-careplus-primary' : isDone ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    {showConnector && (
                      <div
                        className={`w-8 sm:w-12 h-0.5 mx-0.5 sm:mx-1 flex-shrink-0 ${
                          isDone ? 'bg-careplus-primary' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Order items – clickable to product */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Items
        </h2>
        <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Product</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Qty</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Unit price</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item) => {
                const name = item.product?.name ?? `Product ${item.product_id}`;
                const productLink = `/products/${item.product_id}`;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <Link
                        to={productLink}
                        className="font-medium text-careplus-primary hover:underline focus:outline-none focus:ring-2 focus:ring-careplus-primary/30 rounded"
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {order.currency} {item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">
                      {order.currency} {item.total_price.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              Total: {order.currency} {order.total_amount.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Order feedback (end user who placed the order, completed only) */}
      {canGiveFeedback && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Your feedback
          </h2>
          <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            {feedbackLoading && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            )}
            {!feedbackLoading && feedback != null && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <p className="font-medium text-green-800 dark:text-green-300 mb-2">Thank you for your feedback.</p>
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <Star
                      key={r}
                      className={`w-5 h-5 ${feedback.rating >= r ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-600'}`}
                    />
                  ))}
                </div>
                {feedback.comment && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{feedback.comment}</p>
                )}
              </div>
            )}
            {!feedbackLoading && feedback === null && (
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                {feedbackError && (
                  <p className="text-red-600 dark:text-red-400 text-sm">{feedbackError}</p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFeedbackForm((prev) => ({ ...prev, rating: r }))}
                        className="p-0.5 focus:outline-none rounded"
                        aria-label={`${r} star${r > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-8 h-8 ${feedbackForm.rating >= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-500'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Comment (optional)
                  </label>
                  <textarea
                    id="feedback-comment"
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm((prev) => ({ ...prev, comment: e.target.value }))}
                    rows={3}
                    placeholder="How was your order experience?"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white text-sm font-medium hover:bg-careplus-secondary disabled:opacity-50"
                >
                  {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  {submittingFeedback ? 'Submitting…' : 'Submit feedback'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Return request (defect) – within 3 days of completion, with video/photo/notes/description */}
      {canRequestReturn && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Return request (defect)
          </h2>
          <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            {returnRequestLoading && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            )}
            {!returnRequestLoading && returnRequest != null && (
              <div
                className={`rounded-lg border p-4 ${
                  returnRequest.status === 'approved'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : returnRequest.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}
              >
                <p className="font-medium capitalize text-gray-800 dark:text-gray-200">Status: {returnRequest.status}</p>
                {returnRequest.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">{returnRequest.notes}</p>
                )}
                {returnRequest.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{returnRequest.description}</p>
                )}
              </div>
            )}
            {!returnRequestLoading && returnRequest === null && !isWithinReturnWindow && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Return requests must be submitted within 3 days of order completion.
              </p>
            )}
            {!returnRequestLoading && returnRequest === null && isWithinReturnWindow && (
              <form onSubmit={handleSubmitReturnRequest} className="space-y-4">
                {returnRequestError && (
                  <p className="text-red-600 dark:text-red-400 text-sm">{returnRequestError}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  If you received a defective item, submit a return request with video, photo(s), notes, and description within 3 days.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Video (optional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setReturnVideoFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-careplus-primary file:text-white"
                    />
                    {returnVideoFile && <span className="text-sm text-gray-500 truncate max-w-[180px]">{returnVideoFile.name}</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photos (at least one if no video)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setReturnPhotoFiles(Array.from(e.target.files ?? []))}
                    className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-careplus-primary file:text-white"
                  />
                  {returnPhotoFiles.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">{returnPhotoFiles.length} photo(s) selected</p>
                  )}
                </div>
                <div>
                  <label htmlFor="return-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="return-notes"
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Brief notes about the defect"
                  />
                </div>
                <div>
                  <label htmlFor="return-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="return-description"
                    value={returnForm.description}
                    onChange={(e) => setReturnForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Detailed description of the issue"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingReturnRequest}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white text-sm font-medium hover:bg-careplus-secondary disabled:opacity-50"
                >
                  {submittingReturnRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  {submittingReturnRequest ? 'Submitting…' : 'Submit return request'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={acceptConfirmOrder !== null}
        title="Approve order"
        message={
          acceptConfirmOrder
            ? `Approve order #${acceptConfirmOrder.order_number}? It will move to Confirmed status.`
            : ''
        }
        confirmLabel="Approve"
        cancelLabel="Cancel"
        variant="default"
        loading={actingId === acceptConfirmOrder?.id}
        onConfirm={handleAcceptConfirm}
        onCancel={() => setAcceptConfirmOrder(null)}
      />

      <ConfirmDialog
        open={statusConfirm !== null}
        title="Change order status"
        message={
          statusConfirm
            ? statusConfirm.newStatus === 'cancelled'
              ? `Change order #${statusConfirm.order.order_number} to Cancelled? This cannot be undone.`
              : `Change order #${statusConfirm.order.order_number} status to ${statusConfirm.newStatus}?`
            : ''
        }
        confirmLabel="Change status"
        cancelLabel="Cancel"
        variant={statusConfirm?.newStatus === 'cancelled' ? 'danger' : 'default'}
        loading={statusConfirm !== null && actingId === statusConfirm.order.id}
        onConfirm={handleStatusChangeConfirm}
        onCancel={() => setStatusConfirm(null)}
      />
    </div>
  );
}
