import React, { useState } from 'react';
import { Menu, User, LogOut, PlusCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useNavigate, Link } from 'react-router-dom';
import { setAuthToken } from '../api/directus';
import { ProfileModal } from './ProfileModal';
import { NotificationMailbox } from './NotificationMailbox';

interface TopBarProps {
  onMenuClick: () => void;
  onProfileClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, onProfileClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({
    name: localStorage.getItem('user_name') || t('admin_user'),
    role: localStorage.getItem('user_role') || t('super_admin'),
    picture: localStorage.getItem('user_picture') || ''
  });
  
  const isAdmin = localStorage.getItem('user_role')?.toLowerCase() === 'administrator' || localStorage.getItem('user_role')?.toLowerCase() === 'admin';
  
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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-[1000]">
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
          <Link 
            to="/jobs/new"
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t('new_job_assignment')}</span>
          </Link>
        )}
        <NotificationMailbox />
        <LanguageSwitcher />
        
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{userInfo.role}</p>
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
