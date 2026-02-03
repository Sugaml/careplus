import { useCallback, useEffect, useState } from 'react';
import { configApi, referralApi, type PharmacyConfig, type ReferralPointsConfig } from '@/lib/api';
import { useBrand } from '@/contexts/BrandContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Loader from '@/components/Loader';
import { Settings, Save, RefreshCw, Gift } from 'lucide-react';

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
        license_no: config.license_no,
        verified_at: config.verified_at,
        established_year: config.established_year,
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
        Manage your pharmacy name, location, logo, banner, and contact details. These appear on the public website.
      </p>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
            Configuration saved successfully.
          </div>
        )}

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

        <button
          type="submit"
          disabled={saving || !config}
          className="flex items-center gap-2 px-4 py-2.5 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 font-medium"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save configuration'}
        </button>
      </form>

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
