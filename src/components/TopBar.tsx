import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, LogOut, PlusCircle, Bell, Trash2, CheckCircle, AlertTriangle, X, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { setAuthToken } from '../api/directus';
import { ProfileModal } from './ProfileModal';
import { useSystemAlerts } from '../context/SystemAlertContext';
import { useTheme } from '../context/ThemeContext';
import { format } from 'date-fns';

interface TopBarProps {
  onMenuClick: () => void;
  onProfileClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, onProfileClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { alerts, unreadCount, markAsRead, clearAll } = useSystemAlerts();
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [userInfo, setUserInfo] = useState({
    name: localStorage.getItem('user_name') || t('admin_user'),
    role: localStorage.getItem('user_role') || t('super_admin'),
    picture: localStorage.getItem('user_picture') || ''
  });
  
  const isAdmin = localStorage.getItem('user_role')?.toLowerCase() === 'administrator' || localStorage.getItem('user_role')?.toLowerCase() === 'admin';
  
  useEffect(() => {
    const handleStorageChange = () => {
      setUserInfo({
        name: localStorage.getItem('user_name') || t('admin_user'),
        role: localStorage.getItem('user_role') || t('super_admin'),
        picture: localStorage.getItem('user_picture') || ''
      });
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('user-info-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-info-updated', handleStorageChange);
    };
  }, [t]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    // Clear all auth-related items from localStorage
    const itemsToRemove = [
      'admin_token',
      'user_role',
      'user_name',
      'user_email',
      'member_id',
      'is_admin',
      'user_picture',
      'line_user_id'
    ];
    itemsToRemove.forEach(item => localStorage.removeItem(item));
    
    setAuthToken(null);
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-[1000] transition-colors duration-200">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 hover:bg-slate-100 rounded-lg lg:hidden"
        >
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
        <h1 className="text-lg font-semibold text-slate-800 hidden sm:block">
          {t('vehicle_tracking_management')}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {isAdmin && (
          <>
            <Link 
              to="/jobs/new"
              className="flex items-center gap-2 px-4 py-2 bg-[#003399] text-white rounded-lg hover:bg-[#002266] transition-colors text-sm font-bold shadow-lg shadow-blue-900/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('new_job_assignment')}</span>
            </Link>

            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 relative transition-colors"
                title={t('notifications')}
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 z-[1100]">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      {t('system_notifications')}
                    </h3>
                    {alerts.length > 0 && (
                      <button 
                        onClick={clearAll}
                        className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t('clear_all')}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                          <CheckCircle className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-slate-500 text-sm">{t('no_notifications')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {alerts.map((alert) => (
                          <div 
                            key={alert.id}
                            className={`p-4 hover:bg-white transition-colors cursor-pointer relative group ${!alert.isRead ? 'bg-blue-50/30' : ''}`}
                            onClick={() => markAsRead(alert.id)}
                          >
                            <div className="flex gap-3">
                              <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                alert.message.includes('error') ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-relaxed ${!alert.isRead ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                                  {alert.message}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                  {format(new Date(alert.timestamp), 'MMM d, HH:mm')}
                                </p>
                              </div>
                              {!alert.isRead && (
                                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900">{t(userInfo.role.toLowerCase(), userInfo.role)}</p>
            <p className="text-xs text-slate-500">{userInfo.name}</p>
          </div>
          <button 
            onClick={onProfileClick}
            className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 hover:bg-slate-200 transition-colors overflow-hidden"
            title={t('profile')}
          >
            {userInfo.picture ? (
              <img 
                src={userInfo.picture} 
                alt="Profile" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = "w-full h-full flex items-center justify-center text-slate-400";
                    fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <User className="w-6 h-6 text-slate-600" />
            )}
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
            title={t('logout')}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
