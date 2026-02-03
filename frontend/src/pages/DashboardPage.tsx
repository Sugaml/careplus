import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardApi } from '@/lib/api';
import Loader from '@/components/Loader';
import { Package, ShoppingCart, TrendingUp, RefreshCw, UserCog, CalendarDays, ClipboardList, AlertCircle } from 'lucide-react';
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
    { label: t('dashboard_orders'), value: orders, icon: ShoppingCart, color: 'bg-blue-500' },
    { label: t('products'), value: products, icon: Package, color: 'bg-careplus-primary' },
  ];
  const managerCards = isManager
    ? [
        ...commonCards,
        { label: t('team_pharmacists'), value: pharmacistsCount, icon: UserCog, color: 'bg-violet-500' },
        { label: t('dashboard_today_roster'), value: todayRosterCount, icon: CalendarDays, color: 'bg-amber-500' },
        { label: t('dashboard_today_dailies'), value: todayDailiesCount, icon: ClipboardList, color: 'bg-emerald-500' },
      ]
    : [...commonCards, { label: t('dashboard_overview'), value: '—', icon: TrendingUp, color: 'bg-emerald-500' }];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-text">{t('dashboard')}</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-careplus-primary transition-colors disabled:opacity-50"
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={handleRefresh} className="ml-auto text-sm font-medium underline hover:no-underline">
            {t('refresh')}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {managerCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-theme-surface rounded-xl shadow p-6 flex items-center gap-4 border border-theme-border"
          >
            <div className={`p-3 rounded-lg ${color} text-white`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-theme-muted">{label}</p>
              <p className="text-xl font-semibold text-theme-text">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
