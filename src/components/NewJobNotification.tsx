import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { WorkReport } from '../types';
import { Bell, X, ChevronRight, Truck, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { showToast } from './Toast';

export const NewJobNotification: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [newJobs, setNewJobs] = useState<WorkReport[]>([]);
  const notifiedIdsRef = useRef<Set<string>>(new Set(JSON.parse(localStorage.getItem('notified_job_ids') || '[]')));
  
  const memberId = localStorage.getItem('member_id');
  const userRole = localStorage.getItem('user_role') || 'customer';
  const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';
  const isDriver = !!memberId && !isAdmin;

  const checkNewJobs = useCallback(async () => {
    // Only check if Driver (for their own jobs) or Admin (for all jobs)
    if (!isAdmin && !isDriver) return;

    try {
      const allJobs = isAdmin 
        ? await directusApi.getWorkReports() // Admins see all
        : await directusApi.getMemberWorkReports(memberId!); // Drivers see their own
      
      const trulyNewJobs = allJobs.filter(job => !notifiedIdsRef.current.has(String(job.id)));

      if (trulyNewJobs.length > 0) {
        // If it's a massive first load, don't toast everything.
        // On first load after refresh, notifiedIdsRef might be empty.
        // We only want to notify about jobs created in the last 5 minutes if it's the very first poll.
        const isFirstPoll = notifiedIdsRef.current.size === 0;
        const now = Date.now();
        
        const jobsToNotify = isFirstPoll 
          ? trulyNewJobs.filter(job => {
              const createdDate = new Date(job.date_created || '').getTime();
              return (now - createdDate) < 300000; // 5 minutes
            })
          : trulyNewJobs;

        if (jobsToNotify.length > 0) {
          setNewJobs(prev => {
            const existingIds = new Set(prev.map(j => String(j.id)));
            const toAdd = jobsToNotify.filter(j => !existingIds.has(String(j.id)));
            return [...prev, ...toAdd];
          });

          // Also show a toast for each new job
          if (isAdmin) {
            jobsToNotify.forEach(job => {
              showToast(`${t('new_job_created', 'มีการสร้างงานใหม่')}: ${job.case_number || job.id}`, 'info');
            });
          } else if (isDriver) {
            jobsToNotify.forEach(job => {
              showToast(`${t('new_job_assigned_msg', 'คุณได้รับมอบหมายงานใหม่ กรุณาตรวจสอบและกดยอมรับงาน')}`, 'success');
            });
          }

          // Update notified IDs
          jobsToNotify.forEach(job => notifiedIdsRef.current.add(String(job.id)));
          
          // Limit the size of notified IDs in localStorage to prevent bloat (keep last 500)
          const idsArray = Array.from(notifiedIdsRef.current);
          if (idsArray.length > 500) {
            const trimmed = idsArray.slice(-500);
            notifiedIdsRef.current = new Set(trimmed);
            localStorage.setItem('notified_job_ids', JSON.stringify(trimmed));
          } else {
            localStorage.setItem('notified_job_ids', JSON.stringify(idsArray));
          }
          
          // Play notification sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        } else {
          // If first poll didn't find "truly fresh" jobs, still mark all existing as notified
          trulyNewJobs.forEach(job => notifiedIdsRef.current.add(String(job.id)));
          localStorage.setItem('notified_job_ids', JSON.stringify(Array.from(notifiedIdsRef.current)));
        }
      }
    } catch (err: any) {
      // If it's a 403 or network error, it's likely handled by fallback or transient.
      // We don't want to spam the console every 30 seconds if it's a known restricted role issue
      if (err.response?.status !== 403 && err.message !== 'Network Error') {
        console.error('Error checking new jobs:', err.message);
      }
    }
  }, [isAdmin, isDriver, memberId, t]);

  useEffect(() => {
    if (!isAdmin && !isDriver) return;

    // Initial check
    checkNewJobs();

    // Poll every 30 seconds
    const interval = setInterval(checkNewJobs, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, isDriver, checkNewJobs]);

  const handleViewJob = (jobId: any) => {
    setNewJobs(prev => prev.filter(j => j.id !== jobId));
    navigate(`/jobs/edit/${jobId}`);
  };

  const handleDismiss = (jobId: any) => {
    setNewJobs(prev => prev.filter(j => j.id !== jobId));
  };

  if (newJobs.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {newJobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="bg-white rounded-[24px] shadow-2xl border border-blue-50/50 shadow-blue-900/10 overflow-hidden pointer-events-auto"
          >
            <div className="p-4 bg-[#003399] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <Bell className="w-6 h-6 text-white animate-[bounce_2s_infinite]" />
                </div>
                <div>
                  <h4 className="font-bold text-lg leading-tight tracking-tight">{t('new_job_alert', 'แจ้งเตือนงานใหม่')}</h4>
                  <p className="text-[11px] text-white/70 font-mono tracking-wider">{job.case_number || `#${job.id}`}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDismiss(job.id)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-[15px] font-medium text-slate-700 leading-normal">
                {t('new_job_assigned_msg', 'คุณได้รับมอบหมายงานใหม่ กรุณาตรวจสอบและกดยอมรับงาน')}
              </p>
              
              <div className="bg-slate-50/80 rounded-2xl p-4 space-y-3 border border-slate-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                  <Truck className="w-5 h-5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-bold text-slate-900 truncate">{job.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[100px]">{job.origin}</span>
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[100px]">{job.destination}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleDismiss(job.id)}
                  className="flex-1 py-3.5 px-6 rounded-2xl text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  {t('dismiss', 'รับทราบ')}
                </button>
                <button
                  onClick={() => handleViewJob(job.id)}
                  className="flex-[2] py-3.5 px-6 rounded-2xl text-sm font-bold text-white bg-[#003399] hover:bg-[#002266] transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 group"
                >
                  {t('view_job', 'ดูรายละเอียดงาน')}
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
