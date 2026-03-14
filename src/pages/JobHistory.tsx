import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
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
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';
import { clsx } from 'clsx';

export const JobHistory: React.FC = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const userRole = localStorage.getItem('user_role') || 'Driver';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await directusApi.getWorkReports();
      setReports(data);
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

  const formatTimeDisplay = (time: string | null) => {
    if (!time) return '-';
    // Remove seconds if present (e.g. 2023-10-27 14:54:00 -> 2023-10-27 14:54)
    return time.split(':').slice(0, 2).join(':');
  };

  const generateReportText = (report: WorkReport) => {
    const carNum = typeof report.car_id === 'object' ? report.car_id.car_number : report.car_id;
    const driver = typeof report.driver_id === 'object' ? report.driver_id : null;
    const accountSource = driver?.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)';
    const driverName = driver ? `${driver.first_name} ${driver.last_name} ${accountSource}` : report.driver_id;
    
    const workDate = report.work_date ? report.work_date.split(' ')[0] : '';
    
    return `📅 ${t('report_date')} : ${workDate}
📁 ${t('customer_name')} : ${report.customer_name}

📍 ${t('origin')} : ${report.origin}
📍 ${t('destination')} : ${report.destination}

🚚 ${t('car_number')} : ${carNum}

👷 ${t('driver_name')} : ${driverName}
📞 ${t('phone')} : ${report.phone}

👉 ${t('standby_time')} : ${formatTimeDisplay(report.standby_time)}
👉 ${t('departure_time')} : ${formatTimeDisplay(report.departure_time)}
👉 ${t('arrival_time')} : ${formatTimeDisplay(report.arrival_time)}

🍄 ${t('mileage_start')} : ${report.mileage_start}
🍄 ${t('mileage_end')} : ${report.mileage_end}

📌 ${t('notes')} : ${report.notes || '-'}`;
  };

  const filteredReports = reports.filter(r => {
    const search = searchTerm.toLowerCase();
    const customer = (r.customer_name || '').toLowerCase();
    const origin = (r.origin || '').toLowerCase();
    const dest = (r.destination || '').toLowerCase();
    const car = typeof r.car_id === 'object' ? r.car_id.car_number.toLowerCase() : '';
    
    return customer.includes(search) || origin.includes(search) || dest.includes(search) || car.includes(search);
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

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    return new Date(b.work_date).getTime() - new Date(a.work_date).getTime();
  });

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('job_history')}</h2>
          <p className="text-slate-500">{t('job_history_desc')}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search_jobs_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <Filter className="w-4 h-4" />
            {t('total')}: {filteredReports.length}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
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
            <div className="divide-y divide-slate-100">
              {paginatedReports.map((report) => {
                const driver = typeof report.driver_id === 'object' ? report.driver_id : null;
                
                return (
                  <div key={report.id} className="p-6 hover:bg-slate-50 transition-colors group">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(report.work_date), 'MMM dd, yyyy')}
                          </div>
                          <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
                            <Truck className="w-3 h-3" />
                            {typeof report.car_id === 'object' ? report.car_id.car_number : 'N/A'}
                          </div>
                          <div className={clsx(
                            "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5",
                            report.status === 'completed' ? "bg-emerald-100 text-emerald-700" : 
                            report.status === 'accepted' ? "bg-blue-50 text-blue-600" :
                            report.status === 'cancelled' ? "bg-red-100 text-red-700" :
                            report.status === 'cancel_pending' ? "bg-orange-50 text-orange-600 border border-orange-100" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {t(`status_${report.status || 'pending'}`)}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{report.customer_name}</h3>
                          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              <span>{report.origin}</span>
                              <ChevronRight className="w-3 h-3 mx-1" />
                              <span>{report.destination}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('times')}</p>
                            <div className="flex items-center gap-1 text-xs font-medium text-slate-700">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatTimeDisplay(report.standby_time)} - {formatTimeDisplay(report.arrival_time)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('mileage')}</p>
                            <div className="flex items-center gap-1 text-xs font-medium text-slate-700">
                              <Gauge className="w-3 h-3 text-slate-400" />
                              {report.mileage_start} → {report.mileage_end}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('driver_name')}</p>
                            <p className="text-xs font-medium text-slate-700">
                              {driver ? `${driver.first_name} ${driver.last_name} ${driver.line_user_id ? '(สมัครผ่าน LINE)' : '(Admin สร้าง)'}` : 'N/A'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('photos')}</p>
                            <p className="text-xs font-medium text-slate-700">
                              {report.photos?.length || 0} {t('photos')}
                            </p>
                          </div>
                        </div>
                      </div>

                        <div className="flex items-center gap-2 lg:self-start">
                          <button 
                            onClick={() => setSelectedReport(report)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                          >
                            <FileText className="w-4 h-4" />
                            {t('view_report')}
                          </button>
                        </div>
                    </div>
                  </div>
                );
              })}

              {totalPages > 1 && (
                <div className="p-6 border-t border-slate-100 flex items-center justify-center gap-2">
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
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
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

              {selectedReport.photos && selectedReport.photos.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{t('photos')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedReport.photos.map((photoId: any) => (
                      <div key={photoId} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                        <img 
                          src={`${import.meta.env.VITE_DIRECTUS_URL}/assets/${photoId}`} 
                          alt="Job" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
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
    </div>
  );
};
