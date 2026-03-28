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
  MessageSquare,
  TrendingUp,
  ChevronRight
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
    { name: t('maintenance'), path: '/maintenance', icon: RefreshCw, key: 'maintenance' },
  ].filter(item => isVisible(item.key));

  const logisticsItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard, key: 'dashboard' },
    { name: 'Real-time Tracking', path: '/', icon: MapPin, key: 'tracking' },
    { name: 'Shipment Schedule', path: '/jobs/calendar', icon: Calendar, key: 'calendar' },
    { name: 'Shipment History', path: '/jobs/history', icon: History, key: 'history' },
    { name: 'Fleet Analytics', path: '/reports', icon: TrendingUp, key: 'analytics' },
  ].filter(item => isAdmin ? isVisible(item.key) : true);
  
  const bottomItems = [
    { name: 'Settings', path: '/settings/system', icon: Settings, key: 'settings' },
    { name: 'Support', path: '/', icon: MessageSquare, key: 'support' },
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

  const websiteName = localStorage.getItem('website_name') || 'Lucid Curator';
  const websiteLogo = localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg';

  const isCustomer = userRole.toLowerCase() === 'customer';

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
        "fixed inset-y-0 left-0 z-[9999] w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isCustomer ? "bg-white border-r border-slate-100" : "bg-primary text-white",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-8 flex items-center justify-between">
            <div className="flex flex-col">
              <span className={cn("text-xl font-bold tracking-tight leading-none", isCustomer ? "text-slate-900" : "text-white")}>{websiteName}</span>
              <span className={cn("text-[10px] font-bold uppercase mt-1 tracking-widest", isCustomer ? "text-slate-400" : "text-white/50")}>
                Editorial Logistics
              </span>
            </div>
            <button className={cn("lg:hidden", isCustomer ? "text-slate-400" : "text-white")} onClick={() => setIsOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {logisticsItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all relative group",
                    isCustomer ? (
                      isActive 
                        ? "bg-slate-50 text-primary font-bold" 
                        : "text-slate-400 hover:text-slate-600"
                    ) : (
                      isActive 
                        ? "bg-white/20 text-white border border-white/30" 
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {isCustomer && isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                  )}
                  <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-primary" : "text-slate-400")} />
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })}

            {isAdmin && menuItems.length > 0 && (
              <>
                <div className={cn("px-6 py-4 text-[10px] font-bold uppercase tracking-widest mt-6", isCustomer ? "text-slate-300" : "text-white/40")}>Management</div>
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all",
                        isCustomer ? (
                          isActive 
                            ? "bg-slate-50 text-primary font-bold" 
                            : "text-slate-400 hover:text-slate-600"
                        ) : (
                          isActive 
                            ? "bg-white/20 text-white border border-white/30" 
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        )
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className={cn("p-6 space-y-2", isCustomer ? "bg-white" : "border-t border-white/10")}>
            {isCustomer && (
              <button className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all mb-8">
                New Shipment
              </button>
            )}
            
            {bottomItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all",
                  isCustomer ? "text-slate-400 hover:text-slate-600" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.name}</span>
              </Link>
            ))}

            <button 
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-4 px-6 py-4 w-full rounded-2xl transition-all mt-4",
                isCustomer ? "text-red-400 hover:bg-red-50" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-bold">{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
