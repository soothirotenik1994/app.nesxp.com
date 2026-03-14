import React from 'react';
import { Menu, User, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../api/directus';

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setAuthToken(null);
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
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
        <LanguageSwitcher />
        
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{t('admin_user')}</p>
            <p className="text-xs text-slate-500">{t('super_admin')}</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
            <User className="w-6 h-6 text-slate-600" />
          </div>
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
