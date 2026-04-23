import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Package, 
  Map as MapIcon, 
  List,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  Phone,
  User,
  Search
} from 'lucide-react';
import { directusApi } from '../api/directus';
import { gpsApi } from '../api/gps';
import { WorkReport, Car, CarStatus } from '../types';
import { VehicleMap } from '../components/VehicleMap';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export const CustomerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [carStatuses, setCarStatuses] = useState<CarStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [selectedCar, setSelectedCar] = useState<CarStatus | null>(null);

  const memberId = localStorage.getItem('member_id');
  const userRole = localStorage.getItem('user_role') || 'Customer';
  const userName = localStorage.getItem('user_name') || 'User';

  const fetchData = async () => {
    try {
      const [reportsData, carsData] = await Promise.all([
        directusApi.getWorkReports(),
        directusApi.getCars()
      ]);

      // Filter reports for this customer
      const myReports = reportsData.filter(r => {
        // 1. Direct assignment
        const reportMemberId = typeof r.member_id === 'object' ? r.member_id?.id : r.member_id;
        if (String(reportMemberId) === String(memberId)) return true;

        // 2. Customer ID match (direct or through location junction)
        const customerLoc = typeof r.customer_id === 'object' ? r.customer_id : null;
        if (customerLoc) {
          const primaryId = typeof customerLoc.member_id === 'object' ? customerLoc.member_id?.id : customerLoc.member_id;
          if (String(primaryId) === String(memberId)) return true;
          
          if (customerLoc.members && Array.isArray(customerLoc.members)) {
            return customerLoc.members.some((m: any) => {
              const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
              return String(id) === String(memberId);
            });
          }
        }
        
        return false;
      });

      setReports(myReports);
      
      // Filter cars to only those associated with the customer's reports
      const activeCarIds = new Set(myReports.map(r => {
        const carId = typeof r.car_id === 'object' ? r.car_id?.id : r.car_id;
        return String(carId);
      }));

      const filteredCars = carsData.filter(car => activeCarIds.has(String(car.id)));
      setCars(filteredCars);

      // Fetch GPS status for filtered cars
      if (filteredCars.length > 0) {
        const statuses = await Promise.all(
          filteredCars.map(async (car) => {
            try {
              const status = await gpsApi.getCarStatus(car.car_number);
              return status;
            } catch {
              return null;
            }
          })
        );
        const validStatuses = statuses.filter(Boolean) as CarStatus[];
        setCarStatuses(validStatuses);
      }
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const active = reports.filter(r => r.status === 'accepted' || r.status === 'pending').length;
    const completed = reports.filter(r => r.status === 'completed').length;
    const total = reports.length;

    return [
      { label: t('all_jobs', 'งานทั้งหมด'), value: total, icon: Package, color: 'text-slate-600', bg: 'bg-slate-50' },
      { label: t('active_jobs', 'งานที่กำลังทำ'), value: active, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: t('completed_jobs', 'งานที่เสร็จแล้ว'), value: completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];
  }, [reports, t]);

  const activeJobs = useMemo(() => {
    return reports
      .filter(r => r.status === 'accepted' || r.status === 'pending')
      .sort((a, b) => new Date(b.date_created || b.work_date).getTime() - new Date(a.date_created || a.work_date).getTime());
  }, [reports]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-full uppercase">{t('status_completed')}</span>;
      case 'accepted':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full uppercase">{t('status_accepted')}</span>;
      case 'cancel_pending':
        return <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase">{t('status_cancel_pending')}</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase">{t(`status_${status}`)}</span>;
    }
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-slate-500 font-medium">{t('loading', 'กำลังโหลดข้อมูล...')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Truck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard', 'แดชบอร์ด')}</h1>
        </div>
        <p className="text-slate-500 text-sm">
          {t('welcome_back', 'ยินดีต้อนรับกลับมา')}, <span className="font-bold text-slate-900">{userName}</span>
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg)}>
              <stat.icon className={clsx("w-6 h-6", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* View Switcher Controls (Sticky on Mobile) */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm md:hidden sticky top-4 z-20">
        <button 
          onClick={() => setActiveTab('map')}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
            activeTab === 'map' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500"
          )}
        >
          <MapIcon className="w-4 h-4" />
          {t('map_view', 'ดูแผนที่')}
        </button>
        <button 
          onClick={() => setActiveTab('list')}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
            activeTab === 'list' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500"
          )}
        >
          <List className="w-4 h-4" />
          {t('job_list', 'รายการงาน')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Section */}
        <div className={clsx(
          "lg:col-span-2 space-y-4",
          activeTab === 'list' && "hidden md:block" // Hidden on mobile list view, always visible on desktop
        )}>
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              {t('fleet_live_location', 'ตำแหน่งรถแบบเรียลไทม์')}
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {t('live_updates', 'อัปเดตสด')}
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-[2.5rem] h-[400px] md:h-[550px] relative overflow-hidden shadow-2xl border-4 border-white">
            {carStatuses.length > 0 ? (
              <VehicleMap 
                vehicles={carStatuses} 
                selectedVehicle={selectedCar}
                onSelectVehicle={setSelectedCar}
                center={selectedCar ? { lat: selectedCar.lat, lng: selectedCar.lng } : undefined}
                zoom={14}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-white p-8 text-center gap-4">
                <Navigation className="w-12 h-12 opacity-20 animate-pulse" />
                <div>
                  <p className="font-bold text-lg">{t('connecting_gps', 'กำลังเชื่อมต่อ GPS...')}</p>
                  <p className="text-sm opacity-50">{t('please_wait_for_updates', 'โปรดรอสักครู่ขณะดึงข้อมูลตำแหน่งรถ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Jobs List Section */}
        <div className={clsx(
          "space-y-4",
          activeTab === 'map' && "hidden md:block" // Hidden on mobile map view, always visible on desktop
        )}>
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {t('ongoing_jobs', 'งานปัจจุบัน')}
            </h3>
            {activeJobs.length > 0 && (
              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {activeJobs.length} {t('jobs', 'งาน')}
              </span>
            )}
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide pb-10">
            {activeJobs.length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium text-sm">{t('no_active_jobs', 'ไม่มีงานที่กำลังดำเนินการ')}</p>
              </div>
            ) : (
              activeJobs.map((job) => {
                const car = typeof job.car_id === 'object' ? job.car_id : cars.find(c => c.id === job.car_id);
                const driver = typeof job.driver_id === 'object' ? job.driver_id : undefined;
                
                return (
                  <div 
                    key={job.id} 
                    onClick={() => navigate(`/job-report?id=${job.id}`)}
                    className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 group-hover:bg-primary/10 rounded-xl flex items-center justify-center transition-colors">
                          <Truck className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{car?.car_number || '-'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{job.case_number || '#'+job.id.slice(-6)}</p>
                        </div>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{t('origin', 'ต้นทาง')}</p>
                          <p className="text-xs font-bold text-slate-700 line-clamp-1">{job.origin}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{t('destination', 'ปลายทาง')}</p>
                          <p className="text-xs font-bold text-slate-700 line-clamp-1">{job.destination}</p>
                        </div>
                      </div>
                    </div>

                    {driver && (
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">{driver.display_name || `${driver.first_name}`}</span>
                        </div>
                        <a 
                          href={`tel:${driver.phone}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            
            <button 
              onClick={() => navigate('/history')}
              className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 border border-slate-100 border-dashed"
            >
              {t('view_all_history', 'ดูประวัติทั้งหมด')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
