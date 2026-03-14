import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardStats } from '../components/DashboardStats';
import { VehicleMap } from '../components/VehicleMap';
import { directusApi } from '../api/directus';
import { gpsApi } from '../api/gps';
import { Car, CarStatus, Member } from '../types';
import { MapPin, Navigation, Clock, Search, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [carStatuses, setCarStatuses] = useState<CarStatus[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<CarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds

  const fetchGpsData = async (carsData: Car[]) => {
    const statuses = await Promise.all(
      carsData.map(async (car) => {
        try {
          const status = await gpsApi.getCarStatus(car.car_number);
          const assignedNames = (car.car_users || (car as any).line_users)?.map((cu: any) => {
            const user = cu.line_user_id || cu;
            if (!user) return null;
            const source = user.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
            const name = user.display_name || (user.first_name ? `${user.first_name} ${user.last_name}` : null);
            return name ? `${name} ${source}` : null;
          }).filter(Boolean).join(', ');
          return { 
            ...status, 
            driverName: assignedNames || car.owner_name,
            driverPhone: car.driver_phone
          };
        } catch (err) {
          console.warn(`Could not fetch status for ${car.car_number}`);
          return {
            carNumber: car.car_number,
            lat: 0,
            lng: 0,
            speed: 0,
            address: "Data unavailable",
            lastUpdate: new Date().toISOString(),
            status: 'offline' as const,
            driverName: car.owner_name
          };
        }
      })
    );
    setCarStatuses(statuses);
  };

  const fetchData = async () => {
    setError(null);
    try {
      const isAdminUser = localStorage.getItem('is_admin') === 'true';
      const userRole = localStorage.getItem('user_role');
      const memberId = localStorage.getItem('member_id');

      // Fetch members and cars
      let membersData = [];
      let carsData = [];

      try {
        const [m, c] = await Promise.all([
          directusApi.getMembers(),
          directusApi.getCars()
        ]);
        membersData = m;
        carsData = c;
      } catch (fetchErr: any) {
        console.error('Initial fetch error:', fetchErr);
        // If cars fail, we can't show much, but if only members fail, we might continue
        if (fetchErr.message?.includes('line_users')) {
          // Only members failed, try fetching cars separately
          carsData = await directusApi.getCars();
        } else {
          throw fetchErr;
        }
      }

      let finalCars = carsData;
      if (!isAdminUser && userRole === 'customer' && memberId) {
        finalCars = carsData.filter(car => 
          car.car_users?.some((cu: any) => {
            const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
            return String(cuId) === String(memberId);
          })
        );
      }

      setMembers(membersData);
      setCars(finalCars);

      // Initial GPS fetch
      await fetchGpsData(finalCars);
      setCountdown(600);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      if (err.response?.status !== 401) {
        setError(err.response?.data?.errors?.[0]?.message || err.message || 'Failed to connect to the server');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const filteredStatuses = carStatuses.filter(s => 
    (s.carNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalVehicles: cars.length,
    onlineVehicles: carStatuses.filter(s => s.status === 'online').length,
    offlineVehicles: carStatuses.filter(s => s.status === 'offline').length,
    totalMembers: members.length
  };

  const handleZoomToVehicle = (vehicle: CarStatus) => {
    setSelectedVehicle(vehicle);
    // In a real app, we might need to trigger a map center change here
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('dashboard')}</h2>
          <p className="text-slate-500">{t('real_time_monitoring')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-sm font-medium text-slate-600">
            <Clock className="w-4 h-4" />
            {t('last_update')}: {carStatuses.length > 0 
              ? format(new Date(Math.max(...carStatuses.map(s => new Date(s.lastUpdate).getTime()))), 'HH:mm:ss')
              : format(new Date(), 'HH:mm:ss')}
          </div>
          <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 text-sm font-bold text-primary">
            <Sparkles className="w-4 h-4 animate-pulse" />
            {t('next_update')}: {formatCountdown(countdown)}
          </div>
        </div>
      </div>

      <DashboardStats {...stats} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[500px] lg:h-[600px]">
          <VehicleMap 
            vehicles={carStatuses} 
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            center={selectedVehicle ? { lat: selectedVehicle.lat, lng: selectedVehicle.lng } : undefined}
            zoom={selectedVehicle ? 15 : 12}
          />
        </div>
      </div>

      {/* Vehicle List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[500px] lg:h-[600px]">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('vehicles')}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
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
              <div className="space-y-2">
                {filteredStatuses.map((v) => (
                  <div
                    key={v.carNumber}
                    className={`w-full p-4 rounded-2xl transition-all border ${
                      selectedVehicle?.carNumber === v.carNumber 
                        ? "bg-blue-50 border-primary ring-1 ring-primary" 
                        : "bg-white border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-slate-900 text-base">{v.carNumber}</span>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">
                          {t('driver')}: {v.driverName || 'N/A'}
                        </p>
                        {v.driverPhone && (
                          <p className="text-[10px] text-slate-500 font-medium">
                            {v.driverPhone}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        v.status === 'online' ? "bg-blue-100 text-primary" : "bg-slate-100 text-slate-600"
                      }`}>
                        {v.status === 'online' ? t('online') : t('offline')}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
                      <div className="bg-slate-100/50 p-2 rounded-lg">
                        <p className="text-slate-400 uppercase font-bold text-[9px]">Latitude</p>
                        <p className="text-slate-700 font-mono">{v.lat.toFixed(4)}</p>
                      </div>
                      <div className="bg-slate-100/50 p-2 rounded-lg">
                        <p className="text-slate-400 uppercase font-bold text-[9px]">Longitude</p>
                        <p className="text-slate-700 font-mono">{v.lng.toFixed(4)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(v.lastUpdate), 'HH:mm:ss')}</span>
                      </div>
                      <button 
                        onClick={() => handleZoomToVehicle(v)}
                        className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        {t('vehicles')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
