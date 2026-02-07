import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi } from '@/lib/api';
import Loader from '@/components/Loader';
import AnnouncementPopups from '@/components/AnnouncementPopups';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  RefreshCw,
  UserCog,
  CalendarDays,
  ClipboardList,
  AlertCircle,
  ArrowRight,
  Receipt,
  Boxes,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isManager = user?.role === 'manager';

  const [stats, setStats] = useState<{
    orders_count: number;
    products_count: number;
    pharmacists_count: number;
    today_roster_count: number;
    today_dailies_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    if (!refreshing) setLoading(true);
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load dashboard';
      setError(message);
      setStats((prev) => prev ?? { orders_count: 0, products_count: 0, pharmacists_count: 0, today_roster_count: 0, today_dailies_count: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !stats) {
    return <Loader variant="page" message="Loading dashboard…" />;
  }

  const orders = stats?.orders_count ?? 0;
  const products = stats?.products_count ?? 0;
  const pharmacistsCount = stats?.pharmacists_count ?? 0;
  const todayRosterCount = stats?.today_roster_count ?? 0;
  const todayDailiesCount = stats?.today_dailies_count ?? 0;

  const commonCards = [
    { label: t('dashboard_orders'), value: orders, icon: ShoppingCart, to: '/orders', color: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    { label: t('products'), value: products, icon: Package, to: '/manage/products', color: 'from-careplus-primary to-careplus-secondary', iconBg: 'bg-careplus-primary/15 text-careplus-primary' },
  ];
  const managerCards = isManager
    ? [
        ...commonCards,
        { label: t('team_pharmacists'), value: pharmacistsCount, icon: UserCog, to: '/manage/team', color: 'from-violet-500 to-violet-600', iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
        { label: t('dashboard_today_roster'), value: todayRosterCount, icon: CalendarDays, to: '/manage/roster', color: 'from-amber-500 to-amber-600', iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
        { label: t('dashboard_today_dailies'), value: todayDailiesCount, icon: ClipboardList, to: '/manage/dailies', color: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
      ]
    : [
        ...commonCards,
        { label: t('dashboard_overview'), value: '—', icon: TrendingUp, to: '/orders', color: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
      ];

  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || t('user');
  const quickActions = [
    { label: t('dashboard_quick_orders'), to: '/orders', icon: ShoppingCart },
    { label: t('dashboard_quick_products'), to: '/manage/products', icon: Package },
    { label: t('dashboard_quick_billing'), to: '/billing', icon: Receipt },
    { label: t('dashboard_quick_inventory'), to: '/inventory', icon: Boxes },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <AnnouncementPopups />
      {/* Page title + welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-theme-text tracking-tight">
            {t('dashboard')}
          </h1>
          <p className="mt-1 text-theme-muted">
            {t('dashboard_welcome')}, {displayName}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-hover transition-colors disabled:opacity-50 text-sm font-medium"
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {error && (
        <div
          className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-amber-800 dark:text-amber-200"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-sm font-medium underline hover:no-underline"
          >
            {t('refresh')}
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {managerCards.map(({ label, value, icon: Icon, to, iconBg }) => (
          <Link
            key={label}
            to={to}
            className="group bg-theme-surface rounded-2xl border border-theme-border shadow-sm hover:shadow-md hover:border-careplus-primary/30 transition-all duration-200 p-6 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-theme-muted">{label}</p>
              <p className="text-2xl font-bold text-theme-text mt-0.5">{value}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-theme-muted group-hover:text-careplus-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-theme-surface rounded-2xl border border-theme-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-theme-text mb-4">{t('dashboard_quick_actions')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 p-4 rounded-xl border border-theme-border bg-theme-bg hover:bg-theme-surface-hover hover:border-careplus-primary/30 transition-colors"
            >
              <Icon className="w-5 h-5 text-careplus-primary shrink-0" />
              <span className="text-sm font-medium text-theme-text">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
