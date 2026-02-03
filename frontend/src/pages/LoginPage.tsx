import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ApiError } from '@/lib/api';
import { QUICK_LOGIN_USERS } from '@/lib/testUser';
import WebsiteLayout from '@/components/WebsiteLayout';
import { Shield, Pill, ShoppingBag, Users } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/products';
  const registered = searchParams.get('registered') === '1';
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    const clientErrors: Record<string, string> = {};
    if (!email.trim()) clientErrors.email = t('validation_required') || 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) clientErrors.email = t('validation_email') || 'Must be a valid email';
    if (!password) clientErrors.password = t('validation_required') || 'Required';
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError(t('validation_fix_below') || 'Please fix the errors below.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate(returnTo);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
        setError(err.message || (t('validation_fix_below') ?? 'Please fix the errors below.'));
      } else {
        setError(err instanceof Error ? err.message : t('auth_login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail: string, userPassword: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
    setError('');
    setLoading(true);
    try {
      await login(userEmail, userPassword);
      navigate(returnTo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('Invalid email or password') || msg.includes('Quick login')
          ? t('auth_demo_users_not_found')
          : msg || t('auth_login_failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'manager':
        return <Users className="w-4 h-4" />;
      case 'pharmacist':
        return <Pill className="w-4 h-4" />;
      default:
        return <ShoppingBag className="w-4 h-4" />;
    }
  };

  return (
    <WebsiteLayout>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-theme-surface rounded-xl shadow border border-theme-border p-8">
          <h1 className="text-xl font-bold text-theme-text mb-2">{t('auth_login')}</h1>
          <p className="text-sm text-theme-muted mb-6">
            {t('auth_login_subtitle')}
          </p>
          {registered && (
            <div className="p-3 rounded-lg bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-sm mb-4">
              {t('auth_account_created')}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_email')} <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })); }}
                className={`w-full px-3 py-2 bg-theme-input-bg border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent text-theme-text ${fieldErrors.email ? 'border-red-500' : 'border-theme-input-border'}`}
                required
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
              {fieldErrors.email && <p id="email-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text mb-1">{t('auth_password')} <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: '' })); }}
                className={`w-full px-3 py-2 bg-theme-input-bg border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent text-theme-text ${fieldErrors.password ? 'border-red-500' : 'border-theme-input-border'}`}
                required
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              {fieldErrors.password && <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.password}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-careplus-primary text-theme-text-inverse font-medium rounded-lg hover:bg-careplus-secondary disabled:opacity-50 transition-colors"
            >
              {loading ? t('auth_signing_in') : t('auth_sign_in')}
            </button>

            <div className="relative my-4">
              <span className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-theme-border" />
              </span>
              <span className="relative flex justify-center text-xs text-theme-muted bg-theme-surface px-2">
                {t('auth_quick_login_demo')}
              </span>
            </div>

            <div className="space-y-2">
              {QUICK_LOGIN_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => handleQuickLogin(u.email, u.password)}
                  disabled={loading}
                  className="w-full py-2.5 flex items-center justify-center gap-2 border border-careplus-primary text-careplus-primary font-medium rounded-lg hover:bg-careplus-primary/10 disabled:opacity-50 transition-colors"
                >
                  {roleIcon(u.role)}
                  {u.label}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-theme-muted">
              {t('auth_demo_backend_hint')}
            </p>

            <p className="text-center text-sm text-theme-text-secondary">
              {t('auth_dont_have_account')}{' '}
              <Link to="/register" className="text-careplus-primary font-medium hover:underline">
                {t('nav_register')}
              </Link>
            </p>
            {(returnTo === '/products' || returnTo === '/store') && (
              <p className="text-center text-sm text-theme-muted">
                <Link to="/products" className="text-careplus-primary hover:underline">
                  {t('auth_back_to_products')}
                </Link>
              </p>
            )}
          </form>
        </div>
      </div>
    </WebsiteLayout>
  );
}
