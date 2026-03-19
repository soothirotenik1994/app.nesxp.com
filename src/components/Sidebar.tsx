import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  ShieldCheck, 
  UserCog,
  Shield,
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

import { ROLE_PERMISSIONS } from '../config/menuPermissions';

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
  
  // ดึงชื่อ Role จาก localStorage (ที่เก็บไว้ตอน Login)
  const userRole = localStorage.getItem('user_role') || 'Driver';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  // ฟังก์ชันเช็คสิทธิ์การแสดงผลเมนู (ใช้ค่าจากไฟล์ config)
  const isVisible = (key: string) => {
    const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['Driver'];
    return (permissions as any)[key] === true;
  };

  const menuItems = [
    { name: t('reports'), path: '/reports', icon: ShieldCheck, key: 'reports' },
    { name: t('drivers'), path: '/members', icon: Users, key: 'drivers' },
    { name: t('vehicles'), path: '/cars', icon: Car, key: 'vehicles' },
    { name: t('customer_locations'), path: '/locations', icon: MapPin, key: 'locations' },
    { name: t('new_job_assignment'), path: '/jobs/new', icon: FileText, key: 'new_job' },
  ].filter(item => isVisible(item.key));

  const logisticsItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard, key: 'dashboard' },
    { name: t('job_calendar'), path: '/jobs/calendar', icon: Calendar, key: 'calendar' },
    { name: isAdmin ? t('all_jobs') : t('my_assigned_jobs'), path: '/jobs/my', icon: ClipboardList, key: 'all_jobs' },
    { name: t('job_history'), path: '/jobs/history', icon: History, key: 'history' },
  ].filter(item => isAdmin ? isVisible(item.key) : true); // Non-admins see all logistics for now
  
  const settingsItems = [
    { name: t('admins'), path: '/admins', icon: UserCog, key: 'admins' },
    { name: t('system_settings'), path: '/settings/system', icon: Settings, key: 'system_settings' },
  ].filter(item => isVisible(item.key));

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

  const websiteName = localStorage.getItem('website_name') || 'NES Tracking';
  const websiteLogo = localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9998] lg:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-[9999] w-64 bg-primary text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 overflow-hidden">
                <img 
                  src={websiteLogo} 
                  alt={websiteName} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight leading-none">{websiteName}</span>
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
            <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">Logistics</div>
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

            {isAdmin && menuItems.length > 0 && (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mt-4">{t('management')}</div>
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

            {isAdmin && settingsItems.length > 0 && (
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
