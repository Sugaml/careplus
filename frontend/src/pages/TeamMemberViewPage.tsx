import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, User } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Pencil, UserMinus, Mail, User as UserIcon } from 'lucide-react';

export default function TeamMemberViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const isAdmin = currentUser?.role === 'admin';

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    usersApi
      .get(id)
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load user'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeactivate = async () => {
    if (!id) return;
    setDeactivating(true);
    setDeactivateConfirmOpen(false);
    try {
      await usersApi.deactivate(id);
      setUser((prev) => (prev ? { ...prev, is_active: false } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate');
    } finally {
      setDeactivating(false);
    }
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      admin: t('auth_admin') || 'Admin',
      manager: t('auth_manager') || 'Manager',
      pharmacist: t('auth_pharmacist') || 'Pharmacist',
      staff: t('auth_staff') || 'Staff',
    };
    return map[role] ?? role;
  };

  if (loading && !user) {
    return <Loader variant="page" message="Loading…" />;
  }

  if (error && !user) {
    return (
      <div>
        <Link
          to="/manage/team"
          className="inline-flex items-center gap-2 text-careplus-primary hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('back')}
        </Link>
        <div className="p-4 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/manage/team"
          className="inline-flex items-center gap-2 text-theme-text hover:text-careplus-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isAdmin ? t('nav_team') : t('team_pharmacists')}
        </Link>
        {user.role !== 'admin' && (
          <div className="flex items-center gap-2">
            <Link
              to="/manage/team"
              state={{ editId: user.id }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-theme-border rounded-lg text-theme-text hover:bg-theme-surface-hover transition-colors"
            >
              <Pencil className="w-4 h-4" />
              {t('edit')}
            </Link>
            {user.is_active && (
              <button
                type="button"
                onClick={() => setDeactivateConfirmOpen(true)}
                disabled={deactivating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <UserMinus className="w-4 h-4" />
                {t('team_deactivate')}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-theme-surface rounded-xl border border-theme-border overflow-hidden max-w-2xl">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-careplus-primary/20 text-careplus-primary flex items-center justify-center">
              <UserIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-theme-text">{user.name || '—'}</h1>
              <p className="text-theme-muted flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-theme-muted">{t('auth_role')}</dt>
              <dd className="mt-1 text-theme-text">{roleLabel(user.role)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-theme-muted">{t('team_status')}</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    user.is_active
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                      : 'bg-theme-muted/30 text-theme-muted'
                  }`}
                >
                  {user.is_active ? t('team_active') : t('team_inactive')}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-theme-muted">ID</dt>
              <dd className="mt-1 text-theme-muted font-mono text-sm">{user.id}</dd>
            </div>
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={deactivateConfirmOpen}
        title={t('team_deactivate')}
        message={t('team_deactivate_confirm')}
        confirmLabel={t('team_deactivate')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirmOpen(false)}
      />
    </div>
  );
}
