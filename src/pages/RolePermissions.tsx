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
  Bell,
  MessageSquare,
  Code,
  ListOrdered
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
  { key: 'dashboard', label: 'แผนที่เรียลไทม์', icon: LayoutDashboard, group: 'โลจิสติกส์' },
  { key: 'calendar', label: 'ปฏิทินงาน', icon: Calendar, group: 'โลจิสติกส์' },
  { key: 'all_jobs', label: 'รายการงาน', icon: ClipboardList, group: 'โลจิสติกส์' },
  { key: 'history', label: 'ประวัติงาน', icon: History, group: 'โลจิสติกส์' },
  { key: 'trip_history', label: 'ดูรถย้อนหลัง', icon: MapPin, group: 'โลจิสติกส์' },
  { key: 'vehicle_queue', label: 'จัดลำดับคิวรถ', icon: ListOrdered, group: 'โลจิสติกส์' },
  
  { key: 'reports', label: 'รายงาน', icon: ShieldCheck, group: 'การจัดการ' },
  { key: 'members', label: 'สมาชิก', icon: Users, group: 'การจัดการ' },
  { key: 'vehicles', label: 'ยานพาหนะ', icon: Car, group: 'การจัดการ' },
  { key: 'locations', label: 'ที่อยู่ลูกค้า', icon: MapPin, group: 'การจัดการ' },
  { key: 'new_job', label: 'มอบหมายงานใหม่', icon: FileText, group: 'การจัดการ' },
  
  { key: 'maintenance', label: 'แดชบอร์ดการบำรุงรักษา', icon: RefreshCcw, group: 'การบำรุงรักษา' },
  { key: 'maintenance_log', label: 'บันทึกการซ่อมบำรุง', icon: Wrench, group: 'การบำรุงรักษา' },
  { key: 'maintenance_reports', label: 'รายงานการซ่อมบำรุง', icon: FileText, group: 'การบำรุงรักษา' },
  { key: 'maintenance_items', label: 'ประเภทการซ่อมบำรุง', icon: Settings, group: 'การบำรุงรักษา' },
  
  { key: 'admins', label: 'ผู้ดูแลระบบ', icon: UserCog, group: 'ระบบ' },
  { key: 'admin_notifications', label: 'การแจ้งเตือนผู้ดูแล', icon: Bell, group: 'ระบบ' },
  { key: 'line_broadcast', label: 'LINE บรอดแคสต์', icon: MessageSquare, group: 'ระบบ' },
  { key: 'api_settings', label: 'การเชื่อมต่อ API', icon: Code, group: 'ระบบ' },
  { key: 'role_permissions', label: 'จัดการสิทธิ์การใช้งาน', icon: Shield, group: 'ระบบ' },
  { key: 'system_settings', label: 'ตั้งค่าระบบ', icon: Settings, group: 'ระบบ' },
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
      
      // If no data in Directus, initialize with hardcoded ones
      if (data.length === 0) {
        const initialGroups = Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
          id: '',
          role,
          permissions: perms,
          description: `สิทธิ์เริ่มต้นสำหรับ ${role}`
        }));
        setGroups(initialGroups as any);
        if (initialGroups.length > 0) setActiveRole(initialGroups[0].role);
      } else {
        setGroups(data);
        if (data.length > 0) setActiveRole(data[0].role);
      }
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setError('ไม่สามารถโหลดข้อมูลสิทธิ์จากเซิร์ฟเวอร์ได้');
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
      
      setSuccess('บันทึกสิทธิ์การใช้งานเรียบร้อยแล้ว');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save permissions:', err);
      setError('ไม่สามารถบันทึกข้อมูลสิทธิ์ได้ กรุณาตรวจสอบว่ามีคอลเลกชัน "role_permissions" ใน Directus แล้ว');
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
            จัดการสิทธิ์การใช้งานเมนู
          </h1>
          <p className="text-gray-500 mt-1">กำหนดว่ากลุ่มผู้ใช้งานใดสามารถมองเห็นเมนูใดได้บ้าง</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span className="font-bold">{saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลงทั้งหมด'}</span>
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
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">กลุ่มผู้ใช้งาน</h3>
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
                <h2 className="text-lg font-bold text-gray-900">การตั้งค่าสิทธิ์สำหรับกลุ่ม {currentGroup.role}</h2>
                <p className="text-sm text-gray-500 mt-1">คลิกที่รายการเพื่อเปิดหรือปิดการแสดงผลเมนูสำหรับกลุ่มนี้</p>
              </div>
              
              <div className="p-6">
                {['โลจิสติกส์', 'การจัดการ', 'การบำรุงรักษา', 'ระบบ'].map(groupName => (
                  <div key={groupName} className="mb-8 last:mb-0">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="h-px flex-1 bg-gray-100"></div>
                      {groupName}
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
                              <p className="font-bold text-gray-900">{menu.label}</p>
                              <p className="text-xs text-gray-500">รหัสเมนู: {menu.key}</p>
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
              <p className="text-gray-500 font-medium">กรุณาเลือกกลุ่มผู้ใช้งานเพื่อจัดการสิทธิ์</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
