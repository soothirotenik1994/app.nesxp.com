import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardStats } from '../components/DashboardStats';
import { VehicleMap } from '../components/VehicleMap';
import { directusApi } from '../api/directus';
import { gpsApi } from '../api/gps';
import { Car, CarStatus, Member } from '../types';
import { MapPin, Navigation, Clock, Search, Sparkles, AlertCircle, Activity, Zap, Map as MapIcon, ChevronRight, Hash } from 'lucide-react';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [carStatuses, setCarStatuses] = useState<CarStatus[]>([]);
  const [activeJobsByCar, setActiveJobsByCar] = useState<Map<string, any>>(new Map());
  const [selectedVehicle, setSelectedVehicle] = useState<CarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds

  const fetchGpsData = async (carsData: Car[]) => {
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
      let carsData: Car[] = [];

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

      let finalCars: Car[] = [];
      if (isAdminUser) {
        finalCars = carsData;
      } else if (memberId) {
        // 1. Get cars from active jobs (so GPS tracking from reports works)
        // For customers, we ONLY show cars from their active jobs as requested
        let jobCars: Car[] = [];
        try {
          const allReports = await directusApi.getWorkReports();
          const myActiveReports = allReports.filter(r => {
            // Only active jobs
            if (r.status === 'completed' || r.status === 'cancelled') return false;

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
            } else if (userRole === 'member') {
              const rMemberId = typeof r.member_id === 'object' ? r.member_id?.id : r.member_id;
              return String(rMemberId) === String(memberId);
            }
            return false;
          });

          // Extract car IDs from active reports
          const activeCarIds = new Set(myActiveReports.map(r => {
            const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
            return String(carId);
          }));

          // Create active jobs map
          const jobsMap = new Map();
          myActiveReports.forEach(r => {
            const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
            const carNum = typeof r.car_id === 'object' ? (r.car_id as any).car_number : null;
            if (carId) jobsMap.set(String(carId), r);
            if (carNum) jobsMap.set(String(carNum), r);
          });
          setActiveJobsByCar(jobsMap);

          // Find these cars in carsData
          jobCars = carsData.filter(car => activeCarIds.has(String(car.id)));
        } catch (e) {
          console.error('Error fetching job cars:', e);
        }

        // 2. Get cars with direct permissions (car_users) - only for non-customers or if needed
        // But the user specifically said "only cars in jobs" for customers
        let permittedCars: Car[] = [];
        if (userRole !== 'customer') {
          permittedCars = carsData.filter(car => 
            car.car_users?.some((cu: any) => {
              const cuId = cu.line_user_id && typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
              return String(cuId) === String(memberId);
            })
          );
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

      setMembers(membersData);
      setCars(finalCars);

      // Initial GPS fetch
      await fetchGpsData(finalCars);
      setCountdown(600);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      if (err.response?.status !== 401) {
        setError(err.response?.data?.errors?.[0]?.message || err.message || t('failed_connect_server'));
      }
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
          return 600;
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
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('dashboard')}</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-sm font-medium text-slate-600 shadow-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 mr-1">{t('last_update')}:</span>
            <span className="font-semibold">
              {carStatuses.length > 0 
                ? format(new Date(Math.max(...carStatuses.map(s => new Date(s.lastUpdate).getTime()))), 'HH:mm:ss')
                : format(new Date(), 'HH:mm:ss')}
            </span>
          </div>
          
          <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 text-sm font-bold text-primary shadow-sm">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="text-xs text-blue-400 mr-1">{t('next_update')}:</span>
            <span>{formatCountdown(countdown)}</span>
          </div>
        </div>
      </div>

      <DashboardStats {...stats} showOnlyTotal={localStorage.getItem('user_role')?.toLowerCase() === 'customer'} />

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
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-500 text-sm">{t('loading')}</p>
              </div>
            ) : filteredStatuses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t('no_data')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-12 px-6 py-2 bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
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
                      className={`grid grid-cols-12 items-center px-6 py-4 transition-all cursor-pointer hover:bg-slate-50 ${
                        isSelected ? "bg-blue-50 border-l-4 border-primary" : "bg-white"
                      }`}
                    >
                      <div className="col-span-4 flex flex-col pr-2">
                        <span className={`text-sm font-bold tracking-tight ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
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
                      
                      <div className="col-span-3 flex flex-col items-end">
                        <span className="text-[10px] font-medium text-slate-400">
                          {format(new Date(v.lastUpdate), 'HH:mm:ss')}
                        </span>
                        <ChevronRight className={`w-3 h-3 mt-1 ${isSelected ? 'text-primary' : 'text-slate-200'}`} />
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
