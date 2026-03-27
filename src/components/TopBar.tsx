import React, { useState } from 'react';
import { Menu, User, LogOut, PlusCircle, Search, Bell, Grid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useNavigate, Link } from 'react-router-dom';
import { setAuthToken } from '../api/directus';
import { cn } from '../lib/utils';

interface TopBarProps {
  onMenuClick: () => void;
  onProfileClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, onProfileClick }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userInfo] = useState({
    name: localStorage.getItem('user_name') || t('admin_user'),
    role: localStorage.getItem('user_role') || t('super_admin'),
    picture: localStorage.getItem('user_picture') || ''
  });
  
  const userRole = localStorage.getItem('user_role')?.toLowerCase();
  const isAdmin = userRole === 'administrator' || userRole === 'admin';
  const isCustomer = userRole === 'customer';
  
  const handleLogout = () => {
    const itemsToRemove = [
      'admin_token', 'user_role', 'user_name', 'user_email', 
      'member_id', 'is_admin', 'user_picture', 'line_user_id'
    ];
    itemsToRemove.forEach(item => localStorage.removeItem(item));
    setAuthToken(null);
    navigate('/login');
  };

  return (
    <header className={cn(
      "h-20 flex items-center justify-between px-8 sticky top-0 z-[1000] transition-all",
      isCustomer ? "bg-white/80 backdrop-blur-md border-b border-slate-100" : "bg-white border-b border-slate-200"
    )}>
      <div className="flex items-center gap-8 flex-1">
        <button 
          onClick={onMenuClick}
          className="p-2 hover:bg-slate-100 rounded-xl lg:hidden"
        >
          <Menu className="w-6 h-6 text-slate-600" />
        </button>

        {/* Search Bar */}
        <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl w-full max-w-md group focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-primary" />
          <input 
            type="text" 
            placeholder="Find specific vehicles, drivers or IDs..."
            className="bg-transparent border-none outline-none text-sm w-full text-slate-600 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
            <Grid className="w-5 h-5" />
          </button>
        </div>

        <div className="h-8 w-[1px] bg-slate-100"></div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900 leading-none mb-1">{userInfo.name}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userInfo.role}</p>
          </div>
          
          <button 
            onClick={onProfileClick}
            className="group relative"
          >
            <div className="w-11 h-11 rounded-2xl bg-slate-100 border-2 border-white shadow-sm overflow-hidden transition-transform group-hover:scale-105">
              {userInfo.picture ? (
                <img 
                  src={userInfo.picture} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                  <User className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
          </button>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};
