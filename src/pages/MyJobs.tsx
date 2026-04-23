import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { WorkReport } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { 
  Calendar, 
  MapPin, 
  Truck, 
  Clock, 
  ChevronRight, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  User,
  Hash,
  Search,
  Filter,
  Download,
  X,
  Navigation
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatDate, formatTime, formatDateTime } from '../lib/dateUtils';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

export const MyJobs: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'scheduled'>('all');
  const memberId = localStorage.getItem('member_id');
  const userEmail = localStorage.getItem('user_email');
  const userRole = localStorage.getItem('user_role') || 'customer';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  const fetchMyJobs = async () => {
    if (!memberId && !isAdmin) {
      setError(t('user_not_found') || 'User not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setProfileMissing(false);
    try {
      // 1. Fetch all reports
      const allReports = await directusApi.getWorkReports();
      
      let myReports = [];
      
      if (isAdmin) {
        // Admin sees everything
        myReports = allReports;
      } else {
        // Find member profile
        const members = await directusApi.getMembers();
        const currentMember = members.find(m => String(m.id) === String(memberId));

        if (currentMember) {
          if (currentMember.role === 'customer') {
            // Customer sees reports linked to their customer locations
            myReports = allReports.filter(r => {
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
                
              return memberIds.includes(String(currentMember.id));
            });
          } else {
            // Driver sees only their own
            myReports = allReports.filter(r => {
              const mId = typeof r.member_id === 'object' ? r.member_id?.id : r.member_id;
              const dId = typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id;
              return String(mId) === String(currentMember.id) || String(dId) === String(currentMember.id);
            });
          }
        } else {
          // Not an admin and no member profile found
          setProfileMissing(true);
          setError(t('driver_profile_not_found', { email: userEmail }));
          setLoading(false);
          return;
        }
      }

      setReports(myReports);
      setCurrentPage(1);
    } catch (err: any) {
      if (err.response?.status === 401) {
        return;
      }
      console.error('Error fetching my jobs:', err);
      const detail = err.response?.data?.errors?.[0]?.message || err.message;
      
      if (detail.toLowerCase().includes('permission') || detail.toLowerCase().includes('forbidden')) {
        setError(`${t('permission_error')}: ${t('check_directus_permissions', { collection: 'work_reports' })}`);
      } else {
        setError(`${t('failed_to_load_jobs')}: ${detail}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyJobs();
  }, []);

  const formatTimeDisplay = (time: any) => {
    return formatTime(time);
  };

  const formatCaseNumber = (report: WorkReport) => {
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

  const handleExportExcel = () => {
    const dataToExport = filteredReports.map(r => {
      const member = typeof r.member_id === 'object' ? r.member_id : null;
      const car = typeof r.car_id === 'object' ? r.car_id : null;
      const workDate = (r.work_date || r.date_created || '').split('T')[0].split(' ')[0];
      
      return {
        'Case Number': formatCaseNumber(r),
        'Status': t(`status_${r.status || 'pending'}`),
        'Date': workDate,
        'Customer Name': r.customer_name || '-',
        'Contact Name': r.customer_contact_name || '-',
        'Contact Phone': r.customer_contact_phone || '-',
        'Origin': r.origin || '-',
        'Destination': r.destination || '-',
        'Vehicle Number': car?.car_number || '-',
        'Vehicle Type': car?.vehicle_type || '-',
        'Driver Name': member ? `${member.first_name} ${member.last_name}` : '-',
        'Driver Phone': r.phone || '-',
        'Standby Time': formatTimeDisplay(r.standby_time),
        'Departure Time': formatTimeDisplay(r.departure_time),
        'Arrival Time': formatTimeDisplay(r.arrival_time),
        'Mileage Start': r.mileage_start || '-',
        'Mileage End': r.mileage_end || '-',
        [t('total_expenses')]: (r.expense_items && r.expense_items.length > 0) 
          ? r.expense_items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0)
          : (Number(r.toll_fee || 0) + Number(r.fuel_cost || 0) + Number(r.other_expenses || 0)),
        'Notes': r.notes || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");
    
    const fileName = `Jobs_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const filteredReports = reports.filter(r => {
    // Admin sees everything regardless of opening time
    if (!isAdmin) {
      const now = new Date();
      if (r.advance_opening_time) {
        const openingTime = new Date(r.advance_opening_time);
        if (openingTime > now) return false;
      }
    }

    // Filter by type (Scheduled only)
    if (filterType === 'scheduled' && !r.advance_opening_time) return false;

    // Only show active jobs (not completed, cancelled, or deleted)
    if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'deleted') return false;

    // Date filtering
    if (startDate || endDate) {
      const reportDateStr = r.work_date || r.date_created || '';
      if (!reportDateStr) return false;
      
      const reportDate = parseISO(reportDateStr);
      if (startDate && reportDate < startOfDay(parseISO(startDate))) return false;
      if (endDate && reportDate > endOfDay(parseISO(endDate))) return false;
    }

    const search = searchTerm.toLowerCase();
    
    // Get formatted case number (tracking ID)
    const trackingId = formatCaseNumber(r).toLowerCase();
    
    // Get driver name if available
    const member = (r.member_id && typeof r.member_id === 'object' ? r.member_id : null) || 
                   (r.driver_id && typeof r.driver_id === 'object' ? r.driver_id : null);
    const driverName = member ? `${member.first_name} ${member.last_name}`.toLowerCase() : '';
    
    const customer = String(r.customer_name || '').toLowerCase();
    const origin = String(r.origin || '').toLowerCase();
    const dest = String(r.destination || '').toLowerCase();
    const car = typeof r.car_id === 'object' ? String(r.car_id.car_number || '').toLowerCase() : '';
    const dbId = String(r.id || '').toLowerCase();
    const dbCaseNum = String(r.case_number || '').toLowerCase();
    
    return customer.includes(search) || 
           origin.includes(search) || 
           dest.includes(search) || 
           car.includes(search) || 
           trackingId.includes(search) || 
           dbCaseNum.includes(search) || 
           dbId.includes(search) ||
           driverName.includes(search);
  }).sort((a, b) => {
    const getStatusWeight = (status: string) => {
      switch (status) {
        case 'pending': return 0;
        case 'accepted': return 1;
        case 'cancel_pending': return 2;
        case 'completed': return 3;
        case 'cancelled': return 4;
        default: return 5;
      }
    };

    const weightA = getStatusWeight(a.status || 'pending');
    const weightB = getStatusWeight(b.status || 'pending');

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // Tie-breaker: newest date first
    return new Date(b.work_date || b.date_created || 0).getTime() - new Date(a.work_date || a.date_created || 0).getTime();
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-3xl shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{t('error')}</h2>
        <p className="text-slate-500">{error}</p>
        <button 
          onClick={() => fetchMyJobs()}
          className="px-6 py-2 bg-primary text-white rounded-xl font-bold"
        >
          {t('try_again')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          {isAdmin ? t('all_jobs') : t('my_assigned_jobs')}
        </h2>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto">
            {profileMissing ? (
              <AlertCircle className="w-8 h-8 text-slate-300" />
            ) : (
              <Truck className="w-8 h-8 text-slate-300" />
            )}
          </div>
          <p className="text-slate-500 font-medium">
            {profileMissing 
              ? t('profile_missing_error', { email: userEmail })
              : t('no_jobs_assigned')}
          </p>
          {profileMissing && isAdmin && (
            <button 
              onClick={() => navigate('/members')}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm"
            >
              {t('go_to_staff_management')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                <div className="relative flex-1 w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder={t('search_jobs_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm text-slate-600 w-full sm:w-auto"
                  />
                  <span className="text-slate-300">-</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm text-slate-600 w-full sm:w-auto"
                  />
                  {(startDate || endDate) && (
                    <button 
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => setFilterType('all')}
                    className={clsx(
                      "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                      filterType === 'all' 
                        ? "bg-white text-primary shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {t('show_all')}
                  </button>
                  <button
                    onClick={() => setFilterType('scheduled')}
                    className={clsx(
                      "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                      filterType === 'scheduled' 
                        ? "bg-white text-primary shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {t('scheduled_jobs')}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100"
                >
                  <Download className="w-4 h-4" />
                  {t('export_excel')}
                </button>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500 whitespace-nowrap">
                  <Filter className="w-4 h-4" />
                  {t('total')}: {filteredReports.length}
                </div>
              </div>
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('case_number')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('status')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('date')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('customer_name')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('route')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('vehicle')}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{t('driver')}</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReports.map((report) => {
                    const car = typeof report.car_id === 'object' ? report.car_id : null;
                    const member = (report.member_id && typeof report.member_id === 'object' ? report.member_id : null) || 
                                   (report.driver_id && typeof report.driver_id === 'object' ? report.driver_id : null);
                    
                    return (
                      <tr 
                        key={report.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/jobs/edit/${report.id}`)}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {formatCaseNumber(report)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-start gap-2">
                            <span className={clsx(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block shadow-sm",
                              report.status === 'completed' ? "bg-emerald-500 text-white" : 
                              report.status === 'accepted' ? "bg-blue-500 text-white" :
                              report.status === 'cancelled' ? "bg-red-500 text-white" :
                              report.status === 'cancel_pending' ? "bg-orange-500 text-white" :
                              report.status === 'pending' ? "bg-amber-400 text-white animate-pulse" :
                              "bg-slate-500 text-white"
                            )}>
                              {t(`status_${report.status || 'pending'}`)}
                            </span>
                            {report.status === 'pending' && report.acceptance_deadline && (
                              <CountdownTimer 
                                deadline={report.acceptance_deadline} 
                                compact={true}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-primary/60" />
                              <span className="font-medium text-slate-700">{formatDate(report.work_date || report.date_created, 'dd/MM/yyyy')}</span>
                            </div>
                            {report.advance_opening_time && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-bold border border-amber-100">
                                <Clock className="w-3 h-3" />
                                {formatTime(report.advance_opening_time)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">
                            {report.customer_name}
                          </div>
                          {(report.customer_contact_name || report.customer_contact_phone) && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 bg-slate-50 w-fit px-2 py-0.5 rounded-full border border-slate-100">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[150px]">
                                {report.customer_contact_name || '-'} {report.customer_contact_phone ? `(${report.customer_contact_phone})` : ''}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-center gap-2 text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                <span className="truncate max-w-[120px] font-semibold text-slate-700">{report.origin}</span>
                              </div>
                              <ChevronRight className="w-3 h-3 text-slate-300" />
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                <span className="truncate max-w-[120px] font-semibold text-slate-700">{report.destination}</span>
                              </div>
                            </div>
                            {report.destination_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(report.destination_url, '_blank');
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-primary border border-blue-100 rounded-xl text-[10px] font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all w-fit shadow-sm active:scale-95"
                              >
                                <Navigation className="w-3 h-3" />
                                {t('navigate')}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              {car?.car_number || t('no_vehicle')}
                            </div>
                            {car?.vehicle_type && (
                              <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                                {car.vehicle_type}
                              </div>
                            )}
                            {car?.car_number && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/?vehicle=${car.car_number}`);
                                }}
                                className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1 mt-1 bg-primary/5 px-2 py-0.5 rounded-full w-fit"
                              >
                                <MapPin className="w-2.5 h-2.5" />
                                GPS
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                                {member ? `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}` : '?'}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-xs font-bold text-slate-700">{member ? `${member.first_name} ${member.last_name}` : '-'}</span>
                               <span className="text-[10px] text-slate-400">{t('driver')}</span>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="lg:hidden divide-y divide-slate-100">
              {paginatedReports.map((report) => {
                const car = typeof report.car_id === 'object' ? report.car_id : null;
                const member = (report.member_id && typeof report.member_id === 'object' ? report.member_id : null) || 
                               (report.driver_id && typeof report.driver_id === 'object' ? report.driver_id : null);
                const trackingId = formatCaseNumber(report);

                return (
                  <div 
                    key={report.id}
                    onClick={() => navigate(`/jobs/edit/${report.id}`)}
                    className="p-5 flex flex-col gap-4 active:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">
                            #{trackingId}
                          </span>
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm",
                            report.status === 'completed' ? "bg-emerald-500 text-white" : 
                            report.status === 'accepted' ? "bg-blue-500 text-white" :
                            report.status === 'cancelled' ? "bg-red-500 text-white" :
                            report.status === 'cancel_pending' ? "bg-orange-500 text-white" :
                            report.status === 'pending' ? "bg-amber-400 text-white animate-pulse" :
                            "bg-slate-500 text-white"
                          )}>
                            {t(`status_${report.status || 'pending'}`)}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 line-clamp-1">{report.customer_name}</h3>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                           <Calendar className="w-3 h-3" />
                           {formatDate(report.work_date || report.date_created, 'dd MMM yy')}
                        </div>
                        {report.status === 'pending' && report.acceptance_deadline && (
                          <CountdownTimer 
                            deadline={report.acceptance_deadline} 
                            compact={true}
                          />
                        )}
                      </div>
                    </div>

                    <div className="relative pl-4 space-y-3">
                       {/* Vertical Line Connecting Dots */}
                       <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[2px] bg-slate-100"></div>
                       
                       <div className="relative flex items-start gap-3">
                          <div className="absolute -left-[13px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{t('origin_label')}</span>
                            <span className="text-xs font-bold text-slate-700">{report.origin}</span>
                          </div>
                       </div>

                       <div className="relative flex items-start gap-3">
                          <div className="absolute -left-[13px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">{t('destination_label')}</span>
                            <span className="text-xs font-bold text-slate-700">{report.destination}</span>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                             <Truck className="w-3.5 h-3.5 text-slate-400" />
                             <span className="text-xs font-bold text-slate-700">{car?.car_number || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                             <User className="w-3.5 h-3.5 text-slate-400" />
                             <span className="text-xs font-bold text-slate-600 truncate max-w-[80px]">{member ? member.first_name : '-'}</span>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2">
                          {car?.car_number && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/?vehicle=${car.car_number}`);
                              }}
                              className="p-2 bg-blue-50 text-primary rounded-xl border border-blue-100 active:scale-95 transition-transform"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          )}
                          {report.destination_url && (
                             <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(report.destination_url, '_blank');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-100 active:scale-95 transition-transform"
                             >
                                <Navigation className="w-4 h-4" />
                                {t('navigate')}
                             </button>
                          )}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={clsx(
                      "w-10 h-10 rounded-xl font-bold text-sm transition-all",
                      currentPage === page 
                        ? "bg-primary text-white shadow-lg shadow-blue-100" 
                        : "text-slate-500 hover:bg-white"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
