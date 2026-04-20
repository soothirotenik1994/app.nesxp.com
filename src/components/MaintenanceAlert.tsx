import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ChevronRight, Wrench } from 'lucide-react';
import { directusApi } from '../api/directus';
import { Car } from '../types';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

const MILEAGE_THRESHOLD = 500; // km
const DATE_THRESHOLD_DAYS = 7; // days

export const MaintenanceAlert: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nearDueCars, setNearDueCars] = useState<Car[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkMaintenance = async () => {
      // Only check once per session to avoid annoying the user
      if (sessionStorage.getItem('maintenance_alert_shown')) return;

      try {
        const cars = await directusApi.getCars();
        const isAdmin = localStorage.getItem('is_admin') === 'true';
        const memberId = localStorage.getItem('member_id');

        const now = new Date();
        
        const dueList = cars.filter(car => {
          // If not admin, only show for cars assigned to the member
          if (!isAdmin && memberId) {
            const isAssigned = car.car_users?.some(cu => 
              typeof cu.line_user_id === 'object' 
                ? cu.line_user_id.id === memberId 
                : cu.line_user_id === memberId
            );
            if (!isAssigned) return false;
          }

          let isDue = false;

          // Check mileage
          if (car.next_maintenance_mileage && car.current_mileage) {
            const diff = car.next_maintenance_mileage - car.current_mileage;
            if (diff <= MILEAGE_THRESHOLD) {
              isDue = true;
            }
          }

          // Check date
          if (car.next_maintenance_date) {
            const dueDate = parseISO(car.next_maintenance_date);
            if (isValid(dueDate)) {
              const diffDays = differenceInDays(dueDate, now);
              if (diffDays <= DATE_THRESHOLD_DAYS) {
                isDue = true;
              }
            }
          }

          return isDue;
        });

        if (dueList.length > 0) {
          setNearDueCars(dueList);
          setIsOpen(true);
          sessionStorage.setItem('maintenance_alert_shown', 'true');
        }
      } catch (error) {
        console.error('Failed to check maintenance status:', error);
      } finally {
        setHasChecked(true);
      }
    };

    const isAdmin = localStorage.getItem('is_admin') === 'true';
    const memberId = localStorage.getItem('member_id');
    const userRole = localStorage.getItem('user_role');
    const isDriver = userRole?.toLowerCase() === 'driver';

    // Check if the user is an admin or a driver
    if (isAdmin || isDriver || memberId) {
       checkMaintenance();
    }
  }, []);

  const handleViewDetails = (carNumber: string) => {
    setIsOpen(false);
    navigate(`/maintenance/log?car=${carNumber}`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('maintenance_alert')}</h2>
                <p className="text-sm text-slate-500">{t('maintenance_near_due_desc')}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-200/50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {nearDueCars.map((car) => {
              const mileageDiff = car.next_maintenance_mileage && car.current_mileage 
                ? car.next_maintenance_mileage - car.current_mileage 
                : null;
              
              const dateDiff = car.next_maintenance_date 
                ? differenceInDays(parseISO(car.next_maintenance_date), new Date()) 
                : null;

              return (
                <div 
                  key={car.id}
                  className="p-4 hover:bg-slate-50 rounded-2xl transition-colors group cursor-pointer border border-transparent hover:border-slate-100"
                  onClick={() => handleViewDetails(car.car_number)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {car.car_number}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {mileageDiff !== null && mileageDiff <= MILEAGE_THRESHOLD && (
                            <span className={clsx(
                              "text-xs font-medium flex items-center gap-1",
                              mileageDiff < 0 ? "text-red-600" : "text-amber-600"
                            )}>
                              {t('due_mileage')}: {car.next_maintenance_mileage?.toLocaleString()} ({mileageDiff < 0 ? t('overdue') : t('remaining')} {Math.abs(mileageDiff)} {t('km')})
                            </span>
                          )}
                          {dateDiff !== null && dateDiff <= DATE_THRESHOLD_DAYS && (
                            <span className={clsx(
                              "text-xs font-medium flex items-center gap-1",
                              dateDiff < 0 ? "text-red-600" : "text-amber-600"
                            )}>
                              {t('due_date')}: {format(parseISO(car.next_maintenance_date!), 'dd/MM/yyyy')} ({dateDiff < 0 ? t('overdue') : t('remaining')} {Math.abs(dateDiff)} {t('days')})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
            <button 
              onClick={() => setIsOpen(false)}
              className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95"
            >
              {t('remind_me_later')}
            </button>
            <button 
              onClick={() => navigate('/maintenance')}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Wrench className="w-5 h-5" />
              {t('view_details')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
