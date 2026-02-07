import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Pill, ShoppingCart, LogIn, UserPlus, LayoutDashboard, LogOut, Sun, Moon, Facebook, Instagram, Linkedin, User, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { DASHBOARD_ROLES } from '@/lib/roles';

function getInitials(name: string, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

interface WebsiteLayoutProps {
  children: React.ReactNode;
  /** Optional: show cart button in header (e.g. on products page) */
  showCart?: boolean;
  onCartClick?: () => void;
  cartCount?: number;
}

export default function WebsiteLayout({ children, showCart, onCartClick, cartCount = 0 }: WebsiteLayoutProps) {
  const { user, logout } = useAuth();
  const { displayName, logoUrl, verifiedAt } = useBrand();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const navigate = useNavigate();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
    <div className="min-h-screen bg-theme-bg flex flex-col">
      <header className="bg-careplus-primary text-theme-text-inverse shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/products" className="flex items-center gap-2 font-semibold text-lg hover:opacity-90">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
            ) : (
              <Pill className="w-8 h-8 shrink-0" />
            )}
            <span className="truncate">{displayName}</span>
            {verifiedAt && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/20 text-white" title="Verified pharmacy">
                Verified
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4">
            <div className="flex items-center gap-1 border border-white/30 rounded-lg p-0.5 mr-2">
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${locale === 'en' ? 'bg-white text-careplus-primary' : 'text-white/90 hover:bg-white/10'}`}
                aria-pressed={locale === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('ne')}
                className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${locale === 'ne' ? 'bg-white text-careplus-primary' : 'text-white/90 hover:bg-white/10'}`}
                aria-pressed={locale === 'ne'}
              >
                नेपाली
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link
              to="/products"
              className="px-3 py-2 rounded-lg hover:bg-white/10 text-white/95 font-medium"
            >
              {t('nav_products')}
            </Link>
            {user ? (
              <>
                {DASHBOARD_ROLES.includes(user.role) && (
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 text-white/95 text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('nav_dashboard')}</span>
                  </Link>
                )}
                {showCart && onCartClick && (
                  <button
                    onClick={onCartClick}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 hover:scale-105 active:scale-95 relative transition-transform duration-200"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('nav_cart')}</span>
                    {cartCount > 0 && (
                      <span key={cartCount} className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-careplus-secondary text-xs flex items-center justify-center font-semibold animate-bounce-in">
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((o) => !o)}
                    className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
                    aria-expanded={profileOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold text-white ring-2 ring-white/30">
                      {getInitials(user.name, user.email)}
                    </div>
                    <span className="hidden sm:block text-white/95 text-sm font-medium truncate max-w-[100px]">{user.name || user.email}</span>
                    <ChevronDown className={`w-4 h-4 text-white/80 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-theme-border bg-theme-surface shadow-xl py-2 z-50 animate-fade-in" role="menu">
                      <div className="px-4 py-2.5 border-b border-theme-border">
                        <p className="text-sm font-semibold text-theme-text truncate">{user.name || t('user')}</p>
                        <p className="text-xs text-theme-muted truncate mt-0.5">{user.email}</p>
                      </div>
                      {DASHBOARD_ROLES.includes(user.role) && (
                        <>
                          <Link
                            to="/dashboard"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-theme-text hover:bg-theme-surface-hover"
                            role="menuitem"
                          >
                            <LayoutDashboard className="w-4 h-4 text-careplus-primary shrink-0" />
                            {t('nav_dashboard')}
                          </Link>
                          <Link
                            to="/profile"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-theme-text hover:bg-theme-surface-hover"
                            role="menuitem"
                          >
                            <User className="w-4 h-4 text-careplus-primary shrink-0" />
                            {t('nav_profile_settings')}
                          </Link>
                          <div className="border-t border-theme-border my-1" />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handleLogoutClick}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-theme-text hover:bg-theme-surface-hover text-left"
                        role="menuitem"
                      >
                        <LogOut className="w-4 h-4 text-theme-muted shrink-0" />
                        {t('nav_log_out')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium"
                >
                  <UserPlus className="w-4 h-4" />
                  {t('nav_register')}
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium"
                >
                  <LogIn className="w-4 h-4" />
                  {t('nav_login')}
                </Link>
                {showCart && onCartClick && (
                  <button
                    onClick={onCartClick}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 hover:scale-105 active:scale-95 relative transition-transform duration-200"
                    title={t('login_to_add_to_cart')}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('nav_cart')}</span>
                    {cartCount > 0 && (
                      <span key={cartCount} className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-careplus-secondary text-xs flex items-center justify-center font-semibold animate-bounce-in">
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title={t('logout_title')}
        message={t('logout_message_store')}
        confirmLabel={t('logout_confirm')}
        cancelLabel={t('cancel')}
        variant="default"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      <footer className="bg-theme-bg-elevated text-theme-text-secondary py-8 mt-auto border-t border-theme-border">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-6 w-auto object-contain brightness-0 invert opacity-90" />
            ) : (
              <Pill className="w-6 h-6 text-careplus-primary" />
            )}
            <span className="font-semibold text-theme-text">{displayName}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/products" className="hover:text-theme-text transition-colors">
              {t('nav_products')}
            </Link>
            {!user && (
              <>
                <Link to="/register" className="hover:text-theme-text transition-colors">
                  {t('nav_register')}
                </Link>
                <Link to="/login" className="hover:text-theme-text transition-colors">
                  {t('nav_login')}
                </Link>
              </>
            )}
            <Link to="/terms" className="hover:text-theme-text transition-colors">
              {t('auth_terms_and_conditions')}
            </Link>
            <Link to="/privacy" className="hover:text-theme-text transition-colors">
              {t('auth_privacy_policy')}
            </Link>
            <Link to="/return-refund" className="hover:text-theme-text transition-colors">
              {t('return_refund_title')}
            </Link>
            <div className="flex items-center gap-3" aria-label="Social media">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-theme-text-secondary hover:text-careplus-primary hover:bg-theme-bg transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-theme-text-secondary hover:text-careplus-primary hover:bg-theme-bg transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-theme-text-secondary hover:text-careplus-primary hover:bg-theme-bg transition-colors"
                aria-label="TikTok"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-theme-text-secondary hover:text-careplus-primary hover:bg-theme-bg transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pt-4 mt-4 border-t border-theme-border text-center text-sm text-theme-muted">
          {t('footer_rights', { year: String(new Date().getFullYear()) })}
        </div>
      </footer>
    </div>
  );
}
