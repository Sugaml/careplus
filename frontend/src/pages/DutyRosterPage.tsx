import { useEffect, useState } from 'react';
import { dutyRosterApi, usersApi, DutyRoster, User, ShiftType } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, CalendarDays, X, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const SHIFT_OPTIONS: { value: ShiftType; labelKey: string }[] = [
  { value: 'morning', labelKey: 'roster_shift_morning' },
  { value: 'evening', labelKey: 'roster_shift_evening' },
  { value: 'full', labelKey: 'roster_shift_full' },
];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DutyRosterPage() {
  const { t } = useLanguage();
  const [list, setList] = useState<DutyRoster[]>([]);
  const [pharmacists, setPharmacists] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DutyRoster | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState({ user_id: '', date: '', shift_type: 'full' as ShiftType, notes: '' });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const setWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    setFrom(mon.toISOString().slice(0, 10));
    setTo(sun.toISOString().slice(0, 10));
  };

  useEffect(() => {
    setWeekRange();
  }, []);

  useEffect(() => {
    usersApi.list().then((users) => setPharmacists(users.filter((u) => u.role === 'pharmacist' && u.is_active))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    dutyRosterApi
      .list({ from, to })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load roster'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [from, to]);

  const openAddModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({ user_id: pharmacists[0]?.id ?? '', date: today, shift_type: 'full', notes: '' });
    setEditing(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (d: DutyRoster) => {
    setEditing(d);
    setForm({
      user_id: d.user_id,
      date: d.date.slice(0, 10),
      shift_type: d.shift_type,
      notes: d.notes ?? '',
    });
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    if (from && to) dutyRosterApi.list({ from, to }).then(setList).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      if (editing) {
        await dutyRosterApi.update(editing.id, {
          user_id: form.user_id,
          date: form.date,
          shift_type: form.shift_type,
          notes: form.notes || undefined,
        });
      } else {
        await dutyRosterApi.create({
          user_id: form.user_id,
          date: form.date,
          shift_type: form.shift_type,
          notes: form.notes || undefined,
        });
      }
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      await dutyRosterApi.delete(deleteId);
      setList((prev) => prev.filter((d) => d.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };

  const getUserName = (userId: string) => pharmacists.find((u) => u.id === userId)?.name || list.find((d) => d.user_id === userId)?.user?.name || userId.slice(0, 8);
  const shiftLabel = (st: ShiftType) => SHIFT_OPTIONS.find((o) => o.value === st)?.labelKey ? t(SHIFT_OPTIONS.find((o) => o.value === st)!.labelKey) : st;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-theme-text">{t('nav_duty_roster')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-theme-muted">{t('roster_from')}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
          />
          <label className="text-sm text-theme-muted">{t('roster_to')}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
          />
          <button
            type="button"
            onClick={() => { setRefreshing(true); setWeekRange(); }}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover disabled:opacity-50"
            title={t('refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            disabled={pharmacists.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-theme-text-inverse rounded-lg hover:bg-careplus-secondary transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {t('roster_add')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {pharmacists.length === 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          {t('roster_no_pharmacists')}
        </div>
      )}

      {loading && list.length === 0 ? (
        <Loader variant="page" message="Loading roster…" />
      ) : (
        <div className="bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-theme-bg border-b border-theme-border">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-theme-text">{t('roster_date')}</th>
                <th className="text-left py-3 px-4 font-medium text-theme-text">{t('auth_name')}</th>
                <th className="text-left py-3 px-4 font-medium text-theme-text">{t('roster_shift')}</th>
                <th className="text-left py-3 px-4 font-medium text-theme-text">{t('roster_notes')}</th>
                <th className="text-right py-3 px-4 font-medium text-theme-text">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-b border-theme-border-subtle hover:bg-theme-surface-hover">
                  <td className="py-3 px-4 text-theme-text">{formatDate(d.date)}</td>
                  <td className="py-3 px-4 text-theme-text">{getUserName(d.user_id)}</td>
                  <td className="py-3 px-4 text-theme-text">{shiftLabel(d.shift_type)}</td>
                  <td className="py-3 px-4 text-theme-muted text-sm">{d.notes || '—'}</td>
                  <td className="py-3 px-4 text-right">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && !loading && (
            <div className="py-12 text-center text-theme-muted">{t('roster_empty')}</div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-theme-surface rounded-xl shadow-xl border border-theme-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">
                {editing ? t('edit') : t('roster_add')}
              </h2>
              <button type="button" onClick={closeModal} className="p-2 text-theme-muted hover:text-theme-text rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {submitError && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">{submitError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_pharmacist')}</label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                >
                  {pharmacists.map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('roster_date')}</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('roster_shift')}</label>
                <select
                  value={form.shift_type}
                  onChange={(e) => setForm((p) => ({ ...p, shift_type: e.target.value as ShiftType }))}
                  className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                >
                  {SHIFT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">{t('roster_notes')}</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-theme-border rounded-lg text-theme-text hover:bg-theme-surface-hover">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-careplus-primary text-theme-text-inverse rounded-lg hover:bg-careplus-secondary disabled:opacity-50">
                  {editing ? t('save') : t('roster_add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title={t('delete')}
        message={t('roster_delete_confirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
