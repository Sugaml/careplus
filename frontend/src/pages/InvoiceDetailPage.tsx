import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { invoiceApi, InvoiceView } from '@/lib/api';
import { getInvoicePrintHtml, printInvoice, type InvoicePrintSize } from '@/lib/invoicePrint';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Loader2, RefreshCw, Eye, Printer, ChevronDown } from 'lucide-react';

const PRINT_SIZES: { size: InvoicePrintSize; labelKey: string }[] = [
  { size: 'a4', labelKey: 'invoice_print_a4' },
  { size: 'a5', labelKey: 'invoice_print_a5' },
  { size: 'receipt', labelKey: 'invoice_print_receipt' },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [view, setView] = useState<InvoiceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setPrintDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInvoice = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    invoiceApi
      .get(id)
      .then(setView)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load invoice'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleIssueClick = () => setIssueConfirmOpen(true);

  const handleIssueConfirm = async () => {
    if (!id || !view || view.invoice.status === 'issued') return;
    setIssuing(true);
    setIssueConfirmOpen(false);
    try {
      const updated = await invoiceApi.issue(id);
      setView((prev) =>
        prev ? { ...prev, invoice: updated } : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to issue invoice');
    } finally {
      setIssuing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInvoice();
  };

  const handlePreview = () => {
    if (view) setPreviewOpen(true);
  };

  const handlePrint = (size: InvoicePrintSize) => {
    if (view) {
      setPrintDropdownOpen(false);
      printInvoice(view, size);
    }
  };

  if (loading && !view) return <Loader variant="page" message="Loading invoice…" />;
  if (error && !view) return <p className="text-red-600">{error}</p>;
  if (!view) return <p className="text-gray-600">Invoice not found.</p>;

  const { invoice, order, payments } = view;
  const items = order.items ?? [];
  const isDraft = invoice.status === 'draft';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            <Eye className="w-4 h-4" />
            {t('invoice_preview')}
          </button>
          <div className="relative" ref={printDropdownRef}>
            <button
              type="button"
              onClick={() => setPrintDropdownOpen((o) => !o)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
            >
              <Printer className="w-4 h-4" />
              {t('invoice_print')}
              <ChevronDown className="w-4 h-4" />
            </button>
            {printDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10 min-w-[140px]">
                {PRINT_SIZES.map(({ size, labelKey }) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handlePrint(size)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          {isDraft && (
            <button
              type="button"
              onClick={handleIssueClick}
              disabled={issuing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Issue invoice
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoice {invoice.invoice_number}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Order #{order.order_number} · {new Date(invoice.created_at).toLocaleDateString()}
              </p>
              <span
                className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                  isDraft ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {invoice.status}
              </span>
            </div>
            {invoice.issued_at && (
              <p className="text-sm text-gray-600">
                Issued on {new Date(invoice.issued_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Bill to
          </h2>
          <p className="font-medium text-gray-900">{order.customer_name || '—'}</p>
          {order.customer_email && (
            <p className="text-sm text-gray-600">{order.customer_email}</p>
          )}
          {order.customer_phone && (
            <p className="text-sm text-gray-600">{order.customer_phone}</p>
          )}
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-y border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Product</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Qty</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                  Unit price
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900">
                    {item.product?.name ?? `Product ${item.product_id}`}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {order.currency} {item.unit_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {order.currency} {item.total_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-6 border-t border-gray-100 flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>
                {order.currency} {(order.sub_total ?? order.total_amount).toFixed(2)}
              </span>
            </div>
            {(order.tax_amount ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>
                  {order.currency} {order.tax_amount.toFixed(2)}
                </span>
              </div>
            )}
            {(order.discount_amount ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Discount</span>
                <span>
                  -{order.currency} {order.discount_amount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>
                {order.currency} {order.total_amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payments */}
        {payments.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50/30">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Payments
            </h2>
            <ul className="space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {p.currency} {p.amount.toFixed(2)} · {p.method} · {p.status}
                  </span>
                  {p.paid_at && (
                    <span className="text-gray-500">
                      Paid {new Date(p.paid_at).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {previewOpen && view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('invoice_preview')}</h2>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 font-medium"
              >
                {t('cancel')}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              <iframe
                title="Invoice preview"
                srcDoc={getInvoicePrintHtml(view, 'a4')}
                className="w-full min-h-[480px] bg-white rounded border border-gray-200"
                style={{ height: '70vh' }}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={issueConfirmOpen}
        title="Issue invoice"
        message="Are you sure you want to issue this invoice? It will be marked as issued and cannot be edited as draft."
        confirmLabel="Issue"
        cancelLabel="Cancel"
        variant="default"
        loading={issuing}
        onConfirm={handleIssueConfirm}
        onCancel={() => setIssueConfirmOpen(false)}
      />
    </div>
  );
}
