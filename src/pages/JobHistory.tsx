import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { directusApi, DIRECTUS_URL, STATIC_API_KEY } from '../api/directus';
import { WorkReport } from '../types';
import { 
  Search, 
  Calendar, 
  Truck, 
  MapPin, 
  Clock, 
  Gauge, 
  Trash2, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  FileText,
  X,
  Copy,
  User,
  Download,
  Camera
} from 'lucide-react';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { formatDate } from '../lib/dateUtils';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '../components/ConfirmModal';
import { clsx } from 'clsx';

export const JobHistory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const memberId = localStorage.getItem('member_id');
  const userRole = localStorage.getItem('user_role') || 'customer';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  const fetchReports = async () => {
    if (!memberId && !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const allReports = await directusApi.getWorkReports();
      
      let myReports = [];
      
      if (isAdmin) {
        myReports = allReports;
      } else {
        const members = await directusApi.getMembers();
        const currentMember = members.find(m => String(m.id) === String(memberId));

        if (currentMember) {
          if (currentMember.role === 'customer') {
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
            myReports = allReports.filter(r => {
              const memberId = (typeof r.member_id === 'object' ? r.member_id?.id : r.member_id) || 
                               (typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id);
              return String(memberId) === String(currentMember.id);
            });
          }
        }
      }
      setReports(myReports);
    } catch (error: any) {
      if (error.response?.status === 401) {
        return;
      }
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, pageSize]);

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

  const generateReportText = (report: WorkReport) => {
    const carNum = (report.car_id && typeof report.car_id === 'object') ? (report.car_id as any).car_number : report.car_id;
    const member = (report.member_id && typeof report.member_id === 'object') ? report.member_id : 
                   (report.driver_id && typeof report.driver_id === 'object') ? report.driver_id : null;
    const accountSource = member?.line_user_id ? t('registered_line') : t('created_admin');
    const memberName = member ? `${member.first_name} ${member.last_name} ${accountSource}` : (report.member_id || report.driver_id);
    
    const workDate = (report.work_date || report.date_created || '').split('T')[0].split(' ')[0];
    const isCustomer = userRole.toLowerCase() === 'customer';
    
    let routesText = '';
    if (report.routes && report.routes.length > 0) {
      routesText = report.routes.map((route, index) => `
เส้นทางที่ ${index + 1}:
📍 ต้นทาง : ${route.origin || '-'}
🔗 ลิงก์ต้นทาง : ${route.origin_url || '-'}
📍 ปลายทาง : ${route.destination || '-'}
🔗 ลิงก์ปลายทาง : ${route.destination_url || '-'}
ระยะทาง : ${route.distance !== undefined ? route.distance + ' km' : '-'}`).join('\n');
    } else {
      routesText = `📍 ${t('origin')} : ${report.origin || '-'}
📍 ${t('destination')} : ${report.destination || '-'}`;
    }
    
    return `🆔 ${t('case_number')} : ${formatCaseNumber(report)}
📅 ${t('report_date')} : ${workDate}
📁 ${t('customer_name')} : ${report.customer_name}
${routesText}
${report.estimated_distance !== undefined ? `\n📏 ${t('estimated_distance')} รวม : ${report.estimated_distance} ${t('km')}` : ''}

🚚 ${t('car_number')} : ${carNum}

👷 ${t('member_name')} : ${memberName}
📞 ${t('phone')} : ${report.phone}

👉 ${t('standby_time')} : ${formatTimeDisplay(report.standby_time)}
👉 ${t('departure_time')} : ${formatTimeDisplay(report.departure_time)}
👉 ${t('arrival_time')} : ${formatTimeDisplay(report.arrival_time)}
${!isCustomer ? `
🍄 ${t('mileage_start')} : ${report.mileage_start}
🍄 ${t('mileage_end')} : ${report.mileage_end}
` : ''}
📌 ${t('notes')} : ${report.notes || '-'}`;
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // Only show finished jobs (completed, cancelled, or deleted)
      if (r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'deleted') return false;

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
      const car = (r.car_id && typeof r.car_id === 'object') ? String((r.car_id as any).car_number || '').toLowerCase() : '';
      const caseNum = String(r.case_number || r.id || '').toLowerCase();
      
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

      const weightA = getStatusWeight(a.status);
      const weightB = getStatusWeight(b.status);

      return (weightA - weightB) || (new Date(b.work_date || b.date_created || 0).getTime() - new Date(a.work_date || a.date_created || 0).getTime());
    });
  }, [reports, searchTerm, startDate, endDate]);

  const totalPages = Math.ceil(filteredReports.length / pageSize) || 1;
  const paginatedReports = useMemo(() => {
    return filteredReports.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
  }, [filteredReports, currentPage, pageSize]);

  const handleExportExcel = useCallback(() => {
    const dataToExport = filteredReports.map(r => {
      const member = (typeof r.member_id === 'object' ? r.member_id : null) || 
                     (typeof r.driver_id === 'object' ? r.driver_id : null);
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
        [t('estimated_distance')]: r.estimated_distance || '-',
        [t('vehicle_number')]: car?.car_number || '-',
        [t('vehicle_type')]: car?.vehicle_type || '-',
        [t('member_name')]: member ? `${member.first_name} ${member.last_name}` : '-',
        [t('member_phone')]: r.phone || '-',
        [t('standby_time')]: formatTimeDisplay(r.standby_time),
        [t('departure_time')]: formatTimeDisplay(r.departure_time),
        [t('arrival_time')]: formatTimeDisplay(r.arrival_time),
        [t('mileage_start')]: r.mileage_start || '-',
        [t('mileage_end')]: r.mileage_end || '-',
        [t('notes')]: r.notes || '-'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Job History");
    
    const fileName = `Job_History_${formatDate(new Date(), 'dd/MM/yyyy_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [filteredReports, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('job_history')}</h2>
        </div>
      </div>

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
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('driver')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-slate-500">{t('loading_history')}</p>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    {t('no_reports_found')}
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => {
                  const member = (report.member_id && typeof report.member_id === 'object' ? report.member_id : null) || 
                                 (report.driver_id && typeof report.driver_id === 'object' ? report.driver_id : null);
                  const car = typeof report.car_id === 'object' ? report.car_id : null;
                  
                  return (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {formatCaseNumber(report)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={clsx(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block",
                          report.status === 'completed' ? "bg-emerald-100 text-emerald-700" : 
                          report.status === 'accepted' ? "bg-blue-50 text-blue-600" :
                          report.status === 'cancelled' ? "bg-red-100 text-red-700" :
                          report.status === 'deleted' ? "bg-slate-200 text-slate-600" :
                          report.status === 'cancel_pending' ? "bg-orange-50 text-orange-600 border border-orange-100" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {t(`status_${report.status || 'pending'}`)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(new Date(report.work_date || report.date_created || Date.now()), 'dd/MM/yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">
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
                        {report.estimated_distance !== undefined && (
                          <div className="text-[10px] font-bold text-blue-600 mt-1 flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            {report.estimated_distance} {t('km')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            {car?.car_number || 'N/A'}
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {member ? `${member.first_name} ${member.last_name}` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedReport(report)}
                          className="p-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all"
                          title={t('view_report')}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{t('rows_per_page') || 'Rows per page'}:</span>
                <select 
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {[10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <span className="text-sm text-slate-500">
                {t('showing_range', { 
                  start: (currentPage - 1) * pageSize + 1, 
                  end: Math.min(currentPage * pageSize, filteredReports.length),
                  total: filteredReports.length
                }) || `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredReports.length)} of ${filteredReports.length}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                title={t('first_page')}
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                title={t('previous_page')}
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-sm font-bold text-slate-900">{currentPage}</span>
                <span className="text-sm text-slate-400">/</span>
                <span className="text-sm text-slate-500">{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                title={t('next_page')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                title={t('last_page')}
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {t('job_report')} {selectedReport && `- ${formatCaseNumber(selectedReport)}`}
              </h3>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <pre className="text-sm font-sans whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {generateReportText(selectedReport)}
                </pre>
              </div>

              {((selectedReport.pickup_photos && selectedReport.pickup_photos.length > 0) || 
                (selectedReport.delivery_photos && selectedReport.delivery_photos.length > 0) ||
                (selectedReport.photos && selectedReport.photos.length > 0)) && (
                <div className="space-y-6">
                  {selectedReport.pickup_photos && selectedReport.pickup_photos.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Camera className="w-4 h-4 text-primary" />
                        {t('pickup_photos')}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedReport.pickup_photos.map((photoId: any) => {
                          const meta = selectedReport.photo_metadata?.find((m: any) => m.file_id === photoId);
                          return (
                            <div key={photoId} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                              <img 
                                src={directusApi.getFileUrl(photoId, { key: 'system-large-contain' })} 
                                alt="Pickup" 
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                referrerPolicy="no-referrer"
                                onClick={() => setFullscreenImage(directusApi.getFileUrl(photoId))}
                              />
                              {meta && (
                                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 text-[10px] text-white leading-tight">
                                  {meta.timestamp && <div>{meta.timestamp}</div>}
                                  {meta.latitude && <div>GPS: {meta.latitude.toFixed(4)}, {meta.longitude.toFixed(4)}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedReport.delivery_photos && selectedReport.delivery_photos.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        {t('delivery_photos')}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedReport.delivery_photos.map((photoId: any) => {
                          const meta = selectedReport.photo_metadata?.find((m: any) => m.file_id === photoId);
                          return (
                            <div key={photoId} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                              <img 
                                src={directusApi.getFileUrl(photoId, { key: 'system-large-contain' })} 
                                alt="Delivery" 
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                referrerPolicy="no-referrer"
                                onClick={() => setFullscreenImage(directusApi.getFileUrl(photoId))}
                              />
                              {meta && (
                                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 text-[10px] text-white leading-tight">
                                  {meta.timestamp && <div>{meta.timestamp}</div>}
                                  {meta.latitude && <div>GPS: {meta.latitude.toFixed(4)}, {meta.longitude.toFixed(4)}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedReport.photos && selectedReport.photos.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{t('photos')}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedReport.photos.map((photoId: any) => {
                          const meta = selectedReport.photo_metadata?.find((m: any) => m.file_id === photoId);
                          return (
                            <div key={photoId} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                              <img 
                                src={directusApi.getFileUrl(photoId, { key: 'system-large-contain' })} 
                                alt="Job" 
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                referrerPolicy="no-referrer"
                                onClick={() => setFullscreenImage(directusApi.getFileUrl(photoId))}
                              />
                              {meta && (
                                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 text-[10px] text-white leading-tight">
                                  {meta.timestamp && <div>{meta.timestamp}</div>}
                                  {meta.latitude && <div>GPS: {meta.latitude.toFixed(4)}, {meta.longitude.toFixed(4)}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedReport.notes && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{t('notes')}</h4>
                  <p className="text-slate-600 text-sm italic">{selectedReport.notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => {
                  const text = generateReportText(selectedReport);
                  navigator.clipboard.writeText(text);
                  console.log(t('report_copied'));
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                <Copy className="w-4 h-4" />
                {t('copy_text')}
              </button>
              <button 
                onClick={() => setSelectedReport(null)}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-all"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            onClick={() => setFullscreenImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        </div>
      )}
    </div>
  );
};
