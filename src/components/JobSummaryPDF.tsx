import React from 'react';
import { WorkReport, Car, Member, CustomerLocation } from '../types';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { directusApi } from '../api/directus';

interface JobSummaryPDFProps {
  data: Partial<WorkReport>;
  cars: Car[];
  members: Member[];
  customers: CustomerLocation[];
}

export const JobSummaryPDF: React.FC<JobSummaryPDFProps> = ({ data, cars = [], members = [], customers = [] }) => {
  const { t } = useTranslation();
  
  const selectedCar = (cars || []).find(c => String(c.id) === String(typeof data.car_id === 'object' ? (data.car_id as any)?.id : data.car_id));
  const selectedDriver = (members || []).find(m => String(m.id) === String(typeof data.member_id === 'object' ? (data.member_id as any)?.id : data.member_id));
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: th });
    } catch (e) {
      return dateStr;
    }
  };

  const getImageUrl = (fileId: any) => {
    if (!fileId) return '';
    if (typeof fileId === 'string' && fileId.startsWith('http')) return fileId;
    return directusApi.getFileUrl(fileId, { key: 'system-medium-contain' });
  };

  return (
    <div 
      id="pdf-summary-template" 
      className="p-10 bg-white text-slate-800 font-sans"
      style={{ width: '800px', minHeight: '1100px' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-primary mb-1 uppercase tracking-tight">NES TRACKING</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{t('job_summary_report')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-slate-900">{data.case_number || 'N/A'}</p>
          <p className="text-sm text-slate-500">{formatDate(data.work_date)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Customer Info */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{t('customer_label')}</h2>
          <div className="space-y-2">
            <p className="text-lg font-bold text-slate-900">{data.customer_name || '-'}</p>
            <p className="text-sm text-slate-600 flex flex-col">
              <span className="font-bold text-slate-400 mr-2 uppercase text-[10px]">{t('contact_person_label')}:</span>
              {data.customer_contact_name || '-'}
            </p>
            <p className="text-sm text-slate-600 flex flex-col">
              <span className="font-bold text-slate-400 mr-2 uppercase text-[10px]">{t('contact_phone_label')}:</span>
              {data.customer_contact_phone || '-'}
            </p>
          </div>
        </div>

        {/* Vehicle & Driver Info */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{t('driver_info')}</h2>
          <div className="space-y-2">
            <p className="text-lg font-bold text-slate-900">{selectedDriver ? `${selectedDriver.first_name} ${selectedDriver.last_name}` : '-'}</p>
            <p className="text-sm text-slate-600 flex flex-col">
              <span className="font-bold text-slate-400 mr-2 uppercase text-[10px]">{t('car_label')}:</span>
              {selectedCar?.car_number || '-'} ({selectedCar?.vehicle_type || '-'})
            </p>
            <p className="text-sm text-slate-600 flex flex-col">
              <span className="font-bold text-slate-400 mr-2 uppercase text-[10px]">{t('phone')}:</span>
              {selectedDriver?.phone || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Routes & Locations */}
      <div className="space-y-6 mb-8">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{t('route_details')}</h2>
        
        {data.routes?.map((route, rIdx) => (
          <div key={rIdx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="text-sm font-black text-primary mb-4 flex justify-between items-center">
              <span>{t('route_number', { number: rIdx + 1 })}</span>
              <span className="text-slate-400 text-xs font-bold">{route.distance || 0} {t('km')}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('pickup_points')}</p>
                {route.pickups?.map((p, pIdx) => (
                  <div key={pIdx} className="flex flex-col text-sm bg-white p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700 mb-1">📍 {p.name || '-'}</span>
                    {p.time && <span className="text-xs text-slate-400">{t('time')}: {formatDate(p.time)}</span>}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('delivery_points')}</p>
                {route.deliveries?.map((d, dIdx) => (
                  <div key={dIdx} className="flex flex-col text-sm bg-white p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700 mb-1">🏁 {d.name || '-'}</span>
                    {d.time && <span className="text-xs text-slate-400">{t('time')}: {formatDate(d.time)}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Figures & Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1">{t('mileage_start')}</p>
          <p className="text-xl font-black text-primary">{(data.mileage_start || 0).toLocaleString()} <span className="text-xs font-bold opacity-50">KM</span></p>
        </div>
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1">{t('mileage_end')}</p>
          <p className="text-xl font-black text-primary">{(data.mileage_end || 0).toLocaleString()} <span className="text-xs font-bold opacity-50">KM</span></p>
        </div>
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
          <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1">{t('total_expenses')}</p>
          <p className="text-xl font-black text-primary">
            {((data.expense_items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)).toLocaleString()} 
            <span className="text-xs font-bold opacity-50 ml-1">฿</span>
          </p>
        </div>
      </div>

      {/* Signature & Document Photos */}
      <div className="grid grid-cols-2 gap-8 mt-12">
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{t('signature')}</h2>
          {data.signature ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center">
              <img 
                src={getImageUrl(data.signature)} 
                alt="Signature" 
                className="max-h-32 object-contain mb-4"
                referrerPolicy="no-referrer"
              />
              <div className="w-full h-px bg-slate-100 mb-4" />
              <p className="text-sm font-black text-slate-800">{data.signature_name || '-'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('status_completed')}</p>
            </div>
          ) : (
            <div className="h-40 bg-slate-50 border border-dashed border-slate-200 rounded-3xl flex items-center justify-center">
              <p className="text-sm text-slate-400 font-bold italic">{t('no_signature', 'ไม่มีลายเซ็น')}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{t('photo_document')}</h2>
          <div className="grid grid-cols-2 gap-2">
            {(data as any).photo_document?.slice(0, 4).map((photoId: string, idx: number) => (
              <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img 
                  src={getImageUrl(photoId)} 
                  alt="Doc" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
            {!(data as any).photo_document?.length && (
               <div className="col-span-2 h-40 bg-slate-50 border border-dashed border-slate-200 rounded-3xl flex items-center justify-center">
                  <p className="text-sm text-slate-400 font-bold italic">{t('no_photos', 'ไม่มีรูปถ่าย')}</p>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center">
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated by NES Tracking System</p>
         <p className="text-[10px] font-bold text-slate-400">{format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
      </div>
    </div>
  );
};
