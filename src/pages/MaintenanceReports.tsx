import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Calendar, 
  Car as CarIcon, 
  Download, 
  Loader2, 
  TrendingUp, 
  DollarSign, 
  Wrench,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';
import { directusApi } from '../api/directus';
import { MaintenanceHistory, Car } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export const MaintenanceReports: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCarId, setSelectedCarId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const [historyData, carsData] = await Promise.all([
        directusApi.getAllMaintenanceHistory(),
        directusApi.getCars()
      ]);
      setHistory(historyData);
      setCars(carsData);
    } catch (err: any) {
      if (err.response?.status === 401) return;
      console.error('Failed to fetch report data:', err);
      setError(t('failed_to_load_data'));
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const carMatch = selectedCarId === 'all' || 
        (typeof record.car_id === 'string' ? record.car_id === selectedCarId : record.car_id.id === selectedCarId);
      
      const dateMatch = (!startDate || record.date >= startDate) && 
                       (!endDate || record.date <= endDate);
      
      const searchLower = searchQuery.toLowerCase();
      const car = typeof record.car_id === 'object' ? record.car_id : cars.find(c => c.id === record.car_id);
      const carNumber = car?.car_number || '';
      
      const textMatch = !searchQuery || 
        carNumber.toLowerCase().includes(searchLower) ||
        record.service_type.toLowerCase().includes(searchLower) ||
        (record.notes && record.notes.toLowerCase().includes(searchLower));

      return carMatch && dateMatch && textMatch;
    });
  }, [history, selectedCarId, startDate, endDate, searchQuery, cars]);

  const stats = useMemo(() => {
    const totalCost = filteredHistory.reduce((sum, record) => sum + (record.cost || 0), 0);
    const count = filteredHistory.length;
    const uniqueCars = new Set(filteredHistory.map(r => typeof r.car_id === 'string' ? r.car_id : r.car_id.id)).size;
    
    return { totalCost, count, uniqueCars };
  }, [filteredHistory]);

  const handleExport = () => {
    // Basic CSV export for now
    const headers = [
      t('maintenance_date'),
      t('car_number'),
      t('history_service_type'),
      t('mileage_at_service'),
      t('cost'),
      t('history_notes')
    ];

    const rows = filteredHistory.map(record => {
      const car = typeof record.car_id === 'object' ? record.car_id : cars.find(c => c.id === record.car_id);
      return [
        record.date,
        car?.car_number || '',
        record.service_type,
        record.mileage,
        record.cost || 0,
        record.notes || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `maintenance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy', { locale: i18n.language === 'th' ? th : undefined });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" />
            {t('maintenance_reports')}
          </h1>
          <p className="text-gray-500">{t('maintenance_reports_desc')}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredHistory.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {t('export_excel')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
          <Filter className="w-4 h-4" />
          {t('filter')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('select_vehicle')}</label>
            <div className="relative">
              <CarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all appearance-none"
              >
                <option value="all">{t('all_vehicles')}</option>
                {cars.map(car => (
                  <option key={car.id} value={car.id}>{car.car_number}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('start_date')}</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('end_date')}</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>
        </div>
        
        {(selectedCarId !== 'all' || startDate || endDate || searchQuery) && (
          <div className="flex justify-end">
            <button 
              onClick={() => {
                setSelectedCarId('all');
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              {t('clear_filters')}
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('maintenance_count')}</p>
            <p className="text-2xl font-black text-gray-900">{stats.count}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('total_cost')}</p>
            <p className="text-2xl font-black text-gray-900">฿{stats.totalCost.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
            <CarIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t('vehicles')}</p>
            <p className="text-2xl font-black text-gray-900">{stats.uniqueCars}</p>
          </div>
        </div>
      </div>

      {/* Report Table / Cards */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('maintenance_date')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('car_number')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('history_service_type')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t('mileage_at_service')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t('cost')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('history_notes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <p>{t('loading')}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Wrench className="w-12 h-12 mb-4 opacity-10" />
                      <p>{t('no_items_found')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((record) => {
                  const car = typeof record.car_id === 'object' ? record.car_id : cars.find(c => c.id === record.car_id);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <CarIcon className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-bold text-gray-900">{car?.car_number || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                          {record.service_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono">
                        {record.mileage.toLocaleString()} {t('km')}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right">
                        ฿{(record.cost || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>{t('loading')}</p>
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="flex flex-col items-center justify-center text-gray-400">
                <Wrench className="w-12 h-12 mb-4 opacity-10" />
                <p>{t('no_items_found')}</p>
              </div>
            </div>
          ) : (
            filteredHistory.map((record) => {
              const car = typeof record.car_id === 'object' ? record.car_id : cars.find(c => c.id === record.car_id);
              return (
                <div key={record.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <CarIcon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-bold text-gray-900">{car?.car_number || '-'}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-400">{formatDate(record.date)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-[10px] font-bold">
                      {record.service_type}
                    </span>
                    <span className="text-sm font-bold text-emerald-600">
                      ฿{(record.cost || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{t('mileage_at_service')}</p>
                      <p className="text-xs font-mono text-gray-600">{record.mileage.toLocaleString()} {t('km')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{t('history_notes')}</p>
                      <p className="text-xs text-gray-500 truncate">{record.notes || '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
