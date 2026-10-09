import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Admin CMS pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardHome from './pages/admin/DashboardHome';
import ProfileEditor from './pages/admin/ProfileEditor';
import SocialsManager from './pages/admin/SocialsManager';
import SkillsMatrix from './pages/admin/SkillsMatrix';
import ProjectList from './pages/admin/ProjectList';
import ProjectForm from './pages/admin/ProjectForm';
import ExperienceList from './pages/admin/ExperienceList';
import EducationManager from './pages/admin/EducationManager';
import CertificationsManager from './pages/admin/CertificationsManager';
import ResumeManager from './pages/admin/ResumeManager';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AppsPage from './pages/admin/AppsPage';
import AppEditorPage from './pages/admin/AppEditorPage';
import AccountSettings from './pages/admin/AccountSettings';
import SuperadminPanel from './pages/admin/SuperadminPanel';
import Signup from './pages/auth/Signup';
import CheckEmail from './pages/auth/CheckEmail';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import LegalPreview from './pages/auth/LegalPreview';

import NotFound from './pages/NotFound';
import { ToastProvider } from './components/admin/Toast';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Root Redirect to Admin Dashboard */}
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

            {/* Admin Authentication */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/signup" element={<Signup />} />
            <Route path="/admin/check-email" element={<CheckEmail />} />
            <Route path="/admin/verify-email" element={<VerifyEmail />} />
            <Route path="/admin/forgot-password" element={<ForgotPassword />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/legal/terms" element={<LegalPreview />} />
            <Route path="/legal/privacy" element={<LegalPreview />} />

            {/* Admin CMS Protected Routes */}
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
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
