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
  User as UserIcon,
  Coins,
  MapPin,
  Clock,
  History as HistoryIcon
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths, isSameMonth } from 'date-fns';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

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
    } catch (error: any) {
      if (error.response?.status === 401) {
        return;
      }
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

  // --- Expense Stats ---
  const expenseStats = useMemo(() => {
    let total = 0;
    const categories: Record<string, number> = {};

    filteredData.forEach(r => {
      let reportTotal = 0;
      if (r.expense_items && Array.isArray(r.expense_items)) {
        r.expense_items.forEach((item: any) => {
          const amount = Number(item.amount) || 0;
          reportTotal += amount;
          const cat = item.name || t('other');
          categories[cat] = (categories[cat] || 0) + amount;
        });
      } else {
        // Fallback to legacy fields
        const legacyTotal = Number(r.toll_fee || 0) + Number(r.fuel_cost || 0) + Number(r.other_expenses || 0);
        reportTotal = legacyTotal;
        if (Number(r.toll_fee)) categories[t('toll_fee')] = (categories[t('toll_fee')] || 0) + Number(r.toll_fee);
        if (Number(r.fuel_cost)) categories[t('fuel_cost')] = (categories[t('fuel_cost')] || 0) + Number(r.fuel_cost);
        if (Number(r.other_expenses)) categories[t('other_expenses')] = (categories[t('other_expenses')] || 0) + Number(r.other_expenses);
      }
      total += reportTotal;
    });

    const categoryData = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { total, categoryData };
  }, [filteredData, t]);

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
        [t('toll_fee')]: r.toll_fee || '-',
        [t('fuel_cost')]: r.fuel_cost || '-',
        [t('other_expenses')]: r.other_expenses || '-',
        [t('other_expenses_note')]: r.other_expenses_note || '-',
        [t('total_expenses')]: (r.expense_items && r.expense_items.length > 0) 
          ? r.expense_items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
          : (Number(r.toll_fee || 0) + Number(r.fuel_cost || 0) + Number(r.other_expenses || 0)),
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
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredData]);

  // 4. Detailed Jobs Stats (Expanded)
  const detailedJobStats = useMemo(() => {
    return filteredData.map(r => {
      const driver = (typeof r.driver_id === 'object' ? r.driver_id : null) || 
                     (typeof r.member_id === 'object' ? r.member_id : null);
      const car = typeof r.car_id === 'object' ? r.car_id : null;
      
      const totalExpenses = (r.expense_items && Array.isArray(r.expense_items))
        ? r.expense_items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
        : (Number(r.toll_fee || 0) + Number(r.fuel_cost || 0) + Number(r.other_expenses || 0));

      const mileage = (r.mileage_end && r.mileage_start) 
        ? (Number(r.mileage_end) - Number(r.mileage_start))
        : 0;

      return {
        id: r.id,
        caseNumber: formatCaseNumber(r),
        date: r.work_date ? format(parseISO(r.work_date), 'dd/MM/yyyy') : '-',
        customer: r.customer_name || '-',
        driver: driver ? (driver.display_name || `${driver.first_name} ${driver.last_name}`) : '-',
        carNumber: car?.car_number || '-',
        expenses: totalExpenses,
        mileage: mileage,
        status: r.status || 'pending',
        times: {
          standby: r.standby_time || '-',
          departure: r.departure_time || '-',
          arrival: r.arrival_time || '-'
        }
      };
    }).sort((a, b) => b.id - a.id);
  }, [filteredData]);

  // 5. Top Customers
  const topCustomersData = useMemo(() => {
    const stats = filteredData.reduce((acc: any, r) => {
      if (r.customer_name) {
        acc[r.customer_name] = (acc[r.customer_name] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(stats)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredData]);

  // 6. Vehicle Utilization
  const vehicleUtilization = useMemo(() => {
    const stats = filteredData.reduce((acc: any, r) => {
      const car = typeof r.car_id === 'object' ? r.car_id : null;
      if (car?.car_number) {
        acc[car.car_number] = (acc[car.car_number] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(stats)
      .map(([number, count]) => ({ number, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredData]);

  // 7. Efficiency Metrics
  const efficiencyMetrics = useMemo(() => {
    if (filteredData.length === 0) return { avgMileage: 0, avgExpense: 0, totalMileage: 0 };
    
    let totalMileage = 0;
    let totalExpenses = 0;
    
    filteredData.forEach(r => {
      if (r.mileage_end && r.mileage_start) {
        totalMileage += (Number(r.mileage_end) - Number(r.mileage_start));
      }
      
      const reportExpenses = (r.expense_items && Array.isArray(r.expense_items))
        ? r.expense_items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
        : (Number(r.toll_fee || 0) + Number(r.fuel_cost || 0) + Number(r.other_expenses || 0));
      
      totalExpenses += reportExpenses;
    });

    return {
      avgMileage: (totalMileage / filteredData.length).toFixed(1),
      avgExpense: (totalExpenses / filteredData.length).toFixed(0),
      totalMileage: totalMileage.toLocaleString()
    };
  }, [filteredData]);

  // 8. Top Routes
  const topRoutes = useMemo(() => {
    const routes = filteredData.reduce((acc: any, r) => {
      if (r.origin && r.destination) {
        const key = `${r.origin} → ${r.destination}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(routes)
      .map(([path, count]) => ({ path, count: count as number }))
      .sort((a, b) => b.count - a.count)
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
              className="text-sm outline-none bg-white font-medium text-slate-700"
            />
            <span className="mx-2 text-slate-300">ถึง</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="text-sm outline-none bg-white font-medium text-slate-700"
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

      {/* Additional Stats / Efficiency */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-200 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold">{String(t('avg_distance', 'ระยะเฉลี่ย/งาน'))}</h3>
          </div>
          <p className="text-3xl font-bold">{efficiencyMetrics.avgMileage} <span className="text-sm font-medium opacity-80">กม.</span></p>
          <p className="text-[10px] opacity-70 mt-1">{String(t('total_distance', 'ระยะทางรวมทั้งหมด'))} {efficiencyMetrics.totalMileage} กม.</p>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-6 rounded-3xl shadow-lg shadow-rose-200 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Coins className="w-6 h-6" />
            </div>
            <h3 className="font-bold">{String(t('avg_expense', 'ค่าใช้จ่ายเฉลี่ย/งาน'))}</h3>
          </div>
          <p className="text-3xl font-bold">{Number(efficiencyMetrics.avgExpense).toLocaleString()} <span className="text-sm font-medium opacity-80">฿</span></p>
          <p className="text-[10px] opacity-70 mt-1">{String(t('expense_per_job_desc', 'คิดจากรายการรวมค่าใช้จ่ายหารด้วยจำนวนงาน'))}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <Car className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">{String(t('highest_usage_vehicle', 'รถที่ใช้งานสูงสุด'))}</h3>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {vehicleUtilization[0]?.number || '-'} 
            <span className="text-sm font-medium text-slate-400 ml-2">({vehicleUtilization[0]?.count || 0} {t('jobs', 'งาน')})</span>
          </p>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MoM Trend Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">{t('monthly_comparison', 'เปรียบเทียบรายเดือน')}</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{t('this_month', 'เดือนนี้')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span>{t('last_month', 'เดือนที่แล้ว')}</span>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
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
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t('job_status_distribution', 'การกระจายสถานะงาน')}</h3>
          <div className="h-[250px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
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

      {/* Detail Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Breakdown */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('top_customers_report', 'สัดส่วนลูกค้าหลัก')}</h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomersData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} width={100} />
                <Tooltip 
                   cursor={{fill: '#f8fafc'}}
                   contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequent Routes */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">{t('frequent_routes', 'เส้นทางที่ใช้งานบ่อย')}</h3>
          </div>
          <div className="space-y-4">
            {topRoutes.map((route, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-bold text-slate-700 truncate">{route.path}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-emerald-600">{route.count}</span>
                  <span className="text-[10px] text-slate-400">{String(t('times', 'ครั้ง'))}</span>
                </div>
              </div>
            ))}
            {topRoutes.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-sm">
                {String(t('no_route_data', 'ไม่พบข้อมูลเส้นทาง'))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Expenses Card */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t('total_expenses_label', 'รวมค่าใช้จ่าย')}</h3>
                <p className="text-xs text-slate-500">{t('expenses_in_range', 'ค่าใช้จ่ายในช่วงเวลาที่เลือก')}</p>
              </div>
            </div>
            <p className="text-4xl font-bold text-slate-900 mb-2">
              {expenseStats.total.toLocaleString()} <span className="text-lg text-slate-400 font-medium">{t('baht', 'บาท')}</span>
            </p>
          </div>
          <div className="space-y-3 mt-6">
            {expenseStats.categoryData.slice(0, 4).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">{cat.name}</span>
                <span className="text-slate-900 font-bold">{cat.value.toLocaleString()} ฿</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Category Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">{t('expenses_by_category', 'ค่าใช้จ่ายตามหมวดหมู่')}</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseStats.categoryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="value" fill="#f43f5e" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Jobs Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('detailed_job_data', 'ข้อมูลงานโดยละเอียด')}</h3>
              <p className="text-xs text-slate-500">{t('job_performance_summary', 'สรุปผลการดำเนินงานและค่าใช้จ่ายของแต่ละงาน')}</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('job_info', 'ข้อมูลงาน')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('milestones', 'ไทม์ไลน์')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('distance', 'ระยะทาง')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{t('expenses', 'ค่าใช้จ่าย')}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('status', 'สถานะ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {detailedJobStats.slice(0, 30).map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-900 text-sm">#{job.caseNumber}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{job.date}</span>
                      <div className="flex flex-col mt-1.5 gap-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-600 truncate max-w-[150px]">{job.customer}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Car className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-600 font-medium">{job.carNumber}</span>
                          <span className="text-[10px] text-slate-400">({job.driver})</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 items-center">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{t('standby', 'รอรับ')}</span>
                          <span className="text-[10px] font-medium text-slate-700">{job.times.standby}</span>
                        </div>
                        <div className="w-4 h-px bg-slate-200" />
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{t('departure', 'ออกรถ')}</span>
                          <span className="text-[10px] font-medium text-slate-700">{job.times.departure}</span>
                        </div>
                        <div className="w-4 h-px bg-slate-200" />
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{t('arrival', 'ถึงจุด')}</span>
                          <span className="text-[10px] font-medium text-slate-700">{job.times.arrival}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-indigo-600">{job.mileage ? `${job.mileage} กม.` : '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-rose-600">{job.expenses.toLocaleString()} ฿</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      job.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                      job.status === 'pending' ? "bg-amber-50 text-amber-600" :
                      job.status === 'accepted' ? "bg-blue-50 text-blue-600" :
                      "bg-slate-50 text-slate-600"
                    )}>
                      {t(`status_${job.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drivers Performance & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers Bar Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-900 mb-6">{t('top_drivers', 'พนักงานขับรถดีเด่น')}</h3>
           <div className="h-[250px]">
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

        {/* Activity Log (Diligence Table) */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('activity_log', 'บันทึกความขยัน')}</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('driver', 'พนักงาน')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('jobs', 'งาน')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{t('score', 'คะแนน')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {userDiligence.slice(0, 5).map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="font-medium text-slate-700 text-sm">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {user.count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
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
      </div>
    </div>
  );
};
