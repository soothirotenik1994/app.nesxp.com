import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Shield, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  Layout,
  Activity,
  Bell,
  Users,
  Car,
  MapPin,
  FileText,
  RefreshCcw,
  Wrench,
  Settings,
  LayoutDashboard,
  Calendar,
  ClipboardList,
  History,
  UserCog,
  MessageSquare,
  Code,
  ListOrdered,
  CreditCard
} from 'lucide-react';
import { directusApi } from '../api/directus';
import { ROLE_PERMISSIONS } from '../config/menuPermissions';
import { cn } from '../lib/utils';

interface PermissionGroup {
  id: string;
  role: string;
  permissions: Record<string, boolean>;
  description?: string;
}

const MENU_KEYS = [
  { key: 'dashboard', label: 'dashboard', icon: LayoutDashboard, group: 'logistics' },
  { key: 'calendar', label: 'job_calendar', icon: Calendar, group: 'logistics' },
  { key: 'all_jobs', label: 'all_jobs', icon: ClipboardList, group: 'logistics' },
  { key: 'history', label: 'job_history', icon: History, group: 'logistics' },
  { key: 'trip_history', label: 'trip_history', icon: MapPin, group: 'logistics' },
  { key: 'live_monitor', label: 'live_monitor', icon: Activity, group: 'logistics' },
  { key: 'announcements', label: 'company_announcements', icon: Bell, group: 'logistics' },
  { key: 'vehicle_queue', label: 'vehicle_queue', icon: ListOrdered, group: 'logistics' },
  
  { key: 'reports', label: 'reports', icon: ShieldCheck, group: 'management' },
  { key: 'members', label: 'members', icon: Users, group: 'management' },
  { key: 'vehicles', label: 'vehicles', icon: Car, group: 'management' },
  { key: 'locations', label: 'customer_locations', icon: MapPin, group: 'management' },
  { key: 'expenses', label: 'expenses', icon: CreditCard, group: 'management' },
  { key: 'new_job', label: 'new_job_assignment', icon: FileText, group: 'management' },
  
  { key: 'maintenance', label: 'maintenance_dashboard', icon: RefreshCcw, group: 'maintenance' },
  { key: 'maintenance_log', label: 'maintenance_log', icon: Wrench, group: 'maintenance' },
  { key: 'maintenance_reports', label: 'maintenance_reports', icon: FileText, group: 'maintenance' },
  { key: 'maintenance_items', label: 'manage_maintenance_types', icon: Settings, group: 'maintenance' },
  
  { key: 'admins', label: 'admins', icon: UserCog, group: 'system' },
  { key: 'line_broadcast', label: 'line_broadcast', icon: MessageSquare, group: 'system' },
  { key: 'api_settings', label: 'api_settings', icon: Code, group: 'system' },
  { key: 'role_permissions', label: 'role_permissions', icon: Shield, group: 'system' },
  { key: 'system_settings', label: 'system_settings', icon: Settings, group: 'system' },
];

// Fallback icon if specific one is missing
import { ShieldCheck } from 'lucide-react';

export const RolePermissions: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const data = await directusApi.getRolePermissions();
      
      // Ensure all roles from ROLE_PERMISSIONS are present
      const allRoles = Object.keys(ROLE_PERMISSIONS);
      const mergedGroups = allRoles.map(role => {
        const existing = data.find(d => d.role.toLowerCase() === role.toLowerCase());
        if (existing) return { ...existing, role }; // Use the key from ROLE_PERMISSIONS but keep data
        return {
          id: '',
          role,
          permissions: (ROLE_PERMISSIONS as any)[role],
          description: t('default_permissions_for', { role })
        };
      });
      
      setGroups(mergedGroups as any);
      if (mergedGroups.length > 0) setActiveRole(mergedGroups[0].role);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setError(t('permissions_load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (role: string, key: string) => {
    setGroups(prev => prev.map(group => {
      if (group.role === role) {
        return {
          ...group,
          permissions: {
            ...group.permissions,
            [key]: !group.permissions[key]
          }
        };
      }
      return group;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const group of groups) {
        if (group.id) {
          await directusApi.updateRolePermissions(group.id, {
            permissions: group.permissions
          });
        } else {
          const newGroup = await directusApi.createRolePermission({
            role: group.role,
            permissions: group.permissions,
            description: group.description
          });
          // Update local state with new ID
          setGroups(prev => prev.map(g => g.role === group.role ? { ...g, id: newGroup.id } : g));
        }
      }
      
      // Update localStorage for immediate effect
      const permissionsMap: Record<string, any> = {};
      groups.forEach(g => {
        permissionsMap[g.role] = g.permissions;
      });
      localStorage.setItem('dynamic_role_permissions', JSON.stringify(permissionsMap));
      
      setSuccess(t('permissions_saved_success'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save permissions:', err);
      setError(t('permissions_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const currentGroup = groups.find(g => g.role === activeRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            {t('role_permissions_title')}
          </h1>
          <p className="text-gray-500 mt-1">{t('role_permissions_desc')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span className="font-bold">{saving ? t('saving_permissions') : t('save_all_changes')}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role Selection */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">{t('user_groups')}</h3>
          {groups.map(group => (
            <button
              key={group.role}
              onClick={() => setActiveRole(group.role)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left",
                activeRole === group.role
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"
              )}
            >
              <span className="font-bold">{group.role}</span>
              <ChevronRight className={cn("w-4 h-4 transition-transform", activeRole === group.role && "rotate-90")} />
            </button>
          ))}
        </div>

        {/* Permissions Grid */}
        <div className="lg:col-span-3">
          {currentGroup ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900">{t('permissions_for_group', { role: currentGroup.role })}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('click_to_toggle_menu')}</p>
              </div>
              
              <div className="p-6">
                {['logistics', 'management', 'maintenance', 'system'].map(groupName => (
                  <div key={groupName} className="mb-8 last:mb-0">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="h-px flex-1 bg-gray-100"></div>
                      {t(groupName)}
                      <div className="h-px flex-1 bg-gray-100"></div>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {MENU_KEYS.filter(m => m.group === groupName).map(menu => (
                        <div 
                          key={menu.key}
                          onClick={() => handleTogglePermission(currentGroup.role, menu.key)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                            currentGroup.permissions[menu.key]
                              ? "bg-primary/5 border-primary/20"
                              : "bg-white border-gray-100 hover:border-gray-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              currentGroup.permissions[menu.key] ? "bg-primary text-white" : "bg-gray-100 text-gray-400"
                            )}>
                              <menu.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{t(menu.label)}</p>
                              <p className="text-xs text-gray-500">{t('menu_id')}: {menu.key}</p>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "w-12 h-6 rounded-full transition-colors relative",
                            currentGroup.permissions[menu.key] ? "bg-primary" : "bg-gray-200"
                          )}>
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                              currentGroup.permissions[menu.key] ? "left-7" : "left-1"
                            )} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Shield className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">{t('select_role_to_manage')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
