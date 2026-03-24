import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Car as CarType } from '../types';
import { AlertCircle, Wrench, Calendar, Gauge, Edit2, X, Loader2, Save, Car as CarIcon, Plus, Trash2 } from 'lucide-react';

export const MaintenanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [formData, setFormData] = useState({
    car_number: '',
    vehicle_type: '',
    description: '',
    owner_name: '',
    driver_phone: '',
    car_image: '',
    status: 'active',
    maintenance_status: 'normal',
    next_maintenance_date: '',
    next_maintenance_mileage: '',
    current_mileage: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCars = async () => {
    setLoading(true);
    setError(null);
    try {
      const carsData = await directusApi.getCars();
      setCars(carsData);
    } catch (err: any) {
      setError(t('failed_to_load_vehicles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const handleOpenModal = (car: CarType) => {
    setEditingCar(car);
    const carImageId = (car.car_image && typeof car.car_image === 'object') ? (car.car_image as any).id : car.car_image;
    
    setFormData({
      car_number: car.car_number || '',
      vehicle_type: car.vehicle_type || '',
      description: car.description || '',
      owner_name: car.owner_name || '',
      driver_phone: car.driver_phone || '',
      car_image: carImageId || '',
      status: (car as any).status || 'active',
      maintenance_status: (car as any).maintenance_status || 'normal',
      next_maintenance_date: (car as any).next_maintenance_date ? new Date((car as any).next_maintenance_date).toISOString().split('T')[0] : '',
      next_maintenance_mileage: (car as any).next_maintenance_mileage?.toString() || '',
      current_mileage: (car as any).current_mileage?.toString() || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCar) return;
    setSubmitting(true);
    setActionError(null);
    
    try {
      const submissionData = {
        ...formData,
        car_image: formData.car_image || null,
        status: formData.status as 'active' | 'inactive',
        maintenance_status: formData.maintenance_status as 'normal' | 'maintenance',
        next_maintenance_date: formData.next_maintenance_date ? new Date(formData.next_maintenance_date).toISOString() : null,
        next_maintenance_mileage: formData.next_maintenance_mileage ? parseInt(formData.next_maintenance_mileage) : undefined,
        current_mileage: formData.current_mileage ? parseInt(formData.current_mileage) : undefined
      };
      
      await directusApi.updateCar(editingCar.id, submissionData);
      setIsModalOpen(false);
      fetchCars();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const fileId = await directusApi.uploadFile(file);
      setFormData(prev => ({ ...prev, car_image: fileId }));
    } catch (err: any) {
      setActionError('Upload Error: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const checkMaintenance = (car: CarType) => {
    const alerts = [];
    const today = new Date();
    
    if (car.next_maintenance_date) {
      const nextDate = new Date(car.next_maintenance_date);
      if (nextDate < today) {
        alerts.push({ type: 'date', message: t('maintenance_date_passed'), color: 'text-red-500' });
      } else if (nextDate.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000) {
        alerts.push({ type: 'date', message: t('maintenance_date_approaching'), color: 'text-yellow-500' });
      }
    }

    if (car.next_maintenance_mileage && car.current_mileage) {
      if (car.current_mileage >= car.next_maintenance_mileage) {
        alerts.push({ type: 'mileage', message: t('maintenance_mileage_passed'), color: 'text-red-500' });
      } else if (car.next_maintenance_mileage - car.current_mileage < 500) {
        alerts.push({ type: 'mileage', message: t('maintenance_mileage_approaching'), color: 'text-yellow-500' });
      }
    }
    
    return alerts;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('maintenance_dashboard')}</h2>
        <p className="text-slate-500">{t('maintenance_dashboard_desc')}</p>
      </div>

      {loading ? (
        <div className="text-center py-12">{t('loading')}</div>
      ) : error ? (
        <div className="text-red-500 p-4 bg-red-50 rounded-xl">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map(car => {
            const alerts = checkMaintenance(car);

            return (
              <div key={car.id} className={`bg-white p-6 rounded-2xl border ${alerts.length > 0 ? 'border-red-200' : 'border-slate-200'} shadow-sm`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Wrench className={`w-6 h-6 ${alerts.length > 0 ? 'text-red-500' : 'text-primary'}`} />
                    <h3 className="text-xl font-bold">{car.car_number}</h3>
                  </div>
                  <button onClick={() => handleOpenModal(car)} className="p-2 text-slate-400 hover:text-primary">
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm font-bold ${alert.color}`}>
                      <AlertCircle className="w-4 h-4" />
                      {alert.message}
                    </div>
                  ))}
                  <div className="pt-4 mt-4 border-t border-slate-100 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><Calendar className="w-4 h-4"/> {t('next_maintenance_date')}: {car.next_maintenance_date ? new Date(car.next_maintenance_date).toLocaleDateString() : '-'}</p>
                    <p className="flex items-center gap-2"><Gauge className="w-4 h-4"/> {t('next_maintenance_mileage')}: {car.next_maintenance_mileage || '-'}</p>
                    <p className="flex items-center gap-2"><Gauge className="w-4 h-4"/> {t('current_mileage')}: {car.current_mileage || '-'}</p>
                    <p className="flex items-center gap-2 mt-2 font-bold">
                      {t('maintenance_status')}: {car.maintenance_status === 'maintenance' ? <span className="text-red-500">{t('maintenance')}</span> : <span className="text-green-500">{t('normal')}</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && editingCar && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">แก้ไขข้อมูลซ่อมบำรุง</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">เลขทะเบียนรถ</label>
                <input type="text" value={formData.car_number} disabled className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">สถานะซ่อมบำรุง</label>
                <select value={formData.maintenance_status} onChange={(e) => setFormData(prev => ({...prev, maintenance_status: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary">
                  <option value="normal">ปกติ</option>
                  <option value="maintenance">กำลังซ่อมบำรุง</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">วันที่ซ่อมครั้งถัดไป</label>
                  <input type="date" value={formData.next_maintenance_date} onChange={(e) => setFormData(prev => ({...prev, next_maintenance_date: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">เลขไมล์ซ่อมครั้งถัดไป</label>
                  <input type="number" value={formData.next_maintenance_mileage} onChange={(e) => setFormData(prev => ({...prev, next_maintenance_mileage: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">เลขไมล์ปัจจุบัน</label>
                <input type="number" value={formData.current_mileage} onChange={(e) => setFormData(prev => ({...prev, current_mileage: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">ยกเลิก</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> บันทึก</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
