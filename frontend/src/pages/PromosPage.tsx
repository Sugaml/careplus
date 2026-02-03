import { useEffect, useState } from 'react';
import { promoApi, Promo } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, Megaphone, Tag, Calendar, Pencil, Trash2, RefreshCw } from 'lucide-react';

const PROMO_TYPES = [
  { value: 'offer' as const, label: 'Offer', icon: Tag },
  { value: 'announcement' as const, label: 'Announcement', icon: Megaphone },
  { value: 'event' as const, label: 'Event', icon: Calendar },
];

const initialForm = {
  type: 'announcement' as Promo['type'],
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  sort_order: 0,
  is_active: true,
  start_at: '',
  end_at: '',
};

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPromos = () => {
    setLoading(true);
    setError('');
    promoApi
      .list()
      .then(setPromos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load promos'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const openAddModal = () => {
    setForm(initialForm);
    setEditingId(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (p: Promo) => {
    setForm({
      type: p.type,
      title: p.title,
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      link_url: p.link_url ?? '',
      sort_order: p.sort_order ?? 0,
      is_active: p.is_active ?? true,
      start_at: p.start_at ? p.start_at.slice(0, 16) : '',
      end_at: p.end_at ? p.end_at.slice(0, 16) : '',
    });
    setEditingId(p.id);
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setEditingId(null);
    loadPromos();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? (value === '' ? 0 : Number(value))
          : type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : value,
    }));
  };

  const performSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const body = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        link_url: form.link_url.trim() || undefined,
        sort_order: form.sort_order,
        is_active: form.is_active,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined,
      };
      if (editingId) {
        const updated = await promoApi.update(editingId, body);
        setPromos((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await promoApi.create(body);
        setPromos((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promoApi.delete(id);
      setPromos((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const typeLabel = (type: Promo['type']) => PROMO_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers, announcements & events</h1>
          <p className="text-gray-600 mt-1">
            Manage promos shown on the public store (ads-style banners).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              loadPromos();
            }}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white font-medium hover:bg-careplus-secondary"
          >
            <Plus className="w-5 h-5" />
            Add promo
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {loading && <Loader variant="inline" message="Loading promos…" />}
      {!loading && promos.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No promos yet. Add an offer, announcement, or event to show on the public store.</p>
        </div>
      )}
      {!loading && promos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Active</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-careplus-primary/10 text-careplus-primary">
                      {typeLabel(p.type)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{p.title}</td>
                  <td className="py-3 px-4">
                    <span className={p.is_active ? 'text-green-600' : 'text-gray-400'}>
                      {p.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{p.sort_order}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="p-2 text-gray-500 hover:text-careplus-primary hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(p.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !submitting && closeModal()} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">
                  {editingId ? 'Edit promo' : 'Add promo'}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {submitError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{submitError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {PROMO_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    name="image_url"
                    value={form.image_url}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link URL (optional CTA)</label>
                  <input
                    type="url"
                    name="link_url"
                    value={form.link_url}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start (optional)</label>
                    <input
                      type="datetime-local"
                      name="start_at"
                      value={form.start_at}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End (optional)</label>
                    <input
                      type="datetime-local"
                      name="end_at"
                      value={form.end_at}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
                    <input
                      type="number"
                      name="sort_order"
                      value={form.sort_order}
                      onChange={handleChange}
                      min={0}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      name="is_active"
                      id="promo_active"
                      checked={form.is_active}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                    />
                    <label htmlFor="promo_active" className="text-sm text-gray-700">
                      Active (shown on public store)
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performSubmit}
                  disabled={submitting || !form.title.trim()}
                  className="px-4 py-2 rounded-lg bg-careplus-primary text-white font-medium hover:bg-careplus-secondary disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete promo"
        message="Are you sure you want to delete this promo? It will no longer appear on the public store."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
