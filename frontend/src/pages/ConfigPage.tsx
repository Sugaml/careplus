import { useCallback, useEffect, useState } from 'react';
import { configApi, referralApi, paymentGatewaysApi, uploadFile, resolveImageUrl, type PharmacyConfig, type ReferralPointsConfig, type PaymentGateway } from '@/lib/api';
import { useBrand } from '@/contexts/BrandContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Settings, Save, RefreshCw, Gift, CreditCard, Plus, Pencil, Trash2, Globe, Image, MapPin, FileText, MessageCircle, ShieldCheck } from 'lucide-react';

/** Config page section id (for sub-menu). */
type ConfigSectionId =
  | 'company'
  | 'branding'
  | 'location'
  | 'return-refund'
  | 'chat'
  | 'trust'
  | 'referral'
  | 'payment-gateways';

const CONFIG_SECTIONS: { id: ConfigSectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'company', label: 'Company & website', icon: Globe },
  { id: 'branding', label: 'Branding & media', icon: Image },
  { id: 'location', label: 'Location & contact', icon: MapPin },
  { id: 'return-refund', label: 'Return & Refund Policy', icon: FileText },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'trust', label: 'Trust & verification', icon: ShieldCheck },
  { id: 'referral', label: 'Referral & points', icon: Gift },
  { id: 'payment-gateways', label: 'Payment gateways', icon: CreditCard },
];

/** Known feature keys for company feature controls (dynamic for any business type). */
const FEATURE_KEYS: { key: string; label: string }[] = [
  { key: 'products', label: 'Products / Catalog' },
  { key: 'orders', label: 'Orders' },
  { key: 'chat', label: 'Chat' },
  { key: 'promos', label: 'Promos & offers' },
  { key: 'referral', label: 'Referral & points' },
  { key: 'memberships', label: 'Memberships' },
  { key: 'billing', label: 'Billing (POS)' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'statements', label: 'Statements' },
  { key: 'categories', label: 'Categories' },
  { key: 'reviews', label: 'Product reviews' },
];

export default function ConfigPage() {
  const { refreshBrand } = useBrand();
  const [config, setConfig] = useState<PharmacyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [referralConfig, setReferralConfig] = useState<ReferralPointsConfig | null>(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralSaveConfirmOpen, setReferralSaveConfirmOpen] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [paymentGatewaysLoading, setPaymentGatewaysLoading] = useState(true);
  const [paymentGatewayForm, setPaymentGatewayForm] = useState<{
    code: string;
    name: string;
    is_active: boolean;
    sort_order: number;
    qr_details?: string;
    bank_details?: string;
    qr_image_url?: string;
    client_id?: string;
    secret_key?: string;
    extra_config?: string;
  } | null>(null);
  const [editingGatewayId, setEditingGatewayId] = useState<string | null>(null);
  const [gatewaySaving, setGatewaySaving] = useState(false);
  const [gatewayError, setGatewayError] = useState('');
  const [qrImageUploading, setQrImageUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<ConfigSectionId>('company');

  const loadConfig = useCallback(() => {
    setLoading(true);
    setError('');
    configApi
      .get()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load config'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setReferralLoading(true);
    referralApi
      .getConfig()
      .then(setReferralConfig)
      .catch(() =>
        setReferralConfig({
          id: '',
          pharmacy_id: '',
          points_per_currency_unit: 1,
          currency_unit_for_points: 10,
          referral_reward_points: 50,
          redemption_rate_points: 100,
          redemption_rate_currency: 10,
          max_redeem_points_per_order: 0,
          created_at: '',
          updated_at: '',
        } as ReferralPointsConfig)
      )
      .finally(() => setReferralLoading(false));
  }, []);

  const loadPaymentGateways = useCallback(() => {
    setPaymentGatewaysLoading(true);
    paymentGatewaysApi
      .list()
      .then(setPaymentGateways)
      .catch(() => setPaymentGateways([]))
      .finally(() => setPaymentGatewaysLoading(false));
  }, []);

  useEffect(() => {
    loadPaymentGateways();
  }, [loadPaymentGateways]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaveConfirmOpen(true);
  };

  const handleSaveConfirm = async () => {
    if (!config) return;
    setError('');
    setSuccess(false);
    setSaving(true);
    setSaveConfirmOpen(false);
    try {
      const updated = await configApi.update({
        display_name: config.display_name,
        location: config.location,
        logo_url: config.logo_url,
        banner_url: config.banner_url,
        tagline: config.tagline,
        contact_phone: config.contact_phone,
        contact_email: config.contact_email,
        primary_color: config.primary_color,
        default_language: config.default_language,
        website_enabled: config.website_enabled,
        feature_flags: config.feature_flags && Object.keys(config.feature_flags).length > 0 ? config.feature_flags : undefined,
        license_no: config.license_no,
        verified_at: config.verified_at,
        established_year: config.established_year,
        return_refund_policy: config.return_refund_policy ?? undefined,
        chat_edit_window_minutes: config.chat_edit_window_minutes ?? 10,
      });
      setConfig(updated);
      setSuccess(true);
      await refreshBrand();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConfig();
  };

  if (loading) return <Loader variant="page" message="Loading configuration…" />;
  if (error && !config) return <p className="text-red-600">{error}</p>;

  const c = config ?? ({} as PharmacyConfig);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-7 h-7 text-careplus-primary" />
          <h1 className="text-2xl font-bold text-gray-800">Pharmacy configuration</h1>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-gray-600 mb-6">
        Manage your company name, location, logo, website visibility, and feature controls. Works for any business type (pharmacy, retail, clinic, etc.).
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          Configuration saved successfully.
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sub-menu */}
        <nav className="md:w-56 shrink-0" aria-label="Configuration sections">
          <ul className="flex flex-wrap gap-1 md:flex-col md:gap-0 md:border md:border-gray-200 md:rounded-xl md:overflow-hidden md:bg-white md:shadow-sm">
            {CONFIG_SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors rounded-lg md:rounded-none md:border-b md:border-gray-100 last:md:border-b-0 ${
                    activeSection === id
                      ? 'bg-careplus-primary text-white md:bg-careplus-primary md:text-white'
                      : 'text-gray-700 hover:bg-gray-100 md:hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            {activeSection === 'company' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
            <Globe className="w-5 h-5 text-careplus-primary" />
            Company & website
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="website_enabled"
              checked={c.website_enabled !== false}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, website_enabled: e.target.checked } : null)}
              className="w-4 h-4 rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
            />
            <label htmlFor="website_enabled" className="text-sm font-medium text-gray-700">
              Website enabled
            </label>
          </div>
          <p className="text-xs text-gray-500">
            When disabled, the public website shows a &quot;temporarily unavailable&quot; message. Dashboard and login remain available.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default language</label>
            <select
              value={c.default_language ?? 'en'}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, default_language: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
            >
              <option value="en">English</option>
              <option value="ne">नेपाली (Nepali)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Feature controls</label>
            <p className="text-xs text-gray-500 mb-3">
              Enable or disable features for this company. Unlisted features are treated as enabled.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_KEYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`feature_${key}`}
                    checked={c.feature_flags?.[key] !== false}
                    onChange={(e) => {
                      setConfig((prev) => {
                        if (!prev) return null;
                        const next = { ...(prev.feature_flags ?? {}), [key]: e.target.checked };
                        return { ...prev, feature_flags: next };
                      });
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                  />
                  <label htmlFor={`feature_${key}`} className="text-sm text-gray-700">{label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
            )}

            {activeSection === 'branding' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Branding & media</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <p className="text-xs text-gray-500 mb-1">Name shown in the header and on the public store.</p>
            <input
              type="text"
              value={c.display_name ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, display_name: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="e.g. CarePlus Pharmacy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <p className="text-xs text-gray-500 mb-1">Direct URL to your pharmacy logo. Use Upload in the dashboard to host files, or paste an external URL.</p>
            <input
              type="url"
              value={c.logo_url ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, logo_url: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="https://example.com/logo.png"
            />
            {c.logo_url && (
              <img src={c.logo_url} alt="Logo preview" className="mt-2 h-12 object-contain" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner URL</label>
            <p className="text-xs text-gray-500 mb-1">URL for the store banner image shown at the top of the public page.</p>
            <input
              type="url"
              value={c.banner_url ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, banner_url: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="https://example.com/banner.jpg"
            />
            {c.banner_url && (
              <img src={c.banner_url} alt="Banner preview" className="mt-2 w-full max-h-32 object-cover rounded" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
            <p className="text-xs text-gray-500 mb-1">Short phrase under your pharmacy name (e.g. &quot;Your health, our priority&quot;).</p>
            <input
              type="text"
              value={c.tagline ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, tagline: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="e.g. Your health, our priority"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary color (hex)</label>
            <p className="text-xs text-gray-500 mb-1">Hex code for buttons and accents (e.g. #0066cc).</p>
            <input
              type="text"
              value={c.primary_color ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, primary_color: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="#0066cc"
            />
          </div>
        </div>
            )}

            {activeSection === 'location' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Location & contact</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location / address</label>
            <p className="text-xs text-gray-500 mb-1">Full address or location text shown on the public store and invoices.</p>
            <textarea
              value={c.location ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, location: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              rows={2}
              placeholder="Full address or location"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone</label>
            <p className="text-xs text-gray-500 mb-1">Phone number displayed for customers.</p>
            <input
              type="text"
              value={c.contact_phone ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, contact_phone: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="+977 1 2345678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact email</label>
            <p className="text-xs text-gray-500 mb-1">Email shown for customer inquiries.</p>
            <input
              type="email"
              value={c.contact_email ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, contact_email: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="contact@pharmacy.com"
            />
          </div>
        </div>
            )}

            {activeSection === 'return-refund' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Return & Refund Policy</h2>
          <p className="text-sm text-gray-500">
            Optional custom policy text shown on the public Return & Refund page. Leave blank to show the default compliant policy. Plain text or simple HTML.
          </p>
          <textarea
            value={c.return_refund_policy ?? ''}
            onChange={(e) => setConfig((prev) => prev ? { ...prev, return_refund_policy: e.target.value || undefined } : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent font-mono text-sm"
            rows={8}
            placeholder="e.g. We accept returns within 7 days for unopened items..."
          />
        </div>
            )}

            {activeSection === 'chat' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Chat</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chat message edit window (minutes)</label>
            <p className="text-xs text-gray-500 mb-1">Users and customers can edit their own messages only within this many minutes after sending. Set to 0 to disable editing.</p>
            <input
              type="number"
              min={0}
              max={1440}
              value={c.chat_edit_window_minutes ?? 10}
              onChange={(e) =>
                setConfig((prev) =>
                  prev ? { ...prev, chat_edit_window_minutes: Math.max(0, parseInt(e.target.value, 10) || 0) } : null
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="10"
            />
          </div>
        </div>
            )}

            {activeSection === 'trust' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Trust & verification</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License number</label>
            <p className="text-xs text-gray-500 mb-1">Pharmacy license number (optional, for trust badge).</p>
            <input
              type="text"
              value={c.license_no ?? ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, license_no: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="e.g. PH-12345"
            />
          </div>
          <div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!c.verified_at}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev ? { ...prev, verified_at: e.target.checked ? new Date().toISOString() : null } : null
                  )
                }
                className="rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
              />
              <span className="text-sm font-medium text-gray-700">Show &quot;Verified pharmacy&quot; badge</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">When checked, a Verified badge appears on the public store header.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year established</label>
            <p className="text-xs text-gray-500 mb-1">Optional year the pharmacy was established (e.g. 2010).</p>
            <input
              type="number"
              min={1900}
              max={2100}
              value={c.established_year ?? ''}
              onChange={(e) => {
                const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
                setConfig((prev) => (prev ? { ...prev, established_year: v ?? 0 } : null));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="e.g. 2010"
            />
          </div>
        </div>
            )}

            {activeSection === 'referral' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
            <Gift className="w-5 h-5 text-careplus-primary" />
            Referral & points
          </h2>
          <p className="text-sm text-gray-500">
            Configure how customers earn points on purchases and referrals, and how many points equal a discount. Leave at defaults or adjust to your policy.
          </p>
          {referralLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : referralConfig != null ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points per currency unit</label>
                <p className="text-xs text-gray-500 mb-1">e.g. 1 point per 10 NPR: set Points per unit = 1, Currency unit = 10.</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={referralConfig.points_per_currency_unit ?? 1}
                    onChange={(e) =>
                      setReferralConfig((prev) =>
                        prev ? { ...prev, points_per_currency_unit: parseFloat(e.target.value) || 0 } : null
                      )
                    }
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <span className="self-center text-gray-500">points per</span>
                  <input
                    type="number"
                    min={0.01}
                    step={1}
                    value={referralConfig.currency_unit_for_points ?? 10}
                    onChange={(e) =>
                      setReferralConfig((prev) =>
                        prev ? { ...prev, currency_unit_for_points: parseFloat(e.target.value) || 1 } : null
                      )
                    }
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <span className="self-center text-gray-500">NPR spent</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referral reward (points)</label>
                <p className="text-xs text-gray-500 mb-1">Points the referrer gets when a referred customer completes their first order.</p>
                <input
                  type="number"
                  min={0}
                  value={referralConfig.referral_reward_points ?? 50}
                  onChange={(e) =>
                    setReferralConfig((prev) =>
                      prev ? { ...prev, referral_reward_points: parseInt(e.target.value, 10) || 0 } : null
                    )
                  }
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Redemption rate</label>
                <p className="text-xs text-gray-500 mb-1">e.g. 100 points = 10 NPR discount: set Points = 100, Currency = 10.</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={referralConfig.redemption_rate_points ?? 100}
                    onChange={(e) =>
                      setReferralConfig((prev) =>
                        prev ? { ...prev, redemption_rate_points: parseInt(e.target.value, 10) || 100 } : null
                      )
                    }
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <span className="self-center text-gray-500">points =</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={referralConfig.redemption_rate_currency ?? 10}
                    onChange={(e) =>
                      setReferralConfig((prev) =>
                        prev ? { ...prev, redemption_rate_currency: parseFloat(e.target.value) || 0 } : null
                      )
                    }
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <span className="self-center text-gray-500">NPR discount</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max points to redeem per order (0 = no cap)</label>
                <input
                  type="number"
                  min={0}
                  value={referralConfig.max_redeem_points_per_order ?? 0}
                  onChange={(e) =>
                    setReferralConfig((prev) =>
                      prev ? { ...prev, max_redeem_points_per_order: parseInt(e.target.value, 10) || 0 } : null
                    )
                  }
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={() => setReferralSaveConfirmOpen(true)}
                disabled={referralSaving || !referralConfig}
                className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 font-medium"
              >
                <Save className="w-4 h-4" />
                {referralSaving ? 'Saving...' : 'Save referral & points'}
              </button>
            </>
          ) : null}
        </div>
            )}

            {activeSection === 'payment-gateways' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-careplus-primary" />
            Payment gateways
          </h2>
          <p className="text-sm text-gray-500">
            Payment methods shown at checkout (e.g. eSewa, Khalti, QR, Cash on Delivery, Fonepay). Only active gateways appear in the store. Mock payment is used for now.
          </p>
          {paymentGatewaysLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <ul className="space-y-2">
                {paymentGateways.map((gw) => (
                  <li
                    key={gw.id}
                    className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{gw.name}</span>
                      <span className="text-gray-500 text-sm ml-2">({gw.code})</span>
                      {!gw.is_active && <span className="ml-2 text-amber-600 text-sm">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGatewayId(gw.id);
                          setPaymentGatewayForm({
                            code: gw.code,
                            name: gw.name,
                            is_active: gw.is_active,
                            sort_order: gw.sort_order,
                            qr_details: gw.qr_details ?? '',
                            bank_details: gw.bank_details ?? '',
                            qr_image_url: gw.qr_image_url ?? '',
                            client_id: gw.client_id ?? '',
                            secret_key: gw.secret_key ?? '',
                            extra_config: gw.extra_config ?? '',
                          });
                        }}
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-careplus-primary"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Remove this payment gateway?')) return;
                          setGatewayError('');
                          try {
                            await paymentGatewaysApi.delete(gw.id);
                            loadPaymentGateways();
                          } catch (e) {
                            setGatewayError(e instanceof Error ? e.message : 'Failed to delete');
                          }
                        }}
                        className="p-1.5 rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {gatewayError && <p className="text-sm text-red-600">{gatewayError}</p>}
              {editingGatewayId ? (
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Edit gateway</p>
                  {paymentGatewayForm && (
                    <>
                      <input
                        type="text"
                        placeholder="Name"
                        value={paymentGatewayForm.name}
                        onChange={(e) => setPaymentGatewayForm((p) => (p ? { ...p, name: e.target.value } : null))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={paymentGatewayForm.is_active}
                          onChange={(e) =>
                            setPaymentGatewayForm((p) => (p ? { ...p, is_active: e.target.checked } : null))
                          }
                          className="rounded border-gray-300 text-careplus-primary"
                        />
                        <span className="text-sm">Active (show at checkout)</span>
                      </label>
                      {(paymentGatewayForm.code === 'esewa' || paymentGatewayForm.code === 'khalti') && (
                        <div className="space-y-3 pt-2 border-t border-gray-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Client ID</label>
                            <input
                              type="text"
                              placeholder="e.g. from eSewa/Khalti merchant dashboard"
                              value={paymentGatewayForm.client_id ?? ''}
                              onChange={(e) =>
                                setPaymentGatewayForm((p) => (p ? { ...p, client_id: e.target.value } : null))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Secret key</label>
                            <input
                              type="password"
                              placeholder="Keep confidential"
                              value={paymentGatewayForm.secret_key ?? ''}
                              onChange={(e) =>
                                setPaymentGatewayForm((p) => (p ? { ...p, secret_key: e.target.value } : null))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Other details</label>
                            <textarea
                              placeholder="API URL, callback URL, environment, or other config (one per line or JSON)"
                              value={paymentGatewayForm.extra_config ?? ''}
                              onChange={(e) =>
                                setPaymentGatewayForm((p) => (p ? { ...p, extra_config: e.target.value } : null))
                              }
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      )}
                      {paymentGatewayForm.code === 'qr' && (
                        <div className="space-y-3 pt-2 border-t border-gray-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">QR details</label>
                            <textarea
                              placeholder="Instructions or details for scanning the QR"
                              value={paymentGatewayForm.qr_details ?? ''}
                              onChange={(e) =>
                                setPaymentGatewayForm((p) => (p ? { ...p, qr_details: e.target.value } : null))
                              }
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Bank details</label>
                            <textarea
                              placeholder="Bank name, account number, etc."
                              value={paymentGatewayForm.bank_details ?? ''}
                              onChange={(e) =>
                                setPaymentGatewayForm((p) => (p ? { ...p, bank_details: e.target.value } : null))
                              }
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">QR image</label>
                            {paymentGatewayForm.qr_image_url ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <img
                                  src={resolveImageUrl(paymentGatewayForm.qr_image_url)}
                                  alt="QR"
                                  className="h-20 w-20 object-contain border border-gray-200 rounded"
                                />
                                <div className="flex gap-2">
                                  <label className="cursor-pointer px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                                    {qrImageUploading ? 'Uploading…' : 'Change'}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="sr-only"
                                      disabled={qrImageUploading}
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file || !paymentGatewayForm) return;
                                        setQrImageUploading(true);
                                        try {
                                          const { url } = await uploadFile(file);
                                          setPaymentGatewayForm((p) => (p ? { ...p, qr_image_url: url } : null));
                                        } finally {
                                          setQrImageUploading(false);
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPaymentGatewayForm((p) => (p ? { ...p, qr_image_url: '' } : null))
                                    }
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                                {qrImageUploading ? 'Uploading…' : 'Upload QR image'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  disabled={qrImageUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !paymentGatewayForm) return;
                                    setQrImageUploading(true);
                                    try {
                                      const { url } = await uploadFile(file);
                                      setPaymentGatewayForm((p) => (p ? { ...p, qr_image_url: url } : null));
                                    } finally {
                                      setQrImageUploading(false);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!paymentGatewayForm) return;
                            setGatewayError('');
                            setGatewaySaving(true);
                            try {
                              await paymentGatewaysApi.update(editingGatewayId, {
                                name: paymentGatewayForm.name,
                                is_active: paymentGatewayForm.is_active,
                                sort_order: paymentGatewayForm.sort_order,
                                ...(paymentGatewayForm.code === 'qr'
                                  ? {
                                      qr_details: paymentGatewayForm.qr_details ?? '',
                                      bank_details: paymentGatewayForm.bank_details ?? '',
                                      qr_image_url: paymentGatewayForm.qr_image_url ?? '',
                                    }
                                  : {}),
                                ...(paymentGatewayForm.code === 'esewa' || paymentGatewayForm.code === 'khalti'
                                  ? {
                                      client_id: paymentGatewayForm.client_id ?? '',
                                      secret_key: paymentGatewayForm.secret_key ?? '',
                                      extra_config: paymentGatewayForm.extra_config ?? '',
                                    }
                                  : {}),
                              });
                              loadPaymentGateways();
                              setEditingGatewayId(null);
                              setPaymentGatewayForm(null);
                            } catch (e) {
                              setGatewayError(e instanceof Error ? e.message : 'Failed to update');
                            } finally {
                              setGatewaySaving(false);
                            }
                          }}
                          disabled={gatewaySaving}
                          className="px-3 py-1.5 bg-careplus-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGatewayId(null);
                            setPaymentGatewayForm(null);
                            setGatewayError('');
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="pt-2 border-t border-gray-200 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Add gateway</p>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Gateway type</label>
                      <select
                        value={paymentGatewayForm?.code ?? ''}
                        onChange={(e) => {
                          const code = e.target.value;
                          const optionText = e.target.selectedOptions[0]?.text ?? code;
                          if (!code) {
                            setPaymentGatewayForm(null);
                            return;
                          }
                          setPaymentGatewayForm({
                            code,
                            name: code === 'other' ? '' : optionText,
                            is_active: true,
                            sort_order: paymentGatewayForm?.sort_order ?? paymentGateways.length,
                            qr_details: code === 'qr' ? paymentGatewayForm?.qr_details ?? '' : undefined,
                            bank_details: code === 'qr' ? paymentGatewayForm?.bank_details ?? '' : undefined,
                            qr_image_url: code === 'qr' ? paymentGatewayForm?.qr_image_url ?? '' : undefined,
                            client_id: code === 'esewa' || code === 'khalti' ? paymentGatewayForm?.client_id ?? '' : undefined,
                            secret_key: code === 'esewa' || code === 'khalti' ? paymentGatewayForm?.secret_key ?? '' : undefined,
                            extra_config: code === 'esewa' || code === 'khalti' ? paymentGatewayForm?.extra_config ?? '' : undefined,
                          });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select type…</option>
                        <option value="esewa">eSewa</option>
                        <option value="khalti">Khalti</option>
                        <option value="qr">QR</option>
                        <option value="cod">Cash on Delivery</option>
                        <option value="fonepay">Fonepay</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Display name</label>
                      <input
                        type="text"
                        placeholder="e.g. eSewa"
                        value={paymentGatewayForm?.name ?? ''}
                        onChange={(e) =>
                          setPaymentGatewayForm((p) => (p ? { ...p, name: e.target.value } : null))
                        }
                        className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    {(paymentGatewayForm?.code === 'esewa' || paymentGatewayForm?.code === 'khalti') && (
                      <div className="w-full space-y-3 border-t border-gray-200 pt-3 mt-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Client ID</label>
                          <input
                            type="text"
                            placeholder="e.g. from eSewa/Khalti merchant dashboard"
                            value={paymentGatewayForm.client_id ?? ''}
                            onChange={(e) =>
                              setPaymentGatewayForm((p) => (p ? { ...p, client_id: e.target.value } : null))
                            }
                            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Secret key</label>
                          <input
                            type="password"
                            placeholder="Keep confidential"
                            value={paymentGatewayForm.secret_key ?? ''}
                            onChange={(e) =>
                              setPaymentGatewayForm((p) => (p ? { ...p, secret_key: e.target.value } : null))
                            }
                            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Other details</label>
                          <textarea
                            placeholder="API URL, callback URL, environment, or other config (one per line or JSON)"
                            value={paymentGatewayForm.extra_config ?? ''}
                            onChange={(e) =>
                              setPaymentGatewayForm((p) => (p ? { ...p, extra_config: e.target.value } : null))
                            }
                            rows={3}
                            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    )}
                    {paymentGatewayForm?.code === 'qr' && (
                      <div className="w-full space-y-3 border-t border-gray-200 pt-3 mt-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">QR details</label>
                          <textarea
                            placeholder="Instructions or details for scanning the QR"
                            value={paymentGatewayForm.qr_details ?? ''}
                            onChange={(e) =>
                              setPaymentGatewayForm((p) => (p ? { ...p, qr_details: e.target.value } : null))
                            }
                            rows={2}
                            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Bank details</label>
                          <textarea
                            placeholder="Bank name, account number, etc."
                            value={paymentGatewayForm.bank_details ?? ''}
                            onChange={(e) =>
                              setPaymentGatewayForm((p) => (p ? { ...p, bank_details: e.target.value } : null))
                            }
                            rows={2}
                            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">QR image</label>
                          {paymentGatewayForm.qr_image_url ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <img
                                src={resolveImageUrl(paymentGatewayForm.qr_image_url)}
                                alt="QR"
                                className="h-20 w-20 object-contain border border-gray-200 rounded"
                              />
                              <div className="flex gap-2">
                                <label className="cursor-pointer px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                                  {qrImageUploading ? 'Uploading…' : 'Change'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    disabled={qrImageUploading}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setQrImageUploading(true);
                                      try {
                                        const { url } = await uploadFile(file);
                                        setPaymentGatewayForm((p) => (p ? { ...p, qr_image_url: url } : null));
                                      } finally {
                                        setQrImageUploading(false);
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPaymentGatewayForm((p) => (p ? { ...p, qr_image_url: '' } : null))
                                  }
                                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
                              {qrImageUploading ? 'Uploading…' : 'Upload QR image'}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={qrImageUploading}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setQrImageUploading(true);
                                  try {
                                    const { url } = await uploadFile(file);
                                    setPaymentGatewayForm((p) => (p ? { ...p, qr_image_url: url } : null));
                                  } finally {
                                    setQrImageUploading(false);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!paymentGatewayForm?.code || !paymentGatewayForm?.name.trim()) return;
                        setGatewayError('');
                        setGatewaySaving(true);
                        try {
                          await paymentGatewaysApi.create({
                            code: paymentGatewayForm.code,
                            name: paymentGatewayForm.name.trim(),
                            is_active: paymentGatewayForm.is_active,
                            sort_order: paymentGatewayForm.sort_order,
                            ...(paymentGatewayForm.code === 'qr'
                              ? {
                                  qr_details: paymentGatewayForm.qr_details ?? '',
                                  bank_details: paymentGatewayForm.bank_details ?? '',
                                  qr_image_url: paymentGatewayForm.qr_image_url ?? '',
                                }
                              : {}),
                            ...(paymentGatewayForm.code === 'esewa' || paymentGatewayForm.code === 'khalti'
                              ? {
                                  client_id: paymentGatewayForm.client_id ?? '',
                                  secret_key: paymentGatewayForm.secret_key ?? '',
                                  extra_config: paymentGatewayForm.extra_config ?? '',
                                }
                              : {}),
                          });
                          loadPaymentGateways();
                          setPaymentGatewayForm(null);
                        } catch (e) {
                          setGatewayError(e instanceof Error ? e.message : 'Failed to add');
                        } finally {
                          setGatewaySaving(false);
                        }
                      }}
                      disabled={gatewaySaving || !paymentGatewayForm?.code || !paymentGatewayForm?.name?.trim()}
                      className="flex items-center gap-2 px-3 py-2 bg-careplus-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add gateway
                    </button>
                  </div>
                  {gatewayError && <p className="text-sm text-red-600">{gatewayError}</p>}
                </div>
              )}
            </>
          )}
        </div>
            )}

            {/* Save main config: show for all sections except referral & payment-gateways (they have own save) */}
            {activeSection !== 'referral' && activeSection !== 'payment-gateways' && (
              <button
                type="submit"
                disabled={saving || !config}
                className="flex items-center gap-2 px-4 py-2.5 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 font-medium"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save configuration'}
              </button>
            )}
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save configuration"
        message="Are you sure you want to save? This will update the public website and store settings."
        confirmLabel="Save"
        cancelLabel="Cancel"
        variant="default"
        loading={saving}
        onConfirm={handleSaveConfirm}
        onCancel={() => setSaveConfirmOpen(false)}
      />

      <ConfirmDialog
        open={referralSaveConfirmOpen}
        title="Save referral & points"
        message="Update points earning and redemption rules for this pharmacy?"
        confirmLabel="Save"
        cancelLabel="Cancel"
        variant="default"
        loading={referralSaving}
        onConfirm={async () => {
          if (!referralConfig) return;
          setReferralSaveConfirmOpen(false);
          setReferralSaving(true);
          try {
            const updated = await referralApi.upsertConfig({
              points_per_currency_unit: referralConfig.points_per_currency_unit,
              currency_unit_for_points: referralConfig.currency_unit_for_points,
              referral_reward_points: referralConfig.referral_reward_points,
              redemption_rate_points: referralConfig.redemption_rate_points,
              redemption_rate_currency: referralConfig.redemption_rate_currency,
              max_redeem_points_per_order: referralConfig.max_redeem_points_per_order,
            });
            setReferralConfig(updated);
          } catch {
            // error state could be shown
          } finally {
            setReferralSaving(false);
          }
        }}
        onCancel={() => setReferralSaveConfirmOpen(false)}
      />
    </div>
  );
}
