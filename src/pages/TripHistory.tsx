import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { directusApi } from '../api/directus';
import { Car } from '../types';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Calendar, Clock, MapPin, Navigation, Activity, Search, AlertCircle, Info } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let StartIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let EndIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map bounds
const MapBounds: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);

  return null;
};

export const TripHistory: React.FC = () => {
  const { t } = useTranslation();
  const { carNumber } = useParams<{ carNumber?: string }>();
  const navigate = useNavigate();

  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<string>(carNumber || '');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date/Time filters
  const [startDate, setStartDate] = useState(format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState(format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"));

  // Role and restrictions
  const userRoleRaw = localStorage.getItem('user_role') || '';
  const userRole = userRoleRaw.toLowerCase();
  const isAdmin = userRole === 'administrator' || userRole === 'admin';
  const memberId = localStorage.getItem('member_id');
  const [jobTimeframes, setJobTimeframes] = useState<Map<string, {start: string, end: string}>>(new Map());

  useEffect(() => {
    const fetchCarsAndJobs = async () => {
      try {
        const allCars = await directusApi.getCars();
        
        if (isAdmin) {
          setCars(allCars);
          if (!selectedCar && allCars.length > 0) {
            setSelectedCar(allCars[0].car_number);
          }
        } else {
          // For customers/drivers, fetch active jobs to restrict access
          const allReports = await directusApi.getWorkReports();
          const activeReports = allReports.filter(r => {
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

          const allowedCarIds = new Set<string>();
          const timeframes = new Map<string, {start: string, end: string}>();

          activeReports.forEach(r => {
            const car = r.car_id;
            if (car) {
              const carNum = typeof car === 'object' ? (car as any).car_number : null;
              if (carNum) {
                allowedCarIds.add(carNum);
                // Determine timeframe based on job
                const start = r.departure_time || r.work_date || new Date().toISOString();
                const end = r.arrival_time || new Date().toISOString();
                timeframes.set(carNum, { 
                  start: format(new Date(start), "yyyy-MM-dd'T'HH:mm"), 
                  end: format(new Date(end), "yyyy-MM-dd'T'HH:mm") 
                });
              }
            }
          });

          const filteredCars = allCars.filter(c => allowedCarIds.has(c.car_number));
          setCars(filteredCars);
          setJobTimeframes(timeframes);

          // If a car was passed in URL but user doesn't have access, clear it
          if (selectedCar && !allowedCarIds.has(selectedCar)) {
            setSelectedCar('');
            setError('คุณไม่มีสิทธิ์เข้าถึงประวัติของรถคันนี้ หรือรถไม่ได้อยู่ในระหว่างการจัดส่ง');
          } else if (!selectedCar && filteredCars.length > 0) {
            setSelectedCar(filteredCars[0].car_number);
          }
        }
      } catch (err) {
        console.error('Error fetching cars:', err);
      }
    };
    fetchCarsAndJobs();
  }, []);

  // Automatically update dates when a car is selected for non-admins
  useEffect(() => {
    if (!isAdmin && selectedCar && jobTimeframes.has(selectedCar)) {
      const timeframe = jobTimeframes.get(selectedCar)!;
      setStartDate(timeframe.start);
      setEndDate(timeframe.end);
    }
  }, [selectedCar, jobTimeframes, isAdmin]);

  const fetchHistory = async () => {
    if (!selectedCar) return;
    
    setLoading(true);
    setError(null);
    try {
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate).toISOString();
      
      const data = await directusApi.getVehicleHistory(selectedCar, startIso, endIso);
      setHistoryData(data);
      
      if (data.length === 0) {
        setError(t('no_data_found_for_period', 'ไม่พบข้อมูลการเดินทางในช่วงเวลานี้'));
      }
    } catch (err: any) {
      console.error('Error fetching history:', err);
      setError(err.message || t('failed_to_fetch_data', 'ดึงข้อมูลล้มเหลว'));
    } finally {
      setLoading(false);
    }
  };

  const positions: [number, number][] = useMemo(() => {
    return historyData.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
  }, [historyData]);

  const totalDistance = useMemo(() => {
    if (positions.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = L.latLng(positions[i][0], positions[i][1]);
      const p2 = L.latLng(positions[i+1][0], positions[i+1][1]);
      dist += p1.distanceTo(p2);
    }
    return (dist / 1000).toFixed(2); // Convert meters to km
  }, [positions]);

  const maxSpeed = useMemo(() => {
    if (historyData.length === 0) return 0;
    return Math.max(...historyData.map(p => p.speed || 0));
  }, [historyData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">{t('trip_history', 'ประวัติการเดินทาง')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            {!isAdmin && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2 text-blue-700 text-xs">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>คุณสามารถดูประวัติได้เฉพาะรถที่กำลังจัดส่งให้คุณ และดูได้เฉพาะช่วงเวลาที่กำลังจัดส่งเท่านั้น</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t('vehicle', 'รถ')}</label>
              <select 
                value={selectedCar}
                onChange={(e) => setSelectedCar(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="">{t('select_vehicle', 'เลือกรถ')}</option>
                {cars.map(c => (
                  <option key={c.id} value={c.car_number}>{c.car_number}</option>
                ))}
              </select>
              {cars.length === 0 && !isAdmin && (
                <p className="text-xs text-red-500 mt-1">ไม่มีรถที่กำลังจัดส่งในขณะนี้</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t('start_time', 'เวลาเริ่มต้น')}</label>
              <input 
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!isAdmin}
                className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">{t('end_time', 'เวลาสิ้นสุด')}</label>
              <input 
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!isAdmin}
                className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
            </div>

            <button 
              onClick={fetchHistory}
              disabled={loading || !selectedCar}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t('search', 'ค้นหา')}
                </>
              )}
            </button>
          </div>

          {/* Stats */}
          {historyData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900">{t('trip_summary', 'สรุปการเดินทาง')}</h3>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Navigation className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">{t('total_distance', 'ระยะทางรวม')}</p>
                  <p className="font-bold text-slate-900">{totalDistance} km</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Activity className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">{t('max_speed', 'ความเร็วสูงสุด')}</p>
                  <p className="font-bold text-slate-900">{maxSpeed} km/h</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <MapPin className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">{t('data_points', 'จุดบันทึกข้อมูล')}</p>
                  <p className="font-bold text-slate-900">{historyData.length} {t('points', 'จุด')}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] relative">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          
          <MapContainer 
            center={[13.7563, 100.5018]} 
            zoom={6} 
            className="w-full h-full z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {positions.length > 0 && (
              <>
                <MapBounds positions={positions} />
                <Polyline 
                  positions={positions} 
                  color="#3b82f6" 
                  weight={4} 
                  opacity={0.7} 
                />
                
                {/* Start Marker */}
                <Marker position={positions[0]} icon={StartIcon}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold text-emerald-600 mb-1">{t('start_point', 'จุดเริ่มต้น')}</p>
                      <p>{format(new Date(historyData[0].timestamp), 'dd/MM/yyyy HH:mm:ss')}</p>
                      <p>{historyData[0].speed} km/h</p>
                    </div>
                  </Popup>
                </Marker>

                {/* End Marker */}
                {positions.length > 1 && (
                  <Marker position={positions[positions.length - 1]} icon={EndIcon}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-red-600 mb-1">{t('end_point', 'จุดสิ้นสุด')}</p>
                        <p>{format(new Date(historyData[historyData.length - 1].timestamp), 'dd/MM/yyyy HH:mm:ss')}</p>
                        <p>{historyData[historyData.length - 1].speed} km/h</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
