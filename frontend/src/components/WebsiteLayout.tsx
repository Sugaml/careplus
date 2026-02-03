import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Pill, ShoppingCart, LogIn, UserPlus, LayoutDashboard, LogOut, Sun, Moon, Facebook, Instagram, Linkedin } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

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

  const handleLogoutClick = () => setLogoutConfirmOpen(true);

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
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 text-white/95 text-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav_dashboard')}</span>
                </Link>
                {showCart && onCartClick && (
                  <button
                    onClick={onCartClick}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 relative"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('nav_cart')}</span>
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-careplus-secondary text-xs flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </button>
                )}
                <span className="px-2 text-white/80 text-sm truncate max-w-[120px] sm:max-w-[180px]" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 text-white/95 text-sm"
                  title={t('nav_log_out')}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav_logout')}</span>
                </button>
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
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 relative"
                    title={t('login_to_add_to_cart')}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('nav_cart')}</span>
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-careplus-secondary text-xs flex items-center justify-center">
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
