import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  ShieldCheck, 
  Star,
  UserCog,
  Shield,
  LogOut,
  Menu,
  X,
  Activity,
  ClipboardList,
  Calendar,
  FileText,
  History,
  RefreshCw,
  Coins,
  Wrench,
  Truck,
  MapPin,
  Settings,
  MessageSquare,
  Bell,
  Code,
  ChevronRight,
  ListOrdered
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

  const [maintenanceExpanded, setMaintenanceExpanded] = useState(location.pathname.startsWith('/maintenance'));

  useEffect(() => {
    if (location.pathname.startsWith('/maintenance')) {
      setMaintenanceExpanded(true);
    }
  }, [location.pathname]);

  // ฟังก์ชันเช็คสิทธิ์การแสดงผลเมนู (ใช้ค่าจากไฟล์ config)
  const isVisible = (key: string) => {
    // ลองดึงสิทธิ์แบบไดนามิกจาก localStorage ก่อน
    const dynamicPermissionsRaw = localStorage.getItem('dynamic_role_permissions');
    if (dynamicPermissionsRaw) {
      try {
        const dynamicPermissions = JSON.parse(dynamicPermissionsRaw);
        // Case-insensitive role check
        const roleKey = Object.keys(dynamicPermissions).find(
          r => r.toLowerCase() === userRole.toLowerCase()
        );
        
        if (roleKey && dynamicPermissions[roleKey][key] !== undefined) {
          return dynamicPermissions[roleKey][key] === true;
        }
      } catch (e) {
        console.error('Error parsing dynamic permissions', e);
      }
    }

    // ถ้าไม่มีสิทธิ์ไดนามิก ให้ใช้ค่าจากไฟล์ config (Fallback)
    // Case-insensitive fallback check
    const fallbackRoleKey = Object.keys(ROLE_PERMISSIONS).find(
      r => r.toLowerCase() === userRole.toLowerCase()
    );
    
    const permissions = ROLE_PERMISSIONS[fallbackRoleKey || ''] || ROLE_PERMISSIONS['Driver'];
    return (permissions as any)[key] === true;
  };

  const menuItems = [
    { name: t('reports'), path: '/reports', icon: ShieldCheck, key: 'reports' },
    { name: t('members'), path: '/members', icon: Users, key: 'members' },
    { name: t('vehicles'), path: '/cars', icon: Car, key: 'vehicles' },
    { name: t('driver_ratings'), path: '/ratings', icon: Star, key: 'driver_ratings' },
    { name: t('customer_locations'), path: '/locations', icon: MapPin, key: 'locations' },
    { name: t('expenses'), path: '/settings/expenses', icon: Coins, key: 'expenses' },
    { name: t('new_job_assignment'), path: '/jobs/new', icon: FileText, key: 'new_job' },
    { name: t('maintenance'), path: '/maintenance', icon: RefreshCw, key: 'maintenance', isParent: true },
    { name: t('maintenance_dashboard'), path: '/maintenance', icon: LayoutDashboard, key: 'maintenance_dashboard', isSub: true },
    { name: t('maintenance_log'), path: '/maintenance/log', icon: Wrench, key: 'maintenance_log', isSub: true },
    { name: t('maintenance_reports'), path: '/maintenance/reports', icon: FileText, key: 'maintenance_reports', isSub: true },
    { name: t('manage_maintenance_types'), path: '/maintenance/items', icon: Settings, key: 'maintenance_items', isSub: true },
  ].filter(item => isVisible(item.key));

  const logisticsItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard, key: 'dashboard' },
    { name: t('job_calendar'), path: '/jobs/calendar', icon: Calendar, key: 'calendar' },
    { name: isAdmin ? t('all_jobs') : t('my_assigned_jobs'), path: '/jobs/my', icon: ClipboardList, key: 'all_jobs' },
    { name: t('job_history'), path: '/jobs/history', icon: History, key: 'history' },
    { name: t('live_monitor', 'Live Monitor'), path: '/monitor', icon: Activity, key: 'live_monitor' },
    { name: t('company_announcements', 'ประกาศบริษัท'), path: '/announcements', icon: Bell, key: 'announcements' },
    { name: t('trip_history'), path: '/history', icon: MapPin, key: 'trip_history' },
    { name: t('vehicle_queue'), path: '/vehicle-queue', icon: ListOrdered, key: 'vehicle_queue' },
  ].filter(item => isVisible(item.key));
  
  const settingsItems = [
    { name: t('admins'), path: '/admins', icon: UserCog, key: 'admins' },
    { name: t('line_broadcast'), path: '/line/broadcast', icon: MessageSquare, key: 'line_broadcast' },
    { name: t('api_settings'), path: '/settings/api', icon: Code, key: 'api_settings' },
    { name: t('role_permissions'), path: '/role-permissions', icon: Shield, key: 'role_permissions' },
    { name: t('login_history'), path: '/settings/logs', icon: History, key: 'login_logs' },
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
    localStorage.removeItem('is_switched_account');
    navigate('/login');
  };

  const websiteName = localStorage.getItem('website_name') || 'NES Tracking';
  const websiteLogo = localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg';
  const isSwitchedAccount = localStorage.getItem('is_switched_account') === 'true';

  const handleBackToAdmin = () => {
    localStorage.removeItem('is_switched_account');
    localStorage.removeItem('member_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_picture');
    localStorage.removeItem('user_email');
    
    // Restore admin role manually before reload so it doesn't flash
    // App.tsx will fetch the real role from API, but this makes the transition smoother
    localStorage.setItem('user_role', 'Administrator');
    localStorage.setItem('is_admin', 'true');
    
    // App.tsx will refresh the user info on reload
    window.location.href = '/';
  };

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
        "fixed inset-y-0 left-0 z-[9999] w-64 bg-primary text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 border-r border-white/5 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white backdrop-blur-md rounded-xl flex items-center justify-center overflow-hidden shadow-inner border border-white/10 p-1">
                <img 
                  src={websiteLogo} 
                  alt={websiteName} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight leading-none">{websiteName}</span>
                <span className="text-[10px] font-bold text-white/40 uppercase mt-1.5 tracking-widest">
                  {userRole}
                </span>
              </div>
            </div>
            <button className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => setIsOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            <div className="px-4 py-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">{t('logistics')}</div>
            {logisticsItems.map((item: any) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                    item.isSub && "ml-6 py-2 text-sm",
                    isActive 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", item.isSub && "w-4 h-4")} />
                  <span className="font-semibold">{item.name}</span>
                </Link>
              );
            })}

            {isAdmin && menuItems.length > 0 && (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-white/30 uppercase tracking-widest mt-6">{t('management')}</div>
                {menuItems.map((item: any) => {
                  const isActive = location.pathname === item.path;
                  const isMaintenanceParent = item.key === 'maintenance';
                  
                  // Only show sub-items if maintenance is expanded
                  if (item.isSub && !maintenanceExpanded) {
                    return null;
                  }

                  if (item.isParent) {
                    const isAnySubActive = location.pathname.startsWith('/maintenance');
                    return (
                      <button
                        key={item.name}
                        onClick={() => setMaintenanceExpanded(!maintenanceExpanded)}
                        className={cn(
                          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 group",
                          isAnySubActive 
                            ? "bg-white/10 text-white shadow-sm" 
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                          <span className="font-semibold">{item.name}</span>
                        </div>
                        <ChevronRight className={cn(
                          "w-4 h-4 transition-transform duration-300",
                          maintenanceExpanded && "rotate-90"
                        )} />
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                        item.isSub && "ml-6 py-2 text-sm",
                        isActive 
                          ? "bg-white/10 text-white shadow-sm" 
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", item.isSub && "w-4 h-4")} />
                      <span className="font-semibold">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}

            {isAdmin && settingsItems.length > 0 && (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-white/30 uppercase tracking-widest mt-6">{t('system_settings')}</div>
                {settingsItems.map((item: any) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                        item.isSub && "ml-6 py-2 text-sm",
                        isActive 
                          ? "bg-white/10 text-white shadow-sm" 
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", item.isSub && "w-4 h-4")} />
                      <span className="font-semibold">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/10 dark:bg-black/20 space-y-2">
            {isSwitchedAccount && (
              <button 
                onClick={handleBackToAdmin}
                className="flex items-center gap-3 px-4 py-3 w-full bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-900/40 mb-2 active:scale-95"
              >
                <Shield className="w-5 h-5" />
                <span className="font-bold text-sm">{t('back_to_admin')}</span>
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-white/60 hover:bg-white/10 hover:text-white rounded-xl transition-all group active:scale-95"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="font-semibold">{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
