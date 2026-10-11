import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/admin/Toast';
import ProtectedRoute from './components/admin/ProtectedRoute';
import RouteErrorBoundary from './components/admin/RouteErrorBoundary';
import { SITE } from './content/site';

// Every page is its own chunk. A visitor who only reads the landing page never downloads the
// dashboard, and a signed-in owner never downloads the docs' inlined Markdown.
const Landing = lazy(() => import('./pages/public/Landing'));
const DocsIndex = lazy(() => import('./pages/public/DocsIndex'));
const DocPage = lazy(() => import('./pages/public/DocPage'));
const LicensePage = lazy(() => import('./pages/public/LicensePage'));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const CheckEmail = lazy(() => import('./pages/auth/CheckEmail'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const LegalPreview = lazy(() => import('./pages/auth/LegalPreview'));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const DashboardHome = lazy(() => import('./pages/admin/DashboardHome'));
const ProfileEditor = lazy(() => import('./pages/admin/ProfileEditor'));
const SocialsManager = lazy(() => import('./pages/admin/SocialsManager'));
const SkillsMatrix = lazy(() => import('./pages/admin/SkillsMatrix'));
const ProjectList = lazy(() => import('./pages/admin/ProjectList'));
const ProjectForm = lazy(() => import('./pages/admin/ProjectForm'));
const ExperienceList = lazy(() => import('./pages/admin/ExperienceList'));
const EducationManager = lazy(() => import('./pages/admin/EducationManager'));
const CertificationsManager = lazy(() => import('./pages/admin/CertificationsManager'));
const ResumeManager = lazy(() => import('./pages/admin/ResumeManager'));
const AppsPage = lazy(() => import('./pages/admin/AppsPage'));
const AppEditorPage = lazy(() => import('./pages/admin/AppEditorPage'));
const AccountSettings = lazy(() => import('./pages/admin/AccountSettings'));
const SuperadminPanel = lazy(() => import('./pages/admin/SuperadminPanel'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Shown while a chunk is in flight: the wordmark on the page background, so a slow network never looks blank.
function RouteFallback() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-dvh place-items-center bg-t-bg">
      <span className="font-display text-lg font-semibold tracking-tight text-t-muted">{SITE.name}</span>
    </div>
  );
}

// Keyed by path, so a later navigation remounts the boundary and clears a caught error.
function BoundaryWithLocation({ children }) {
  const location = useLocation();
  return <RouteErrorBoundary key={location.pathname}>{children}</RouteErrorBoundary>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <BoundaryWithLocation>
          <Routes>
            {/* Public pages */}
            <Route path="/" element={<Landing />} />
            <Route path="/docs" element={<DocsIndex />} />
            <Route path="/docs/:slug" element={<DocPage />} />
            <Route path="/license" element={<LicensePage />} />

            {/* Account creation and sign-in. The short paths are the ones we print; the /admin ones stay valid. */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/signup" element={<Signup />} />
            <Route path="/admin/check-email" element={<CheckEmail />} />
            <Route path="/admin/verify-email" element={<VerifyEmail />} />
            <Route path="/admin/forgot-password" element={<ForgotPassword />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/legal/terms" element={<LegalPreview />} />
            <Route path="/legal/privacy" element={<LegalPreview />} />

            {/* Dashboard */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardHome />} />
              <Route path="profile" element={<ProfileEditor />} />
              <Route path="socials" element={<SocialsManager />} />
              <Route path="skills" element={<SkillsMatrix />} />
              <Route path="projects" element={<ProjectList />} />
              <Route path="projects/new" element={<ProjectForm />} />
              <Route path="projects/edit/:id" element={<ProjectForm />} />
              <Route path="experience" element={<ExperienceList />} />
              <Route path="education" element={<EducationManager />} />
              <Route path="certifications" element={<CertificationsManager />} />
              <Route path="resume" element={<ResumeManager />} />
              <Route path="apps" element={<AppsPage />} />
              <Route path="apps/:id" element={<AppEditorPage />} />
              <Route path="account" element={<AccountSettings />} />
              <Route path="superadmin" element={<SuperadminPanel />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BoundaryWithLocation>
          </Suspense>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
