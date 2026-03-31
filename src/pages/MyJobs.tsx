import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { WorkReport } from '../types';
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
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
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
              const memberId = typeof r.member_id === 'object' ? r.member_id?.id : r.member_id;
              return String(memberId) === String(currentMember.id);
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
    if (!time || typeof time !== 'string') return '-';
    // Remove seconds if present (e.g. 2023-10-27 14:54:00 -> 2023-10-27 14:54)
    return time.split(':').slice(0, 2).join(':');
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
    // Only show active jobs (not completed or cancelled)
    if (r.status === 'completed' || r.status === 'cancelled') return false;

    // Date filtering
    if (startDate || endDate) {
      const reportDateStr = r.work_date || r.date_created || '';
      if (!reportDateStr) return false;
      
      const reportDate = parseISO(reportDateStr);
      if (startDate && reportDate < startOfDay(parseISO(startDate))) return false;
      if (endDate && reportDate > endOfDay(parseISO(endDate))) return false;
    }

    const search = searchTerm.toLowerCase();
    const customer = String(r.customer_name || '').toLowerCase();
    const origin = String(r.origin || '').toLowerCase();
    const dest = String(r.destination || '').toLowerCase();
    const car = typeof r.car_id === 'object' ? String(r.car_id.car_number || '').toLowerCase() : '';
    const caseNum = String(r.id || '').toLowerCase();
    
    return customer.includes(search) || origin.includes(search) || dest.includes(search) || car.includes(search) || caseNum.includes(search);
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
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
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
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-auto">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('case_number')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('date')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('customer_name')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('route')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('vehicle')}</th>
                    {isAdmin && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('driver')}</th>}
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReports.map((report) => {
                    const car = typeof report.car_id === 'object' ? report.car_id : null;
                    const member = typeof report.member_id === 'object' ? report.member_id : null;
                    
                    return (
                      <tr 
                        key={report.id} 
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/jobs/edit/${report.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono text-xs font-bold text-slate-700">
                              {formatCaseNumber(report)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block",
                            report.status === 'completed' ? "bg-emerald-100 text-emerald-700" : 
                            report.status === 'accepted' ? "bg-blue-100 text-blue-700" :
                            report.status === 'cancelled' ? "bg-red-100 text-red-700" :
                            report.status === 'cancel_pending' ? "bg-orange-100 text-orange-700 border border-orange-200" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {t(`status_${report.status || 'pending'}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {(report.work_date || report.date_created || '').split('T')[0].split(' ')[0]}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">
                            {report.customer_name}
                          </div>
                          {(report.customer_contact_name || report.customer_contact_phone) && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[150px]">
                                {report.customer_contact_name || '-'} {report.customer_contact_phone ? `(${report.customer_contact_phone})` : ''}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-[100px]">{report.origin}</span>
                            <ChevronRight className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate max-w-[100px]">{report.destination}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <Truck className="w-3.5 h-3.5 text-slate-400" />
                              {car?.car_number || t('no_vehicle')}
                              {car?.vehicle_type && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold ml-1">
                                  {car.vehicle_type}
                                </span>
                              )}
                            </div>
                            {car?.car_number && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/?vehicle=${car.car_number}`);
                                }}
                                className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1 mt-1"
                              >
                                <MapPin className="w-3 h-3" />
                                GPS
                              </button>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {member ? `${member.first_name} ${member.last_name}` : '-'}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-primary group-hover:text-white transition-all inline-block">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
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
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
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
