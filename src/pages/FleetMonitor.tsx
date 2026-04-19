import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { VehicleMap } from '../components/VehicleMap';
import { directusApi } from '../api/directus';
import { gpsApi } from '../api/gps';
import { Car, CarStatus } from '../types';
import { Activity, Clock, Navigation, Search, AlertCircle, Maximize2, Minimize2, Map as MapIcon, Car as CarIcon, CheckCircle2, XCircle, Zap, History, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const FleetMonitor: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cars, setCars] = useState<Car[]>([]);
  const [carStatuses, setCarStatuses] = useState<CarStatus[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<CarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countdown, setCountdown] = useState(() => {
    return parseInt(localStorage.getItem('map_update_interval') || '10', 10);
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const updateInterval = useMemo(() => {
    return parseInt(localStorage.getItem('map_update_interval') || '10', 10);
  }, []);

  const websiteName = localStorage.getItem('website_name') || 'NES Tracking';
  const websiteLogo = localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg';

  const fetchGpsData = async (carsData: Car[]) => {
    const BATCH_SIZE = 5;
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
              const name = user && typeof user === 'object' ? (user.display_name || (user.first_name ? `${user.first_name} ${user.last_name}` : null)) : null;
              return name;
            }).filter(Boolean).join(', ');
            return { 
              ...status, 
              memberName: assignedNames || car.owner_name,
              memberPhone: car.member_phone
            };
          } catch (err) {
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
      
      if (i + BATCH_SIZE < carsData.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    setCarStatuses(statuses);
  };

  const fetchData = async () => {
    setError(null);
    try {
      const carsData = await directusApi.getCars();
      setCars(carsData);
      await fetchGpsData(carsData);
      setCountdown(updateInterval);
    } catch (err: any) {
      console.error('Error fetching monitor data:', err);
      setError(err.message || t('failed_connect_server'));
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
          return updateInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cars]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const filteredStatuses = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return carStatuses.filter(s => 
      String(s.carNumber || '').toLowerCase().includes(search) ||
      String(s.memberName || '').toLowerCase().includes(search)
    );
  }, [carStatuses, searchTerm]);

  const stats = useMemo(() => ({
    total: cars.length,
    online: carStatuses.filter(s => s.status === 'online').length,
    offline: carStatuses.filter(s => s.status === 'offline').length,
    moving: carStatuses.filter(s => s.status === 'online' && s.speed > 0).length,
  }), [cars.length, carStatuses]);

  const carMap = useMemo(() => {
    const map = new Map();
    cars.forEach(car => map.set(car.car_number, car));
    return map;
  }, [cars]);

  if (loading && cars.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-emerald-500 font-medium tracking-widest uppercase text-sm">{t('initializing_monitor')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-300 flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-2 group"
            title={t('back')}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{t('back')}</span>
          </button>
          
          <div className="h-8 w-px bg-slate-800 mx-2"></div>

          <div className="w-10 h-10 bg-white rounded-lg p-1 flex items-center justify-center">
            <img src={websiteLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight leading-none">{websiteName}</h1>
            <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mt-1">{t('live_fleet_monitor')}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-slate-400">{t('updating_in')} <span className="text-white font-mono">{countdown}s</span></span>
            </div>
            <div className="h-4 w-px bg-slate-800"></div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{format(new Date(), 'HH:mm:ss')}</span>
            </div>
          </div>
          
          <button 
            onClick={toggleFullscreen}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title={t('toggle_fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Stats & List */}
        <div className="w-96 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 z-10 shadow-2xl">
          {/* Stats Grid */}
          <div className="p-4 grid grid-cols-2 gap-3 border-b border-slate-800">
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <CarIcon className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('total')}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('online')}</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{stats.online}</p>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('moving')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{stats.moving}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{t('offline')}</span>
              </div>
              <p className="text-2xl font-bold text-slate-400">{stats.offline}</p>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder={t('search_vehicles_drivers')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredStatuses.map((v) => {
              const isSelected = selectedVehicle?.carNumber === v.carNumber;
              const isOnline = v.status === 'online';
              const isMoving = isOnline && v.speed > 0;
              
              return (
                <div
                  key={v.carNumber}
                  onClick={() => setSelectedVehicle(v)}
                  className={`w-full text-left p-3 rounded-xl transition-all border cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-800 border-slate-600 shadow-lg' 
                      : 'bg-transparent border-transparent hover:bg-slate-800/50'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedVehicle(v);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        isMoving ? 'bg-blue-500 animate-pulse' : 
                        isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                      }`} />
                      <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {v.carNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {localStorage.getItem('is_admin') === 'true' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Open in new tab since we are already in a full-screen monitor
                            window.open(`/cars/${v.carNumber}/history`, '_blank');
                          }}
                          className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                          title={t('trip_history', 'ประวัติการเดินทาง')}
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className={`text-xs font-mono font-bold ${
                        isMoving ? 'text-blue-400' : 
                        isOnline ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {v.speed} km/h
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Navigation className="w-3 h-3 shrink-0" />
                      <span className="truncate">{v.address || t('unknown_location')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 truncate pr-2">
                        {v.memberName || t('no_driver_assigned')}
                      </span>
                      <span className="text-slate-600 font-mono shrink-0">
                        {format(new Date(v.lastUpdate), 'HH:mm:ss')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-slate-950">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-md">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          
          <VehicleMap 
            vehicles={carStatuses} 
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            center={selectedVehicle ? { lat: selectedVehicle.lat, lng: selectedVehicle.lng } : undefined}
            zoom={selectedVehicle ? 16 : 11}
            darkMode={true}
          />
        </div>
      </div>
    </div>
  );
};
