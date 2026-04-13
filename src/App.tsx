import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { LineCallback } from './pages/LineCallback';
import { CustomerRating } from './pages/CustomerRating';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Cars } from './pages/Cars';
import { CustomerLocations } from './pages/CustomerLocations';
import { Admins } from './pages/Admins';
import { JobReport } from './pages/JobReport';
import { JobHistory } from './pages/JobHistory';
import { JobCalendar } from './pages/JobCalendar';
import { MyJobs } from './pages/MyJobs';
import { Reports } from './pages/Reports';
import { LineBroadcast } from './pages/LineBroadcast';
import { LineSettings } from './pages/LineSettings';
import { LineApiSettings } from './pages/LineApiSettings';
import { SystemSettings } from './pages/SystemSettings';
import { ApiSettings } from './pages/ApiSettings';
import { MaintenanceDashboard } from './pages/MaintenanceDashboard';
import { MaintenanceItems } from './pages/MaintenanceItems';
import { MaintenanceReports } from './pages/MaintenanceReports';
import { MaintenanceLog } from './pages/MaintenanceLog';
import { DriverRatingManagement } from './pages/DriverRatingManagement';
import { RolePermissions } from './pages/RolePermissions';
import { VehicleQueue } from './pages/VehicleQueue';
import { FleetMonitor } from './pages/FleetMonitor';
import { TripHistory } from './pages/TripHistory';
import { useEffect } from 'react';
import { setAuthToken, directusApi } from './api/directus';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SystemAlertProvider } from './context/SystemAlertContext';

export default function App() {
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAuthToken(token);
      
      // Refresh user info
      const isSwitchedAccount = localStorage.getItem('is_switched_account') === 'true';
      
      if (!isSwitchedAccount) {
        directusApi.getCurrentUser().then(user => {
          const role = user.role?.name || 'Driver';
          const isAdmin = role.toLowerCase() === 'administrator' || role.toLowerCase() === 'admin';
          localStorage.setItem('user_role', role);
          localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
          localStorage.setItem('user_name', `${user.first_name} ${user.last_name}`);
          localStorage.setItem('user_email', user.email);
          
          if (user.avatar) {
            localStorage.setItem('user_picture', directusApi.getFileUrl(user.avatar));
          } else {
            localStorage.removeItem('user_picture');
          }
          
          window.dispatchEvent(new Event('user-info-updated'));
          
          // Fetch dynamic role permissions from Directus
          directusApi.getRolePermissions().then(permissions => {
            if (permissions && permissions.length > 0) {
              const permissionsMap: Record<string, any> = {};
              permissions.forEach(p => {
                permissionsMap[p.role] = p.permissions;
              });
              localStorage.setItem('dynamic_role_permissions', JSON.stringify(permissionsMap));
            }
          }).catch(err => {
            console.error('Error fetching dynamic permissions:', err);
          });

          // เราไม่ใช้ menu_permissions จาก Directus แล้ว แต่ใช้จากไฟล์ config แทน
          localStorage.removeItem('menu_permissions');
        }).catch(err => {
          // Only log if it's not a 401 (which is handled by the interceptor)
          if (err.response?.status !== 401) {
            console.error('Error refreshing user info:', err);
          }
        });
      }
    }

    // Update document title
    const websiteName = localStorage.getItem('website_name') || 'NES Tracking';
    document.title = websiteName;
  }, []);

  return (
    <SystemAlertProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/line/callback" element={<LineCallback />} />
          <Route path="/rate/:id" element={<CustomerRating />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/monitor" element={<FleetMonitor />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/cars" element={<Cars />} />
              <Route path="/cars/:carNumber/history" element={<TripHistory />} />
              <Route path="/history" element={<TripHistory />} />
              <Route path="/locations" element={<CustomerLocations />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/admins" element={<Admins />} />
              <Route path="/jobs/new" element={<JobReport />} />
              <Route path="/jobs/edit/:id" element={<JobReport />} />
              <Route path="/jobs/my" element={<MyJobs />} />
              <Route path="/jobs/calendar" element={<JobCalendar />} />
              <Route path="/jobs/history" element={<JobHistory />} />
              <Route path="/vehicle-queue" element={<VehicleQueue />} />
              <Route path="/line/settings" element={<LineSettings />} />
              <Route path="/line/api-settings" element={<LineApiSettings />} />
              <Route path="/line/broadcast" element={<LineBroadcast />} />
              <Route path="/settings/api" element={<ApiSettings />} />
              <Route path="/maintenance" element={<MaintenanceDashboard />} />
              <Route path="/maintenance/log" element={<MaintenanceLog />} />
              <Route path="/maintenance/items" element={<MaintenanceItems />} />
              <Route path="/maintenance/reports" element={<MaintenanceReports />} />
              <Route path="/ratings" element={<DriverRatingManagement />} />
              <Route path="/settings/system" element={<SystemSettings />} />
              <Route path="/role-permissions" element={<RolePermissions />} />
              <Route path="/permissions" element={<Members />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SystemAlertProvider>
  );
}
