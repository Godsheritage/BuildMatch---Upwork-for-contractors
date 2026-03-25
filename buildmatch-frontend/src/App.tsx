import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ContractorsPage } from './pages/ContractorsPage';
import { ContractorProfilePage } from './pages/ContractorProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { PostJobPage } from './pages/PostJobPage';
import { JobDetailPage } from './pages/JobDetailPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
            <Route path="/contractors/:id" element={<ContractorProfilePage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/post-job"
              element={
                <ProtectedRoute>
                  <PostJobPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
