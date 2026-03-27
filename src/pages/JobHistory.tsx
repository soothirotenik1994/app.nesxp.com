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
  Camera
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
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
              const driverId = typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id;
              return String(driverId) === String(currentMember.id);
            });
          }
        }
      }
      setReports(myReports);
    } catch (error) {
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

  const generateReportText = (report: WorkReport) => {
    const carNum = (report.car_id && typeof report.car_id === 'object') ? (report.car_id as any).car_number : report.car_id;
    const driver = (report.driver_id && typeof report.driver_id === 'object') ? report.driver_id : null;
    const accountSource = driver?.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
    const driverName = driver ? `${driver.first_name} ${driver.last_name} ${accountSource}` : report.driver_id;
    
    const workDate = (report.work_date || report.date_created || '').split('T')[0].split(' ')[0];
    const isCustomer = userRole.toLowerCase() === 'customer';
    
    return `🆔 ID : ${report.id || '-'}
🆔 ${t('case_number')} : ${report.case_number || '-'}
📅 ${t('report_date')} : ${workDate}
📁 ${t('customer_name')} : ${report.customer_name}

📍 ${t('origin')} : ${report.origin}
📍 ${t('destination')} : ${report.destination}

🚚 ${t('car_number')} : ${carNum}

👷 ${t('driver_name')} : ${driverName}
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
      // Only show finished jobs (completed or cancelled)
      if (r.status !== 'completed' && r.status !== 'cancelled') return false;

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

      const weightA = getStatusWeight(a.status);
      const weightB = getStatusWeight(b.status);

      return (weightA - weightB) || (new Date(b.work_date || b.date_created || 0).getTime() - new Date(a.work_date || a.date_created || 0).getTime());
    });
  }, [reports, searchTerm, startDate, endDate]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = useMemo(() => {
    return filteredReports.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredReports, currentPage, itemsPerPage]);

  const handleExportExcel = useCallback(() => {
    const dataToExport = filteredReports.map(r => {
      const driver = typeof r.driver_id === 'object' ? r.driver_id : null;
      const car = typeof r.car_id === 'object' ? r.car_id : null;
      const workDate = (r.work_date || r.date_created || '').split('T')[0].split(' ')[0];
      
      return {
        'ID': r.id || '-',
        'Case Number': r.case_number || '-',
        'Status': t(`status_${r.status || 'pending'}`),
        'Date': workDate,
        'Customer Name': r.customer_name || '-',
        'Contact Name': r.customer_contact_name || '-',
        'Contact Phone': r.customer_contact_phone || '-',
        'Origin': r.origin || '-',
        'Destination': r.destination || '-',
        'Vehicle Number': car?.car_number || '-',
        'Vehicle Type': car?.vehicle_type || '-',
        'Driver Name': driver ? `${driver.first_name} ${driver.last_name}` : '-',
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Job History");
    
    const fileName = `Job_History_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [filteredReports, t]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipment History</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Review and manage the ledger of all completed deliveries.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Advanced Filters
          </button>
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Ledger
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Deliveries</span>
          <div className="text-3xl font-bold text-slate-900">{filteredReports.length.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Success Rate</span>
          <div className="text-3xl font-bold text-primary">99.4%</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg. Delay</span>
          <div className="text-3xl font-bold text-red-500">12m</div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Fleet</span>
          <div className="text-3xl font-bold text-slate-900">128</div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="pl-10 pr-8 py-2 bg-slate-50 border-none rounded-full text-xs font-bold text-slate-600 appearance-none focus:ring-2 focus:ring-primary/20 transition-all">
                <option>Oct 01, 2023 - Oct 31, 2023</option>
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="pl-10 pr-8 py-2 bg-slate-50 border-none rounded-full text-xs font-bold text-slate-600 appearance-none focus:ring-2 focus:ring-primary/20 transition-all">
                <option>All Statuses</option>
              </select>
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing 1-10 of {filteredReports.length} shipments
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shipment ID</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Route</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vehicle</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-slate-500">{t('loading_history')}</p>
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    {t('no_reports_found')}
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => {
                  const driver = typeof report.driver_id === 'object' ? report.driver_id : null;
                  const car = typeof report.car_id === 'object' ? report.car_id : null;
                  const workDate = (report.work_date || report.date_created || '').split('T')[0].split(' ')[0];
                  
                  return (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-6">
                        <span className="text-xs font-bold text-primary">#SHP-{report.id || '-'}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className={clsx(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5",
                          report.status === 'completed' ? "bg-emerald-50 text-emerald-600" : 
                          report.status === 'accepted' ? "bg-blue-50 text-blue-600" :
                          report.status === 'cancelled' ? "bg-red-50 text-red-600" :
                          "bg-slate-50 text-slate-600"
                        )}>
                          <div className={clsx(
                            "w-1.5 h-1.5 rounded-full",
                            report.status === 'completed' ? "bg-emerald-600" : 
                            report.status === 'accepted' ? "bg-blue-600" :
                            report.status === 'cancelled' ? "bg-red-600" :
                            "bg-slate-600"
                          )}></div>
                          {report.status === 'completed' ? 'Success' : report.status === 'accepted' ? 'In Transit' : report.status === 'cancelled' ? 'Delayed' : report.status}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-xs font-bold text-slate-900">{format(new Date(report.work_date || report.date_created || Date.now()), 'MMM dd, yyyy')}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{format(new Date(report.work_date || report.date_created || Date.now()), 'hh:mm a')}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">
                            {report.customer_name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="text-xs font-bold text-slate-900">{report.customer_name}</div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          {report.origin}
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                          {report.destination}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Truck className="w-4 h-4 text-slate-400" />
                          {car?.car_number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => setSelectedReport(report)}
                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-8 border-t border-slate-50 flex items-center justify-center gap-4">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 text-slate-400 disabled:opacity-30 hover:bg-slate-50 rounded-full transition-all"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={clsx(
                  "w-8 h-8 rounded-full text-xs font-bold transition-all",
                  currentPage === page ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                {page}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-2 text-slate-400 disabled:opacity-30 hover:bg-slate-50 rounded-full transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Footer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-50 p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Regional Volume Density</h3>
            <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Full Map →</button>
          </div>
          <div className="bg-slate-200 h-48 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
            <div className="absolute inset-0 flex items-center justify-around p-8">
              <div className="text-center space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">North</div>
                <div className="text-xl font-bold text-slate-900">1,204</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Central</div>
                <div className="text-xl font-bold text-slate-900">4,812</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">South</div>
                <div className="text-xl font-bold text-slate-900">892</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Ledger</h3>
          <div className="space-y-6">
            {[
              { title: 'Ledger Entry #2901-X', desc: 'Archived shipment data for Q3 finalized.', time: '2 hours ago', color: 'bg-primary' },
              { title: 'Audit Flag raised', desc: 'Discrepancy detected in Route #BK-SIN fuel logs.', time: '5 hours ago', color: 'bg-red-500' },
              { title: 'API Sync Complete', desc: 'External carrier data synchronized successfully.', time: 'Yesterday', color: 'bg-emerald-500' },
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", item.color)}></div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900">{item.title}</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">{item.desc}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all">
            View Audit Log
          </button>
        </div>
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{t('job_report')}</h3>
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
                        ภาพตอนขึ้นของ (Pickup)
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
                        ภาพตอนส่งของ (Delivery)
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
