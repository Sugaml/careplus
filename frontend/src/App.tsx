import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BrandProvider } from '@/contexts/BrandContext';
import { CartProvider } from '@/contexts/CartContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import TermsPage from '@/pages/TermsPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import ProductsExplorePage from '@/pages/ProductsExplorePage';
import DashboardPage from '@/pages/DashboardPage';
import ProductsPage from '@/pages/ProductsPage';
import OrdersPage from '@/pages/OrdersPage';
import BillingPage from '@/pages/BillingPage';
import InvoicesPage from '@/pages/InvoicesPage';
import InvoiceDetailPage from '@/pages/InvoiceDetailPage';
import PaymentsPage from '@/pages/PaymentsPage';
import StatementsPage from '@/pages/StatementsPage';
import PharmacyPage from '@/pages/PharmacyPage';
import ConfigPage from '@/pages/ConfigPage';
import ActivityPage from '@/pages/ActivityPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfileSettingsPage from '@/pages/ProfileSettingsPage';
import CategoriesPage from '@/pages/CategoriesPage';
import ProductUnitsPage from '@/pages/ProductUnitsPage';
import MembershipsPage from '@/pages/MembershipsPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import PromosPage from '@/pages/PromosPage';
import CustomersPage from '@/pages/CustomersPage';
import TeamPage from '@/pages/TeamPage';
import TeamMemberViewPage from '@/pages/TeamMemberViewPage';
import DutyRosterPage from '@/pages/DutyRosterPage';
import DailyLogsPage from '@/pages/DailyLogsPage';
import InventoryPage from '@/pages/InventoryPage';

/** Roles that can access the dashboard layout (admin/manager/pharmacist). Everyone else is treated as buyer/end user and sent to /products. */
const STAFF_DASHBOARD_ROLES = ['admin', 'manager', 'pharmacist'];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  if (loading) {
    return <Loader variant="fullPage" message={t('checking_auth')} />;
  }
  if (!user) {
    // Buyers see the products page without login when visiting root
    if (location.pathname === '/') {
      return <Navigate to="/products" replace />;
    }
    const returnTo = encodeURIComponent(location.pathname || '/products');
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // Buyers/end users (e.g. staff role) always go to /products; only staff dashboard roles see the sidebar/dashboard
  const canAccessDashboard = STAFF_DASHBOARD_ROLES.includes(user.role);
  if (!canAccessDashboard) {
    return <Navigate to="/products" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/products" element={<ProductsExplorePage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/products" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="manage/products" element={<ProductsPage />} />
        <Route path="manage/categories" element={<CategoriesPage />} />
        <Route path="manage/units" element={<ProductUnitsPage />} />
        <Route path="manage/memberships" element={<MembershipsPage />} />
        <Route path="manage/customers" element={<CustomersPage />} />
        <Route path="manage/team" element={<TeamPage />} />
        <Route path="manage/team/:id" element={<TeamMemberViewPage />} />
        <Route path="manage/roster" element={<DutyRosterPage />} />
        <Route path="manage/dailies" element={<DailyLogsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="statements" element={<StatementsPage />} />
        <Route path="promos" element={<PromosPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="pharmacy" element={<PharmacyPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
      </Route>
      <Route path="/store" element={<Navigate to="/products" replace />} />
      <Route path="*" element={<Navigate to="/products" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <BrandProvider>
              <CartProvider>
                <AppRoutes />
              </CartProvider>
            </BrandProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
