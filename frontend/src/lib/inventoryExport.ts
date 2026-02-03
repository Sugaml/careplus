import type { InventoryBatch } from '@/lib/api';

function formatDateCell(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return String(iso);
  }
}

function productName(b: InventoryBatch): string {
  return b.product?.name ?? b.product_id.slice(0, 8);
}

/** Build "By Product" summary: product name, total quantity, batch count */
function byProductRows(batches: InventoryBatch[]): { productName: string; totalQuantity: number; batchCount: number }[] {
  const map = new Map<string, { name: string; qty: number; count: number }>();
  for (const b of batches) {
    const name = productName(b);
    const cur = map.get(b.product_id);
    if (cur) {
      cur.qty += b.quantity;
      cur.count += 1;
    } else {
      map.set(b.product_id, { name, qty: b.quantity, count: 1 });
    }
  }
  return Array.from(map.entries()).map(([, v]) => ({
    productName: v.name,
    totalQuantity: v.qty,
    batchCount: v.count,
  }));
}

/** Export inventory report to Excel with multiple sheets: All Batches, Expiring Soon, By Product */
export async function exportInventoryToExcel(
  batches: InventoryBatch[],
  expiringSoon: InventoryBatch[],
  options?: { reportTitle?: string; dateRange?: string }
): Promise<void> {
  const XLSX = await import('xlsx');
  const title = options?.reportTitle ?? 'Inventory Report';
  const wb = XLSX.utils.book_new();

  // Sheet 1: All Batches
  const allHeaders = ['Product', 'Batch Number', 'Quantity', 'Expiry Date', 'Created At'];
  const allData = batches.map((b) => [
    productName(b),
    b.batch_number,
    b.quantity,
    formatDateCell(b.expiry_date),
    formatDateCell(b.created_at),
  ]);
  const wsAll = XLSX.utils.aoa_to_sheet([allHeaders, ...allData]);
  XLSX.utils.book_append_sheet(wb, wsAll, 'All Batches');

  // Sheet 2: Expiring Soon
  const expHeaders = ['Product', 'Batch Number', 'Quantity', 'Expiry Date', 'Created At'];
  const expData = expiringSoon.map((b) => [
    productName(b),
    b.batch_number,
    b.quantity,
    formatDateCell(b.expiry_date),
    formatDateCell(b.created_at),
  ]);
  const wsExp = XLSX.utils.aoa_to_sheet([expHeaders, ...expData]);
  XLSX.utils.book_append_sheet(wb, wsExp, 'Expiring Soon');

  // Sheet 3: By Product (summary)
  const byProduct = byProductRows(batches);
  const sumHeaders = ['Product', 'Total Quantity', 'Batch Count'];
  const sumData = byProduct.map((r) => [r.productName, r.totalQuantity, r.batchCount]);
  const wsSum = XLSX.utils.aoa_to_sheet([sumHeaders, ...sumData]);
  XLSX.utils.book_append_sheet(wb, wsSum, 'By Product');

  const filename = `inventory-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/** Export inventory report to PDF with sections: All Batches, Expiring Soon, By Product */
export async function exportInventoryToPdf(
  batches: InventoryBatch[],
  expiringSoon: InventoryBatch[],
  options?: { reportTitle?: string; dateRange?: string }
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const title = options?.reportTitle ?? 'Inventory Report';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 14;

  doc.setFontSize(16);
  doc.text(title, 14, y);
  y += 10;
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 8;

  const tableHead = [['Product', 'Batch Number', 'Quantity', 'Expiry Date', 'Created At']];

  // Section 1: All Batches
  doc.setFontSize(12);
  doc.text('All Batches', 14, y);
  y += 6;
  const allBody = batches.map((b) => [
    productName(b),
    b.batch_number,
    String(b.quantity),
    formatDateCell(b.expiry_date),
    formatDateCell(b.created_at),
  ]);
  autoTable(doc, {
    head: tableHead,
    body: allBody.length ? allBody : [['No batches']],
    startY: y,
    margin: { left: 14 },
    styles: { fontSize: 8 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (y > 270) {
    doc.addPage();
    y = 14;
  }

  // Section 2: Expiring Soon
  doc.setFontSize(12);
  doc.text('Expiring Soon (within 30 days)', 14, y);
  y += 6;
  const expBody = expiringSoon.map((b) => [
    productName(b),
    b.batch_number,
    String(b.quantity),
    formatDateCell(b.expiry_date),
    formatDateCell(b.created_at),
  ]);
  autoTable(doc, {
    head: tableHead,
    body: expBody.length ? expBody : [['No batches expiring soon']],
    startY: y,
    margin: { left: 14 },
    styles: { fontSize: 8 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (y > 270) {
    doc.addPage();
    y = 14;
  }

  // Section 3: By Product
  doc.setFontSize(12);
  doc.text('By Product (Summary)', 14, y);
  y += 6;
  const byProduct = byProductRows(batches);
  const sumHead = [['Product', 'Total Quantity', 'Batch Count']];
  const sumBody = byProduct.map((r) => [r.productName, String(r.totalQuantity), String(r.batchCount)]);
  autoTable(doc, {
    head: sumHead,
    body: sumBody.length ? sumBody : [['No data']],
    startY: y,
    margin: { left: 14 },
    styles: { fontSize: 8 },
  });

  const filename = `inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
