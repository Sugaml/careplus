import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { inventoryApi, productApi, type InventoryBatch, type Product, ApiError } from '@/lib/api';
import { exportInventoryToExcel, exportInventoryToPdf } from '@/lib/inventoryExport';
import Loader from '@/components/Loader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Boxes, RefreshCw, Plus, Pencil, Trash2, X, Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function InventoryPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [batchToEdit, setBatchToEdit] = useState<InventoryBatch | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<InventoryBatch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [addForm, setAddForm] = useState({ product_id: '', batch_number: '', quantity: 0, expiry_date: '' });
  const [editForm, setEditForm] = useState({ quantity: 0, expiry_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportOpen]);

  const loadBatches = useCallback(() => {
    setLoading(true);
    setError('');
    inventoryApi
      .listBatchesByPharmacy()
      .then(setBatches)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load inventory');
        setBatches([]);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (addModalOpen && isManagerOrAdmin) {
      productApi.list().then((list) => setProducts(list ?? [])).catch(() => setProducts([]));
      setAddForm({ product_id: products[0]?.id ?? '', batch_number: '', quantity: 0, expiry_date: '' });
      setSubmitError('');
    }
  }, [addModalOpen, isManagerOrAdmin]);

  useEffect(() => {
    if (addModalOpen && products.length && !addForm.product_id) {
      setAddForm((f) => ({ ...f, product_id: products[0].id }));
    }
  }, [addModalOpen, products, addForm.product_id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadBatches();
  };

  const handleOpenAdd = () => {
    setAddModalOpen(true);
    setAddForm({ product_id: '', batch_number: '', quantity: 0, expiry_date: '' });
    setSubmitError('');
  };

  const handleCloseAdd = () => {
    setAddModalOpen(false);
    setSubmitError('');
  };

  const handleAddSubmit = () => {
    const productId = addForm.product_id?.trim();
    const batchNumber = addForm.batch_number?.trim();
    const quantity = addForm.quantity;
    if (!productId || !batchNumber || quantity < 1) {
      setSubmitError(t('validation_required'));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    inventoryApi
      .addBatch(productId, {
        batch_number: batchNumber,
        quantity,
        expiry_date: addForm.expiry_date?.trim() || undefined,
      })
      .then(() => {
        handleCloseAdd();
        loadBatches();
      })
      .catch((e) => {
        setSubmitError(e instanceof ApiError ? e.message : 'Failed to add batch');
      })
      .finally(() => setSubmitting(false));
  };

  const handleOpenEdit = (batch: InventoryBatch) => {
    setBatchToEdit(batch);
    setEditForm({
      quantity: batch.quantity,
      expiry_date: batch.expiry_date ? batch.expiry_date.slice(0, 10) : '',
    });
    setSubmitError('');
    setEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setBatchToEdit(null);
    setSubmitError('');
  };

  const handleEditSubmit = () => {
    if (!batchToEdit) return;
    const quantity = editForm.quantity;
    if (quantity < 0) {
      setSubmitError(t('validation_required'));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    inventoryApi
      .updateBatch(batchToEdit.id, {
        quantity: editForm.quantity,
        expiry_date: editForm.expiry_date?.trim() || null,
      })
      .then(() => {
        handleCloseEdit();
        loadBatches();
      })
      .catch((e) => {
        setSubmitError(e instanceof ApiError ? e.message : 'Failed to update batch');
      })
      .finally(() => setSubmitting(false));
  };

  const handleDeleteConfirm = () => {
    if (!batchToDelete) return;
    setDeleting(true);
    inventoryApi
      .deleteBatch(batchToDelete.id)
      .then(() => {
        setBatchToDelete(null);
        loadBatches();
      })
      .catch(() => {})
      .finally(() => setDeleting(false));
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setExportOpen(false);
    try {
      const expiringSoon = await inventoryApi.listExpiringSoon(30);
      await exportInventoryToExcel(batches, expiringSoon, { reportTitle: 'Inventory Report' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setExportOpen(false);
    try {
      const expiringSoon = await inventoryApi.listExpiringSoon(30);
      await exportInventoryToPdf(batches, expiringSoon, { reportTitle: 'Inventory Report' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Boxes className="w-7 h-7 text-careplus-primary" />
          <h1 className="text-2xl font-bold text-theme-text">{t('nav_inventory')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              {t('inventory_add_batch')}
            </button>
          )}
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              disabled={loading || exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-border text-theme-text hover:bg-theme-hover transition-colors disabled:opacity-50 font-medium text-sm"
              title={t('inventory_export')}
              aria-expanded={exportOpen}
              aria-haspopup="true"
            >
              <Download className="w-4 h-4" />
              {t('inventory_export')}
              <ChevronDown className={`w-4 h-4 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 min-w-[180px] bg-white dark:bg-theme-card border border-theme-border rounded-lg shadow-lg z-50">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-theme-text hover:bg-theme-hover disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  {t('inventory_export_excel')}
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-theme-text hover:bg-theme-hover disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-red-600" />
                  {t('inventory_export_pdf')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-theme-text hover:bg-theme-hover transition-colors disabled:opacity-50"
            title={t('refresh')}
            aria-label={t('refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {user?.role === 'pharmacist' && (
        <p className="text-theme-muted text-sm mb-4">{t('inventory_changes_approved_by_manager')}</p>
      )}

      {exporting && (
        <div className="mb-4 p-3 rounded-lg bg-careplus-primary/10 text-careplus-primary text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          {t('inventory_export_loading')}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <Loader variant="page" message={t('loading')} />
      ) : (
        <div className="bg-white dark:bg-theme-card rounded-xl border border-theme-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-theme-border">
              <thead className="bg-theme-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('inventory_product')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('inventory_batch_number')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('inventory_quantity')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('inventory_expiry_date')}</th>
                  {isManagerOrAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">{t('actions')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={isManagerOrAdmin ? 5 : 4} className="px-4 py-8 text-center text-theme-muted">
                      {t('inventory_empty')}
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} className="hover:bg-theme-muted/20">
                      <td className="px-4 py-3 text-sm text-theme-text">{b.product?.name ?? b.product_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-sm text-theme-text font-mono">{b.batch_number}</td>
                      <td className="px-4 py-3 text-sm text-theme-text">{b.quantity}</td>
                      <td className="px-4 py-3 text-sm text-theme-text">{formatDate(b.expiry_date)}</td>
                      {isManagerOrAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 rounded text-theme-muted hover:bg-theme-hover hover:text-theme-text mr-1"
                            title={t('edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setBatchToDelete(b)}
                            className="p-1.5 rounded text-theme-muted hover:bg-red-50 hover:text-red-600"
                            title={t('delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add batch modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-theme-card rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">{t('inventory_add_batch')}</h2>
              <button type="button" onClick={handleCloseAdd} className="p-1 rounded hover:bg-theme-hover">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('inventory_product')}</label>
                <select
                  value={addForm.product_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, product_id: e.target.value }))}
                  className="w-full border border-theme-border rounded-lg px-3 py-2 bg-white dark:bg-theme-bg text-theme-text"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('inventory_batch_number')}</label>
                <input
                  type="text"
                  value={addForm.batch_number}
                  onChange={(e) => setAddForm((f) => ({ ...f, batch_number: e.target.value }))}
                  className="w-full border border-theme-border rounded-lg px-3 py-2 bg-white dark:bg-theme-bg text-theme-text"
                  placeholder="e.g. BATCH-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('inventory_quantity')}</label>
                <input
                  type="number"
                  min={1}
                  value={addForm.quantity || ''}
                  onChange={(e) => setAddForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full border border-theme-border rounded-lg px-3 py-2 bg-white dark:bg-theme-bg text-theme-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('inventory_expiry_date')}</label>
                <input
                  type="date"
                  value={addForm.expiry_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, expiry_date: e.target.value }))}
                  className="w-full border border-theme-border rounded-lg px-3 py-2 bg-white dark:bg-theme-bg text-theme-text"
                />
              </div>
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-theme-border">
              <button type="button" onClick={handleCloseAdd} className="px-4 py-2 rounded-lg border border-theme-border text-theme-text hover:bg-theme-hover">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleAddSubmit} disabled={submitting} className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50">
                {submitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit batch modal */}
      {editModalOpen && batchToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-theme-card rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">{t('edit')}</h2>
              <button type="button" onClick={handleCloseEdit} className="p-1 rounded hover:bg-theme-hover">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-theme-muted">
                {batchToEdit.product?.name ?? batchToEdit.product_id.slice(0, 8)} · {batchToEdit.batch_number}
              </p>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('inventory_quantity')}</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full border border-theme-border rounded-lg px-3 py-2 bg-white dark:bg-theme-bg text-theme-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('inventory_expiry_date')}</label>
                <input
                  type="date"
                  value={editForm.expiry_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, expiry_date: e.target.value }))}
                  className="w-full border border-theme-border rounded-lg px-3 py-2 bg-white dark:bg-theme-bg text-theme-text"
                />
              </div>
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-theme-border">
              <button type="button" onClick={handleCloseEdit} className="px-4 py-2 rounded-lg border border-theme-border text-theme-text hover:bg-theme-hover">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleEditSubmit} disabled={submitting} className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50">
                {submitting ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!batchToDelete}
        title={t('delete')}
        message={batchToDelete ? t('inventory_delete_batch_confirm') : ''}
        confirmLabel={t('delete')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setBatchToDelete(null)}
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}
