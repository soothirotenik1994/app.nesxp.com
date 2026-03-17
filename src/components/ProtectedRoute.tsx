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
  const adminPaths = ['/members', '/cars', '/admins', '/permissions'];
  const isDashboard = location.pathname === '/';
  
  if (!isAdmin) {
    if (adminPaths.some(path => location.pathname.startsWith(path)) || isDashboard) {
      return <Navigate to="/jobs/new" replace />;
    }
  }

  return <Outlet />;
};
