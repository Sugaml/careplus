import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { LayoutDashboard, Package, FolderTree, BadgePercent, Users, ShoppingCart, CreditCard, FileText, Building2, Settings, LogOut, User, ChevronDown, Activity, Pill, Megaphone, Sun, Moon, UserCog, CalendarDays, ClipboardList, Menu, X, Boxes, Receipt, ListOrdered } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type NavItem = {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles that can see this item. Empty/undefined = all roles. */
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
  { to: '/billing', labelKey: 'nav_billing', icon: Receipt, roles: ['admin', 'manager', 'pharmacist'] },
  { to: '/invoices', labelKey: 'nav_invoices', icon: FileText },
  { to: '/payments', labelKey: 'nav_payments', icon: CreditCard },
  { to: '/statements', labelKey: 'nav_statements', icon: ListOrdered },
  { to: '/promos', labelKey: 'nav_promos', icon: Megaphone, roles: ['admin'] },
  { to: '/activity', labelKey: 'nav_activity', icon: Activity, roles: ['admin'] },
  { to: '/pharmacy', labelKey: 'nav_pharmacy', icon: Building2, roles: ['admin'] },
  { to: '/config', labelKey: 'nav_config', icon: Settings, roles: ['admin'] },
];

/**
 * Returns sidebar menu entries visible for the given role.
 */
function getVisibleNavEntries(role: string | undefined): NavEntry[] {
  if (!role) return NAV_ENTRIES.filter((e) => !e.roles || e.roles.length === 0);
  return NAV_ENTRIES.filter(
    (e) => !e.roles || e.roles.length === 0 || e.roles.includes(role)
  );
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
      {/* Backdrop for mobile when sidebar is open */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={closeSidebar}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 bg-careplus-primary text-theme-text-inverse flex flex-col shrink-0 transform transition-transform duration-200 ease-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b border-careplus-secondary flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
            ) : (
              <Pill className="w-8 h-8 shrink-0" />
            )}
            <h1 className="font-semibold text-lg truncate">{displayName}</h1>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden p-2 -m-2 rounded-lg text-theme-text-inverse hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {getVisibleNavEntries(user?.role).map((entry, idx) => {
            if (isNavGroup(entry)) {
              const Icon = entry.icon;
              const pathname = location.pathname;
              const isActive = entry.children.some((c) => c.to === pathname || (c.to !== '/products' && pathname.startsWith(c.to)));
              return (
                <div key={entry.labelKey} className="mb-1">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                      isActive ? 'bg-careplus-secondary/80' : ''
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">{t(entry.labelKey)}</span>
                  </div>
                  <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/20 pl-2">
                    {entry.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={closeSidebar}
                        className={({ isActive: childActive }) =>
                          `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${
                            childActive ? 'bg-careplus-secondary' : 'hover:bg-careplus-secondary/80'
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
                  `flex items-center gap-2 px-3 py-2 rounded-md mb-1 ${
                    isActive ? 'bg-careplus-secondary' : 'hover:bg-careplus-secondary/80'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {t(labelKey)}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-2 border-t border-careplus-secondary">
          <div className="px-3 py-2 text-sm text-white/90 truncate">{user?.email}</div>
          <button
            type="button"
            onClick={() => { closeSidebar(); handleLogoutClick(); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-careplus-secondary/80 text-left"
          >
            <LogOut className="w-5 h-5" />
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-theme-surface border-b border-theme-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-1 border border-theme-border rounded-lg p-0.5 bg-theme-bg">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${locale === 'en' ? 'bg-theme-surface text-theme-text shadow-sm' : 'text-theme-muted hover:text-theme-text'}`}
                aria-pressed={locale === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('ne')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${locale === 'ne' ? 'bg-theme-surface text-theme-text shadow-sm' : 'text-theme-muted hover:text-theme-text'}`}
                aria-pressed={locale === 'ne'}
              >
                नेपाली
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-theme-muted hover:bg-theme-surface-hover hover:text-theme-text transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 p-1.5 pr-2 rounded-lg text-theme-text hover:bg-theme-surface-hover transition-colors"
              aria-expanded={profileOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-careplus-primary text-theme-text-inverse flex items-center justify-center text-sm font-medium">
                {user ? getInitials(user.name, user.email) : '?'}
              </div>
              <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-theme-border bg-theme-surface shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b border-theme-border-subtle">
                  <p className="text-sm font-medium text-theme-text truncate">{user?.name || t('user')}</p>
                  <p className="text-xs text-theme-muted truncate">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-theme-text hover:bg-theme-surface-hover"
                >
                  <User className="w-4 h-4" />
                  {t('nav_profile_settings')}
                </Link>
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-theme-text hover:bg-theme-surface-hover text-left"
                >
                  <LogOut className="w-4 h-4" />
                  {t('nav_log_out')}
                </button>
              </div>
            )}
          </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
