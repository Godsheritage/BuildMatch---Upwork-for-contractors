import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ContractorsPage } from './pages/ContractorsPage';
import { ContractorProfilePage } from './pages/ContractorProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { PostJobPage } from './pages/PostJobPage';
import { InvestorJobsPage } from './pages/InvestorJobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { TermsPage } from './pages/TermsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { OnboardCompletePage } from './pages/OnboardCompletePage';
import { OnboardRefreshPage } from './pages/OnboardRefreshPage';
import { FundJobPage } from './pages/FundJobPage';
import { DrawSchedulePage } from './pages/DrawSchedulePage';
import { MyBidsPage } from './pages/MyBidsPage';
import { BrowseJobsPage } from './pages/BrowseJobsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsPersonalPage } from './pages/SettingsPersonalPage';
import { SettingsSecurityPage } from './pages/SettingsSecurityPage';
import { SettingsNotificationsPage } from './pages/SettingsNotificationsPage';
import { SettingsVerificationPage } from './pages/SettingsVerificationPage';
import { SettingsBillingPage } from './pages/SettingsBillingPage';
import { IdVerificationStartPage } from './pages/IdVerificationStartPage';
import { MobileIdVerificationPage } from './pages/MobileIdVerificationPage';
import { ProfileEditPage } from './pages/ProfileEditPage';
import { TestimonialSubmitPage } from './pages/TestimonialSubmitPage';
import { AboutPage } from './pages/AboutPage';
import { MessagesPage } from './pages/MessagesPage';
import { ContractReviewPage } from './pages/ContractReviewPage';
import { SavedContractorsProvider } from './context/SavedContractorsContext';
import { BugReportProvider } from './context/BugReportContext';
import { ScopeEstimatorPage } from './pages/ScopeEstimatorPage';
import { SavedContractorsPage } from './pages/SavedContractorsPage';
import { DisputesListPage } from './pages/settings/DisputesListPage';
import { DisputeDetailPage } from './pages/settings/DisputeDetailPage';
import { FileDisputePage } from './pages/settings/FileDisputePage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRoute } from './components/admin/AdminRoute';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminOverviewPage }  from './pages/admin/AdminOverviewPage';
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
import { AdminTestimonialsPage } from './pages/admin/AdminTestimonialsPage'

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <SavedContractorsProvider>
          <BugReportProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email"   element={<VerifyEmailPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contractors/:id" element={<ContractorProfilePage />} />
              <Route path="/testimonials/:token" element={<TestimonialSubmitPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/verify-id/m/:token" element={<MobileIdVerificationPage />} />

              {/* Contract review — protected, party-only access enforced in page */}
              <Route
                path="/contracts/:contractId"
                element={
                  <ProtectedRoute>
                    <ContractReviewPage />
                  </ProtectedRoute>
                }
              />

              {/* Standalone dispute routes — accessible from public pages, no layout sidebars */}
              <Route
                path="/settings/disputes"
                element={<ProtectedRoute><DisputesListPage /></ProtectedRoute>}
              />
              <Route
                path="/settings/disputes/new"
                element={<ProtectedRoute><FileDisputePage /></ProtectedRoute>}
              />
              <Route
                path="/settings/disputes/:disputeId"
                element={<ProtectedRoute><DisputeDetailPage /></ProtectedRoute>}
              />

              {/* Admin portal — ADMIN role only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index                          element={<AdminOverviewPage />} />
                  <Route path="users"                   element={<AdminUsersPage />} />
                  <Route path="users/:userId"           element={<AdminUserDetailPage />} />
                  <Route path="contractors"             element={<AdminContractorsPage />} />
                  <Route path="jobs"                    element={<AdminJobsPage />} />
                  <Route path="jobs/:jobId"             element={<AdminJobDetailPage />} />
                  <Route path="disputes"                element={<AdminDisputesPage />} />
                  <Route path="disputes/:id"            element={<AdminDisputeDetailPage />} />
                  <Route path="finance"                 element={<AdminFinancePage />} />
                  <Route path="moderation"              element={<AdminModerationPage />} />
                  <Route path="reviews"                 element={<AdminReviewsPage />} />
                  <Route path="analytics"               element={<AdminAnalyticsPage />} />
                  <Route path="health"                  element={<AdminHealthPage />} />
                  <Route path="audit"                   element={<AdminAuditLogPage />} />
                  <Route path="settings"                element={<AdminSettingsPage />} />
                  <Route path="flags"                   element={<AdminFeatureFlagsPage />} />
                  <Route path="testimonials"            element={<AdminTestimonialsPage />} />
                </Route>
              </Route>

              {/* Protected dashboard shell — all nested pages rendered via Outlet */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/dashboard/profile" element={<UserProfilePage />} />
                <Route path="/dashboard/profile/edit" element={<ProfileEditPage />} />
                <Route path="/dashboard/settings"              element={<SettingsPage />} />
                <Route path="/dashboard/settings/personal"     element={<SettingsPersonalPage />} />
                <Route path="/dashboard/settings/security"     element={<SettingsSecurityPage />} />
                <Route path="/dashboard/settings/notifications" element={<SettingsNotificationsPage />} />
                <Route path="/dashboard/settings/verification" element={<SettingsVerificationPage />} />
                <Route path="/dashboard/settings/billing"      element={<SettingsBillingPage />} />
                <Route path="/dashboard/settings/verification/id" element={<IdVerificationStartPage />} />
                {/* Disputes — inside DashboardLayout but no settings sidebar */}
                <Route path="/dashboard/settings/disputes"              element={<DisputesListPage />} />
                <Route path="/dashboard/settings/disputes/new"          element={<FileDisputePage />} />
                <Route path="/dashboard/settings/disputes/:disputeId"   element={<DisputeDetailPage />} />
                <Route path="/dashboard/messages" element={<MessagesPage />} />
                <Route path="/dashboard/messages/:conversationId" element={<MessagesPage />} />
                <Route
                  path="/dashboard/my-bids"
                  element={
                    <ProtectedRoute roles={['CONTRACTOR']}>
                      <MyBidsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/browse-jobs"
                  element={
                    <ProtectedRoute roles={['CONTRACTOR']}>
                      <BrowseJobsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/contractors" element={<ContractorsPage />} />
                <Route
                  path="/dashboard/jobs"
                  element={
                    <ProtectedRoute roles={['INVESTOR']}>
                      <InvestorJobsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/post-job"
                  element={
                    <ProtectedRoute roles={['INVESTOR']}>
                      <PostJobPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/scope-estimator"
                  element={
                    <ProtectedRoute roles={['INVESTOR']}>
                      <ScopeEstimatorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/saved"
                  element={
                    <ProtectedRoute roles={['INVESTOR']}>
                      <SavedContractorsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/profile/setup"
                  element={
                    <ProtectedRoute roles={['CONTRACTOR']}>
                      <ProfileSetupPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/payments"
                  element={
                    <ProtectedRoute roles={['CONTRACTOR']}>
                      <PaymentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/payments/onboard/complete"
                  element={
                    <ProtectedRoute roles={['CONTRACTOR']}>
                      <OnboardCompletePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/payments/onboard/refresh"
                  element={
                    <ProtectedRoute roles={['CONTRACTOR']}>
                      <OnboardRefreshPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/jobs/:jobId/fund"
                  element={
                    <ProtectedRoute roles={['INVESTOR']}>
                      <FundJobPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/jobs/:jobId/draw-schedule"
                  element={
                    <ProtectedRoute>
                      <DrawSchedulePage />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
          </BugReportProvider>
          </SavedContractorsProvider>
        </ToastProvider>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
