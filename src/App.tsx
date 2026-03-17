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
import { SmsSettings } from './pages/SmsSettings';
import { SystemSettings } from './pages/SystemSettings';
import Profile from './pages/Profile';
import { useEffect } from 'react';
import { setAuthToken } from './api/directus';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAuthToken(token);
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/line/callback" element={<LineCallback />} />
        <Route path="/profile/:lineUserId" element={<Profile />} />
        
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
            <Route path="/settings/sms" element={<SmsSettings />} />
            <Route path="/settings/system" element={<SystemSettings />} />
            <Route path="/permissions" element={<Members />} />
            <Route path="/permissions/:memberId" element={<AssignCars />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
