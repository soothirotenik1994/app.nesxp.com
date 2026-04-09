import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Search,
  Bell,
  Grid,
  MapPin,
  Clock,
  Navigation,
  ChevronRight,
  Plus,
  MessageSquare,
  Thermometer,
  Fuel
} from 'lucide-react';
import { directusApi } from '../api/directus';
import { WorkReport, Car } from '../types';
import { clsx } from 'clsx';

export const CustomerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);

  const userRole = localStorage.getItem('user_role') || 'Customer';
  const userName = localStorage.getItem('user_name') || 'User';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsData, carsData] = await Promise.all([
          directusApi.getWorkReports(),
          directusApi.getCars()
        ]);
        setReports(reportsData);
        setCars(carsData);
        if (carsData.length > 0) {
          setSelectedCar(carsData[0]);
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const active = cars.filter(c => c.status === 'active').length;
    const inTransit = reports.filter(r => r.status === 'accepted').length;
    const atRisk = reports.filter(r => r.status === 'cancel_pending').length;
    const delivered = reports.filter(r => r.status === 'completed').length;

    return [
      { label: 'Active Fleet', value: active, status: 'Operational', color: 'bg-purple-50 text-purple-600', badge: 'bg-purple-100' },
      { label: 'In Transit', value: inTransit, status: '...', color: 'bg-blue-50 text-blue-600', badge: '' },
      { label: 'At Risk', value: atRisk, status: 'High Priority', color: 'bg-red-50 text-red-600', badge: 'bg-red-100' },
      { label: 'Delivered (24h)', value: delivered, status: '↑', color: 'bg-slate-50 text-slate-600', badge: '' },
    ];
  }, [reports, cars]);

  const waypoints = [
    { name: 'Berlin Distribution Hub', time: 'Departed at 08:30 AM', status: 'completed' },
    { name: 'A2 Highway - Magdeburg', time: 'Estimated arrival in 12 min', status: 'active' },
    { name: 'Hannover Logistics Park', time: 'Scheduled for 11:45 AM', status: 'pending' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Shipment Command</h1>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Find specific vehicles, members or IDs..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
          </button>
          <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <Grid className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold text-slate-900">{stat.value.toLocaleString()}</span>
              {stat.status && (
                <span className={clsx(
                  "px-3 py-1 rounded-full text-[10px] font-bold",
                  stat.color,
                  stat.badge
                )}>
                  {stat.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-[2.5rem] h-[400px] relative overflow-hidden shadow-xl">
            <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            {/* Mock Map UI */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full h-full bg-slate-900/20 flex items-center justify-center">
                <div className="absolute top-8 left-8 flex flex-col gap-2">
                  <button className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg flex items-center justify-center text-slate-900 hover:bg-white transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                  <button className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl shadow-lg flex items-center justify-center text-slate-900 hover:bg-white transition-colors">
                    <div className="w-4 h-0.5 bg-slate-900"></div>
                  </button>
                </div>

                {/* Markers */}
                <div className="absolute top-1/3 left-1/4">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-4 border-white animate-pulse">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-1/4 right-1/3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                    <Truck className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-4">
                  <div className="w-3 h-3 bg-primary rounded-full animate-ping"></div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current View</div>
                    <div className="text-sm font-bold text-slate-900">Central European Hub (BER-12)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Widgets */}
        <div className="space-y-8">
          {/* Vehicle Details */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Vehicle Details</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unit ID: #TRK-992-ALPHA</p>
              </div>
              <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider">In Transit</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Marek" alt="Driver" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Member</div>
                <div className="text-sm font-bold text-slate-900">Marek Kowalski</div>
              </div>
              <button className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fuel Level</div>
                <div className="flex items-center gap-2 text-slate-900">
                  <Fuel className="w-4 h-4 text-primary" />
                  <span className="text-lg font-bold">78%</span>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temp Range</div>
                <div className="flex items-center gap-2 text-slate-900">
                  <Thermometer className="w-4 h-4 text-blue-500" />
                  <span className="text-lg font-bold">4.2° C</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Live Coordinates</div>
              <div className="bg-slate-100 p-4 rounded-2xl flex items-center gap-3 text-slate-600 font-mono text-xs">
                <Navigation className="w-4 h-4 text-slate-400" />
                52.5200° N, 13.4050° E
              </div>
            </div>

            <button className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              View Full Telemetry
            </button>
          </div>

          {/* Upcoming Waypoints */}
          <div className="bg-slate-50 p-8 rounded-[2.5rem] space-y-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upcoming Waypoints</h3>
            <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {waypoints.map((wp, idx) => (
                <div key={wp.name} className="flex gap-4 relative">
                  <div className={clsx(
                    "w-6 h-6 rounded-full border-4 border-slate-50 flex items-center justify-center z-10",
                    wp.status === 'completed' ? "bg-primary" : wp.status === 'active' ? "bg-blue-100 border-blue-500" : "bg-white border-slate-200"
                  )}>
                    {wp.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    {wp.status === 'active' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 leading-none">{wp.name}</div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1">{wp.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
