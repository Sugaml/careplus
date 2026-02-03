import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, User } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Plus, X, Pencil, UserMinus, RefreshCw, Eye } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const ROLE_OPTIONS_ADMIN = [
  { value: 'manager', labelKey: 'auth_manager' },
  { value: 'pharmacist', labelKey: 'auth_pharmacist' },
  { value: 'staff', labelKey: 'auth_staff' },
];

const ROLE_OPTIONS_MANAGER = [{ value: 'pharmacist', labelKey: 'auth_pharmacist' }];

export default function TeamPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const roleOptions = isAdmin ? ROLE_OPTIONS_ADMIN : ROLE_OPTIONS_MANAGER;

  const [list, setList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'pharmacist' });
  const [editForm, setEditForm] = useState({ name: '', role: '', is_active: true });
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    setError('');
    usersApi
      .list()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load team'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Open edit modal when navigated from view page with state.editId
  useEffect(() => {
    const state = location.state as { editId?: string } | null;
    const editId = state?.editId;
    if (!editId || list.length === 0) return;
    const u = list.find((x) => x.id === editId);
    if (u) openEditModal(u);
    navigate('/manage/team', { replace: true, state: {} });
  }, [list, location.state, navigate]);

  const openAddModal = () => {
    setForm({ email: '', password: '', name: '', role: roleOptions[0]?.value ?? 'pharmacist' });
    setEditingUser(null);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditForm({ name: u.name ?? '', role: u.role, is_active: u.is_active ?? true });
    setSubmitError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setSubmitError('');
    loadUsers();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await usersApi.create({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        role: form.role,
      });
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await usersApi.update(editingUser.id, {
        name: editForm.name.trim() || undefined,
        role: editForm.role || undefined,
        is_active: editForm.is_active,
      });
      closeModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setSubmitting(true);
    try {
      await usersApi.deactivate(deactivateId);
      setList((prev) => prev.map((u) => (u.id === deactivateId ? { ...u, is_active: false } : u)));
      setDeactivateId(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to deactivate');
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = (role: string) => {
    const r = roleOptions.find((o) => o.value === role);
    return r ? t(r.labelKey) : role;
  };

  if (loading && list.length === 0) {
    return <Loader variant="page" message="Loading team…" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-text">
          {isAdmin ? t('nav_team') : t('team_pharmacists')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setRefreshing(true); loadUsers(); }}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover transition-colors disabled:opacity-50"
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
            {t('team_add')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-bg border-b border-theme-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-theme-text">{t('auth_name')}</th>
              <th className="text-left py-3 px-4 font-medium text-theme-text">{t('auth_email')}</th>
              <th className="text-left py-3 px-4 font-medium text-theme-text">{t('auth_role')}</th>
              <th className="text-left py-3 px-4 font-medium text-theme-text">{t('team_status')}</th>
              <th className="text-right py-3 px-4 font-medium text-theme-text">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-b border-theme-border-subtle hover:bg-theme-surface-hover">
                <td className="py-3 px-4 text-theme-text">{u.name || '—'}</td>
                <td className="py-3 px-4 text-theme-text">{u.email}</td>
                <td className="py-3 px-4 text-theme-text">{roleLabel(u.role)}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      u.is_active ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-theme-muted/30 text-theme-muted'
                    }`}
                  >
                    {u.is_active ? t('team_active') : t('team_inactive')}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  {u.role !== 'admin' && (
                    <>
                      <Link
                        to={`/manage/team/${u.id}`}
                        className="p-2 text-theme-muted hover:text-careplus-primary hover:bg-careplus-primary/10 rounded-lg inline-flex"
                        title={t('view')}
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="p-2 text-theme-muted hover:text-careplus-primary hover:bg-careplus-primary/10 rounded-lg"
                        title={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {u.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivateId(u.id)}
                          className="p-2 text-theme-muted hover:text-red-600 rounded-lg"
                          title={t('team_deactivate')}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !loading && (
          <div className="py-12 text-center text-theme-muted">{t('team_empty')}</div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-theme-surface rounded-xl shadow-xl border border-theme-border w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">
                {editingUser ? t('edit') : t('team_add')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-theme-muted hover:text-theme-text rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={editingUser ? handleEditSubmit : handleCreateSubmit}
              className="p-4 space-y-4"
            >
              {submitError && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">
                  {submitError}
                </div>
              )}
              {editingUser ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_name')}</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_role')}</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                        className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                      >
                        {ROLE_OPTIONS_ADMIN.map((o) => (
                          <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={editForm.is_active}
                      onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                      className="rounded border-theme-input-border"
                    />
                    <label htmlFor="is_active" className="text-sm text-theme-text">{t('team_active')}</label>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_email')} *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_password')} *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_name')}</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_role')}</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-theme-text"
                    >
                      {roleOptions.map((o) => (
                        <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-theme-border rounded-lg text-theme-text hover:bg-theme-surface-hover"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-careplus-primary text-theme-text-inverse rounded-lg hover:bg-careplus-secondary disabled:opacity-50"
                >
                  {editingUser ? t('save') : t('team_add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateId}
        title={t('team_deactivate')}
        message={t('team_deactivate_confirm')}
        confirmLabel={t('team_deactivate')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateId(null)}
      />
    </div>
  );
}
