import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardStats } from '../components/DashboardStats';
import { VehicleMap } from '../components/VehicleMap';
import { directusApi, api } from '../api/directus';
import { gpsApi } from '../api/gps';
import { Car as CarType, CarStatus, Member } from '../types';
import { MapPin, Navigation, Clock, Search, Sparkles, AlertCircle, Activity, Zap, Map as MapIcon, ChevronRight, Hash, History, TrendingUp, Package, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar, CheckCircle2, Wrench, Car as CarIcon } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { formatDateTime } from '../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { clsx } from 'clsx';
import { ROLE_PERMISSIONS } from '../config/menuPermissions';
import { CustomerDashboard } from './CustomerDashboard';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [cars, setCars] = useState<CarType[]>([]);
  const [carStatuses, setCarStatuses] = useState<CarStatus[]>([]);
  const [activeJobsByCar, setActiveJobsByCar] = useState<Map<string, any>>(new Map());
  const [selectedVehicle, setSelectedVehicle] = useState<CarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countdown, setCountdown] = useState(30); 
  const [updateInterval, setUpdateInterval] = useState(30);
  const [jobStats, setJobStats] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    freeCars: 0,
    busyCars: 0,
    maintenanceAlerts: 0,
    latePending: 0
  });

  const userRole = localStorage.getItem('user_role') || 'Customer';
  const [hasMonitorPermission, setHasMonitorPermission] = useState(false);

  useEffect(() => {
    const checkPermission = () => {
      // 1. Check dynamic permissions
      const dynamicPermissionsRaw = localStorage.getItem('dynamic_role_permissions');
      if (dynamicPermissionsRaw) {
        try {
          const dynamicPermissions = JSON.parse(dynamicPermissionsRaw);
          const roleKey = Object.keys(dynamicPermissions).find(
            r => r.toLowerCase() === userRole.toLowerCase()
          );
          if (roleKey && dynamicPermissions[roleKey]['live_monitor'] !== undefined) {
            return dynamicPermissions[roleKey]['live_monitor'] === true;
          }
        } catch (e) {}
      }
      
      // 2. Fallback to static config
      const fallbackRoleKey = Object.keys(ROLE_PERMISSIONS).find(
        r => r.toLowerCase() === userRole.toLowerCase()
      );
      const permissions = ROLE_PERMISSIONS[fallbackRoleKey || ''] || ROLE_PERMISSIONS['Driver'];
      return (permissions as any)['live_monitor'] === true;
    };
    setHasMonitorPermission(checkPermission());
  }, [userRole]);

  // Handle role-based rendering AFTER all hooks have been called
  if (userRole.toLowerCase() === 'customer') {
    return <CustomerDashboard />;
  }

  const fetchGpsData = async (carsData: CarType[]) => {
    const BATCH_SIZE = 3;
    const statuses: CarStatus[] = [];

    for (let i = 0; i < carsData.length; i += BATCH_SIZE) {
      const batch = carsData.slice(i, i + BATCH_SIZE);
      const batchStatuses = await Promise.all(
        batch.map(async (car) => {
          try {
            const status = await gpsApi.getCarStatus(car.car_number);
            const assignedNames = (car.car_users || (car as any).line_users)?.map((cu: any) => {
              if (!cu) return null;
              const user = cu.line_user_id && typeof cu.line_user_id === 'object' ? cu.line_user_id : cu;
              if (!user) return null;
              const source = user && typeof user === 'object' && (user as any).line_user_id ? t('registered_via_line') : t('created_by_admin');
              const name = user && typeof user === 'object' ? (user.display_name || (user.first_name ? `${user.first_name} ${user.last_name}` : null)) : null;
              return name ? `${name} (${source})` : null;
            }).filter(Boolean).join(', ');
            return { 
              ...status, 
              memberName: assignedNames || car.owner_name,
              memberPhone: car.member_phone
            };
          } catch (err) {
            console.warn(`Could not fetch status for ${car.car_number}`);
            return {
              carNumber: car.car_number,
              lat: 0,
              lng: 0,
              speed: 0,
              address: t('data_unavailable'),
              lastUpdate: new Date().toISOString(),
              status: 'offline' as const,
              memberName: car.owner_name
            };
          }
        })
      );
      statuses.push(...(batchStatuses as CarStatus[]));
      
      // Add a delay between batches to respect rate limits
      if (i + BATCH_SIZE < carsData.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    setCarStatuses(statuses);
  };

  const fetchData = async () => {
    setError(null);
    try {
      const userRoleRaw = localStorage.getItem('user_role');
      const userRole = userRoleRaw?.toLowerCase();
      const isAdminUser = localStorage.getItem('is_admin') === 'true' && 
                          (userRole === 'admin' || userRole === 'administrator');
      const memberId = localStorage.getItem('member_id');

      // Fetch members and cars
      let membersData: Member[] = [];
      let carsData: CarType[] = [];

      try {
        // Optimization: If not admin, we might not need to fetch ALL members
        // but for now we keep it simple and try to fetch both.
        // If one fails, we handle it gracefully.
        
        if (isAdminUser) {
          const [m, c] = await Promise.all([
            directusApi.getMembers(),
            directusApi.getCars()
          ]);
          membersData = m;
          carsData = c;
        } else {
          // For non-admins, we still need cars to filter, but maybe we don't need all members
          // Try fetching cars first as they are critical for the dashboard
          carsData = await directusApi.getCars();
          try {
            membersData = await directusApi.getMembers();
          } catch (mErr) {
            console.warn('Could not fetch all members, continuing with cars only');
          }
        }
      } catch (fetchErr: any) {
        // Only log if it's not a 401 (which is handled by the interceptor)
        if (fetchErr.response?.status !== 401) {
          console.error('Initial fetch error:', fetchErr);
        }
        
        // If it's a 401, the interceptor will handle the redirect, 
        // but we should still stop execution here.
        if (fetchErr.response?.status === 401) {
          return;
        }

        // If cars fail, we can't show much, but if only members fail, we might continue
        if (fetchErr.message?.includes('line_users') || fetchErr.response?.data?.errors?.[0]?.message?.includes('line_users')) {
          // Only members failed, try fetching cars separately
          carsData = await directusApi.getCars();
        } else {
          throw fetchErr;
        }
      }

      let finalCars: CarType[] = [];
      if (isAdminUser) {
        finalCars = carsData;
      } else if (memberId) {
        // 1. Get cars from active jobs (so GPS tracking from reports works)
        // For customers, we ONLY show cars from their active jobs as requested
        let jobCars: CarType[] = [];
        try {
          const allReports = await directusApi.getWorkReports();
          const myActiveReports = allReports.filter(r => {
            // Only active jobs
            if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'deleted') return false;

            if (userRole === 'customer') {
              const customerLoc = typeof r.customer_id === 'object' ? r.customer_id : null;
              if (!customerLoc) return false;
              
              const memberIds: string[] = [];
              const primaryId = typeof customerLoc.member_id === 'object' ? customerLoc.member_id?.id : customerLoc.member_id;
              if (primaryId) memberIds.push(String(primaryId));
              
              if (customerLoc.members && Array.isArray(customerLoc.members)) {
                customerLoc.members.forEach((m: any) => {
                  const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
                  if (id) memberIds.push(String(id));
                });
              }
              return memberIds.includes(String(memberId));
            } else if (userRole === 'member' || userRole === 'driver') {
              const rMemberId = typeof r.member_id === 'object' ? r.member_id?.id : r.member_id;
              const rDriverId = typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id;
              return String(rMemberId) === String(memberId) || String(rDriverId) === String(memberId);
            }
            return false;
          });

          // Extract car IDs from active reports
          const activeCarIds = new Set(myActiveReports.map(r => {
            const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
            return String(carId);
          }));

          // Create active jobs map and extract car objects
          const jobsMap = new Map();
          myActiveReports.forEach(r => {
            const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
            const carNum = typeof r.car_id === 'object' ? (r.car_id as any).car_number : null;
            if (carId) jobsMap.set(String(carId), r);
            if (carNum) jobsMap.set(String(carNum), r);
            
            // If car_id is an object, it contains the car details
            if (typeof r.car_id === 'object' && r.car_id !== null) {
              // Only add if not already in jobCars
              if (!jobCars.some(c => c.id === r.car_id.id)) {
                jobCars.push(r.car_id as CarType);
              }
            }
          });
          setActiveJobsByCar(jobsMap);

          // Also find these cars in carsData (in case they have more details)
          const carsFromData = carsData.filter(car => activeCarIds.has(String(car.id)));
          carsFromData.forEach(car => {
            const index = jobCars.findIndex(c => c.id === car.id);
            if (index >= 0) {
              jobCars[index] = { ...jobCars[index], ...car };
            } else {
              jobCars.push(car);
            }
          });
        } catch (e: any) {
          if (e.response?.status === 401) return;
          console.error('Error fetching job cars:', e);
        }

        // 2. Get cars with direct permissions (car_users) - only for non-customers or if needed
        // But the user specifically said "only cars in jobs" for customers
        let permittedCars: CarType[] = [];
        if (userRole !== 'customer') {
          try {
            const permissions = await directusApi.getCarPermissions(memberId);
            const permittedCarIds = new Set(permissions.map(p => {
              const carId = typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
              return String(carId);
            }));
            
            permittedCars = carsData.filter(car => 
              permittedCarIds.has(String(car.id)) ||
              car.car_users?.some((cu: any) => {
                const cuId = cu.line_user_id && typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                return String(cuId) === String(memberId);
              })
            );

            // If carsData was empty (e.g. due to permissions), fetch permitted cars directly
            if (permittedCars.length === 0 && permittedCarIds.size > 0) {
              const carPromises = Array.from(permittedCarIds).map(id => 
                api.get(`/items/cars/${id}`).then(res => res.data.data).catch(() => null)
              );
              const fetchedCars = await Promise.all(carPromises);
              permittedCars = fetchedCars.filter(Boolean) as CarType[];
            }
          } catch (e) {
            console.error('Error fetching car permissions:', e);
            // Fallback to checking car.car_users if getCarPermissions fails
            permittedCars = carsData.filter(car => 
              car.car_users?.some((cu: any) => {
                const cuId = cu.line_user_id && typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                return String(cuId) === String(memberId);
              })
            );
          }
        }

        // Combine and unique by car ID
        const combined = [...permittedCars, ...jobCars];
        finalCars = combined.filter((car, index, self) =>
          index === self.findIndex((c) => c.id === car.id)
        );
      } else {
        // Non-admin without memberId sees nothing
        finalCars = [];
      }

      // Filter members to only those "related" to the user
      let relatedMembers = membersData;
      if (!isAdminUser && memberId) {
        const relatedMemberIds = new Set<string>();
        relatedMemberIds.add(memberId);
        
        // Add members linked to my cars
        finalCars.forEach(car => {
          car.car_users?.forEach((cu: any) => {
            const cuId = cu.line_user_id && typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
            if (cuId) relatedMemberIds.add(String(cuId));
          });
        });

        // Also try to find members in the same customer location
        try {
          const customerLocs = await directusApi.getCustomerLocations();
          const myLoc = customerLocs.find(loc => {
            const primaryId = typeof loc.member_id === 'object' ? loc.member_id?.id : loc.member_id;
            if (String(primaryId) === String(memberId)) return true;
            return loc.members?.some((m: any) => {
              const mId = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
              return String(mId) === String(memberId);
            });
          });
          
          if (myLoc) {
            const primaryId = typeof myLoc.member_id === 'object' ? myLoc.member_id?.id : myLoc.member_id;
            if (primaryId) relatedMemberIds.add(String(primaryId));
            myLoc.members?.forEach((m: any) => {
              const mId = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
              if (mId) relatedMemberIds.add(String(mId));
            });
          }
        } catch (e) {
          console.warn('Could not fetch customer locations for member filtering');
        }
        
        relatedMembers = membersData.filter(m => relatedMemberIds.has(String(m.id)));
      }

      setMembers(relatedMembers);
      setCars(finalCars);

      // Fetch job stats for chart
      try {
        const reports = await directusApi.getWorkReports();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = subDays(new Date(), i);
          return format(d, 'yyyy-MM-dd');
        }).reverse();

        const statsMap = new Map();
        last7Days.forEach(date => statsMap.set(date, 0));

        reports.forEach(r => {
          const date = format(new Date(r.work_date || r.date_created), 'yyyy-MM-dd');
          if (statsMap.has(date)) {
            statsMap.set(date, statsMap.get(date) + 1);
          }
        });

        const chartData = last7Days.map(date => ({
          date: format(new Date(date), 'dd MMM'),
          jobs: statsMap.get(date)
        }));
        setJobStats(chartData);
        
        // Set recent jobs
        const sortedReports = reports.sort((a, b) => 
          new Date(b.work_date || b.date_created || 0).getTime() - new Date(a.work_date || a.date_created || 0).getTime()
        );
        setRecentJobs(sortedReports.slice(0, 5));

        // Calculate Daily Stats
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayReports = reports.filter(r => {
          const rDate = format(new Date(r.work_date || r.date_created), 'yyyy-MM-dd');
          return rDate === today;
        });

        const activeCarIds = new Set();
        reports.forEach(r => {
          if (r.status === 'accepted' || r.status === 'in_progress') {
            const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
            if (carId) activeCarIds.add(String(carId));
          }
        });

        // Calculate Maintenance Alerts
        let maintenanceAlertsCount = 0;
        const now = new Date();
        carsData.forEach(car => {
          let hasAlert = false;
          if ((car as any).next_maintenance_date) {
            const nextDate = new Date((car as any).next_maintenance_date);
            if (nextDate < now) hasAlert = true;
          }
          if ((car as any).next_maintenance_mileage && (car as any).current_mileage) {
            if ((car as any).current_mileage >= (car as any).next_maintenance_mileage) hasAlert = true;
          }
          if (hasAlert) maintenanceAlertsCount++;
        });

        const pendingJobs = todayReports.filter(r => r.status === 'pending');
        const lateThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
        const latePendingCount = pendingJobs.filter(r => {
          const createdAt = new Date(r.date_created || Date.now());
          return createdAt < lateThreshold;
        }).length;

        setDailyStats({
          total: todayReports.length,
          completed: todayReports.filter(r => r.status === 'completed').length,
          inProgress: todayReports.filter(r => r.status === 'accepted' || r.status === 'in_progress').length,
          pending: pendingJobs.length,
          busyCars: activeCarIds.size,
          freeCars: Math.max(0, carsData.length - activeCarIds.size),
          maintenanceAlerts: maintenanceAlertsCount,
          latePending: latePendingCount
        });
      } catch (e) {
        console.error('Error fetching job stats:', e);
      }

      // Initial GPS fetch
      await fetchGpsData(finalCars);
      
      // Fetch map update interval from settings
      const settings = await directusApi.getSystemSettings();
      if (settings && settings.map_update_interval) {
        const interval = parseInt(String(settings.map_update_interval), 10);
        setUpdateInterval(interval);
        setCountdown(interval);
        localStorage.setItem('map_update_interval', String(interval));
      } else {
        const localInterval = parseInt(localStorage.getItem('map_update_interval') || '30', 10);
        setUpdateInterval(localInterval);
        setCountdown(localInterval);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        return;
      }
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.errors?.[0]?.message || err.message || t('failed_connect_server'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (carStatuses.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const vehicleNum = params.get('vehicle');
      if (vehicleNum) {
        const vehicle = carStatuses.find(s => s.carNumber === vehicleNum);
        if (vehicle) {
          setSelectedVehicle(vehicle);
        }
      }
    }
  }, [carStatuses]);

  useEffect(() => {
    if (cars.length === 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchGpsData(cars);
          return updateInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cars]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredStatuses = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return carStatuses.filter(s => 
      String(s.carNumber || '').toLowerCase().includes(search)
    );
  }, [carStatuses, searchTerm]);

  const stats = useMemo(() => ({
    totalVehicles: cars.length,
    onlineVehicles: carStatuses.filter(s => s.status === 'online').length,
    offlineVehicles: carStatuses.filter(s => s.status === 'offline').length,
    totalMembers: members.length
  }), [cars.length, carStatuses, members.length]);

  const carMap = useMemo(() => {
    const map = new Map();
    cars.forEach(car => map.set(car.car_number, car));
    return map;
  }, [cars]);

  const handleZoomToVehicle = useCallback((vehicle: CarStatus) => {
    setSelectedVehicle(vehicle);
  }, []);

  const formatCaseNumber = (report: any) => {
    if (!report) return '';
    if (report.case_number) return report.case_number;
    
    // Fallback for existing reports
    const date = new Date(report.work_date || report.date_created || Date.now());
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const sequence = String(report.id).padStart(4, '0');
    
    // Consistent "random" part based on ID
    const random = Math.floor((Math.abs(Math.sin(Number(report.id)) * 10000) % 9000) + 1000);
    return `TH${dateStr}${sequence}${random}`;
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">{t('vehicle_tracking_system')}</h2>
          {hasMonitorPermission && (
            <button 
              onClick={() => window.open('/monitor', '_blank')}
              className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
            >
              <Activity className="w-4 h-4" />
              {t('live_monitor', 'Live Monitor')}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-sm font-medium text-slate-600 shadow-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 mr-1">{t('last_update')}:</span>
            <span className="font-semibold text-slate-900">
              {carStatuses.length > 0 
                ? format(new Date(Math.max(...carStatuses.map(s => new Date(s.lastUpdate).getTime()))), 'HH:mm:ss')
                : format(new Date(), 'HH:mm:ss')}
            </span>
          </div>
          
          <div className="bg-white px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 text-sm font-bold text-primary shadow-sm">
            <RefreshCw className={clsx("w-4 h-4", countdown < 10 && "animate-spin")} />
            <span className="text-xs text-blue-400 mr-1">{t('next_update')}:</span>
            <span>{formatCountdown(countdown)}</span>
          </div>
        </div>
      </div>

      <DashboardStats 
        {...stats} 
        showOnlyTotal={
          localStorage.getItem('user_role')?.toLowerCase() === 'customer' || 
          localStorage.getItem('user_role')?.toLowerCase() === 'driver'
        } 
      />

      {/* Daily Operations Dashboard - Only for Admin/Admins */}
      {(userRole.toLowerCase() === 'admin' || userRole.toLowerCase() === 'administrator') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Today's Jobs Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {t('daily_jobs_summary', 'สรุปงานวันนี้')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase">{t('total', 'ทั้งหมด')}</p>
                <p className="text-2xl font-black text-slate-900">{dailyStats.total}</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">{t('completed', 'เสร็จสิ้น')}</p>
                <p className="text-2xl font-black text-emerald-700">{dailyStats.completed}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <p className="text-[10px] font-bold text-blue-600 uppercase">{t('in_progress', 'กำลังดำเนินการ')}</p>
                <p className="text-2xl font-black text-blue-700">{dailyStats.inProgress}</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-600 uppercase">{t('pending', 'รอรับงาน')}</p>
                <p className="text-2xl font-black text-amber-700">{dailyStats.pending}</p>
              </div>
            </div>
          </div>

          {/* Vehicle Status Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CarIcon className="w-4 h-4 text-primary" />
              {t('vehicle_availability', 'สถานะความพร้อมของรถ')}
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">{t('free_cars', 'รถว่าง (พร้อมรับงาน)')}</p>
                    <p className="text-[10px] text-emerald-600">{t('ready_to_serve', 'พร้อมให้บริการ')}</p>
                  </div>
                </div>
                <p className="text-3xl font-black text-emerald-700">{dailyStats.freeCars}</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center text-white">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t('busy_cars', 'รถไม่ว่าง (ติดงาน)')}</p>
                    <p className="text-[10px] text-slate-500">{t('currently_on_job', 'กำลังอยู่ระหว่างงาน')}</p>
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-700">{dailyStats.busyCars}</p>
              </div>
            </div>
          </div>

          {/* Action Required / Quick Info */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              {t('attention_required', 'สิ่งที่ต้องตรวจสอบ')}
            </h3>
            <div className="space-y-3">
              {dailyStats.latePending > 0 ? (
                <div 
                  onClick={() => navigate('/reports?status=pending')}
                  className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white animate-pulse">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-900">{t('late_acceptance_warning', 'งานรอรับนานผิดปกติ')}</p>
                      <p className="text-xs text-red-600">{t('late_pending_count', { count: dailyStats.latePending })}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-400" />
                </div>
              ) : dailyStats.pending > 0 ? (
                <div 
                  onClick={() => navigate('/jobs/history')}
                  className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-amber-800">{t('jobs_awaiting_acceptance', 'มีงานที่ยังไม่มีคนกดรับ')}</span>
                  </div>
                  <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">{dailyStats.pending}</span>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-600">{t('all_jobs_assigned', 'งานทั้งหมดถูกรับมอบหมายแล้ว')}</span>
                </div>
              )}

              {dailyStats.maintenanceAlerts > 0 && (
                <div 
                  onClick={() => navigate('/maintenance')}
                  className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between cursor-pointer hover:bg-rose-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center text-white">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-rose-900">{t('vehicles_due_maintenance', 'มีรถที่ต้องซ่อมบำรุง')}</p>
                      <p className="text-xs text-rose-600">{t('maintenance_due_count', { count: dailyStats.maintenanceAlerts })}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400" />
                </div>
              )}
              
              <div 
                onClick={() => navigate('/cars')}
                className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-blue-800">{t('monitor_truck_movements', 'ตรวจสอบการเคลื่อนไหวรถ')}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400" />
              </div>

              {dailyStats.maintenanceAlerts > 0 && (
                <div 
                  onClick={() => navigate('/maintenance')}
                  className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-800">{t('vehicles_due_maintenance', 'มีรถที่ต้องซ่อมบำรุง')}</span>
                  </div>
                  <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded-full font-bold">{dailyStats.maintenanceAlerts}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {t('delivery_performance', 'ประสิทธิภาพการส่งสินค้า')}
              </h3>
              <p className="text-xs text-slate-500">{t('last_7_days', '7 วันที่ผ่านมา')}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">
              <ArrowUpRight className="w-3 h-3" />
              +12.5%
            </div>
          </div>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={jobStats}>
                <defs>
                  <linearGradient id="colorJobs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003399" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#003399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: '#1e293b'
                  }}
                  itemStyle={{ color: '#1e293b' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#64748b' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="jobs" 
                  stroke="#003399" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorJobs)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Jobs Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {t('recent_jobs', 'งานล่าสุด')}
            </h3>
            <button 
              onClick={() => navigate('/jobs/history')}
              className="text-xs font-bold text-primary hover:underline"
            >
              {t('view_all', 'ดูทั้งหมด')}
            </button>
          </div>

          <div className="space-y-4">
            {recentJobs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                {t('no_data')}
              </div>
            ) : (
              recentJobs.map((job) => (
                <div 
                  key={job.id}
                  onClick={() => navigate(`/jobs/edit/${job.id}`)}
                  className="group p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-blue-50/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-slate-400">#{formatCaseNumber(job)}</span>
                    <span className={`px-3 py-1 text-[9px] font-bold rounded-full uppercase ${
                      job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      job.status === 'accepted' ? 'bg-amber-100 text-amber-700' :
                      job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {t('status_' + job.status, t(job.status))}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:bg-[#003399] group-hover:text-white transition-all shadow-sm">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {job.customer_name || t('no_customer')}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {formatDateTime(job.work_date || job.date_created)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
          <button 
            onClick={fetchData}
            className="text-sm font-bold underline hover:no-underline"
          >
            {t('try_again')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[500px] lg:h-[600px] relative">
            <VehicleMap 
              vehicles={carStatuses} 
              selectedVehicle={selectedVehicle}
              onSelectVehicle={setSelectedVehicle}
              onViewHistory={(v) => navigate(`/cars/${v.carNumber}/history`)}
              center={selectedVehicle ? { lat: selectedVehicle.lat, lng: selectedVehicle.lng } : undefined}
              zoom={selectedVehicle ? 15 : 12}
            />
            
            {/* Map Overlay Info */}
            {selectedVehicle && (() => {
              return (
                <div className="absolute bottom-4 left-4 right-4 lg:left-auto lg:w-72 bg-white p-4 rounded-xl border border-slate-200 shadow-lg z-[1000]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900">{selectedVehicle.carNumber}</h4>
                      <p className="text-xs text-slate-500">{selectedVehicle.memberName || t('no_member')}</p>
                    </div>
                    <div className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                      selectedVehicle.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedVehicle.status === 'online' ? t('online') : t('offline')}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Navigation className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{selectedVehicle.address || t('locating')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Activity className="w-3 h-3 text-slate-400" />
                      <span>{selectedVehicle.speed} km/h</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedVehicle(null)}
                    className="mt-3 w-full py-1.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    {t('close')}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Vehicle List Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[500px] lg:h-[600px] overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">{t('vehicles')}</h3>
              <div className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">
                {filteredStatuses.length} {t('units')}
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('loading')}</p>
              </div>
            ) : filteredStatuses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t('no_data')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-12 px-6 py-2 bg-white sticky top-0 z-10 border-b border-slate-100">
                  <span className="col-span-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('vehicle')}</span>
                  <span className="col-span-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('status')}</span>
                  <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">{t('update')}</span>
                </div>
                
                {filteredStatuses.map((v) => {
                  const carInfo = carMap.get(v.carNumber);
                  const isSelected = selectedVehicle?.carNumber === v.carNumber;
                  
                  return (
                    <div
                      key={v.carNumber}
                      onClick={() => handleZoomToVehicle(v)}
                      className={clsx(
                        "grid grid-cols-12 items-center px-6 py-4 transition-all cursor-pointer hover:bg-white",
                        isSelected ? "bg-blue-50 border-l-4 border-primary" : "bg-white"
                      )}
                    >
                      <div className="col-span-4 flex flex-col pr-2">
                        <span className={clsx(
                          "text-sm font-bold tracking-tight",
                          isSelected ? 'text-primary' : 'text-slate-900'
                        )}>
                          {v.carNumber}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400 uppercase truncate">
                          {carInfo?.vehicle_type || t('general')}
                        </span>
                      </div>
                      
                      <div className="col-span-5 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            v.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                          }`} />
                          <span className={`text-[10px] font-bold uppercase ${
                            v.status === 'online' ? 'text-emerald-600' : 'text-slate-400'
                          }`}>
                            {v.status === 'online' ? t('online') : t('offline')}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {v.speed} km/h
                        </div>
                      </div>
                      
                      <div className="col-span-3 flex flex-col items-end gap-1">
                        <span className="text-[10px] font-medium text-slate-400">
                          {format(new Date(v.lastUpdate), 'HH:mm:ss')}
                        </span>
                        <div className="flex items-center gap-1">
                          {localStorage.getItem('is_admin') === 'true' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/cars/${v.carNumber}/history`);
                              }}
                              className="p-1 text-slate-400 hover:text-primary hover:bg-blue-50 rounded transition-colors"
                              title={t('trip_history', 'ประวัติการเดินทาง')}
                            >
                              <History className="w-3 h-3" />
                            </button>
                          )}
                          <ChevronRight className={`w-3 h-3 ${isSelected ? 'text-primary' : 'text-slate-200'}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
