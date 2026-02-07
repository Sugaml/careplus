import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { configApi, fetchAppConfig, publicStoreApi } from '@/lib/api';

const DEFAULT_DISPLAY_NAME = 'CarePlus Pharmacy';
const DEFAULT_PRIMARY = '#0d9488';
const DEFAULT_SECONDARY = '#0f766e';

/** Darken hex color by a factor (0–1). */
function darkenHex(hex: string, factor: number): string {
  const n = hex.replace('#', '');
  const r = Math.max(0, parseInt(n.slice(0, 2), 16) * (1 - factor));
  const g = Math.max(0, parseInt(n.slice(2, 4), 16) * (1 - factor));
  const b = Math.max(0, parseInt(n.slice(4, 6), 16) * (1 - factor));
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

function applyBrandToDocument(primaryColor: string | null) {
  const root = document.documentElement;
  const primary = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY;
  const secondary = primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? darkenHex(primaryColor, 0.08) : DEFAULT_SECONDARY;
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-secondary', secondary);
}

export interface BrandState {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  verifiedAt: string | null;
  loading: boolean;
  /** When on public store: selected pharmacy id (for policy/config by pharmacy). */
  publicPharmacyId: string | null;
  /** Company website enabled (from app-config or config). When false, public site can show "disabled" message. */
  websiteEnabled: boolean;
  /** Per-tenant feature flags (products, orders, chat, etc.). Empty = all enabled for backward compat. */
  features: Record<string, boolean>;
}

interface BrandContextValue extends BrandState {
  setPublicPharmacyId: (id: string | null) => void;
  refreshBrand: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(DEFAULT_DISPLAY_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicPharmacyId, setPublicPharmacyId] = useState<string | null>(null);
  const [websiteEnabled, setWebsiteEnabled] = useState(true);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  const loadBrand = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        const config = await configApi.get();
        setDisplayName(config.display_name || DEFAULT_DISPLAY_NAME);
        setLogoUrl(config.logo_url || null);
        setPrimaryColor(config.primary_color || null);
        setVerifiedAt(config.verified_at ?? null);
        setWebsiteEnabled(config.website_enabled ?? true);
        setFeatures(config.feature_flags ?? {});
        applyBrandToDocument(config.primary_color || null);
      } else {
        // Public: try /app-config by hostname first (multi-tenant); fallback to pharmacy list
        let appConfig = await fetchAppConfig();
        if (!appConfig && (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) {
          appConfig = await fetchAppConfig('careplus');
        }
        if (appConfig) {
          setDisplayName(appConfig.company_name || DEFAULT_DISPLAY_NAME);
          setLogoUrl(appConfig.logo_url || null);
          setPrimaryColor(appConfig.default_theme || null);
          setVerifiedAt(appConfig.verified_at ?? null);
          setWebsiteEnabled(appConfig.website_enabled ?? true);
          setFeatures(appConfig.features ?? {});
          applyBrandToDocument(appConfig.default_theme || null);
          setPublicPharmacyId(appConfig.pharmacy_id);
        } else {
          const pharmacies = await publicStoreApi.listPharmacies();
          const pharmacyId = publicPharmacyId || (pharmacies[0]?.id ?? null);
          if (pharmacyId) {
            const config = await publicStoreApi.getConfig(pharmacyId);
            setDisplayName(config.display_name || DEFAULT_DISPLAY_NAME);
            setLogoUrl(config.logo_url || null);
            setPrimaryColor(config.primary_color || null);
            setVerifiedAt(config.verified_at ?? null);
            setWebsiteEnabled(config.website_enabled ?? true);
            setFeatures(config.feature_flags ?? {});
            applyBrandToDocument(config.primary_color || null);
          } else {
            setDisplayName(DEFAULT_DISPLAY_NAME);
            setLogoUrl(null);
            setPrimaryColor(null);
            setVerifiedAt(null);
            setWebsiteEnabled(true);
            setFeatures({});
            applyBrandToDocument(null);
          }
        }
      }
    } catch {
      setDisplayName(DEFAULT_DISPLAY_NAME);
      setLogoUrl(null);
      setPrimaryColor(null);
      setVerifiedAt(null);
      setWebsiteEnabled(true);
      setFeatures({});
      applyBrandToDocument(null);
    } finally {
      setLoading(false);
    }
  }, [user, publicPharmacyId]);

  useEffect(() => {
    loadBrand();
  }, [loadBrand]);

  const refreshBrand = useCallback(async () => {
    await loadBrand();
  }, [loadBrand]);

  const setPublicPharmacyIdCb = useCallback((id: string | null) => {
    setPublicPharmacyId(id);
  }, []);

  const value: BrandContextValue = {
    displayName,
    logoUrl,
    primaryColor,
    verifiedAt,
    loading,
    publicPharmacyId,
    websiteEnabled,
    features,
    setPublicPharmacyId: setPublicPharmacyIdCb,
    refreshBrand,
  };

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
