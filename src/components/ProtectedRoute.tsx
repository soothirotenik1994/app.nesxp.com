import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROLE_PERMISSIONS } from '../config/menuPermissions';

export const ProtectedRoute: React.FC = () => {
  const token = localStorage.getItem('admin_token');
  const memberId = localStorage.getItem('member_id');
  const userRole = localStorage.getItem('user_role') || 'Customer';
  const location = useLocation();
  
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  if (!token && !memberId) {
    return <Navigate to="/login" replace />;
  }

  // ฟังก์ชันเช็คสิทธิ์การแสดงผลเมนู (ใช้ค่าจากไฟล์ config หรือ dynamic)
  const isVisible = (key: string) => {
    // ลองดึงสิทธิ์แบบไดนามิกจาก localStorage ก่อน
    const dynamicPermissionsRaw = localStorage.getItem('dynamic_role_permissions');
    if (dynamicPermissionsRaw) {
      try {
        const dynamicPermissions = JSON.parse(dynamicPermissionsRaw);
        // Case-insensitive role check
        const roleKey = Object.keys(dynamicPermissions).find(
          r => r.toLowerCase() === userRole.toLowerCase()
        );
        
        if (roleKey && dynamicPermissions[roleKey][key] !== undefined) {
          return dynamicPermissions[roleKey][key] === true;
        }
      } catch (e) {
        console.error('Error parsing dynamic permissions', e);
      }
    }

    // ถ้าไม่มีสิทธิ์ไดนามิก ให้ใช้ค่าจากไฟล์ config (Fallback)
    // Case-insensitive fallback check
    const fallbackRoleKey = Object.keys(ROLE_PERMISSIONS).find(
      r => r.toLowerCase() === userRole.toLowerCase()
    );
    
    const permissions = ROLE_PERMISSIONS[fallbackRoleKey || ''] || ROLE_PERMISSIONS['Driver'];
    return (permissions as any)[key] === true;
  };

  // Map paths to permission keys
  const pathPermissionMap: Record<string, string> = {
    '/members': 'members',
    '/admins': 'admins',
    '/maintenance': 'maintenance',
    '/role-permissions': 'role_permissions',
    '/ratings': 'driver_ratings',
    '/reports': 'reports',
    '/cars': 'vehicles',
    '/locations': 'locations',
    '/jobs/new': 'new_job',
    '/jobs/calendar': 'calendar',
    '/jobs/history': 'history',
    '/history': 'trip_history',
    '/vehicle-queue': 'vehicle_queue',
    '/line/broadcast': 'line_broadcast',
    '/settings/api': 'api_settings',
    '/settings/system': 'system_settings',
    '/monitor': 'live_monitor',
    '/announcements': 'announcements',
  };

  // Check if current path requires a permission that the user doesn't have
  const currentPath = location.pathname;
  const permissionKey = Object.keys(pathPermissionMap).find(path => currentPath.startsWith(path));

  if (permissionKey && !isVisible(pathPermissionMap[permissionKey])) {
    // If it's a sub-path of maintenance, check maintenance_dashboard/log/etc
    if (currentPath.startsWith('/maintenance')) {
      if (currentPath === '/maintenance' && !isVisible('maintenance_dashboard')) {
        return <Navigate to="/" replace />;
      }
      if (currentPath === '/maintenance/log' && !isVisible('maintenance_log')) {
        return <Navigate to="/" replace />;
      }
      if (currentPath === '/maintenance/items' && !isVisible('maintenance_items')) {
        return <Navigate to="/" replace />;
      }
      if (currentPath === '/maintenance/reports' && !isVisible('maintenance_reports')) {
        return <Navigate to="/" replace />;
      }
    }
    
    return <Navigate to="/" replace />;
  }

  // Special case for /permissions/:memberId
  const permissionPath = '/permissions';
  if (location.pathname.startsWith(permissionPath)) {
    const memberIdFromUrl = location.pathname.split('/')[2];
    const loggedInMemberId = localStorage.getItem('member_id');
    if (!isAdmin && memberIdFromUrl !== loggedInMemberId) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};
