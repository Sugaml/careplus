import { useEffect, useState } from 'react';
import { promoCodeApi, type PromoCode } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, Tag, X, Pencil, RefreshCw } from 'lucide-react';

function toDateInputValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
}

const initialForm = {
  code: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: 0,
  min_order_amount: 0,
  valid_from: '',
  valid_until: '',
  max_uses: 0,
  first_order_only: false,
  is_active: true,
};

export default function PromoCodesPage() {
  const { t } = useLanguage();
  const [list, setList] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadList = () => {
    setLoading(true);
    setError('');
    promoCodeApi
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load promo codes'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadList();
  }, []);

  const openAddModal = () => {
    const now = new Date();
    const from = new Date(now);
    const until = new Date(now);
    until.setMonth(until.getMonth() + 1);
    setForm({
      ...initialForm,
      valid_from: toDateInputValue(from.toISOString()),
      valid_until: toDateInputValue(until.toISOString()),
    });
    setEditingId(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (p: PromoCode) => {
    setForm({
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_order_amount: p.min_order_amount ?? 0,
      valid_from: toDateInputValue(p.valid_from),
      valid_until: toDateInputValue(p.valid_until),
      max_uses: p.max_uses ?? 0,
      first_order_only: p.first_order_only ?? false,
      is_active: p.is_active ?? true,
    });
    setEditingId(p.id);
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setEditingId(null);
    loadList();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const validFrom = form.valid_from ? new Date(form.valid_from).toISOString() : new Date().toISOString();
      const validUntil = form.valid_until ? new Date(form.valid_until).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (editingId) {
        const updated = await promoCodeApi.update(editingId, {
          code: form.code.trim(),
          discount_type: form.discount_type,
          discount_value: form.discount_value,
          min_order_amount: form.min_order_amount,
          valid_from: validFrom,
          valid_until: validUntil,
          max_uses: form.max_uses,
          first_order_only: form.first_order_only,
          is_active: form.is_active,
        });
        setList((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await promoCodeApi.create({
          code: form.code.trim(),
          discount_type: form.discount_type,
          discount_value: form.discount_value,
          min_order_amount: form.min_order_amount,
          valid_from: validFrom,
          valid_until: validUntil,
          max_uses: form.max_uses,
          first_order_only: form.first_order_only,
          is_active: form.is_active,
        });
        setList((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save promo code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadList();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-theme-text flex items-center gap-2">
          <Tag className="w-6 h-6 text-careplus-primary" />
          {t('nav_promo_codes')}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="px-3 py-2 border border-theme-border rounded-lg text-theme-muted hover:bg-theme-surface-hover transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('common_refresh')}
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('promo_codes_new')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <Loader className="my-8" />
      ) : (
        <div className="bg-theme-surface border border-theme-border rounded-xl overflow-hidden">
          {list.length === 0 ? (
            <div className="p-8 text-center text-theme-muted">
              {t('promo_codes_empty')}
              <button
                type="button"
                onClick={openAddModal}
                className="ml-2 text-careplus-primary hover:underline"
              >
                {t('promo_codes_new')}
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-theme-surface-hover border-b border-theme-border">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-theme-muted text-sm">{t('promo_codes_code')}</th>
                  <th className="text-left py-3 px-4 font-medium text-theme-muted text-sm">{t('promo_codes_discount')}</th>
                  <th className="text-left py-3 px-4 font-medium text-theme-muted text-sm">{t('promo_codes_validity')}</th>
                  <th className="text-left py-3 px-4 font-medium text-theme-muted text-sm">{t('promo_codes_uses')}</th>
                  <th className="text-left py-3 px-4 font-medium text-theme-muted text-sm">{t('promo_codes_status')}</th>
                  <th className="w-24 py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-theme-surface-hover/50">
                    <td className="py-3 px-4">
                      <span className="font-mono font-medium text-theme-text">{p.code}</span>
                      {p.first_order_only && (
                        <span className="ml-2 text-xs text-theme-muted">({t('promo_codes_first_order')})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-theme-text">
                      {p.discount_type === 'percent' ? `${p.discount_value}%` : `NPR ${p.discount_value}`}
                      {p.min_order_amount > 0 && (
                        <span className="text-theme-muted text-sm block">min NPR {p.min_order_amount}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-theme-muted text-sm">
                      {new Date(p.valid_from).toLocaleDateString()} – {new Date(p.valid_until).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-theme-muted text-sm">
                      {p.used_count} {p.max_uses > 0 ? `/ ${p.max_uses}` : '(∞)'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          p.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {p.is_active ? t('common_active') : t('common_inactive')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="p-2 text-theme-muted hover:text-careplus-primary hover:bg-theme-surface-hover rounded-lg transition-colors"
                        title={t('common_edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="bg-theme-bg border border-theme-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">
                {editingId ? t('promo_codes_edit') : t('promo_codes_new')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-theme-muted hover:text-theme-text rounded-lg hover:bg-theme-surface-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {submitError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_code')}</label>
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  required
                  maxLength={50}
                  placeholder="e.g. SAVE10"
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                  disabled={!!editingId}
                />
                {editingId && <p className="mt-1 text-xs text-theme-muted">{t('promo_codes_code_readonly')}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_discount_type')}</label>
                  <select
                    name="discount_type"
                    value={form.discount_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed (NPR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_discount_value')}</label>
                  <input
                    type="number"
                    name="discount_value"
                    value={form.discount_value || ''}
                    onChange={handleChange}
                    required
                    min={0}
                    step={form.discount_type === 'percent' ? 1 : 0.01}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_min_order')}</label>
                <input
                  type="number"
                  name="min_order_amount"
                  value={form.min_order_amount || ''}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_valid_from')}</label>
                  <input
                    type="datetime-local"
                    name="valid_from"
                    value={form.valid_from}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_valid_until')}</label>
                  <input
                    type="datetime-local"
                    name="valid_until"
                    value={form.valid_until}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-muted mb-1">{t('promo_codes_max_uses')}</label>
                <input
                  type="number"
                  name="max_uses"
                  value={form.max_uses || ''}
                  onChange={handleChange}
                  min={0}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg text-theme-text focus:ring-2 focus:ring-careplus-primary"
                />
                <p className="mt-1 text-xs text-theme-muted">{t('promo_codes_max_uses_hint')}</p>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="first_order_only"
                    checked={form.first_order_only}
                    onChange={handleChange}
                    className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                  />
                  <span className="text-sm text-theme-text">{t('promo_codes_first_order_only')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                    className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                  />
                  <span className="text-sm text-theme-text">{t('common_active')}</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-theme-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-theme-border rounded-lg text-theme-muted hover:bg-theme-surface-hover"
                >
                  {t('common_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? t('common_saving') : editingId ? t('common_save') : t('promo_codes_create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
