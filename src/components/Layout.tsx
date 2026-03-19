import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ProfileModal } from './ProfileModal';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const isAuthenticated = !!localStorage.getItem('admin_token') || !!localStorage.getItem('member_id');
  const lineUserId = localStorage.getItem('line_user_id') || localStorage.getItem('member_id') || '';

  const refreshUserInfo = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar 
          key={refreshKey}
          onMenuClick={() => setIsSidebarOpen(true)} 
          onProfileClick={() => setIsProfileOpen(true)}
        />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        lineUserId={lineUserId}
        onUpdate={refreshUserInfo}
      />
    </div>
  );
};
