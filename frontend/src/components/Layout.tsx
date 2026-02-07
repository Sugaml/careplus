import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { isBuyerAllowedPath, ROLE_STAFF } from '@/lib/roles';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  BadgePercent,
  Users,
  ShoppingCart,
  CreditCard,
  FileText,
  Building2,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Activity,
  Pill,
  Megaphone,
  Sun,
  Moon,
  UserCog,
  CalendarDays,
  ClipboardList,
  Menu,
  X,
  Boxes,
  Receipt,
  ListOrdered,
  MessageCircle,
  Tag,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type NavItem = {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

type NavGroupChild = { to: string; labelKey: string };

type NavGroup = {
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  children: NavGroupChild[];
};

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry && Array.isArray((entry as NavGroup).children);
}

const NAV_ENTRIES: NavEntry[] = [
  { to: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
  {
    labelKey: 'nav_product_management',
    icon: Package,
    roles: ['admin', 'manager', 'pharmacist'],
    children: [
      { to: '/manage/products', labelKey: 'nav_products' },
      { to: '/manage/categories', labelKey: 'nav_categories' },
      { to: '/manage/units', labelKey: 'nav_units' },
      { to: '/products', labelKey: 'nav_catalog' },
    ],
  },
  { to: '/manage/team', labelKey: 'nav_team', icon: UserCog, roles: ['admin', 'manager'] },
  { to: '/manage/roster', labelKey: 'nav_duty_roster', icon: CalendarDays, roles: ['admin', 'manager'] },
  { to: '/manage/dailies', labelKey: 'nav_daily_logs', icon: ClipboardList, roles: ['admin', 'manager'] },
  { to: '/manage/memberships', labelKey: 'nav_memberships', icon: BadgePercent, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/manage/customers', labelKey: 'nav_customers', icon: Users, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/inventory', labelKey: 'nav_inventory', icon: Boxes, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/orders', labelKey: 'nav_orders', icon: ShoppingCart },
  { to: '/chat', labelKey: 'nav_chat', icon: MessageCircle, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/billing', labelKey: 'nav_billing', icon: Receipt, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/promo-codes', labelKey: 'nav_promo_codes', icon: Tag, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/announcements', labelKey: 'nav_announcements', icon: Megaphone, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/invoices', labelKey: 'nav_invoices', icon: FileText },
  { to: '/payments', labelKey: 'nav_payments', icon: CreditCard },
  { to: '/statements', labelKey: 'nav_statements', icon: ListOrdered },
  { to: '/promos', labelKey: 'nav_promos', icon: Megaphone, roles: ['admin'] },
  { to: '/activity', labelKey: 'nav_activity', icon: Activity, roles: ['admin'] },
  { to: '/pharmacy', labelKey: 'nav_pharmacy', icon: Building2, roles: ['admin'] },
  { to: '/config', labelKey: 'nav_config', icon: Settings, roles: ['admin'] },
];

/** Sidebar menu for buyers/end users (role "staff"): Dashboard, Catalog, Orders, Chat, Profile. */
const NAV_ENTRIES_BUYER: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav_dashboard', icon: LayoutDashboard },
  { to: '/catalog', labelKey: 'nav_catalog', icon: Package },
  { to: '/orders', labelKey: 'nav_orders', icon: ShoppingCart },
  { to: '/chat', labelKey: 'nav_chat', icon: MessageCircle },
  { to: '/profile', labelKey: 'nav_profile_settings', icon: User },
];

function getVisibleNavEntries(role: string | undefined): NavEntry[] {
  if (!role) return NAV_ENTRIES.filter((e) => !e.roles || e.roles.length === 0);
  if (role === ROLE_STAFF) return NAV_ENTRIES_BUYER;
  return NAV_ENTRIES.filter((e) => !e.roles || e.roles.length === 0 || e.roles.includes(role));
}

function getInitials(name: string, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

const navLinkBase =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150';
const navLinkActive = 'bg-white/20 text-white shadow-sm';
const navLinkInactive = 'text-white/90 hover:bg-white/10 hover:text-white';

export default function Layout() {
  const { user, logout } = useAuth();
  const { displayName, logoUrl } = useBrand();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    setProfileOpen(false);
    setLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutConfirmOpen(false);
    logout();
    navigate('/products');
  };

  return (
    <div className="min-h-screen bg-theme-bg flex">
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={closeSidebar}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-careplus-primary text-theme-text-inverse flex flex-col shrink-0 transform transition-transform duration-200 ease-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2 min-h-[4rem]">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-auto object-contain rounded" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
                <Pill className="w-5 h-5 text-white" />
              </div>
            )}
            <h1 className="font-semibold text-base truncate">{displayName}</h1>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden p-2 -m-2 rounded-lg text-white/80 hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {getVisibleNavEntries(user?.role).map((entry, idx) => {
            if (isNavGroup(entry)) {
              const Icon = entry.icon;
              const pathname = location.pathname;
              const isActive = entry.children.some(
                (c) => c.to === pathname || (c.to !== '/products' && pathname.startsWith(c.to))
              );
              return (
                <div key={entry.labelKey} className="mb-2">
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isActive ? 'bg-white/15' : ''}`}
                  >
                    <Icon className="w-5 h-5 shrink-0 text-white/90" />
                    <span className="text-sm font-medium text-white/95">{t(entry.labelKey)}</span>
                  </div>
                  <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l-2 border-white/20 pl-3">
                    {entry.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={closeSidebar}
                        className={({ isActive: childActive }) =>
                          `block py-2 px-2 rounded-md text-sm transition-colors ${
                            childActive ? 'text-white font-medium bg-white/15' : 'text-white/85 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        {t(child.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }
            const { to, labelKey, icon: Icon } = entry;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `${navLinkBase} mb-1 ${isActive ? navLinkActive : navLinkInactive}`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {t(labelKey)}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar footer: user summary */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold text-white shrink-0 ring-2 ring-white/30">
              {user ? getInitials(user.name, user.email) : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.name || t('user')}</p>
              <p className="text-xs text-white/70 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              closeSidebar();
              setProfileOpen(true);
            }}
            className="mt-2 flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
          >
            <User className="w-4 h-4 shrink-0" />
            {t('nav_profile_settings')}
          </button>
          <button
            type="button"
            onClick={() => {
              closeSidebar();
              handleLogoutClick();
            }}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {t('nav_logout')}
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title={t('logout_title')}
        message={t('logout_message_dashboard')}
        confirmLabel={t('logout_confirm')}
        cancelLabel={t('cancel')}
        variant="default"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-theme-surface border-b border-theme-border flex items-center justify-between px-4 md:px-6 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-xl text-theme-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-1 border border-theme-border rounded-xl p-0.5 bg-theme-bg">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`px-2.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${locale === 'en' ? 'bg-theme-surface text-theme-text shadow-sm' : 'text-theme-muted hover:text-theme-text'}`}
                aria-pressed={locale === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('ne')}
                className={`px-2.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${locale === 'ne' ? 'bg-theme-surface text-theme-text shadow-sm' : 'text-theme-muted hover:text-theme-text'}`}
                aria-pressed={locale === 'ne'}
              >
                नेपाली
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-theme-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-3 pl-2 pr-3 py-2 rounded-xl border border-theme-border bg-theme-bg hover:bg-theme-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-careplus-primary focus:ring-offset-2"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <div className="w-9 h-9 rounded-full bg-careplus-primary text-theme-text-inverse flex items-center justify-center text-sm font-semibold ring-2 ring-theme-border">
                {user ? getInitials(user.name, user.email) : '?'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-theme-text truncate max-w-[140px]">
                  {user?.name || t('user')}
                </p>
                <p className="text-xs text-theme-muted truncate max-w-[140px]">{user?.email}</p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-theme-muted shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {profileOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-theme-border bg-theme-surface shadow-xl py-2 z-50 animate-fade-in"
                role="menu"
              >
                <div className="px-4 py-3 border-b border-theme-border">
                  <p className="text-sm font-semibold text-theme-text truncate">
                    {user?.name || t('user')}
                  </p>
                  <p className="text-xs text-theme-muted truncate mt-0.5">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-theme-text hover:bg-theme-surface-hover transition-colors"
                  role="menuitem"
                >
                  <User className="w-4 h-4 text-careplus-primary shrink-0" />
                  {t('nav_profile_settings')}
                </Link>
                <div className="border-t border-theme-border my-1" />
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-theme-text hover:bg-theme-surface-hover text-left transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 text-theme-muted shrink-0" />
                  {t('nav_log_out')}
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {user?.role === ROLE_STAFF && !isBuyerAllowedPath(location.pathname) ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
