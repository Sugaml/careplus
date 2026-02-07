import { useEffect, useState } from 'react';
import { announcementApi, Announcement } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Megaphone, Tag, Calendar, Pencil, Trash2, RefreshCw } from 'lucide-react';

const ANNOUNCEMENT_TYPES = [
  { value: 'offer' as const, labelKey: 'announcement_type_offer', icon: Tag },
  { value: 'status' as const, labelKey: 'announcement_type_status', icon: Megaphone },
  { value: 'event' as const, labelKey: 'announcement_type_event', icon: Calendar },
];

const TEMPLATES = [
  { value: 'celebration' as const, labelKey: 'announcement_template_celebration' },
  { value: 'banner' as const, labelKey: 'announcement_template_banner' },
  { value: 'modal' as const, labelKey: 'announcement_template_modal' },
];

const DISPLAY_SECONDS_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 20, 30];

const initialForm = {
  type: 'offer' as Announcement['type'],
  template: 'celebration' as Announcement['template'],
  title: '',
  body: '',
  image_url: '',
  link_url: '',
  display_seconds: 5,
  valid_days: 7,
  show_terms: false,
  terms_text: '',
  allow_skip_all: true,
  start_at: '',
  end_at: '',
  sort_order: 0,
  is_active: true,
};

export default function AnnouncementsPage() {
  const { t } = useLanguage();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    announcementApi
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load announcements'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(initialForm);
    setEditingId(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setForm({
      type: a.type,
      template: a.template,
      title: a.title,
      body: a.body ?? '',
      image_url: a.image_url ?? '',
      link_url: a.link_url ?? '',
      display_seconds: a.display_seconds ?? 5,
      valid_days: a.valid_days ?? 7,
      show_terms: a.show_terms ?? false,
      terms_text: a.terms_text ?? '',
      allow_skip_all: a.allow_skip_all ?? true,
      start_at: a.start_at ? a.start_at.slice(0, 16) : '',
      end_at: a.end_at ? a.end_at.slice(0, 16) : '',
      sort_order: a.sort_order ?? 0,
      is_active: a.is_active ?? true,
    });
    setEditingId(a.id);
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setEditingId(null);
    load();
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
        template: form.template,
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        link_url: form.link_url.trim() || undefined,
        display_seconds: form.display_seconds,
        valid_days: form.valid_days,
        show_terms: form.show_terms,
        terms_text: form.terms_text.trim() || undefined,
        allow_skip_all: form.allow_skip_all,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : undefined,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : undefined,
        sort_order: form.sort_order,
        is_active: form.is_active,
      };
      if (editingId) {
        const updated = await announcementApi.update(editingId, body);
        setList((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
      } else {
        const created = await announcementApi.create(body);
        setList((prev) => [...prev, created]);
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
      await announcementApi.delete(id);
      setList((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const typeLabel = (type: Announcement['type']) => {
    const x = ANNOUNCEMENT_TYPES.find((e) => e.value === type);
    return x ? t(x.labelKey) : type;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-theme-text tracking-tight">
            {t('announcements_title')}
          </h1>
          <p className="mt-1 text-theme-muted">{t('announcements_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              load();
            }}
            disabled={loading || refreshing}
            className="p-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-hover transition-colors disabled:opacity-50"
            title={t('refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            {t('announcements_new')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && <Loader variant="inline" message={t('loading')} />}
      {!loading && list.length === 0 && (
        <div className="bg-theme-surface rounded-2xl border border-theme-border p-8 text-center text-theme-muted">
          <Megaphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('announcements_empty')}</p>
        </div>
      )}
      {!loading && list.length > 0 && (
        <div className="bg-theme-surface rounded-2xl border border-theme-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-theme-bg border-b border-theme-border">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-theme-text">{t('announcements_type')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-theme-text">{t('announcements_template')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-theme-text">{t('announcements_title_label')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-theme-text">{t('announcements_display_seconds')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-theme-text">{t('announcements_valid_days')}</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-theme-text">{t('common_active')}</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-theme-text">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover/50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-careplus-primary/10 text-careplus-primary">
                      {typeLabel(a.type)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-theme-muted text-sm">{t(`announcement_template_${a.template}`)}</td>
                  <td className="py-3 px-4 font-medium text-theme-text">{a.title}</td>
                  <td className="py-3 px-4 text-theme-muted">{a.display_seconds}s</td>
                  <td className="py-3 px-4 text-theme-muted">{a.valid_days} {t('announcements_days')}</td>
                  <td className="py-3 px-4">
                    <span className={a.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-muted'}>
                      {a.is_active ? t('common_active') : t('common_inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="p-2 text-theme-muted hover:text-careplus-primary hover:bg-theme-surface-hover rounded-lg"
                      title={t('common_edit')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(a.id)}
                      className="p-2 text-theme-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                      title={t('delete')}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div
              className="bg-theme-surface rounded-2xl shadow-xl max-w-lg w-full my-8 border border-theme-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-theme-border">
                <h2 className="text-lg font-semibold text-theme-text">
                  {editingId ? t('announcements_edit') : t('announcements_new')}
                </h2>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {submitError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_type')}</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                  >
                    {ANNOUNCEMENT_TYPES.map((typeOpt) => (
                      <option key={typeOpt.value} value={typeOpt.value}>
                        {t(typeOpt.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_template')}</label>
                  <select
                    name="template"
                    value={form.template}
                    onChange={handleChange}
                    className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                  >
                    {TEMPLATES.map((tm) => (
                      <option key={tm.value} value={tm.value}>
                        {t(tm.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_title_label')} *</label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_body')}</label>
                  <textarea
                    name="body"
                    value={form.body}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_display_seconds')}</label>
                    <select
                      name="display_seconds"
                      value={form.display_seconds}
                      onChange={handleChange}
                      className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    >
                      {DISPLAY_SECONDS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}s</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_valid_days')}</label>
                    <input
                      type="number"
                      name="valid_days"
                      value={form.valid_days}
                      onChange={handleChange}
                      min={1}
                      max={365}
                      className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_image_url')}</label>
                  <input
                    type="url"
                    name="image_url"
                    value={form.image_url}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_link_url')}</label>
                  <input
                    type="url"
                    name="link_url"
                    value={form.link_url}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="show_terms"
                    id="show_terms"
                    checked={form.show_terms}
                    onChange={handleChange}
                    className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                  />
                  <label htmlFor="show_terms" className="text-sm text-theme-text">{t('announcements_show_terms')}</label>
                </div>
                {form.show_terms && (
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_terms_text')}</label>
                    <textarea
                      name="terms_text"
                      value={form.terms_text}
                      onChange={handleChange}
                      rows={2}
                      className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allow_skip_all"
                    id="allow_skip_all"
                    checked={form.allow_skip_all}
                    onChange={handleChange}
                    className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                  />
                  <label htmlFor="allow_skip_all" className="text-sm text-theme-text">{t('announcements_allow_skip_all')}</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_start_at')}</label>
                    <input
                      type="datetime-local"
                      name="start_at"
                      value={form.start_at}
                      onChange={handleChange}
                      className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_end_at')}</label>
                    <input
                      type="datetime-local"
                      name="end_at"
                      value={form.end_at}
                      onChange={handleChange}
                      className="w-full border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('announcements_sort_order')}</label>
                    <input
                      type="number"
                      name="sort_order"
                      value={form.sort_order}
                      onChange={handleChange}
                      min={0}
                      className="w-24 border border-theme-border rounded-xl px-3 py-2 bg-theme-bg text-theme-text"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      name="is_active"
                      id="announcement_active"
                      checked={form.is_active}
                      onChange={handleChange}
                      className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                    />
                    <label htmlFor="announcement_active" className="text-sm text-theme-text">
                      {t('announcements_is_active')}
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-theme-border text-theme-text hover:bg-theme-surface-hover disabled:opacity-50"
                >
                  {t('common_cancel')}
                </button>
                <button
                  type="button"
                  onClick={performSubmit}
                  disabled={submitting || !form.title.trim()}
                  className="px-4 py-2.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? t('common_saving') : editingId ? t('common_save') : t('announcements_create')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteConfirmId !== null}
        title={t('announcements_delete_title')}
        message={t('announcements_delete_message')}
        confirmLabel={t('delete')}
        variant="danger"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
