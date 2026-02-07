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
import ReturnRefundPolicyPage from '@/pages/ReturnRefundPolicyPage';
import ProductsExplorePage from '@/pages/ProductsExplorePage';
import DashboardPage from '@/pages/DashboardPage';
import ProductsPage from '@/pages/ProductsPage';
import OrdersPage from '@/pages/OrdersPage';
import BillingPage from '@/pages/BillingPage';
import InvoicesPage from '@/pages/InvoicesPage';
import InvoiceDetailPage from '@/pages/InvoiceDetailPage';
import PaymentsPage from '@/pages/PaymentsPage';
import StatementsPage from '@/pages/StatementsPage';
import CompaniesPage from '@/pages/CompaniesPage';
import ConfigPage from '@/pages/ConfigPage';
import ActivityPage from '@/pages/ActivityPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfileSettingsPage from '@/pages/ProfileSettingsPage';
import CategoriesPage from '@/pages/CategoriesPage';
import ProductUnitsPage from '@/pages/ProductUnitsPage';
import MembershipsPage from '@/pages/MembershipsPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import PromosPage from '@/pages/PromosPage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import PromoCodesPage from '@/pages/PromoCodesPage';
import CustomersPage from '@/pages/CustomersPage';
import TeamPage from '@/pages/TeamPage';
import TeamMemberViewPage from '@/pages/TeamMemberViewPage';
import DutyRosterPage from '@/pages/DutyRosterPage';
import DailyLogsPage from '@/pages/DailyLogsPage';
import InventoryPage from '@/pages/InventoryPage';
import ChatPage from '@/pages/ChatPage';
import CustomerChatEntryPage from '@/pages/CustomerChatEntryPage';
import { STAFF_DASHBOARD_ROLES } from '@/lib/roles';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  if (loading) {
    return <Loader variant="fullPage" message={t('checking_auth')} />;
  }
  if (!user) {
    if (location.pathname === '/') {
      return <Navigate to="/products" replace />;
    }
    const returnTo = encodeURIComponent(location.pathname || '/products');
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  // All logged-in users (including buyers/staff) get the Layout with a role-appropriate sidebar
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/return-refund" element={<ReturnRefundPolicyPage />} />
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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="catalog" element={<ProductsExplorePage embedded />} />
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
        <Route path="chat" element={<ChatPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="promo-codes" element={<PromoCodesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="statements" element={<StatementsPage />} />
        <Route path="promos" element={<PromosPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="manage/companies" element={<CompaniesPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
      </Route>
      <Route path="/store" element={<Navigate to="/products" replace />} />
      <Route path="/customer-chat" element={<CustomerChatEntryPage />} />
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
