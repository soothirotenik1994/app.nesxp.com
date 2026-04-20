import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { WorkReport } from '../types';
import { Bell, X, ChevronRight, Truck, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    if (!isDriver || !memberId) return;

    try {
      const myJobs = await directusApi.getMemberWorkReports(memberId);
      const trulyNewJobs = myJobs.filter(job => !notifiedIdsRef.current.has(String(job.id)));

      if (trulyNewJobs.length > 0) {
        setNewJobs(prev => {
          // Add only if not already in state
          const existingIds = new Set(prev.map(j => String(j.id)));
          const toAdd = trulyNewJobs.filter(j => !existingIds.has(String(j.id)));
          return [...prev, ...toAdd];
        });

        // Update notified IDs to prevent repeated popups for the same job
        trulyNewJobs.forEach(job => notifiedIdsRef.current.add(String(job.id)));
        localStorage.setItem('notified_job_ids', JSON.stringify(Array.from(notifiedIdsRef.current)));
        
        // Play notification sound if possible
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {}); // Browser might block autoplay
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error checking new jobs:', err);
    }
  }, [isDriver, memberId]);

  useEffect(() => {
    if (!isDriver) return;

    // Initial check
    checkNewJobs();

    // Poll every 30 seconds
    const interval = setInterval(checkNewJobs, 30000);
    return () => clearInterval(interval);
  }, [isDriver, checkNewJobs]);

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
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="bg-white rounded-2xl shadow-2xl border border-blue-100 shadow-blue-500/10 overflow-hidden pointer-events-auto"
          >
            <div className="p-4 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Bell className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-tight">{t('new_job_alert')}</h4>
                  <p className="text-[10px] text-white/80 font-medium uppercase tracking-widest">{job.case_number || `#${job.id}`}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDismiss(job.id)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {t('new_job_assigned_msg')}
              </p>
              
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span className="font-bold">{job.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{job.origin}</span>
                  <ChevronRight className="w-3 h-3 text-slate-300" />
                  <span className="truncate">{job.destination}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleDismiss(job.id)}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
                >
                  {t('dismiss')}
                </button>
                <button
                  onClick={() => handleViewJob(job.id)}
                  className="flex-[2] py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {t('view_job')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
