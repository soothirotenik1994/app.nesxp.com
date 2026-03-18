import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  ShieldCheck, 
  UserCog,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Calendar,
  FileText,
  History,
  RefreshCw,
  Truck,
  MapPin,
  Settings,
  MessageSquare
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const userRole = localStorage.getItem('user_role') || 'customer';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';
  
  const menuItems = [
    { name: t('reports'), path: '/reports', icon: ShieldCheck },
    { name: t('drivers'), path: '/members', icon: Users },
    { name: t('vehicles'), path: '/cars', icon: Car },
    { name: t('customer_locations'), path: '/locations', icon: MapPin },
    { name: t('new_job_assignment'), path: '/jobs/new', icon: FileText },
  ];

  const logisticsItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard },
    { name: t('job_calendar'), path: '/jobs/calendar', icon: Calendar },
    { name: isAdmin ? t('all_jobs') : t('my_assigned_jobs'), path: '/jobs/my', icon: ClipboardList },
    { name: t('job_history'), path: '/jobs/history', icon: History },
  ];
  
  const settingsItems = [
    { name: t('admins'), path: '/admins', icon: UserCog },
    { name: t('line_settings'), path: '/settings/line', icon: MessageSquare },
    { name: t('system_settings'), path: '/settings/system', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('member_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('view_mode');
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-primary text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 overflow-hidden">
                <img 
                  src="https://img2.pic.in.th/4863801.jpg" 
                  alt="NES Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight leading-none">NES Tracking</span>
                <span className="text-[10px] font-medium text-white/50 uppercase mt-1 tracking-widest">
                  {userRole}
                </span>
              </div>
            </div>
            <button className="lg:hidden" onClick={() => setIsOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {isAdmin && (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">{t('management')}</div>
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                        isActive 
                          ? "bg-white/20 text-white border border-white/30" 
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}

            <div className={cn("px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest", isAdmin && "mt-4")}>Logistics</div>
            {logisticsItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                    isActive 
                      ? "bg-white/20 text-white border border-white/30" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mt-4">{t('system_settings')}</div>
                {settingsItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                        isActive 
                          ? "bg-white/20 text-white border border-white/30" 
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
