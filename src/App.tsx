import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { LineCallback } from './pages/LineCallback';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Cars } from './pages/Cars';
import { CustomerLocations } from './pages/CustomerLocations';
import { AssignCars } from './pages/AssignCars';
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
import { MaintenanceDashboard } from './pages/MaintenanceDashboard';
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
      directusApi.getCurrentUser().then(user => {
        const role = user.role?.name || 'Driver';
        const isAdmin = role.toLowerCase() === 'administrator' || role.toLowerCase() === 'admin';
        localStorage.setItem('user_role', role);
        localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
        localStorage.setItem('user_name', `${user.first_name} ${user.last_name}`);
        localStorage.setItem('user_email', user.email);
        
        // เราไม่ใช้ menu_permissions จาก Directus แล้ว แต่ใช้จากไฟล์ config แทน
        localStorage.removeItem('menu_permissions');
      }).catch(err => {
        // Only log if it's not a 401 (which is handled by the interceptor)
        if (err.response?.status !== 401) {
          console.error('Error refreshing user info:', err);
        }
      });
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
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/cars" element={<Cars />} />
              <Route path="/locations" element={<CustomerLocations />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/admins" element={<Admins />} />
              <Route path="/jobs/new" element={<JobReport />} />
              <Route path="/jobs/edit/:id" element={<JobReport />} />
              <Route path="/jobs/my" element={<MyJobs />} />
              <Route path="/jobs/calendar" element={<JobCalendar />} />
              <Route path="/jobs/history" element={<JobHistory />} />
              <Route path="/line/settings" element={<LineSettings />} />
              <Route path="/line/api-settings" element={<LineApiSettings />} />
              <Route path="/line/broadcast" element={<LineBroadcast />} />
              <Route path="/maintenance" element={<MaintenanceDashboard />} />
              <Route path="/settings/system" element={<SystemSettings />} />
              <Route path="/permissions" element={<Members />} />
              <Route path="/permissions/:memberId" element={<AssignCars />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SystemAlertProvider>
  );
}
