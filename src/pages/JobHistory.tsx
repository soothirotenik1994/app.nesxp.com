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
  Filter,
  FileText,
  X,
  Copy,
  User,
  Download,
  Camera,
  Hash,
  Navigation,
  Building2
} from 'lucide-react';
import { isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { formatDate, formatDateTime } from '../lib/dateUtils';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { ConfirmModal } from '../components/ConfirmModal';
import { clsx } from 'clsx';

export const JobHistory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
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
  }, [searchTerm]);

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
${t('route_index', { index: index + 1 })}:
📍 ${t('origin_label')} : ${route.origin || '-'}
🔗 ${t('origin_url_label')} : ${route.origin_url || '-'}
📍 ${t('destination_label')} : ${route.destination || '-'}
🔗 ${t('destination_url_label')} : ${route.destination_url || '-'}
${t('distance_label')} : ${route.distance !== undefined ? route.distance + ' ' + t('km') : '-'}`).join('\n');
    } else {
      routesText = `📍 ${t('origin')} : ${report.origin || '-'}
📍 ${t('destination')} : ${report.destination || '-'}`;
    }
    
    return `🆔 ${t('case_number')} : ${formatCaseNumber(report)}
📅 ${t('report_date')} : ${workDate}
📁 ${t('customer_name')} : ${report.customer_name}
${routesText}
${report.estimated_distance !== undefined ? `\n📏 ${t('estimated_distance')} ${t('total_label')} : ${report.estimated_distance} ${t('km')}` : ''}

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
${((report.expense_items && report.expense_items.length > 0) || report.toll_fee || report.fuel_cost || report.other_expenses) ? `
💰 ${t('expenses')}:
${(report.expense_items && report.expense_items.length > 0) 
  ? report.expense_items.map(item => `👉 ${item.name || t('expense_name')} : ${item.amount.toLocaleString()} ${t('baht')}`).join('\n')
  : `${report.toll_fee ? `👉 ${t('toll_fee')} : ${report.toll_fee} ${t('baht')}\n` : ''}${report.fuel_cost ? `👉 ${t('fuel_cost')} : ${report.fuel_cost} ${t('baht')}\n` : ''}${report.other_expenses ? `👉 ${t('other_expenses')} : ${report.other_expenses} ${t('baht')}\n` : ''}${report.other_expenses_note ? `👉 ${t('other_expenses_note')} : ${report.other_expenses_note}\n` : ''}`}
💵 ${t('total_expenses')} : ${((report.expense_items && report.expense_items.length > 0) ? report.expense_items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) : (Number(report.toll_fee || 0) + Number(report.fuel_cost || 0) + Number(report.other_expenses || 0))).toLocaleString()} ${t('baht')}` : ''}
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
  }, [reports, searchTerm, startDate, endDate, t]);

  const handleDownloadPdf = async (reportId: string) => {
    setDownloadingPdf(reportId);
    try {
      const response = await axios.get(`/api/generate-pdf/${reportId}`);
      if (response.data && response.data.base64) {
        const linkSource = `data:application/pdf;base64,${response.data.base64}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = response.data.fileName || `report_${reportId}.pdf`;
        downloadLink.click();
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(t('pdf_generation_failed', 'Failed to generate PDF'));
    } finally {
      setDownloadingPdf(null);
    }
  };

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = useMemo(() => {
    return filteredReports.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredReports, currentPage, itemsPerPage]);

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Job History");
    
    const fileName = `Job_History_${formatDate(new Date(), 'dd-MM-yyyy_HHmm')}.xlsx`;
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
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder={t('search_jobs_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 overflow-x-auto no-scrollbar">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none outline-none text-xs sm:text-sm text-slate-600 focus:ring-0"
              />
              <span className="text-slate-300">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none outline-none text-xs sm:text-sm text-slate-600 focus:ring-0"
              />
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex-1 sm:flex-none justify-center"
            >
              <Download className="w-4 h-4" />
              {t('export_excel')}
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <Filter className="w-4 h-4 text-primary" />
              {t('total')}: <span className="text-slate-900">{filteredReports.length}</span>
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
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]"></th>
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
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {formatCaseNumber(report)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={clsx(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block shadow-sm",
                          report.status === 'completed' ? "bg-emerald-500 text-white" : 
                          report.status === 'accepted' ? "bg-blue-500 text-white" :
                          report.status === 'cancelled' ? "bg-red-500 text-white" :
                          report.status === 'deleted' ? "bg-slate-500 text-white" :
                          report.status === 'cancel_pending' ? "bg-orange-500 text-white" :
                          "bg-slate-500 text-white"
                        )}>
                          {t(`status_${report.status || 'pending'}`)}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-primary/60" />
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{formatDate(report.work_date || report.date_created, 'dd/MM/yyyy')}</span>
                            <span className="text-[10px] text-slate-400">{formatTimeDisplay(report.work_date || report.date_created)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-bold text-slate-900 text-sm">
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
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                              <span className="truncate max-w-[100px] font-semibold text-slate-700">{report.origin}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                              <span className="truncate max-w-[100px] font-semibold text-slate-700">{report.destination}</span>
                            </div>
                          </div>
                          {report.estimated_distance !== undefined && (
                            <div className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                              <Gauge className="w-3 h-3" />
                              {report.estimated_distance} {t('km')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            {car?.car_number || 'N/A'}
                          </div>
                          {car?.vehicle_type && (
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                              {car.vehicle_type}
                            </div>
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
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => navigate(`/jobs/new?copyFrom=${report.id}`)}
                            className="p-2 bg-blue-50 text-primary border border-blue-100 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                            title={t('duplicate_job')}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(report.id);
                            }}
                            disabled={downloadingPdf === report.id}
                            className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            title={t('download_pdf')}
                          >
                            {downloadingPdf === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          <button 
                            onClick={() => setSelectedReport(report)}
                            className="p-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-600 hover:text-white transition-all shadow-sm active:scale-95"
                            title={t('view_report')}
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden divide-y divide-slate-100">
          {loading ? (
             <div className="p-12 text-center">
               <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
               <p className="text-slate-500">{t('loading_history')}</p>
             </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              {t('no_reports_found')}
            </div>
          ) : (
            paginatedReports.map((report) => {
              const car = typeof report.car_id === 'object' ? report.car_id : null;
              const member = (report.member_id && typeof report.member_id === 'object' ? report.member_id : null) || 
                             (report.driver_id && typeof report.driver_id === 'object' ? report.driver_id : null);
              const trackingId = formatCaseNumber(report);

              return (
                <div 
                  key={report.id}
                  className="p-5 flex flex-col gap-5 active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold border border-slate-200">
                          #{trackingId}
                        </span>
                        <span className={clsx(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm",
                          report.status === 'completed' ? "bg-emerald-500 text-white" : 
                          report.status === 'accepted' ? "bg-blue-500 text-white" :
                          report.status === 'cancelled' ? "bg-red-500 text-white" :
                          report.status === 'deleted' ? "bg-slate-500 text-white" :
                          report.status === 'cancel_pending' ? "bg-orange-500 text-white" :
                          "bg-slate-500 text-white"
                        )}>
                          {t(`status_${report.status || 'pending'}`)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">{report.customer_name}</h3>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <Calendar className="w-3.5 h-3.5 text-primary/70" />
                        {formatDate(report.work_date || report.date_created, 'dd MMM yy')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium px-1">
                        {formatTimeDisplay(report.work_date || report.date_created)}
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-6 space-y-4">
                    {/* Vertical Line Connecting Dots */}
                    <div className="absolute left-[11px] top-1.5 bottom-1.5 w-[2px] bg-slate-100"></div>
                    
                    <div className="relative flex flex-col">
                      <div className="absolute -left-[20px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white shadow-sm z-10"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('origin_label')}</span>
                      <span className="text-xs font-bold text-slate-700">{report.origin || '-'}</span>
                    </div>

                    <div className="relative flex flex-col">
                      <div className="absolute -left-[20px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white shadow-sm z-10"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('destination_label')}</span>
                      <span className="text-xs font-bold text-slate-700">{report.destination || '-'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 pt-4 border-t border-slate-50">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
                        <Truck className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-bold text-slate-700">{car?.car_number || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">
                          {member ? `${member.first_name}` : '-'}
                        </span>
                      </div>
                      {report.estimated_distance !== undefined && (
                        <div className="flex items-center gap-1.5 bg-blue-50/50 px-2 py-1.5 rounded-lg border border-blue-100/50 ml-auto">
                          <Gauge className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-bold text-primary">{report.estimated_distance} {t('km')}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                       <button 
                        onClick={() => navigate(`/jobs/new?copyFrom=${report.id}`)}
                        className="flex items-center justify-center p-3 bg-blue-50 text-primary rounded-2xl border border-blue-100 active:scale-95 transition-all shadow-sm"
                        title={t('duplicate_job')}
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDownloadPdf(report.id)}
                        disabled={downloadingPdf === report.id}
                        className="flex items-center justify-center p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                        title={t('download_pdf')}
                      >
                        {downloadingPdf === report.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                      <button 
                        onClick={() => setSelectedReport(report)}
                        className="flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl text-xs font-bold active:scale-95 transition-all shadow-md active:shadow-sm"
                      >
                        <FileText className="w-4 h-4" />
                        {t('view')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full px-2 py-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors bg-white flex-shrink-0"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={clsx(
                      "w-10 h-10 rounded-xl font-bold text-sm transition-all flex-shrink-0",
                      currentPage === page 
                        ? "bg-primary text-white shadow-lg shadow-blue-100" 
                        : "text-slate-500 hover:bg-white border border-transparent hover:border-slate-200"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors bg-white flex-shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {t('job_report')}
                </h3>
                {selectedReport && (
                  <span className="text-xs font-mono text-primary font-bold">
                    {formatCaseNumber(selectedReport)}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors bg-white shadow-sm"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-slate-50/30">
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex justify-center">
                  <div className={clsx(
                    "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm",
                    selectedReport.status === 'completed' ? "bg-emerald-500 text-white" : 
                    selectedReport.status === 'accepted' ? "bg-blue-500 text-white" :
                    selectedReport.status === 'cancelled' ? "bg-red-500 text-white" :
                    "bg-slate-500 text-white"
                  )}>
                    {t(`status_${selectedReport.status || 'pending'}`)}
                  </div>
                </div>

                {/* Info Display UI Instead of Raw Pre */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('case_number')}</span>
                        <span className="text-sm font-bold text-slate-700">{formatCaseNumber(selectedReport)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-50 pt-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('report_date')}</span>
                        <span className="text-sm font-bold text-slate-700">{(selectedReport.work_date || selectedReport.date_created || '').split('T')[0]}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-50 pt-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('customer_name')}</span>
                        <span className="text-sm font-bold text-slate-700">{selectedReport.customer_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Route Summary */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">{t('route')}</h4>
                    {selectedReport.routes?.map((route: any, rIdx: number) => (
                      <div key={rIdx} className={clsx("space-y-3", rIdx > 0 && "pt-3 border-t border-slate-50")}>
                        <div className="text-[10px] font-bold text-primary">{t('route_index', { index: rIdx + 1 })}</div>
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700">{route.origin}</span>
                            {route.origin_url && (
                              <button 
                                onClick={() => window.open(route.origin_url, '_blank')}
                                className="text-[10px] text-blue-500 font-medium hover:underline flex items-center gap-1 overflow-hidden text-ellipsis"
                              >
                                <Navigation className="w-3 h-3" /> {t('view_on_map')}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700">{route.destination}</span>
                            {route.destination_url && (
                              <button 
                                onClick={() => window.open(route.destination_url, '_blank')}
                                className="text-[10px] text-blue-500 font-medium hover:underline flex items-center gap-1 overflow-hidden text-ellipsis"
                              >
                                <Navigation className="w-3 h-3" /> {t('view_on_map')}
                              </button>
                            )}
                          </div>
                        </div>
                        {route.distance && (
                          <div className="flex items-center gap-2 px-6">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span className="text-xs font-bold text-slate-500">{route.distance} {t('km')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Vehicle & Driver */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('car_number')}</span>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Truck className="w-4 h-4 text-primary/70" />
                        <span className="text-sm font-bold">{(selectedReport.car_id as any)?.car_number || selectedReport.car_id || '-'}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{t('member_name')}</span>
                      <div className="flex items-center gap-2 text-slate-700">
                        <User className="w-4 h-4 text-primary/70" />
                        <span className="text-sm font-bold truncate">{(selectedReport.member_id as any)?.first_name || (selectedReport.driver_id as any)?.first_name || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Times Section */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-1.5">{t('standby')}</span>
                      <span className="text-xs font-bold text-slate-700">{formatTimeDisplay(selectedReport.standby_time)}</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-1.5">{t('departure')}</span>
                      <span className="text-xs font-bold text-slate-700">{formatTimeDisplay(selectedReport.departure_time)}</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-1.5">{t('arrival')}</span>
                      <span className="text-xs font-bold text-slate-700">{formatTimeDisplay(selectedReport.arrival_time)}</span>
                    </div>
                  </div>

                  {/* Expenses Summary if exists */}
                  {(selectedReport.toll_fee || selectedReport.fuel_cost || selectedReport.other_expenses) && (
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                       <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">{t('expenses')}</h4>
                       <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                             <span className="text-slate-500 font-medium">{t('total_expenses')}</span>
                             <span className="font-bold text-slate-900">
                                {((selectedReport.expense_items && selectedReport.expense_items.length > 0) 
                                  ? selectedReport.expense_items.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0) 
                                  : (Number(selectedReport.toll_fee || 0) + Number(selectedReport.fuel_cost || 0) + Number(selectedReport.other_expenses || 0))).toLocaleString()} {t('baht')}
                             </span>
                          </div>
                       </div>
                    </div>
                  )}

                  {/* Hidden Text for Copying Still Available via Helper */}
                  <div className="hidden">
                     <pre id="job-report-text-hidden">
                        {generateReportText(selectedReport)}
                     </pre>
                  </div>
                </div>
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
            <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 bg-white">
              <div className="flex gap-2 w-full sm:flex-1">
                <button 
                  onClick={() => handleDownloadPdf(selectedReport.id)}
                  disabled={downloadingPdf === selectedReport.id}
                  className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  {downloadingPdf === selectedReport.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <span className="text-[10px] uppercase tracking-wider">{t('pdf')}</span>
                </button>
                <button 
                  onClick={() => {
                    const text = generateReportText(selectedReport);
                    navigator.clipboard.writeText(text);
                    // Use a toast or simple feedback if available
                  }}
                  className="flex-1 flex flex-col items-center justify-center gap-1 p-2 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                >
                  <Copy className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider">{t('copy')}</span>
                </button>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg active:shadow-md h-full flex items-center justify-center"
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
