import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { RegistrationSuccessPage } from './pages/RegistrationSuccessPage';
import { JobRoleSelectionPage } from './pages/JobRoleSelectionPage';
import { VerifyPage } from './pages/VerifyPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { EmailVerifiedSuccessPage } from './pages/EmailVerifiedSuccessPage';
import { ExpiredPage } from './pages/ExpiredPage';
import { ReadyPage } from './pages/ReadyPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { ThankYouPage } from './pages/ThankYouPage';
import { CandidateLoginPage } from './pages/CandidateLoginPage';
import { CandidateDashboardPage } from './pages/CandidateDashboardPage';
import { AdminLoginPage } from './pages/admin/LoginPage';
import { JobRolesPage } from './pages/admin/JobRolesPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { CandidatesPage } from './pages/admin/CandidatesPage';
import { CandidateDetailPage } from './pages/admin/CandidateDetailPage';
import { QuestionsPage } from './pages/admin/QuestionsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AccessDeniedPage } from './pages/admin/AccessDeniedPage';
import { AdminRoute, SuperAdminRoute } from './components/guards/AdminRoute';
import { VisitorTracker } from './components/VisitorTracker';
import { MarketingAnalyticsPage } from './pages/admin/MarketingAnalyticsPage';
import { getCandidateToken } from './api/client';

function CandidateGuard({ children }: { children: React.ReactNode }) {
  const token = getCandidateToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <VisitorTracker />
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<CandidateLoginPage />} />
      <Route path="/dashboard" element={<Navigate to="/portal/dashboard" replace />} />
      <Route path="/portal/dashboard" element={<CandidateGuard><CandidateDashboardPage /></CandidateGuard>} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/registration-success" element={<RegistrationSuccessPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/email-verified-success" element={<EmailVerifiedSuccessPage />} />
      <Route path="/expired" element={<ExpiredPage />} />
      <Route path="/ready" element={<ReadyPage />} />
      <Route path="/select-role" element={<JobRoleSelectionPage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="/thank-you" element={<ThankYouPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/access-denied" element={<AdminRoute><AccessDeniedPage /></AdminRoute>} />
      <Route path="/admin/dashboard" element={<AdminRoute permission="view_dashboard"><DashboardPage /></AdminRoute>} />
      <Route path="/admin/candidates" element={<AdminRoute permission="view_candidates"><CandidatesPage /></AdminRoute>} />
      <Route path="/admin/job-roles" element={<AdminRoute permission="view_job_roles"><JobRolesPage /></AdminRoute>} />
      <Route path="/admin/candidates/:id" element={<AdminRoute permission="view_candidates"><CandidateDetailPage /></AdminRoute>} />
      <Route path="/admin/questions" element={<AdminRoute permission="manage_questions"><QuestionsPage /></AdminRoute>} />
      <Route path="/admin/users" element={<SuperAdminRoute><AdminUsersPage /></SuperAdminRoute>} />
      <Route path="/admin/settings" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/analytics" element={<SuperAdminRoute><MarketingAnalyticsPage /></SuperAdminRoute>} />
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
    </>
  );
}
