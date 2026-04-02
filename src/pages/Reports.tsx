import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Car, 
  ClipboardList, 
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  User as UserIcon
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, isSameMonth } from 'date-fns';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const Reports: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsData, carsData, membersData] = await Promise.all([
        directusApi.getWorkReports(),
        directusApi.getCars(),
        directusApi.getMembers()
      ]);
      setReports(reportsData);
      setCars(carsData);
      setMembers(membersData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return reports.filter(r => {
      const dateStr = r.work_date || r.date_created;
      if (!dateStr) return false;
      const reportDate = parseISO(dateStr);
      return isWithinInterval(reportDate, {
        start: parseISO(dateRange.start),
        end: parseISO(dateRange.end)
      });
    });
  }, [reports, dateRange]);

  // --- MoM Calculation ---
  const momStats = useMemo(() => {
    const now = new Date();
    const currentMonthJobs = reports.filter(r => {
      const dateStr = r.work_date || r.date_created;
      return dateStr && isSameMonth(parseISO(dateStr), now);
    }).length;

    const lastMonthJobs = reports.filter(r => {
      const dateStr = r.work_date || r.date_created;
      return dateStr && isSameMonth(parseISO(dateStr), subMonths(now, 1));
    }).length;
    
    const momGrowth = lastMonthJobs === 0 ? 100 : ((currentMonthJobs - lastMonthJobs) / lastMonthJobs) * 100;
    return { currentMonthJobs, lastMonthJobs, momGrowth };
  }, [reports]);

  // --- Activity Log (Diligence) ---
  const userDiligence = useMemo(() => {
    return members
      .filter(m => m.role === 'driver')
      .map(member => {
        const userReports = reports.filter(r => {
          const driverId = (typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id) || 
                           (typeof r.member_id === 'object' ? r.member_id?.id : r.member_id);
          return (String(driverId) === String(member.id)) || (String(r.user_created) === String(member.id));
        });
      
      const lastReport = [...userReports].sort((a, b) => {
        const dateA = a.date_updated || a.date_created || 0;
        const dateB = b.date_updated || b.date_created || 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })[0];

      const lastActiveDate = lastReport ? (lastReport.date_updated || lastReport.date_created) : null;

      return {
        id: member.id,
        name: member.display_name || `${member.first_name} ${member.last_name}`,
        count: userReports.length,
        lastActive: lastActiveDate ? format(parseISO(lastActiveDate), 'MMM dd, HH:mm') : '-'
      };
    }).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [members, reports]);

  const formatCaseNumber = (report: any) => {
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

  const handleExportExcel = useCallback(() => {
    const dataToExport = filteredData.map(r => {
      const driver = (typeof r.driver_id === 'object' ? r.driver_id : null) || 
                     (typeof r.member_id === 'object' ? r.member_id : null);
      const car = typeof r.car_id === 'object' ? r.car_id : null;
      const workDate = (r.work_date || r.date_created || '').split('T')[0].split(' ')[0];
      
      return {
        [t('case_number')]: formatCaseNumber(r),
        [t('status')]: t(`status_${r.status || 'pending'}`),
        [t('date')]: workDate,
        [t('customer_name')]: r.customer_name || '-',
        [t('contact_name')]: r.customer_contact_name || '-',
        [t('contact_phone')]: r.customer_contact_phone || '-',
        [t('origin')]: r.origin || '-',
        [t('destination')]: r.destination || '-',
        [t('vehicle_number')]: car?.car_number || '-',
        [t('vehicle_type')]: car?.vehicle_type || '-',
        [t('driver_name')]: driver ? (driver.display_name || `${driver.first_name} ${driver.last_name}`) : '-',
        [t('driver_phone')]: r.phone || '-',
        [t('standby_time')]: r.standby_time || '-',
        [t('departure_time')]: r.departure_time || '-',
        [t('arrival_time')]: r.arrival_time || '-',
        [t('mileage_start')]: r.mileage_start || '-',
        [t('mileage_end')]: r.mileage_end || '-',
        [t('notes')]: r.notes || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
    
    const fileName = `Reports_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [filteredData, t]);

  // 1. Job Status Distribution
  const statusData = useMemo(() => [
    { name: t('status_completed'), value: filteredData.filter(r => r.status === 'completed').length },
    { name: t('status_pending'), value: filteredData.filter(r => r.status === 'pending').length },
    { name: t('status_accepted'), value: filteredData.filter(r => r.status === 'accepted').length },
    { name: t('status_cancelled'), value: filteredData.filter(r => r.status === 'cancelled').length },
  ].filter(d => d.value > 0), [filteredData, t]);

  // 2. Jobs Over Time (MoM Line Chart)
  const combinedTrend = useMemo(() => {
    const now = new Date();
    const getMonthTrend = (monthDate: Date) => {
      const daysInMonth = endOfMonth(monthDate).getDate();
      const data = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = i.toString().padStart(2, '0');
        const count = reports.filter(r => {
          const dateStr = r.work_date || r.date_created;
          if (!dateStr) return false;
          const d = parseISO(dateStr);
          return isSameMonth(d, monthDate) && format(d, 'dd') === dayStr;
        }).length;
        data.push({ day: i, count });
      }
      return data;
    };

    const currentMonthTrend = getMonthTrend(now);
    const lastMonthTrend = getMonthTrend(subMonths(now, 1));
    
    return currentMonthTrend.map((d, i) => ({
      day: d.day,
      current: d.count,
      last: lastMonthTrend[i]?.count || 0
    }));
  }, [reports]);

  // 3. Top Drivers
  const topDrivers = useMemo(() => {
    const driverStats = filteredData.reduce((acc: any, r) => {
      const driver = (typeof r.driver_id === 'object' ? r.driver_id : null) || 
                     (typeof r.member_id === 'object' ? r.member_id : null);
      
      if (driver) {
        const name = driver.display_name || `${driver.first_name} ${driver.last_name}`;
        acc[name] = (acc[name] || 0) + 1;
      } else if (r.driver_id || r.member_id) {
        const name = r.driver_id || r.member_id;
        acc[name] = (acc[name] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(driverStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);
  }, [filteredData]);

  // 4. Top Customers
  const topCustomers = useMemo(() => {
    const customerStats = filteredData.reduce((acc: any, r) => {
      if (r.customer_name) {
        acc[r.customer_name] = (acc[r.customer_name] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(customerStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);
  }, [filteredData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('reports')}</h1>
        </div>
        
        <div className="flex items-center gap-3">
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
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-blue-600" />
            </div>
            <div className={clsx(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
              momStats.momGrowth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {momStats.momGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(momStats.momGrowth).toFixed(1)}%
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">{t('total_jobs')}</p>
          <p className="text-2xl font-bold text-slate-900">{filteredData.length}</p>
          <p className="text-[10px] text-slate-400 mt-1">{t('vs_last_month')}: {momStats.lastMonthJobs}</p>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('completed_jobs')}</p>
            <p className="text-2xl font-bold text-slate-900">{filteredData.filter(r => r.status === 'completed').length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('total_drivers')}</p>
            <p className="text-2xl font-bold text-slate-900">{members.filter(m => m.role === 'driver').length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
            <Car className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">{t('total_vehicles')}</p>
            <p className="text-2xl font-bold text-slate-900">{cars.length}</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MoM Trend Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">{t('month_over_month')}</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{t('this_month')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span>{t('last_month')}</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Line type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="last" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t('job_status_distribution')}</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Log (Diligence Table) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('activity_log')}</h3>
              <p className="text-xs text-slate-500">{t('monitoring_diligence')}</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('user_activity')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('updates_count')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('last_active')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('diligence_score')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {userDiligence.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-700">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {user.count}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {user.lastActive}
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-[100px]">
                      <div 
                        className={clsx(
                          "h-1.5 rounded-full",
                          user.count > 10 ? "bg-emerald-500" : user.count > 5 ? "bg-amber-500" : "bg-slate-300"
                        )}
                        style={{ width: `${Math.min(user.count * 10, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6">
        {/* Top Drivers */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t('top_drivers')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDrivers} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={120} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
