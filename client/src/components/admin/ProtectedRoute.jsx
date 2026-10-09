import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div role="status" aria-label="Checking your session" className="flex min-h-screen bg-t-bg">
        <div className="hidden w-64 shrink-0 space-y-3 border-r border-t-border bg-t-surface p-4 md:block">
          <div className="skeleton h-10 w-full" />
          {Array.from({ length: 7 }, (_, index) => <div key={index} className="skeleton h-8 w-full" />)}
        </div>
        <div className="flex-1 space-y-4 p-8">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-4 w-80 max-w-full" />
          <div className="grid gap-4 pt-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton h-28" />)}</div>
          <div className="skeleton h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
