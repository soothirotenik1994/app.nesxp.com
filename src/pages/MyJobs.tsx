import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
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
  User
} from 'lucide-react';
import { clsx } from 'clsx';

interface WorkReport {
  id: string;
  work_date: string;
  customer_name: string;
  origin: string;
  destination: string;
  car_id: any;
  driver_id: any;
  status: string;
  mileage_start: number;
  mileage_end: number;
}

export const MyJobs: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const userEmail = localStorage.getItem('user_email');
  const userRole = localStorage.getItem('user_role') || 'Driver';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

  const fetchMyJobs = async () => {
    if (!userEmail) {
      setError(t('user_email_not_found'));
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
        // Admin sees everything, no need to check line_users
        myReports = allReports;
      } else {
        // Driver needs to find their member profile
        const members = await directusApi.getMembers();
        const currentMember = members.find(m => m.email === userEmail);

        if (currentMember) {
          // Driver sees only their own
          myReports = allReports.filter(r => {
            const driverId = typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id;
            return String(driverId) === String(currentMember.id);
          });
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

  const sortedReports = [...reports].sort((a, b) => {
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

    // Tie-breaker: newest date first
    return new Date(b.work_date).getTime() - new Date(a.work_date).getTime();
  });

  const totalPages = Math.ceil(sortedReports.length / itemsPerPage);
  const paginatedReports = sortedReports.slice(
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
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          {isAdmin ? t('all_jobs') : t('my_assigned_jobs')}
        </h2>
        <p className="text-slate-500">{t('select_job_to_update')}</p>
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
          <div className="space-y-4">
            {paginatedReports.map((report) => {
              const isCompleted = report.mileage_end > 0;
              return (
                <button
                  key={report.id}
                  onClick={() => navigate(`/jobs/edit/${report.id}`)}
                  className="w-full text-left bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          report.status === 'completed' ? "bg-emerald-100 text-emerald-700" : 
                          report.status === 'accepted' ? "bg-blue-100 text-blue-700" :
                          report.status === 'cancelled' ? "bg-red-100 text-red-700" :
                          report.status === 'cancel_pending' ? "bg-orange-100 text-orange-700 border border-orange-200" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {t(`status_${report.status || 'pending'}`)}
                        </span>
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {report.work_date}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-primary transition-colors">
                          {report.customer_name}
                        </h3>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{report.origin}</span>
                          <ChevronRight className="w-3 h-3" />
                          <span>{report.destination}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 pt-2 border-t border-slate-50">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          {report.car_id?.car_number || t('no_vehicle')}
                        </div>
                        {isAdmin && report.driver_id && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {typeof report.driver_id === 'object' 
                              ? `${report.driver_id.first_name} ${report.driver_id.last_name}`
                              : report.driver_id}
                          </div>
                        )}
                        {isCompleted && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 ml-auto">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('done')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="self-center p-2 bg-slate-50 rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </button>
              );
            })}
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
