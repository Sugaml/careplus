import { useEffect, useState } from 'react';
import { membershipApi, Membership } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, BadgePercent, X, Pencil, Trash2, RefreshCw } from 'lucide-react';

const initialForm = {
  name: '',
  description: '',
  discount_percent: 0,
  is_active: true,
  sort_order: 0,
};

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
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

  const loadMemberships = () => {
    setLoading(true);
    setError('');
    membershipApi
      .list()
      .then(setMemberships)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load memberships'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadMemberships();
  }, []);

  const openAddModal = () => {
    setForm(initialForm);
    setEditingId(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (m: Membership) => {
    setForm({
      name: m.name,
      description: m.description ?? '',
      discount_percent: m.discount_percent ?? 0,
      is_active: m.is_active ?? true,
      sort_order: m.sort_order ?? 0,
    });
    setEditingId(m.id);
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setEditingId(null);
    loadMemberships();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? value === ''
            ? 0
            : Number(value)
          : type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : value,
    }));
  };

  const performSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await membershipApi.update(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          discount_percent: form.discount_percent,
          is_active: form.is_active,
          sort_order: form.sort_order,
        });
        setMemberships((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      } else {
        const created = await membershipApi.create({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          discount_percent: form.discount_percent,
          is_active: form.is_active,
          sort_order: form.sort_order,
        });
        setMemberships((prev) => [...prev, created]);
      }
      setUpdateConfirmOpen(false);
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save membership');
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
    setDeleteConfirmId(null);
    try {
      await membershipApi.delete(deleteConfirmId);
      setMemberships((prev) => prev.filter((m) => m.id !== deleteConfirmId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMemberships();
  };

  if (loading) return <Loader variant="page" message="Loading memberships…" />;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Membership Tiers</h1>
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
            Add Membership
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {memberships.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <BadgePercent className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No membership tiers yet. Add tiers using the button above. Each tier has a name, optional description, discount %, and sort order. Tiers are stored via the API and used for customer assignments and checkout discounts.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-28">Discount</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700 w-24">Active</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-24">Order</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {memberships.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{m.description || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{m.discount_percent}%</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{m.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(m)}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(m.id)}
                        disabled={deletingId === m.id}
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="membership-modal-title"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 id="membership-modal-title" className="text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Membership' : 'Add Membership'}
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
                <label htmlFor="mem-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="mem-name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="Tier name (e.g. Premium, Standard)"
                />
              </div>
              <div>
                <label htmlFor="mem-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="mem-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label htmlFor="mem-discount" className="block text-sm font-medium text-gray-700 mb-1">
                  Discount %
                </label>
                <input
                  id="mem-discount"
                  name="discount_percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.discount_percent}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                />
              </div>
              <div>
                <label htmlFor="mem-sort" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort order
                </label>
                <input
                  id="mem-sort"
                  name="sort_order"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="mem-active"
                  name="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                />
                <label htmlFor="mem-active" className="text-sm font-medium text-gray-700">
                  Active
                </label>
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
                  {submitting ? 'Saving…' : editingId ? 'Update' : 'Add Membership'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete membership"
        message="Are you sure you want to delete this membership tier?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deletingId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmDialog
        open={updateConfirmOpen}
        title="Update membership"
        message="Save changes to this membership tier?"
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
