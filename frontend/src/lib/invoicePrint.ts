import type { InvoiceView } from '@/lib/api';

export type InvoicePrintSize = 'a4' | 'a5' | 'receipt';

const PRINT_STYLES: Record<InvoicePrintSize, string> = {
  a4: `
    @media print { body { width: 210mm; max-width: 210mm; margin: 12mm; font-size: 11pt; } }
    .invoice-wrap { width: 100%; font-size: 11pt; }
    .invoice-wrap table { font-size: 10pt; }
    .invoice-wrap th, .invoice-wrap td { padding: 6px 8px; }
  `,
  a5: `
    @media print { body { width: 148mm; max-width: 148mm; margin: 10mm; font-size: 10pt; } }
    .invoice-wrap { width: 100%; font-size: 10pt; }
    .invoice-wrap table { font-size: 9pt; }
    .invoice-wrap th, .invoice-wrap td { padding: 4px 6px; }
  `,
  receipt: `
    @media print { body { width: 80mm; max-width: 80mm; margin: 4mm; font-size: 9pt; } }
    .invoice-wrap { width: 100%; font-size: 9pt; }
    .invoice-wrap h1 { font-size: 12pt; }
    .invoice-wrap table { font-size: 8pt; }
    .invoice-wrap th, .invoice-wrap td { padding: 2px 4px; }
    .invoice-wrap .section { margin-bottom: 6px; }
  `,
};

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function getInvoicePrintHtml(view: InvoiceView, size: InvoicePrintSize): string {
  const { invoice, order, payments } = view;
  const items = order.items ?? [];
  const subTotal = order.sub_total ?? order.total_amount;
  const taxAmount = order.tax_amount ?? 0;
  const discountAmount = order.discount_amount ?? 0;

  const rows = items
    .map(
      (item) =>
        `<tr>
          <td>${escapeHtml(item.product?.name ?? `Product`)}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td style="text-align:right">${order.currency} ${item.unit_price.toFixed(2)}</td>
          <td style="text-align:right">${order.currency} ${item.total_price.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const paymentRows =
    payments.length > 0
      ? payments
          .map(
            (p) =>
              `<tr><td>${p.currency} ${p.amount.toFixed(2)}</td><td>${p.method}</td><td>${p.status}</td></tr>`
          )
          .join('')
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #111; line-height: 1.4; }
    .invoice-wrap { margin: 0 auto; }
    .invoice-wrap h1 { margin: 0 0 4px 0; font-size: 1.25rem; }
    .invoice-wrap .meta { font-size: 0.85em; color: #555; margin-bottom: 12px; }
    .invoice-wrap .section { margin-bottom: 12px; }
    .invoice-wrap .section-title { font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-bottom: 4px; }
    .invoice-wrap table { width: 100%; border-collapse: collapse; }
    .invoice-wrap th { text-align: left; font-weight: 600; border-bottom: 1px solid #ddd; }
    .invoice-wrap td { border-bottom: 1px solid #eee; }
    .invoice-wrap .text-right { text-align: right; }
    .invoice-wrap .totals { width: 100%; max-width: 200px; margin-left: auto; }
    .invoice-wrap .totals div { display: flex; justify-content: space-between; }
    .invoice-wrap .totals .total-line { font-weight: 700; border-top: 1px solid #333; padding-top: 4px; margin-top: 4px; }
    ${PRINT_STYLES[size]}
  </style>
</head>
<body>
  <div class="invoice-wrap" data-print-size="${size}">
    <h1>Invoice ${escapeHtml(invoice.invoice_number)}</h1>
    <p class="meta">Order #${escapeHtml(order.order_number)} · ${new Date(invoice.created_at).toLocaleDateString()} · ${invoice.status}</p>
    ${invoice.issued_at ? `<p class="meta">Issued: ${new Date(invoice.issued_at).toLocaleDateString()}</p>` : ''}

    <div class="section">
      <div class="section-title">Bill to</div>
      <p style="margin:0">${escapeHtml(order.customer_name || '—')}</p>
      ${order.customer_phone ? `<p style="margin:0;font-size:0.9em">${escapeHtml(order.customer_phone)}</p>` : ''}
      ${order.customer_email ? `<p style="margin:0;font-size:0.9em">${escapeHtml(order.customer_email)}</p>` : ''}
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Unit price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="section totals">
      <div><span>Subtotal</span><span>${order.currency} ${subTotal.toFixed(2)}</span></div>
      ${taxAmount > 0 ? `<div><span>Tax</span><span>${order.currency} ${taxAmount.toFixed(2)}</span></div>` : ''}
      ${discountAmount > 0 ? `<div><span>Discount</span><span>-${order.currency} ${discountAmount.toFixed(2)}</span></div>` : ''}
      <div class="total-line"><span>Total</span><span>${order.currency} ${order.total_amount.toFixed(2)}</span></div>
    </div>

    ${paymentRows ? `
    <div class="section">
      <div class="section-title">Payments</div>
      <table>
        <thead><tr><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

export function printInvoice(view: InvoiceView, size: InvoicePrintSize): void {
  const html = getInvoicePrintHtml(view, size);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  const doPrint = () => {
    w.print();
    w.onafterprint = () => w.close();
  };
  if (w.document.readyState === 'complete') {
    setTimeout(doPrint, 100);
  } else {
    w.onload = () => setTimeout(doPrint, 100);
  }
}
