import { useCallback, useEffect, useState } from 'react';
import { pharmacyApi, type Pharmacy } from '@/lib/api';
import Loader from '@/components/Loader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Building2, Plus, Pencil, RefreshCw } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'retail', label: 'Retail' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'other', label: 'Other' },
];

type FormState = {
  name: string;
  license_no: string;
  tenant_code: string;
  hostname_slug: string;
  business_type: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: '',
  license_no: '',
  tenant_code: '',
  hostname_slug: '',
  business_type: 'pharmacy',
  address: '',
  phone: '',
  email: '',
  is_active: true,
};

function pharmacyToForm(p: Pharmacy | null): FormState {
  if (!p) return emptyForm;
  return {
    name: p.name ?? '',
    license_no: p.license_no ?? '',
    tenant_code: p.tenant_code ?? '',
    hostname_slug: p.hostname_slug ?? '',
    business_type: p.business_type ?? 'pharmacy',
    address: p.address ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    is_active: p.is_active ?? true,
  };
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadCompanies = useCallback(() => {
    setLoading(true);
    setError('');
    pharmacyApi
      .list()
      .then(setCompanies)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load companies'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCompanies();
  };

  const handleOpenAdd = () => {
    setForm(emptyForm);
    setSaveError('');
    setAddOpen(true);
  };

  const handleOpenEdit = (p: Pharmacy) => {
    setForm(pharmacyToForm(p));
    setSaveError('');
    setEditingId(p.id);
  };

  const handleCloseAdd = () => {
    setAddOpen(false);
    setForm(emptyForm);
    setSaveError('');
  };

  const handleCloseEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSaveError('');
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.license_no.trim()) {
      setSaveError('Name and license number are required.');
      return;
    }
    if (!form.tenant_code.trim() || !form.hostname_slug.trim()) {
      setSaveError('Tenant code and hostname slug are required for the company website (app-config).');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await pharmacyApi.create({
        name: form.name.trim(),
        license_no: form.license_no.trim(),
        tenant_code: form.tenant_code.trim(),
        hostname_slug: form.hostname_slug.trim(),
        business_type: form.business_type || 'pharmacy',
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        is_active: form.is_active,
      });
      loadCompanies();
      handleCloseAdd();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create company');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!form.name.trim() || !form.license_no.trim()) {
      setSaveError('Name and license number are required.');
      return;
    }
    if (!form.tenant_code.trim() || !form.hostname_slug.trim()) {
      setSaveError('Tenant code and hostname slug are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await pharmacyApi.update(editingId, {
        name: form.name.trim(),
        license_no: form.license_no.trim(),
        tenant_code: form.tenant_code.trim(),
        hostname_slug: form.hostname_slug.trim(),
        business_type: form.business_type || 'pharmacy',
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        is_active: form.is_active,
      });
      loadCompanies();
      handleCloseEdit();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };

  if (loading && companies.length === 0) {
    return <Loader variant="page" message="Loading companies…" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-7 h-7 text-careplus-primary" />
          <h1 className="text-2xl font-bold text-theme-text">Companies</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface hover:text-careplus-primary transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary font-medium"
          >
            <Plus className="w-5 h-5" />
            Add company
          </button>
        </div>
      </div>

      <p className="text-theme-muted mb-6">
        Add and manage companies (tenants). Each company has its own website identified by hostname. Set tenant code and hostname slug so the public app-config loads the right company.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white dark:bg-theme-surface rounded-xl border border-theme-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-theme-border-subtle border-b border-theme-border">
              <tr>
                <th className="py-3 px-4 text-sm font-semibold text-theme-text">Name</th>
                <th className="py-3 px-4 text-sm font-semibold text-theme-text">Tenant / Hostname</th>
                <th className="py-3 px-4 text-sm font-semibold text-theme-text">Type</th>
                <th className="py-3 px-4 text-sm font-semibold text-theme-text">Address</th>
                <th className="py-3 px-4 text-sm font-semibold text-theme-text">Status</th>
                <th className="py-3 px-4 text-sm font-semibold text-theme-text w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-theme-muted">
                    No companies yet. Click &quot;Add company&quot; to create one.
                  </td>
                </tr>
              ) : (
                companies.map((p) => (
                  <tr key={p.id} className="hover:bg-theme-border-subtle/50">
                    <td className="py-3 px-4 font-medium text-theme-text">{p.name}</td>
                    <td className="py-3 px-4 text-sm text-theme-muted">
                      <span className="font-mono">{p.tenant_code || '—'}</span>
                      {p.hostname_slug && (
                        <span className="ml-1 text-theme-muted">/ {p.hostname_slug}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-theme-text capitalize">
                      {(p.business_type || 'pharmacy').replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-sm text-theme-muted max-w-[200px] truncate">
                      {p.address || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          p.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface hover:text-careplus-primary transition-colors"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add company modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true" role="dialog">
          <div className="bg-white dark:bg-theme-surface rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">Add company</h2>
              <p className="text-sm text-theme-muted mt-1">Create a new company (tenant). Set tenant code and hostname slug for the public website.</p>
            </div>
            <div className="p-6 space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">{saveError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                  placeholder="e.g. Care+ Pharmacy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">License number *</label>
                <input
                  type="text"
                  value={form.license_no}
                  onChange={(e) => setForm((f) => ({ ...f, license_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                  placeholder="e.g. PH-12345"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Tenant code *</label>
                  <input
                    type="text"
                    value={form.tenant_code}
                    onChange={(e) => setForm((f) => ({ ...f, tenant_code: e.target.value.replace(/\s/g, '') }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text font-mono"
                    placeholder="e.g. careplus"
                  />
                  <p className="text-xs text-theme-muted mt-0.5">Unique ID for this company</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Hostname slug *</label>
                  <input
                    type="text"
                    value={form.hostname_slug}
                    onChange={(e) => setForm((f) => ({ ...f, hostname_slug: e.target.value.replace(/\s/g, '') }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text font-mono"
                    placeholder="e.g. careplus"
                  />
                  <p className="text-xs text-theme-muted mt-0.5">Used in URL / app-config</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">Business type</label>
                <select
                  value={form.business_type}
                  onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                >
                  {BUSINESS_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                  rows={2}
                  placeholder="Full address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                    placeholder="+977 ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                    placeholder="contact@company.com"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                />
                <span className="text-sm text-theme-text">Active (company visible and selectable)</span>
              </label>
            </div>
            <div className="p-6 border-t border-theme-border flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseAdd}
                className="px-4 py-2 border border-theme-border rounded-lg text-theme-text hover:bg-theme-border-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 font-medium"
              >
                {saving ? 'Creating…' : 'Create company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit company modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true" role="dialog">
          <div className="bg-white dark:bg-theme-surface rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-text">Edit company</h2>
            </div>
            <div className="p-6 space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">{saveError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">License number *</label>
                <input
                  type="text"
                  value={form.license_no}
                  onChange={(e) => setForm((f) => ({ ...f, license_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Tenant code *</label>
                  <input
                    type="text"
                    value={form.tenant_code}
                    onChange={(e) => setForm((f) => ({ ...f, tenant_code: e.target.value.replace(/\s/g, '') }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Hostname slug *</label>
                  <input
                    type="text"
                    value={form.hostname_slug}
                    onChange={(e) => setForm((f) => ({ ...f, hostname_slug: e.target.value.replace(/\s/g, '') }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">Business type</label>
                <select
                  value={form.business_type}
                  onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                >
                  {BUSINESS_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent bg-theme-bg text-theme-text"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-theme-border text-careplus-primary focus:ring-careplus-primary"
                />
                <span className="text-sm text-theme-text">Active</span>
              </label>
            </div>
            <div className="p-6 border-t border-theme-border flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-4 py-2 border border-theme-border rounded-lg text-theme-text hover:bg-theme-border-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
