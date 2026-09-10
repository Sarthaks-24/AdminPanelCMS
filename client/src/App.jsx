import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Root Redirect to Admin Dashboard */}
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Admin Authentication */}
          <Route path="/admin/login" element={<AdminLogin />} />

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
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
