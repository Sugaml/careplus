import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { orderApi, paymentApi, invoiceApi, type Order, type Payment, type Invoice } from '@/lib/api';
import Loader from '@/components/Loader';
import { RefreshCw, Printer, FileText, ShoppingCart, CreditCard } from 'lucide-react';

type TabId = 'orders' | 'payments' | 'invoices';

function parseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function isInRange(createdAt: string, from: string, to: string): boolean {
  const date = parseDate(createdAt);
  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;
  if (fromDate && date < fromDate) return false;
  if (toDate) {
    const toEnd = new Date(toDate);
    toEnd.setHours(23, 59, 59, 999);
    if (date > toEnd) return false;
  }
  return true;
}

export default function StatementsPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabId>('orders');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([orderApi.list(), paymentApi.list(), invoiceApi.list()])
      .then(([o, p, i]) => {
        setOrders(o);
        setPayments(p);
        setInvoices(i);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load data'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredOrders = useMemo(
    () => orders.filter((o) => isInRange(o.created_at, dateFrom, dateTo)),
    [orders, dateFrom, dateTo]
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => isInRange(p.created_at, dateFrom, dateTo)),
    [payments, dateFrom, dateTo]
  );
  const filteredInvoices = useMemo(
    () => invoices.filter((i) => isInRange(i.created_at, dateFrom, dateTo)),
    [invoices, dateFrom, dateTo]
  );

  const summary = useMemo(() => {
    const orderTotal = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const paymentTotal = filteredPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return { orderTotal, paymentTotal, orderCount: filteredOrders.length, paymentCount: filteredPayments.length };
  }, [filteredOrders, filteredPayments]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = `
      <!DOCTYPE html>
      <html>
        <head><title>Statement</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Company Statement</h1>
          <p>From: ${dateFrom || '—'} To: ${dateTo || '—'}</p>
          <p>Orders: ${summary.orderCount} · Total: NPR ${summary.orderTotal.toFixed(2)}</p>
          <p>Payments: ${summary.paymentCount} · Total: NPR ${summary.paymentTotal.toFixed(2)}</p>
          <h2>Orders</h2>
          <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
            <tr><th>Order #</th><th>Date</th><th>Customer</th><th>Status</th><th>Total (NPR)</th></tr>
            ${filteredOrders
              .map(
                (o) =>
                  `<tr><td>${o.order_number}</td><td>${new Date(o.created_at).toLocaleDateString()}</td><td>${o.customer_name || o.customer_phone || '—'}</td><td>${o.status}</td><td>${o.total_amount.toFixed(2)}</td></tr>`
              )
              .join('')}
          </table>
          <h2>Payments</h2>
          <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
            <tr><th>Date</th><th>Amount (NPR)</th><th>Method</th><th>Status</th></tr>
            ${filteredPayments
              .map(
                (p) =>
                  `<tr><td>${new Date(p.created_at).toLocaleDateString()}</td><td>${p.amount.toFixed(2)}</td><td>${p.method}</td><td>${p.status}</td></tr>`
              )
              .join('')}
          </table>
          <h2>Invoices</h2>
          <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%;">
            <tr><th>Invoice #</th><th>Date</th><th>Status</th></tr>
            ${filteredInvoices
              .map(
                (i) =>
                  `<tr><td>${i.invoice_number}</td><td>${new Date(i.created_at).toLocaleDateString()}</td><td>${i.status}</td></tr>`
              )
              .join('')}
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
  };

  if (loading && orders.length === 0 && payments.length === 0 && invoices.length === 0) {
    return <Loader variant="page" message="Loading…" />;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-theme-text">{t('nav_statements')}</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg text-sm"
            aria-label={t('statements_date_from')}
          />
          <span className="text-theme-muted">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-theme-border px-3 py-2 text-theme-text bg-theme-bg text-sm"
            aria-label={t('statements_date_to')}
          />
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-muted hover:text-theme-text transition-colors"
            title={t('statements_print')}
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-muted hover:text-theme-text transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-800 text-sm">{error}</div>
      )}

      <div className="flex gap-2 border-b border-theme-border mb-4">
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-4 py-2 rounded-t font-medium text-sm flex items-center gap-2 ${
            tab === 'orders' ? 'bg-careplus-primary text-white' : 'bg-theme-surface text-theme-text hover:bg-theme-muted'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          {t('statements_orders')}
        </button>
        <button
          type="button"
          onClick={() => setTab('payments')}
          className={`px-4 py-2 rounded-t font-medium text-sm flex items-center gap-2 ${
            tab === 'payments' ? 'bg-careplus-primary text-white' : 'bg-theme-surface text-theme-text hover:bg-theme-muted'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          {t('statements_payments')}
        </button>
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={`px-4 py-2 rounded-t font-medium text-sm flex items-center gap-2 ${
            tab === 'invoices' ? 'bg-careplus-primary text-white' : 'bg-theme-surface text-theme-text hover:bg-theme-muted'
          }`}
        >
          <FileText className="w-4 h-4" />
          {t('statements_invoices')}
        </button>
      </div>

      <div className="bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
        {tab === 'orders' && (
          <>
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-theme-muted">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('statements_no_data')}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-theme-muted/50 border-b border-theme-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Order #</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Customer</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-theme-text">Total (NPR)</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-theme-text">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-theme-muted/30">
                      <td className="px-4 py-3 font-medium text-theme-text">{o.order_number}</td>
                      <td className="px-4 py-3 text-theme-muted">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-theme-text">{o.customer_name || o.customer_phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-theme-muted text-theme-text capitalize">
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-theme-text">{o.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/orders`} className="text-careplus-primary text-sm font-medium hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {tab === 'payments' && (
          <>
            {filteredPayments.length === 0 ? (
              <div className="p-12 text-center text-theme-muted">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('statements_no_data')}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-theme-muted/50 border-b border-theme-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Order ID</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-theme-text">Amount (NPR)</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Method</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-theme-muted/30">
                      <td className="px-4 py-3 text-theme-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-theme-text font-mono text-sm">{p.order_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-right font-medium text-theme-text">{p.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-theme-text capitalize">{p.method}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-theme-muted text-theme-text capitalize">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {tab === 'invoices' && (
          <>
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-theme-muted">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('statements_no_data')}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-theme-muted/50 border-b border-theme-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Invoice #</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-theme-text">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-theme-text">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-theme-muted/30">
                      <td className="px-4 py-3 font-medium text-theme-text">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-theme-muted">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                            inv.status === 'issued' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="text-careplus-primary text-sm font-medium hover:underline"
                        >
                          {t('billing_view_invoice')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
