import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { legacyAdminTarget } from '../../lib/routes';

// Every old /admin/* URL lands on its new home with its query (e.g. ?token=) and hash intact.
export default function LegacyAdminRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${legacyAdminTarget(pathname)}${search}${hash}`} replace />;
}
