import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { 
  Star, 
  Users, 
  ClipboardList, 
  TrendingUp, 
  MessageSquare,
  Search,
  Filter,
  Download,
  RefreshCw,
  User as UserIcon,
  Calendar,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';

const COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'];

export const DriverRatingManagement: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRating, setSelectedRating] = useState<any | null>(null);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsData, membersData] = await Promise.all([
        directusApi.getWorkReports(),
        directusApi.getMembers()
      ]);
      // Filter only reports that have ratings
      setReports(reportsData.filter(r => r.rating !== null && r.rating !== undefined));
      setMembers(membersData.filter(m => m.role === 'driver'));
    } catch (error: any) {
      console.error('Error fetching rating data:', error);
      setError(error.response?.status === 401 ? t('session_expired') : t('error_fetching_data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const dateStr = r.rated_at || r.date_updated || r.date_created;
      if (!dateStr) return false;
      const reportDate = parseISO(dateStr);
      const isInDateRange = isWithinInterval(reportDate, {
        start: parseISO(dateRange.start),
        end: parseISO(dateRange.end)
      });

      const driver = (typeof r.driver_id === 'object' ? r.driver_id : null) || 
                     (typeof r.member_id === 'object' ? r.member_id : null);
      const driverName = driver ? (driver.display_name || `${driver.first_name} ${driver.last_name}`).toLowerCase() : '';
      const matchesSearch = driverName.includes(searchTerm.toLowerCase()) || 
                           (r.case_number || '').toLowerCase().includes(searchTerm.toLowerCase());

      return isInDateRange && matchesSearch;
    });
  }, [reports, dateRange, searchTerm]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const totalRatings = filteredReports.length;
    const avgRating = totalRatings > 0 
      ? filteredReports.reduce((acc, r) => acc + (r.rating || 0), 0) / totalRatings 
      : 0;
    
    const fiveStars = filteredReports.filter(r => r.rating === 5).length;
    const positiveRate = totalRatings > 0 ? (fiveStars / totalRatings) * 100 : 0;

    return { totalRatings, avgRating, fiveStars, positiveRate };
  }, [filteredReports]);

  // Chart Data: Rating Distribution
  const ratingDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // 1-5 stars
    filteredReports.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[r.rating - 1]++;
      }
    });
    return counts.map((count, i) => ({
      name: `${i + 1} ${t('stars', 'ดาว')}`,
      value: count
    })).reverse();
  }, [filteredReports, t]);

  // Chart Data: Top Rated Drivers
  const driverRatings = useMemo(() => {
    const driverStats: Record<string, { total: number, count: number }> = {};
    
    filteredReports.forEach(r => {
      const driver = (typeof r.driver_id === 'object' ? r.driver_id : null) || 
                     (typeof r.member_id === 'object' ? r.member_id : null);
      if (driver) {
        const name = driver.display_name || `${driver.first_name} ${driver.last_name}`;
        if (!driverStats[name]) driverStats[name] = { total: 0, count: 0 };
        driverStats[name].total += (r.rating || 0);
        driverStats[name].count += 1;
      }
    });

    return Object.entries(driverStats)
      .map(([name, stat]) => ({
        name,
        avg: Number((stat.total / stat.count).toFixed(1)),
        count: stat.count
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [filteredReports]);

  const handleExportExcel = () => {
    const dataToExport = filteredReports.map(r => {
      const driver = (typeof r.driver_id === 'object' ? r.driver_id : null) || 
                     (typeof r.member_id === 'object' ? r.member_id : null);
      return {
        'เลขที่งาน': r.case_number || '-',
        'พนักงานขับรถ': driver ? (driver.display_name || `${driver.first_name} ${driver.last_name}`) : '-',
        'คะแนน': r.rating,
        'ความคิดเห็น': r.feedback || '-',
        'วันที่ประเมิน': r.rated_at ? format(parseISO(r.rated_at), 'yyyy-MM-dd HH:mm') : '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Driver Ratings");
    XLSX.writeFile(workbook, `Driver_Ratings_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">{t('loading')}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Star className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">{t('error')}</h2>
          <p className="text-slate-500 mb-8">{error}</p>
          <button
            onClick={fetchData}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('driver_rating_management')}</h1>
          <p className="text-slate-500 text-sm">{t('satisfied_desc')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="text-sm outline-none bg-transparent"
            />
            <span className="mx-2 text-slate-300">{t('to')}</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="text-sm outline-none bg-transparent"
            />
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
          >
            <Download className="w-4 h-4" />
            {t('export_excel')}
          </button>
          <button 
            onClick={fetchData}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-white transition-colors shadow-sm"
          >
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t('avg_rating')}</p>
          <p className="text-2xl font-bold text-slate-900">{stats.avgRating.toFixed(1)} / 5.0</p>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t('total_ratings')}</p>
          <p className="text-2xl font-bold text-slate-900">{stats.totalRatings} {t('times')}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t('max_satisfaction')}</p>
          <p className="text-2xl font-bold text-slate-900">{stats.positiveRate.toFixed(1)}%</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">{t('rated_drivers')}</p>
          <p className="text-2xl font-bold text-slate-900">{Object.keys(driverRatings).length} {t('persons')}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t('rating_distribution')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistribution} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={80} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Rated Drivers Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t('top_rated_drivers')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverRatings}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} domain={[0, 5]} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="avg" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ratings Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('all_rating_items')}</h3>
              <p className="text-xs text-slate-500">{t('individual_rating_desc')}</p>
            </div>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search_driver_or_case')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('rating_case_number')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('rating_driver_name')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('rating_score')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('rating_feedback')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('rating_date')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => {
                  const driver = (typeof report.driver_id === 'object' ? report.driver_id : null) || 
                                 (typeof report.member_id === 'object' ? report.member_id : null);
                  return (
                    <tr key={report.id} className="hover:bg-white transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-primary">{report.case_number || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="font-medium text-slate-700">
                            {driver ? (driver.display_name || `${driver.first_name} ${driver.last_name}`) : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star} 
                              className={clsx(
                                "w-3.5 h-3.5",
                                star <= (report.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"
                              )} 
                            />
                          ))}
                          <span className="ml-1 text-sm font-bold text-slate-700">{report.rating}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600 max-w-xs truncate" title={report.feedback}>
                          {report.feedback || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {report.rated_at ? format(parseISO(report.rated_at), 'dd MMM yyyy, HH:mm') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedRating(report)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                        >
                          {t('view_details')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    {t('no_data')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rating Detail Modal */}
      {selectedRating && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{t('rating_details')}</h3>
              <button 
                onClick={() => setSelectedRating(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('rating_case_number')}</p>
                  <p className="font-mono text-lg font-bold text-primary">{selectedRating.case_number || '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('rating_date')}</p>
                  <p className="text-slate-700 font-medium">
                    {selectedRating.rated_at ? format(parseISO(selectedRating.rated_at), 'dd MMM yyyy, HH:mm') : '-'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('rating_driver_name')}</p>
                  <p className="text-slate-900 font-bold">
                    {(() => {
                      const driver = (typeof selectedRating.driver_id === 'object' ? selectedRating.driver_id : null) || 
                                     (typeof selectedRating.member_id === 'object' ? selectedRating.member_id : null);
                      return driver ? (driver.display_name || `${driver.first_name} ${driver.last_name}`) : '-';
                    })()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('customer_feedback')}</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={clsx(
                          "w-6 h-6",
                          star <= (selectedRating.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"
                        )} 
                      />
                    ))}
                  </div>
                  <span className="text-2xl font-black text-slate-900 ml-2">{selectedRating.rating}.0</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('customer_feedback')}</p>
                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedRating.feedback || t('no_feedback')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white flex justify-end">
              <button 
                onClick={() => setSelectedRating(null)}
                className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-sm"
              >
                {t('close_window')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
