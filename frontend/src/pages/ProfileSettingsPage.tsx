import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { authApi, addressesApi, uploadFile, resolveImageUrl, type UserAddress, type MyCustomerProfileResponse } from '@/lib/api';
import { isBuyerRole } from '@/lib/roles';
import ConfirmDialog from '@/components/ConfirmDialog';
import { QRCodeSVG } from 'qrcode.react';
import {
  User,
  Save,
  Lock,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  ChevronRight,
  Mail,
  Shield,
  Eye,
  EyeOff,
  Award,
  Gift,
  QrCode,
  Share2,
  Copy,
  Check,
  Ticket,
  Camera,
} from 'lucide-react';

type ProfileSection = 'account' | 'security' | 'addresses' | 'rewards';

const SECTION_ICONS: Record<ProfileSection, React.ComponentType<{ className?: string }>> = {
  account: User,
  security: Lock,
  addresses: MapPin,
  rewards: Gift,
};

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<ProfileSection>('account');

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [profileConfirmOpen, setProfileConfirmOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [addressSuccess, setAddressSuccess] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    phone: '',
    set_as_default: false,
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showPoints, setShowPoints] = useState(true); // eye icon: show/hide points in profile
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [customerProfile, setCustomerProfile] = useState<MyCustomerProfileResponse | null>(null);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const loadAddresses = async () => {
    try {
      const list = await addressesApi.list();
      setAddresses(list);
    } catch {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAddresses();
      setPhone(user.phone ?? '');
    }
  }, [user]);

  const loadCustomerProfile = useCallback(async () => {
    if (!isBuyerRole(user?.role)) return;
    setCustomerProfileLoading(true);
    try {
      const data = await authApi.getMyCustomerProfile();
      setCustomerProfile(data);
    } catch {
      setCustomerProfile(null);
    } finally {
      setCustomerProfileLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (isBuyerRole(user?.role) && activeSection === 'rewards') loadCustomerProfile();
  }, [user?.role, activeSection, loadCustomerProfile]);

  const resetAddressForm = () => {
    setAddressForm({
      label: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      phone: '',
      set_as_default: false,
    });
    setEditingAddress(null);
    setShowAddressForm(false);
  };

  const handleAddAddress = () => {
    resetAddressForm();
    setShowAddressForm(true);
  };

  const handleEditAddress = (addr: UserAddress) => {
    setEditingAddress(addr);
    setAddressForm({
      label: addr.label || '',
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state || '',
      postal_code: addr.postal_code || '',
      country: addr.country,
      phone: addr.phone || '',
      set_as_default: addr.is_default,
    });
    setShowAddressForm(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError('');
    setAddressSuccess('');
    setAddressSaving(true);
    try {
      if (editingAddress) {
        await addressesApi.update(editingAddress.id, {
          label: addressForm.label || undefined,
          line1: addressForm.line1,
          line2: addressForm.line2 || undefined,
          city: addressForm.city,
          state: addressForm.state || undefined,
          postal_code: addressForm.postal_code || undefined,
          country: addressForm.country,
          phone: addressForm.phone || undefined,
          set_as_default: addressForm.set_as_default,
        });
        setAddressSuccess('Address updated.');
      } else {
        await addressesApi.create({
          label: addressForm.label || undefined,
          line1: addressForm.line1,
          line2: addressForm.line2 || undefined,
          city: addressForm.city,
          state: addressForm.state || undefined,
          postal_code: addressForm.postal_code || undefined,
          country: addressForm.country,
          phone: addressForm.phone || undefined,
          set_as_default: addressForm.set_as_default,
        });
        setAddressSuccess('Address added.');
      }
      resetAddressForm();
      await loadAddresses();
    } catch (e) {
      setAddressError(e instanceof Error ? e.message : 'Failed to save address');
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
    setAddressError('');
    setAddressSuccess('');
    try {
      await addressesApi.setDefault(id);
      setAddressSuccess('Default address updated.');
      await loadAddresses();
    } catch (e) {
      setAddressError(e instanceof Error ? e.message : 'Failed to set default address');
    }
  };

  const handleDeleteAddressClick = (id: string) => {
    setDeleteAddressId(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteAddressConfirm = async () => {
    if (!deleteAddressId) return;
    setAddressError('');
    setAddressSuccess('');
    try {
      await addressesApi.delete(deleteAddressId);
      setAddressSuccess('Address removed.');
      setDeleteAddressId(null);
      setDeleteConfirmOpen(false);
      await loadAddresses();
    } catch (e) {
      setAddressError(e instanceof Error ? e.message : 'Failed to delete address');
    } finally {
      setDeleteAddressId(null);
      setDeleteConfirmOpen(false);
    }
  };

  const formatAddress = (a: UserAddress) => {
    const parts = [a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileConfirmOpen(true);
  };

  const handleProfileConfirm = async () => {
    setError('');
    setSuccess(false);
    setSaving(true);
    setProfileConfirmOpen(false);
    try {
      const body: { name: string; phone?: string } = { name: name.trim() };
      if (isBuyerRole(user?.role)) body.phone = phone.trim();
      const updated = await authApi.updateProfile(body);
      setName(updated.name);
      setPhone(updated.phone ?? '');
      setSuccess(true);
      await refreshUser();
      if (isBuyerRole(user?.role)) loadCustomerProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setPhotoError(t('profile_photo_invalid'));
      return;
    }
    setPhotoError('');
    setPhotoUploading(true);
    try {
      const { url } = await uploadFile(file);
      await authApi.updateProfile({ photo_url: url });
      await refreshUser();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('profile_photo_upload_failed'));
    } finally {
      setPhotoUploading(false);
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    setPasswordConfirmOpen(true);
  };

  const handlePasswordConfirm = async () => {
    setPasswordConfirmOpen(false);
    setPasswordSaving(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) return null;

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl bg-theme-input-bg border border-theme-input-border text-theme-text placeholder:text-theme-muted focus:ring-2 focus:ring-careplus-primary focus:border-transparent transition-shadow';

  const sections: { id: ProfileSection; labelKey: string }[] = [
    { id: 'account', labelKey: 'profile_menu_account' },
    ...(isBuyerRole(user?.role) ? [{ id: 'rewards' as const, labelKey: 'profile_menu_rewards' }] : []),
    { id: 'security', labelKey: 'profile_menu_security' },
    { id: 'addresses', labelKey: 'profile_menu_addresses' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-careplus-primary/15 flex items-center justify-center shrink-0">
          <User className="w-6 h-6 text-careplus-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-theme-text">{t('profile_title')}</h1>
          <p className="text-theme-muted text-sm mt-0.5">{t('profile_subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Sub-menu: sidebar on md+, tabs on small */}
        <nav
          className="md:w-56 shrink-0 flex flex-row md:flex-col gap-1 p-1 md:py-0 rounded-xl md:rounded-none bg-theme-surface md:bg-transparent border border-theme-border md:border-0 md:border-r md:border-theme-border md:pr-6"
          aria-label={t('profile_subtitle')}
        >
          {sections.map(({ id, labelKey }) => {
            const Icon = SECTION_ICONS[id];
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`
                  w-full flex items-center justify-between md:justify-start gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors
                  ${isActive
                    ? 'bg-careplus-primary/15 text-careplus-primary border border-careplus-primary/30'
                    : 'text-theme-text hover:bg-theme-surface-hover border border-transparent'}
                `}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-5 h-5 shrink-0 opacity-80" />
                  {t(labelKey)}
                </span>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 md:hidden ${isActive ? 'text-careplus-primary' : 'text-theme-muted'}`}
                />
              </button>
            );
          })}
        </nav>

        {/* Content area */}
        <main className="flex-1 min-w-0">
          {/* Account */}
          {activeSection === 'account' && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
              {error && (
                <div
                  className="p-3 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"
                  role="status"
                >
                  {t('profile_saved')}
                </div>
              )}

              <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-theme-border bg-theme-bg/50">
                  <h2 className="font-semibold text-theme-text flex items-center gap-2">
                    <User className="w-5 h-5 text-careplus-primary shrink-0" />
                    {t('profile_account_info')}
                  </h2>
                </div>
                <div className="p-6 space-y-5">
                  {/* Profile picture */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-24 h-24 rounded-full bg-theme-bg border-2 border-theme-border overflow-hidden flex items-center justify-center">
                        {user.photo_url ? (
                          <img
                            src={resolveImageUrl(user.photo_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-12 h-12 text-theme-muted" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="block text-sm font-medium text-theme-text">{t('profile_photo')}</label>
                        <input
                          ref={profilePhotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handlePhotoChange}
                          className="hidden"
                          disabled={photoUploading}
                        />
                        <button
                          type="button"
                          onClick={() => profilePhotoInputRef.current?.click()}
                          disabled={photoUploading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-theme-border text-theme-text text-sm font-medium hover:bg-theme-surface-hover transition-colors disabled:opacity-60"
                        >
                          <Camera className="w-4 h-4" />
                          {photoUploading ? t('profile_photo_uploading') : user.photo_url ? t('profile_photo_change') : t('profile_photo_upload')}
                        </button>
                      </div>
                    </div>
                    {photoError && (
                      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                        {photoError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-theme-text mb-1">
                      <Mail className="w-4 h-4 text-theme-muted" />
                      {t('auth_email')}
                    </label>
                    <p className="text-theme-text pl-6">{user.email}</p>
                    <p className="text-xs text-theme-muted mt-1 pl-6">{t('profile_email_readonly')}</p>
                  </div>
                  {!isBuyerRole(user.role) && (
                    <div>
                      <label className="block text-sm font-medium text-theme-text mb-1.5">{t('auth_role')}</label>
                      <p className="text-theme-text capitalize pl-6">{user.role}</p>
                    </div>
                  )}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-theme-text mb-1">
                      <Award className="w-4 h-4 text-careplus-primary" />
                      {t('profile_points')}
                    </label>
                    <p className="text-xs text-theme-muted mb-1.5 pl-6">{t('profile_points_earned')}</p>
                    <div className="pl-6 flex items-center gap-2">
                      <span className="text-theme-text font-semibold tabular-nums">
                        {showPoints ? (user.points_balance ?? 0).toLocaleString() : t('profile_points_hidden')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPoints((prev) => !prev)}
                        className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-careplus-primary/50"
                        title={showPoints ? t('profile_hide_points') : t('profile_show_points')}
                        aria-label={showPoints ? t('profile_hide_points') : t('profile_show_points')}
                      >
                        {showPoints ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1.5">{t('profile_display_name')}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      placeholder={user.name || user.email}
                    />
                  </div>
                  {isBuyerRole(user.role) && (
                    <div>
                      <label className="block text-sm font-medium text-theme-text mb-1.5">{t('profile_phone')}</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputClass}
                        placeholder={t('profile_phone_placeholder')}
                      />
                      <p className="text-xs text-theme-muted mt-1">{t('profile_phone_hint')}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-medium hover:bg-careplus-secondary disabled:opacity-60 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? t('profile_saving') : t('profile_save')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Security (password) */}
          {activeSection === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-6 animate-fade-in">
              <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-theme-border bg-theme-bg/50">
                  <h2 className="font-semibold text-theme-text flex items-center gap-2">
                    <Shield className="w-5 h-5 text-careplus-primary shrink-0" />
                    {t('profile_change_password')}
                  </h2>
                </div>
                <div className="p-6 space-y-5">
                  {passwordError && (
                    <div
                      className="p-3 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm"
                      role="alert"
                    >
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div
                      className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"
                      role="status"
                    >
                      {t('profile_password_changed')}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1.5">
                      {t('profile_current_password')}
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1.5">
                      {t('profile_new_password')}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-text mb-1.5">
                      {t('profile_confirm_password')}
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-medium hover:bg-careplus-secondary disabled:opacity-60 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    {passwordSaving ? t('profile_saving') : t('profile_change_password')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Addresses */}
          {activeSection === 'addresses' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-theme-border bg-theme-bg/50">
                  <h2 className="font-semibold text-theme-text flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-careplus-primary shrink-0" />
                    {t('profile_addresses')}
                  </h2>
                  <p className="text-sm text-theme-muted mt-1">{t('profile_addresses_hint')}</p>
                </div>
                <div className="p-6 space-y-5">
                  {addressError && (
                    <div
                      className="p-3 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm"
                      role="alert"
                    >
                      {addressError}
                    </div>
                  )}
                  {addressSuccess && (
                    <div
                      className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm"
                      role="status"
                    >
                      {addressSuccess}
                    </div>
                  )}

                  {addressesLoading ? (
                    <p className="text-theme-muted text-sm py-4">{t('profile_loading_addresses')}</p>
                  ) : (
                    <>
                      <ul className="space-y-4">
                        {addresses.map((addr) => (
                          <li
                            key={addr.id}
                            className="group flex items-start justify-between gap-4 p-5 rounded-xl border border-theme-border bg-theme-bg hover:border-careplus-primary/30 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {addr.label && (
                                  <span className="font-semibold text-theme-text">{addr.label}</span>
                                )}
                                {addr.is_default && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-careplus-primary/15 text-careplus-primary">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    {t('profile_default')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-theme-muted leading-relaxed">{formatAddress(addr)}</p>
                              {addr.phone && (
                                <p className="text-xs text-theme-muted mt-2 flex items-center gap-1">
                                  <span className="opacity-75">Phone:</span> {addr.phone}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
                              {!addr.is_default && (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultAddress(addr.id)}
                                  className="p-2.5 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-careplus-primary transition-colors"
                                  title={t('profile_set_default')}
                                >
                                  <Star className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEditAddress(addr)}
                                className="p-2.5 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-careplus-primary transition-colors"
                                title={t('profile_edit')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAddressClick(addr.id)}
                                className="p-2.5 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-red-600 transition-colors"
                                title={t('profile_delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      {addresses.length === 0 && !showAddressForm && (
                        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-theme-border bg-theme-bg/50">
                          <MapPin className="w-10 h-10 text-theme-muted mx-auto mb-3 opacity-60" />
                          <p className="text-theme-muted text-sm">{t('profile_no_addresses')}</p>
                        </div>
                      )}

                      {showAddressForm ? (
                        <form
                          onSubmit={handleSaveAddress}
                          className="space-y-4 pt-6 border-t border-theme-border"
                        >
                          <h3 className="font-medium text-theme-text">
                            {editingAddress ? t('profile_edit_address') : t('profile_add_address')}
                          </h3>
                          <div>
                            <label className="block text-sm font-medium text-theme-text mb-1.5">
                              Label (optional)
                            </label>
                            <input
                              type="text"
                              value={addressForm.label}
                              onChange={(e) => setAddressForm((f) => ({ ...f, label: e.target.value }))}
                              className={inputClass}
                              placeholder="e.g. Home, Office"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-theme-text mb-1.5">
                              Address line 1 *
                            </label>
                            <input
                              type="text"
                              value={addressForm.line1}
                              onChange={(e) => setAddressForm((f) => ({ ...f, line1: e.target.value }))}
                              className={inputClass}
                              placeholder="Street address"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-theme-text mb-1.5">
                              Address line 2 (optional)
                            </label>
                            <input
                              type="text"
                              value={addressForm.line2}
                              onChange={(e) => setAddressForm((f) => ({ ...f, line2: e.target.value }))}
                              className={inputClass}
                              placeholder="Apartment, suite, etc."
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-theme-text mb-1.5">City *</label>
                              <input
                                type="text"
                                value={addressForm.city}
                                onChange={(e) => setAddressForm((f) => ({ ...f, city: e.target.value }))}
                                className={inputClass}
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-theme-text mb-1.5">
                                State / Province
                              </label>
                              <input
                                type="text"
                                value={addressForm.state}
                                onChange={(e) => setAddressForm((f) => ({ ...f, state: e.target.value }))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-theme-text mb-1.5">
                                Postal code
                              </label>
                              <input
                                type="text"
                                value={addressForm.postal_code}
                                onChange={(e) =>
                                  setAddressForm((f) => ({ ...f, postal_code: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-theme-text mb-1.5">
                                Country *
                              </label>
                              <input
                                type="text"
                                value={addressForm.country}
                                onChange={(e) => setAddressForm((f) => ({ ...f, country: e.target.value }))}
                                className={inputClass}
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-theme-text mb-1.5">
                              Phone (optional)
                            </label>
                            <input
                              type="text"
                              value={addressForm.phone}
                              onChange={(e) => setAddressForm((f) => ({ ...f, phone: e.target.value }))}
                              className={inputClass}
                              placeholder="Contact number"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="set_as_default"
                              checked={addressForm.set_as_default}
                              onChange={(e) =>
                                setAddressForm((f) => ({ ...f, set_as_default: e.target.checked }))
                              }
                              className="rounded border-theme-input-border text-careplus-primary focus:ring-careplus-primary"
                            />
                            <label htmlFor="set_as_default" className="text-sm text-theme-text">
                              {t('profile_set_default')} address
                            </label>
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button
                              type="submit"
                              disabled={addressSaving}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-careplus-primary text-theme-text-inverse font-medium hover:bg-careplus-secondary disabled:opacity-60 transition-colors"
                            >
                              {addressSaving
                                ? t('profile_saving')
                                : editingAddress
                                  ? t('profile_update_address')
                                  : t('profile_add_address')}
                            </button>
                            <button
                              type="button"
                              onClick={resetAddressForm}
                              className="px-5 py-2.5 rounded-xl border border-theme-border text-theme-text hover:bg-theme-surface-hover transition-colors"
                            >
                              {t('profile_cancel')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAddAddress}
                          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed border-careplus-primary/50 text-careplus-primary font-medium hover:bg-careplus-primary/10 hover:border-careplus-primary transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                          {t('profile_add_address')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rewards (end-user: referral code, QR, share, points, membership) */}
          {activeSection === 'rewards' && isBuyerRole(user.role) && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-theme-border bg-theme-bg/50">
                  <h2 className="font-semibold text-theme-text flex items-center gap-2">
                    <Gift className="w-5 h-5 text-careplus-primary shrink-0" />
                    {t('profile_rewards_title')}
                  </h2>
                  <p className="text-sm text-theme-muted mt-1">{t('profile_rewards_subtitle')}</p>
                  <p className="text-xs text-theme-muted mt-0.5">{t('profile_rewards_how')}</p>
                </div>
                <div className="p-6 space-y-6">
                  {customerProfileLoading ? (
                    <p className="text-theme-muted text-sm py-4">{t('profile_loading_rewards')}</p>
                  ) : !customerProfile?.customer ? (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-theme-border bg-theme-bg/50">
                      <Gift className="w-10 h-10 text-theme-muted mx-auto mb-3 opacity-60" />
                      <p className="text-theme-muted text-sm">{t('profile_rewards_no_customer')}</p>
                      <p className="text-theme-muted text-xs mt-2">{t('profile_rewards_add_phone')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col items-center p-4 rounded-xl bg-theme-bg border border-theme-border">
                          <QrCode className="w-5 h-5 text-careplus-primary mb-2" />
                          <p className="text-xs font-medium text-theme-muted mb-2">{t('profile_rewards_qr_register')}</p>
                          <QRCodeSVG
                            value={`${window.location.origin}/register?ref=${customerProfile.customer.referral_code}`}
                            size={140}
                            level="M"
                            className="rounded-lg"
                          />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-theme-muted mb-1">{t('profile_referral_code')}</label>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-semibold text-theme-text tracking-wider bg-theme-bg px-3 py-2 rounded-lg border border-theme-border">
                                {customerProfile.customer.referral_code}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(customerProfile.customer!.referral_code);
                                  setReferralCopied(true);
                                  setTimeout(() => setReferralCopied(false), 2000);
                                }}
                                className="p-2.5 rounded-lg border border-theme-border text-theme-muted hover:bg-theme-surface-hover hover:text-careplus-primary transition-colors"
                                title={t('profile_copy_code')}
                              >
                                {referralCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${window.location.origin}/register?ref=${customerProfile.customer!.referral_code}`;
                                const text = t('profile_share_message_register', { code: customerProfile.customer!.referral_code });
                                if (navigator.share) {
                                  navigator.share({ title: 'CarePlus', text, url }).catch(() => {});
                                } else {
                                  navigator.clipboard.writeText(`${text} ${url}`);
                                  setReferralCopied(true);
                                  setTimeout(() => setReferralCopied(false), 2000);
                                }
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-careplus-primary/50 text-careplus-primary font-medium hover:bg-careplus-primary/10 transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                              {t('profile_share')}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const url = `${window.location.origin}/register?ref=${customerProfile.customer!.referral_code}`;
                                await navigator.clipboard.writeText(url);
                                setReferralCopied(true);
                                setTimeout(() => setReferralCopied(false), 2000);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-theme-border text-theme-text font-medium hover:bg-theme-surface-hover transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              {t('profile_copy_register_link')}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-theme-bg border border-theme-border">
                          <p className="text-sm font-medium text-theme-muted">{t('profile_points_balance')}</p>
                          <p className="text-2xl font-bold text-careplus-primary tabular-nums mt-1">
                            {showPoints ? customerProfile.customer.points_balance.toLocaleString() : t('profile_points_hidden')}
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-theme-bg border border-theme-border">
                          <p className="text-sm font-medium text-theme-muted">{t('profile_points_earned_purchases')}</p>
                          <p className="text-2xl font-bold text-theme-text tabular-nums mt-1">
                            {showPoints ? customerProfile.points_earned_from_purchases.toLocaleString() : t('profile_points_hidden')}
                          </p>
                        </div>
                      </div>

                      {customerProfile.membership && (
                        <div className="p-4 rounded-xl bg-careplus-primary/10 border border-careplus-primary/30">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-careplus-primary shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-theme-muted">{t('profile_membership')}</p>
                              <p className="font-semibold text-theme-text">{customerProfile.membership.name}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {customerProfile.points_transactions && customerProfile.points_transactions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-theme-text mb-3">{t('profile_points_history')}</h3>
                          <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {customerProfile.points_transactions.slice(0, 15).map((tx) => (
                              <li
                                key={tx.id}
                                className="flex items-center justify-between py-2 px-3 rounded-lg bg-theme-bg border border-theme-border text-sm"
                              >
                                <span className="text-theme-muted">
                                  {tx.type === 'earn_purchase' && t('profile_pts_earn_purchase')}
                                  {tx.type === 'earn_referral' && t('profile_pts_earn_referral')}
                                  {tx.type === 'redeem' && t('profile_pts_redeem')}
                                </span>
                                <span className={tx.amount >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {tx.amount >= 0 ? '+' : ''}{tx.amount}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={profileConfirmOpen}
        title={t('profile_update_profile')}
        message={t('profile_update_confirm')}
        confirmLabel={t('save')}
        cancelLabel={t('cancel')}
        variant="default"
        loading={saving}
        onConfirm={handleProfileConfirm}
        onCancel={() => setProfileConfirmOpen(false)}
      />

      <ConfirmDialog
        open={passwordConfirmOpen}
        title={t('profile_change_password')}
        message={t('profile_change_password_confirm')}
        confirmLabel={t('profile_change_password')}
        cancelLabel={t('cancel')}
        variant="default"
        loading={passwordSaving}
        onConfirm={handlePasswordConfirm}
        onCancel={() => setPasswordConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('profile_delete_address')}
        message={t('profile_delete_address_confirm')}
        confirmLabel={t('profile_delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDeleteAddressConfirm}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteAddressId(null);
        }}
      />
    </div>
  );
}
