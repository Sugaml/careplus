import { useEffect, useState } from 'react';
import { dailyLogsApi, DailyLog, DailyLogStatus } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, ClipboardList, X, Pencil, Trash2, RefreshCw, CheckCircle, Circle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DailyLogsPage() {
  const { t } = useLanguage();
  const [list, setList] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ date: '', title: '', description: '' });
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'open' as DailyLogStatus });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = () => {
    setLoading(true);
    setError('');
    dailyLogsApi
      .list({ date })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load daily logs'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadLogs();
  }, [date]);

  const openAddModal = () => {
    setForm({ date, title: '', description: '' });
    setEditing(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (d: DailyLog) => {
    setEditing(d);
    setEditForm({ title: d.title, description: d.description ?? '', status: d.status });
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    loadLogs();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await dailyLogsApi.create({ date: form.date, title: form.title.trim(), description: form.description.trim() || undefined });
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await dailyLogsApi.update(editing.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        status: editForm.status,
      });
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (d: DailyLog) => {
    const next: DailyLogStatus = d.status === 'open' ? 'done' : 'open';
    try {
      const updated = await dailyLogsApi.update(d.id, { status: next });
      setList((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      await dailyLogsApi.delete(deleteId);
      setList((prev) => prev.filter((d) => d.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-theme-text">{t('nav_daily_logs')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-theme-muted">{t('dailies_date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
          />
          <button
            type="button"
            onClick={() => { setRefreshing(true); loadLogs(); }}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover disabled:opacity-50"
            title={t('refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-theme-text-inverse rounded-lg hover:bg-careplus-secondary transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('dailies_add')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {loading && list.length === 0 ? (
        <Loader variant="page" message="Loading daily logs…" />
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <div
              key={d.id}
              className={`bg-theme-surface rounded-xl border border-theme-border p-4 flex items-start gap-4 ${
                d.status === 'done' ? 'opacity-75' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggleStatus(d)}
                className="mt-0.5 shrink-0 text-theme-muted hover:text-careplus-primary"
                title={d.status === 'open' ? t('dailies_mark_done') : t('dailies_mark_open')}
              >
                {d.status === 'done' ? <CheckCircle className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6" />}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium text-theme-text ${d.status === 'done' ? 'line-through text-theme-muted' : ''}`}>
                  {d.title}
                </h3>
                {d.description && (
                  <p className="mt-1 text-sm text-theme-muted whitespace-pre-wrap">{d.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditModal(d)}
                  className="p-2 text-theme-muted hover:text-careplus-primary rounded-lg"
                  title={t('edit')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(d.id)}
                  className="p-2 text-theme-muted hover:text-red-600 rounded-lg"
                  title={t('delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && !loading && (
            <div className="py-12 text-center text-theme-muted rounded-xl border border-theme-border bg-theme-surface">
              {t('dailies_empty')}
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-theme-surface rounded-xl shadow-xl border border-theme-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">
                {editing ? t('edit') : t('dailies_add')}
              </h2>
              <button type="button" onClick={closeModal} className="p-2 text-theme-muted hover:text-theme-text rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editing ? handleEditSubmit : handleCreateSubmit} className="p-4 space-y-4">
              {submitError && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">{submitError}</div>
              )}
              {editing ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('dailies_title')}</label>
                    <input
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('description')}</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('dailies_status')}</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as DailyLogStatus }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    >
                      <option value="open">{t('dailies_open')}</option>
                      <option value="done">{t('dailies_done')}</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('dailies_date')}</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('dailies_title')}</label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('description')}</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-theme-border rounded-lg text-theme-text hover:bg-theme-surface-hover">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-careplus-primary text-theme-text-inverse rounded-lg hover:bg-careplus-secondary disabled:opacity-50">
                  {editing ? t('save') : t('dailies_add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title={t('delete')}
        message={t('dailies_delete_confirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
