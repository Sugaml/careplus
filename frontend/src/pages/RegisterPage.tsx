import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, ApiError, publicStoreApi } from '@/lib/api';
import type { Pharmacy } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import WebsiteLayout from '@/components/WebsiteLayout';
import Loader from '@/components/Loader';

export default function RegisterPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingPharmacy, setLoadingPharmacy] = useState(true);
  const { t, locale } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    publicStoreApi
      .listPharmacies()
      .then((list) => {
        setPharmacies(list);
        if (list.length > 0 && !pharmacyId) setPharmacyId(list[0].id);
      })
      .catch(() => setError(t('auth_could_not_load_pharmacies')))
      .finally(() => setLoadingPharmacy(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    const clientErrors: Record<string, string> = {};
    if (!pharmacyId) clientErrors.pharmacy_id = t('auth_please_select_pharmacy');
    if (!email.trim()) clientErrors.email = t('validation_required') || 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) clientErrors.email = t('validation_email') || 'Must be a valid email';
    if (!password) clientErrors.password = t('validation_required') || 'Required';
    else if (password.length < 6) clientErrors.password = t('validation_password_min') || 'Password must be at least 6 characters';
    if (!agreedToTerms) clientErrors.agreedToTerms = t('auth_must_agree_terms');
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError(t('validation_fix_below') || 'Please fix the errors below.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({ pharmacy_id: pharmacyId, email, password, name: name || undefined, role: role || undefined });
      navigate('/login?registered=1');
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
        setError(err.message || (t('validation_fix_below') ?? 'Please fix the errors below.'));
      } else {
        setError(err instanceof Error ? err.message : t('auth_registration_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <WebsiteLayout>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('auth_create_account')}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {t('auth_register_subtitle')}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            {loadingPharmacy ? (
              <Loader variant="small" message={t('auth_loading_pharmacies')} className="py-2" />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth_pharmacy')} <span className="text-red-500">*</span></label>
                <select
                  value={pharmacyId}
                  onChange={(e) => { setPharmacyId(e.target.value); setFieldErrors((p) => ({ ...p, pharmacy_id: '' })); }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent ${fieldErrors.pharmacy_id ? 'border-red-500' : 'border-gray-300'}`}
                  required
                  aria-invalid={!!fieldErrors.pharmacy_id}
                >
                  <option value="">{t('auth_select_pharmacy')}</option>
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.pharmacy_id && <p className="mt-1 text-sm text-red-600">{fieldErrors.pharmacy_id}</p>}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth_email')} <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })); }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent ${fieldErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                required
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth_password')} <span className="text-red-500">*</span></label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: '' })); }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'}`}
                required
                minLength={6}
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth_name_optional')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth_role_optional')}</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              >
                <option value="staff">{t('auth_staff')}</option>
                <option value="pharmacist">{t('auth_pharmacist')}</option>
                <option value="admin">{t('auth_admin')}</option>
              </select>
            </div>
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${fieldErrors.agreedToTerms ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-gray-300 dark:border-theme-border'}`}>
              <input
                type="checkbox"
                id="agree-terms"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  setFieldErrors((p) => ({ ...p, agreedToTerms: '' }));
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                aria-invalid={!!fieldErrors.agreedToTerms}
              />
              <label htmlFor="agree-terms" className="text-sm text-gray-700 dark:text-theme-text cursor-pointer">
                {t('auth_agree_terms_before')}
                <Link to="/terms" className="text-careplus-primary font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{t('auth_terms_and_conditions')}</Link>
                {t('auth_agree_terms_between')}
                <Link to="/privacy" className="text-careplus-primary font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{t('auth_privacy_policy')}</Link>
                {t('auth_agree_terms_after')}
              </label>
            </div>
            {fieldErrors.agreedToTerms && <p className="text-sm text-red-600 -mt-2">{fieldErrors.agreedToTerms}</p>}
            <button
              type="submit"
              disabled={loading || loadingPharmacy}
              className="w-full py-2.5 bg-careplus-primary text-white font-medium rounded-lg hover:bg-careplus-secondary disabled:opacity-50"
            >
              {loading ? t('auth_creating_account') : t('nav_register')}
            </button>
            <p className="text-center text-sm text-gray-600">
              {t('auth_already_have_account')}{' '}
              <Link to="/login" className="text-careplus-primary font-medium hover:underline">
                {t('nav_login')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </WebsiteLayout>
  );
}
