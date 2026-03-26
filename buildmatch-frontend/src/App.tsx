import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
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
import { JobDetailPage } from './pages/JobDetailPage';
import { ProfileSetupPage } from './pages/ProfileSetupPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/contractors" element={<ContractorsPage />} />
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
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
