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
import { MyBidsPage } from './pages/MyBidsPage';
import { BrowseJobsPage } from './pages/BrowseJobsPage';
import { SettingsPage } from './pages/SettingsPage';
import { MessagesPage } from './pages/MessagesPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/contractors/:id" element={<ContractorProfilePage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />

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
                <Route path="/dashboard/settings" element={<SettingsPage />} />
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
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
