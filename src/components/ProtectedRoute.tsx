import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const ProtectedRoute: React.FC = () => {
  const token = localStorage.getItem('admin_token');
  const memberId = localStorage.getItem('member_id');
  const userRole = localStorage.getItem('user_role') || 'customer';
  const location = useLocation();
  
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  if (!token && !memberId) {
    return <Navigate to="/login" replace />;
  }

  // If driver tries to access admin pages, redirect to logistics
  const adminPaths = ['/members', '/admins'];
  const permissionPath = '/permissions';
  
  if (!isAdmin) {
    if (adminPaths.some(path => location.pathname.startsWith(path))) {
      return <Navigate to="/jobs/new" replace />;
    }
    // Allow access to /permissions/:memberId only if it's their own
    if (location.pathname.startsWith(permissionPath)) {
      const memberIdFromUrl = location.pathname.split('/')[2];
      const loggedInMemberId = localStorage.getItem('member_id');
      if (memberIdFromUrl !== loggedInMemberId) {
        return <Navigate to="/jobs/new" replace />;
      }
    }
  }

  return <Outlet />;
};
