import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import thLocale from '@fullcalendar/core/locales/th';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { WorkReport, Car } from '../types';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, MapPin, User, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export const JobCalendar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const memberId = localStorage.getItem('member_id');
      const userRole = localStorage.getItem('user_role') || 'customer';
      const isAdmin = userRole.toLowerCase() === 'administrator' || userRole.toLowerCase() === 'admin';

      try {
        const [allJobs, carsData] = await Promise.all([
          directusApi.getWorkReports(),
          directusApi.getCars()
        ]);
        
        let filteredJobs = [];
        let filteredCars = [];

        if (isAdmin) {
          filteredJobs = allJobs;
          filteredCars = carsData;
        } else {
          const members = await directusApi.getMembers();
          const currentMember = members.find(m => String(m.id) === String(memberId));

          if (currentMember) {
            if (currentMember.role === 'customer') {
              // Filter jobs for customer
              filteredJobs = allJobs.filter(r => {
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

              // Filter cars for customer (those linked via car_users)
              filteredCars = carsData.filter(car => 
                car.car_users?.some((cu: any) => {
                  const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                  return String(cuId) === String(currentMember.id);
                })
              );
            } else {
              // Filter jobs for member/driver
              filteredJobs = allJobs.filter(r => {
                const rMemberId = typeof r.member_id === 'object' ? r.member_id?.id : r.member_id;
                const rDriverId = typeof r.driver_id === 'object' ? r.driver_id?.id : r.driver_id;
                return String(rMemberId) === String(currentMember.id) || String(rDriverId) === String(currentMember.id);
              });

              // Filter cars for member (those they are assigned to)
              filteredCars = carsData.filter(car => 
                car.car_users?.some((cu: any) => {
                  const cuId = typeof cu.line_user_id === 'object' ? cu.line_user_id.id : cu.line_user_id;
                  return String(cuId) === String(currentMember.id);
                })
              );
            }
          }
        }

        setCars(filteredCars);

        const calendarEvents = filteredJobs.map((job: WorkReport) => {
          const car = typeof job.car_id === 'object' ? job.car_id : null;
          const carNumber = car?.car_number || job.car_id;
          
          // Use standby_time or departure_time as start
          const start = job.standby_time || job.departure_time || job.work_date;
          // Use arrival_time as end, if not available use start + 1 hour
          const end = job.arrival_time || (start ? new Date(new Date(start).getTime() + 3600000).toISOString() : null);

          // Determine color based on status
          let color = '#3b82f6'; // Default blue
          if (job.status === 'completed') color = '#10b981'; // Green
          if (job.status === 'cancelled') color = '#ef4444'; // Red
          if (job.status === 'accepted') color = '#f59e0b'; // Amber

          return {
            id: job.id,
            title: `${carNumber}${job.case_number ? ` [${job.case_number}]` : ''} - ${job.customer_name} (${job.origin || '?'} -> ${job.destination || '?'})`,
            start: start,
            end: end,
            extendedProps: {
              job: job,
              carNumber: carNumber
            },
            backgroundColor: color,
            borderColor: 'transparent',
            textColor: '#ffffff'
          };
        });
        setEvents(calendarEvents);
      } catch (error: any) {
        if (error.response?.status === 401) {
          return;
        }
        console.error('Error fetching data for calendar:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper to get a consistent color for a car
  const getCarColor = (index: number) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 
      'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-orange-500',
      'bg-teal-500', 'bg-rose-500', 'bg-lime-500', 'bg-violet-500'
    ];
    return colors[index % colors.length];
  };

  const handleEventClick = (info: any) => {
    navigate(`/jobs/edit/${info.event.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-primary" />
            {t('job_calendar')}
          </h2>
        </div>
      </div>

      <div className="bg-white p-3 sm:p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] sm:min-h-[700px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[600px] gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-slate-500 font-medium">{t('loading')}</p>
          </div>
        ) : (
          <div className="calendar-container">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={events}
              eventClick={handleEventClick}
              eventContent={(eventInfo) => {
                const job = eventInfo.event.extendedProps.job;
                return (
                  <div className="flex flex-col w-full overflow-hidden leading-tight p-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold truncate flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {eventInfo.event.extendedProps.carNumber}
                      </span>
                      <span className="text-[9px] opacity-80 whitespace-nowrap">{eventInfo.timeText}</span>
                    </div>
                    <div className="truncate text-[10px] opacity-90 font-medium mt-0.5">
                      {job.customer_name}
                    </div>
                    {(job.origin || job.destination) && (
                      <div className="flex items-center gap-1 text-[9px] opacity-80 mt-0.5 truncate">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">
                          {job.origin || '?'} {job.destination ? `→ ${job.destination}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
              height="auto"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
              }}
              locale={i18n.language.startsWith('th') ? 'th' : 'en'}
              locales={[thLocale]}
              firstDay={1}
              titleFormat={{ year: 'numeric', month: 'long' }}
              dayMaxEvents={true}
              nowIndicator={true}
              buttonText={{
                today: t('today', 'วันนี้'),
                month: t('month', 'เดือน'),
                week: t('week', 'สัปดาห์'),
                day: t('day', 'วัน'),
                prev: t('prev', 'ก่อนหน้า'),
                next: t('next', 'ถัดไป')
              }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t('status')}</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-sm text-slate-600">{t('status_pending')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              <span className="text-sm text-slate-600">{t('status_accepted')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
              <span className="text-sm text-slate-600">{t('status_completed')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm text-slate-600">{t('status_cancelled')}</span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t('cars')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cars.map((car, index) => (
              <div key={car.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <div className={`w-3 h-3 rounded-full ${getCarColor(index)} flex-shrink-0`}></div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{car.car_number}</p>
                  <p className="text-xs text-slate-500 truncate">{car.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .fc {
          font-family: inherit;
          --fc-border-color: #e2e8f0;
          --fc-daygrid-event-dot-width: 8px;
        }
        
        /* Responsive Toolbar */
        @media (max-width: 640px) {
          .fc .fc-toolbar {
            flex-direction: column;
            gap: 1rem;
            align-items: center;
          }
          .fc .fc-toolbar-title {
            font-size: 1.25rem !important;
            order: 1;
          }
          .fc .fc-toolbar-chunk:nth-child(1) {
            order: 2;
          }
          .fc .fc-toolbar-chunk:nth-child(3) {
            order: 3;
            width: 100%;
          }
          .fc .fc-button-group {
            display: flex;
            width: 100%;
          }
          .fc .fc-button-group > .fc-button {
            flex: 1;
            padding: 6px 4px !important;
            font-size: 0.75rem !important;
          }
          .fc .fc-today-button {
            width: 100%;
            margin-top: 4px;
          }
          .fc-daygrid-day-number {
            font-size: 0.7rem !important;
            padding: 4px !important;
          }
          .fc-col-header-cell-cushion {
            font-size: 0.6rem !important;
            padding: 8px 2px !important;
          }
          .fc-event {
            padding: 2px 4px !important;
            font-size: 0.6rem !important;
          }
        }

        .fc .fc-button-primary {
          background-color: #ffffff;
          border-color: #e2e8f0;
          color: #475569;
          font-weight: 600;
          text-transform: capitalize;
          padding: 8px 16px;
          border-radius: 12px;
          box-shadow: none;
        }
        .fc .fc-button-primary:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background-color: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
        }
        .fc .fc-toolbar-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
        }
        .fc .fc-col-header-cell-cushion {
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 16px 4px;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border-color: #f1f5f9;
        }
        .fc-daygrid-day-number {
          font-weight: 600;
          color: #64748b;
          padding: 8px !important;
        }
        .fc-day-today {
          background-color: #f8fafc !important;
        }
        .fc-day-today .fc-daygrid-day-number {
          color: #2563eb;
          background-color: #eff6ff;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 4px;
        }
        .fc-event {
          border: none;
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          margin: 2px 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: transform 0.1s ease;
        }
        .fc-event:hover {
          transform: scale(1.02);
          filter: brightness(0.95);
        }
        .fc-event-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc-h-event .fc-event-main {
          color: inherit;
        }
        .fc-daygrid-more-link {
          font-size: 0.7rem;
          font-weight: 700;
          color: #2563eb;
          margin-left: 8px;
        }
      `}</style>
    </div>
  );
};
