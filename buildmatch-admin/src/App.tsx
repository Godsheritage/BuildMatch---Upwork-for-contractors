import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AdminRoute } from './components/admin/AdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminOverviewPage }  from './pages/admin/AdminOverviewPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage';
import { AdminContractorsPage } from './pages/admin/AdminContractorsPage';
import { AdminJobsPage } from './pages/admin/AdminJobsPage';
import { AdminJobDetailPage } from './pages/admin/AdminJobDetailPage';
import { AdminDisputesPage } from './pages/admin/AdminDisputesPage';
import { AdminDisputeDetailPage } from './pages/admin/AdminDisputeDetailPage';
import { AdminFinancePage } from './pages/admin/AdminFinancePage';
import { AdminModerationPage } from './pages/admin/AdminModerationPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminHealthPage } from './pages/admin/AdminHealthPage';
import { AdminAuditLogPage } from './pages/admin/AdminAuditLogPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminFeatureFlagsPage } from './pages/admin/AdminFeatureFlagsPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Admin portal — ADMIN role only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index                        element={<AdminOverviewPage />} />
                  <Route path="users"                 element={<AdminUsersPage />} />
                  <Route path="users/:userId"         element={<AdminUserDetailPage />} />
                  <Route path="contractors"           element={<AdminContractorsPage />} />
                  <Route path="jobs"                  element={<AdminJobsPage />} />
                  <Route path="jobs/:jobId"           element={<AdminJobDetailPage />} />
                  <Route path="disputes"              element={<AdminDisputesPage />} />
                  <Route path="disputes/:id"          element={<AdminDisputeDetailPage />} />
                  <Route path="finance"               element={<AdminFinancePage />} />
                  <Route path="moderation"            element={<AdminModerationPage />} />
                  <Route path="reviews"               element={<AdminReviewsPage />} />
                  <Route path="analytics"             element={<AdminAnalyticsPage />} />
                  <Route path="health"                element={<AdminHealthPage />} />
                  <Route path="audit"                 element={<AdminAuditLogPage />} />
                  <Route path="settings"              element={<AdminSettingsPage />} />
                  <Route path="flags"                 element={<AdminFeatureFlagsPage />} />
                </Route>
              </Route>

              {/* Redirect root to admin */}
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
