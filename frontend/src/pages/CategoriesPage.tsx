import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryApi, Category } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, FolderTree, X, Pencil, Trash2, RefreshCw, Package, GripVertical } from 'lucide-react';

const initialForm = {
  name: '',
  description: '',
  sort_order: 0,
  parent_id: '' as string,
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const loadCategories = () => {
    setLoading(true);
    setError('');
    categoryApi
      .list()
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load categories'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setForm(initialForm);
    setEditingId(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setForm({
      name: cat.name,
      description: cat.description ?? '',
      sort_order: cat.sort_order ?? 0,
      parent_id: cat.parent_id ?? '',
    });
    setEditingId(cat.id);
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setEditingId(null);
    loadCategories();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const parentCategories = categories.filter((c) => !c.parent_id);

  const performSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await categoryApi.update(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sort_order: form.sort_order,
          parent_id: form.parent_id.trim() || undefined,
        });
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await categoryApi.create({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sort_order: form.sort_order,
          parent_id: form.parent_id.trim() || undefined,
        });
        setCategories((prev) => [...prev, created]);
      }
      setUpdateConfirmOpen(false);
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save category');
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

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('application/json', JSON.stringify({ id }));
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingId && draggingId !== id) setDragOverId(id);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      return;
    }
    const fromIndex = categories.findIndex((c) => c.id === sourceId);
    const toIndex = categories.findIndex((c) => c.id === targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null);
      return;
    }
    const reordered = [...categories];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    setDraggingId(null);
    setReordering(true);
    setError('');
    try {
      await Promise.all(
        reordered.map((cat, index) =>
          categoryApi.update(cat.id, {
            name: cat.name,
            description: cat.description ?? '',
            sort_order: index,
          })
        )
      );
      setCategories(reordered.map((c, i) => ({ ...c, sort_order: i })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder categories');
    } finally {
      setReordering(false);
    }
  };

  const handleDeleteClick = (id: string) => setDeleteConfirmId(id);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    setDeleteConfirmId(null);
    try {
      await categoryApi.delete(deleteConfirmId);
      setCategories((prev) => prev.filter((c) => c.id !== deleteConfirmId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  if (loading) return <Loader variant="page" message="Loading categories…" />;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Categories</h1>
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
            Add Category
          </button>
        </div>
      </div>
      {reordering && (
        <p className="mb-3 text-sm text-gray-600">Updating order…</p>
      )}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FolderTree className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No categories yet. Add categories to group your products (e.g. OTC, Prescription).</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-2 py-3" aria-label="Drag to reorder" />
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Parent</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-24">Order</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...categories]
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((cat) => (
                  <tr
                    key={cat.id}
                    draggable={!reordering}
                    onDragStart={(e) => !reordering && handleDragStart(e, cat.id)}
                    onDragOver={(e) => handleDragOver(e, cat.id)}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, cat.id)}
                    className={`hover:bg-gray-50 transition-colors ${
                      draggingId === cat.id ? 'opacity-50' : ''
                    } ${dragOverId === cat.id ? 'bg-careplus-primary/5 border-l-4 border-l-careplus-primary' : ''}`}
                  >
                    <td
                      className="px-2 py-3 text-gray-400 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Drag to reorder (order is used in product catalog)"
                    >
                      <GripVertical className="w-5 h-5" aria-hidden />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/manage/products?category=${encodeURIComponent(cat.name)}`}
                        className="font-medium text-careplus-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cat.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cat.parent_id
                        ? (categories.find((c) => c.id === cat.parent_id)?.name ?? cat.parent?.name ?? cat.parent_id)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{cat.description || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{cat.sort_order}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/manage/products?category=${encodeURIComponent(cat.name)}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-careplus-primary transition-colors"
                          title="View all products in this category"
                        >
                          <Package className="w-4 h-4" />
                          Products
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(cat)}
                          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(cat.id)}
                          disabled={deletingId === cat.id}
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
      {categories.length > 1 && !reordering && (
        <p className="mt-2 text-sm text-gray-500">
          Drag rows by the grip icon to reorder. This order is used on the product catalog page.
        </p>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 id="category-modal-title" className="text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Category' : 'Add Category'}
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
                <label htmlFor="cat-parent" className="block text-sm font-medium text-gray-700 mb-1">
                  Parent category <span className="text-gray-400 font-normal">(optional; leave empty for top-level)</span>
                </label>
                <select
                  id="cat-parent"
                  name="parent_id"
                  value={form.parent_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary bg-white"
                >
                  <option value="">None (top-level category)</option>
                  {parentCategories.filter((c) => c.id !== editingId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="cat-name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="e.g. OTC, Prescription, Cleansers"
                />
              </div>
              <div>
                <label htmlFor="cat-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="cat-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label htmlFor="cat-sort" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort order
                </label>
                <input
                  id="cat-sort"
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
                  {submitting ? 'Saving…' : editingId ? 'Update' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete category"
        message="Are you sure you want to delete this category? Products using it will keep the category name as text."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmDialog
        open={updateConfirmOpen}
        title="Update category"
        message="Save changes to this category?"
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
