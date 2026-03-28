import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ProfileModal } from './ProfileModal';
import { AlertCircle, X } from 'lucide-react';

export const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLimitWarning, setShowLimitWarning] = useState(localStorage.getItem('line_limit_reached') === 'true');
  
  const isAuthenticated = !!localStorage.getItem('admin_token') || !!localStorage.getItem('member_id');
  const isAdmin = localStorage.getItem('is_admin') === 'true';
  const lineUserId = localStorage.getItem('line_user_id') || localStorage.getItem('member_id') || '';

  useEffect(() => {
    const handleLimitReached = () => {
      if (isAdmin) {
        setShowLimitWarning(true);
      }
    };

    window.addEventListener('line-limit-reached', handleLimitReached);
    return () => window.removeEventListener('line-limit-reached', handleLimitReached);
  }, [isAdmin]);

  const dismissWarning = () => {
    setShowLimitWarning(false);
    localStorage.removeItem('line_limit_reached');
  };

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
        
        {isAdmin && showLimitWarning && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>LINE Messaging API monthly limit reached. Notifications are temporarily disabled.</span>
            </div>
            <button 
              onClick={dismissWarning}
              className="text-amber-500 hover:text-amber-700 p-1 rounded-full hover:bg-amber-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
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
