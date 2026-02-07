import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ApiError } from '@/lib/api';
import { QUICK_LOGIN_USERS } from '@/lib/testUser';
import WebsiteLayout from '@/components/WebsiteLayout';
import { Shield, Pill, ShoppingBag, Users, LogIn, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
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
        return <Shield className="w-4 h-4 shrink-0" />;
      case 'manager':
        return <Users className="w-4 h-4 shrink-0" />;
      case 'pharmacist':
        return <Pill className="w-4 h-4 shrink-0" />;
      default:
        return <ShoppingBag className="w-4 h-4 shrink-0" />;
    }
  };

  return (
    <WebsiteLayout>
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        {/* Hero / welcome block */}
        <div className="w-full max-w-md text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-careplus-primary/10 text-careplus-primary mb-4" aria-hidden>
            <LogIn className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-theme-text tracking-tight">
            {t('auth_login')}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-theme-muted max-w-sm mx-auto">
            {t('auth_login_subtitle')}
          </p>
        </div>

        {/* Main sign-in card */}
        <div className="w-full max-w-md">
          <div className="bg-theme-surface rounded-2xl shadow-lg border border-theme-border p-6 sm:p-8">
            {registered && (
              <div
                className="mb-5 p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2"
                role="status"
              >
                <span className="flex-1">{t('auth_account_created')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error && (
                <div
                  className="p-3 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-theme-text mb-1.5">
                  {t('auth_email')} <span className="text-red-500" aria-hidden>*</span>
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((p) => ({ ...p, email: '' }));
                  }}
                  placeholder={t('auth_email_placeholder')}
                  className={`w-full px-4 py-3 rounded-xl bg-theme-input-bg border text-theme-text placeholder:text-theme-muted focus:ring-2 focus:ring-careplus-primary focus:border-transparent transition-shadow ${fieldErrors.email ? 'border-red-500' : 'border-theme-input-border'}`}
                  required
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium text-theme-text">
                    {t('auth_password')} <span className="text-red-500" aria-hidden>*</span>
                  </label>
                  <Link
                    to="#"
                    className="text-sm text-careplus-primary hover:underline focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2 rounded"
                  >
                    {t('auth_forgot_password')}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((p) => ({ ...p, password: '' }));
                    }}
                    placeholder={t('auth_password_placeholder')}
                    className={`w-full px-4 py-3 pr-12 rounded-xl bg-theme-input-bg border text-theme-text placeholder:text-theme-muted focus:ring-2 focus:ring-careplus-primary focus:border-transparent transition-shadow ${fieldErrors.password ? 'border-red-500' : 'border-theme-input-border'}`}
                    required
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover focus:outline-none focus:ring-2 focus:ring-careplus-primary"
                    aria-label={showPassword ? t('auth_hide_password') : t('auth_show_password')}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-semibold hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2"
              >
                {loading ? t('auth_signing_in') : t('auth_sign_in')}
              </button>
            </form>

            {/* Secondary actions */}
            <div className="mt-6 pt-6 border-t border-theme-border space-y-4">
              <p className="text-center text-sm text-theme-text-secondary">
                {t('auth_dont_have_account')}{' '}
                <Link
                  to="/register"
                  className="text-careplus-primary font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2 rounded"
                >
                  {t('nav_register')}
                </Link>
              </p>
              {(returnTo === '/products' || returnTo === '/store') && (
                <p className="text-center">
                  <Link
                    to="/products"
                    className="text-sm text-theme-muted hover:text-careplus-primary hover:underline focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2 rounded"
                  >
                    {t('auth_back_to_products')}
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* Collapsible demo section */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setDemoOpen((o) => !o)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-theme-border bg-theme-surface/80 text-theme-muted text-sm font-medium hover:bg-theme-surface-hover hover:text-theme-text transition-colors focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2"
              aria-expanded={demoOpen}
              aria-controls="demo-accounts"
            >
              {demoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('auth_try_demo')}
            </button>
            <div
              id="demo-accounts"
              role="region"
              aria-label={t('auth_quick_login_demo')}
              className={`overflow-hidden transition-all duration-200 ${demoOpen ? 'mt-3' : 'max-h-0 opacity-0'}`}
            >
              <div className="p-4 rounded-xl border border-theme-border bg-theme-surface/60 space-y-2">
                <p className="text-xs text-theme-muted mb-3">{t('auth_demo_backend_hint')}</p>
                {QUICK_LOGIN_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => handleQuickLogin(u.email, u.password)}
                    disabled={loading}
                    className="w-full py-2.5 flex items-center justify-center gap-2 rounded-lg border border-careplus-primary/50 text-careplus-primary font-medium hover:bg-careplus-primary/10 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2"
                  >
                    {roleIcon(u.role)}
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WebsiteLayout>
  );
}
