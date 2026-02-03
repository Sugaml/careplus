import { useEffect, useState } from 'react';
import { productUnitApi, ProductUnit } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, Box, X, Pencil, Trash2, RefreshCw } from 'lucide-react';

const initialForm = {
  name: '',
  description: '',
  sort_order: 0,
};

export default function ProductUnitsPage() {
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadUnits = () => {
    setLoading(true);
    setError('');
    productUnitApi
      .list()
      .then(setUnits)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load units'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const openAddModal = () => {
    setForm(initialForm);
    setEditingId(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (u: ProductUnit) => {
    setForm({
      name: u.name,
      description: u.description ?? '',
      sort_order: u.sort_order ?? 0,
    });
    setEditingId(u.id);
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setEditingId(null);
    loadUnits();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const performSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await productUnitApi.update(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sort_order: form.sort_order,
        });
        setUnits((prev) => prev.map((u) => (u.id === editingId ? updated : u)));
      } else {
        const created = await productUnitApi.create({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sort_order: form.sort_order,
        });
        setUnits((prev) => [...prev, created]);
      }
      setUpdateConfirmOpen(false);
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save unit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      setUpdateConfirmOpen(true);
      return;
    }
    await performSubmit();
  };

  const handleUpdateConfirm = () => {
    performSubmit();
  };

  const handleDeleteClick = (id: string) => setDeleteConfirmId(id);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    const idToDelete = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await productUnitApi.delete(idToDelete);
      setUnits((prev) => prev.filter((u) => u.id !== idToDelete));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUnits();
  };

  if (loading) return <Loader variant="page" message="Loading units…" />;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Product Units</h1>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Unit
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {units.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Box className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No units yet. Add units of measure for your products (e.g. tablet, bottle, box, ml).</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-24">Order</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{u.description || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{u.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(u.id)}
                        disabled={deletingId === u.id}
                        className="p-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-modal-title"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 id="unit-modal-title" className="text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Unit' : 'Add Unit'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{submitError}</div>
              )}
              <div>
                <label htmlFor="unit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="unit-name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="e.g. tablet, bottle, ml"
                />
              </div>
              <div>
                <label htmlFor="unit-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="unit-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label htmlFor="unit-sort" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort order
                </label>
                <input
                  id="unit-sort"
                  name="sort_order"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving…' : editingId ? 'Update' : 'Add Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete unit"
        message="Are you sure you want to delete this unit? Products using it will keep the unit name as text."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmDialog
        open={updateConfirmOpen}
        title="Update unit"
        message="Save changes to this unit?"
        confirmLabel="Save"
        cancelLabel="Cancel"
        variant="default"
        loading={submitting}
        onConfirm={handleUpdateConfirm}
        onCancel={() => setUpdateConfirmOpen(false)}
      />
    </div>
  );
}
