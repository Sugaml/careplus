import { useCallback, useEffect, useState } from 'react';
import {
  orderApi,
  Order,
  ORDER_NEXT_STATUS,
  invoiceApi,
} from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { ShoppingCart, Check, ChevronDown, Loader2, FileText, RefreshCw } from 'lucide-react';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function statusBadgeClass(status: string): string {
  const base = 'px-2 py-1 rounded-full text-xs font-medium capitalize ';
  switch (status) {
    case 'pending':
      return base + 'bg-amber-100 text-amber-800';
    case 'confirmed':
      return base + 'bg-blue-100 text-blue-800';
    case 'processing':
      return base + 'bg-indigo-100 text-indigo-800';
    case 'ready':
      return base + 'bg-emerald-100 text-emerald-800';
    case 'completed':
      return base + 'bg-green-100 text-green-800';
    case 'cancelled':
      return base + 'bg-gray-200 text-gray-700';
    default:
      return base + 'bg-gray-100 text-gray-700';
  }
}

/** End users (role "staff") only see their own orders and cannot accept or change status. */
const STAFF_CAN_MANAGE_ORDERS = ['admin', 'manager', 'pharmacist'];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageOrders = user?.role && STAFF_CAN_MANAGE_ORDERS.includes(user.role);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [createInvoiceId, setCreateInvoiceId] = useState<string | null>(null);
  const [acceptConfirmOrder, setAcceptConfirmOrder] = useState<Order | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ order: Order; newStatus: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError('');
    orderApi
      .list(statusFilter ? { status: statusFilter } : undefined)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleAcceptClick = (order: Order) => {
    setOpenDropdown(null);
    setAcceptConfirmOrder(order);
  };

  const handleAcceptConfirm = async () => {
    if (!acceptConfirmOrder) return;
    const order = acceptConfirmOrder;
    setActingId(order.id);
    setAcceptConfirmOrder(null);
    try {
      const updated = await orderApi.accept(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept order');
    } finally {
      setActingId(null);
    }
  };

  const handleStatusChangeClick = (order: Order, newStatus: string) => {
    setOpenDropdown(null);
    setStatusConfirm({ order, newStatus });
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusConfirm) return;
    const { order, newStatus } = statusConfirm;
    setActingId(order.id);
    setStatusConfirm(null);
    try {
      const updated = await orderApi.updateStatus(order.id, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setActingId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleCreateInvoice = async (order: Order) => {
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

  if (loading && orders.length === 0)
    return <Loader variant="page" message="Loading orders…" />;
  if (error && orders.length === 0) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {canManageOrders ? 'Orders' : 'My orders'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      <div className="bg-white dark:bg-gray-800/50 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No orders {statusFilter ? 'with this status' : 'yet'}.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Order #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Customer</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Total</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                {canManageOrders && (
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {orders.map((o) => {
                const next = nextStatuses(o.status);
                const isActing = actingId === o.id;
                const isDropdownOpen = openDropdown === o.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{o.order_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {o.customer_name || o.customer_email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(o.status)}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">
                      {o.currency} {o.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    {canManageOrders && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCreateInvoice(o)}
                            disabled={createInvoiceId === o.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                            title="Create invoice"
                          >
                            {createInvoiceId === o.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            Invoice
                          </button>
                          {o.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleAcceptClick(o)}
                              disabled={isActing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isActing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Accept
                            </button>
                          )}
                          {next.length > 0 && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenDropdown(isDropdownOpen ? null : o.id)
                                }
                                disabled={isActing}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                              >
                                Change status
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                                />
                              </button>
                              {isDropdownOpen && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    aria-hidden
                                    onClick={() => setOpenDropdown(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] py-1 rounded-lg bg-white border border-gray-200 shadow-lg">
                                    {next.map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => handleStatusChangeClick(o, s)}
                                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 capitalize"
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
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
