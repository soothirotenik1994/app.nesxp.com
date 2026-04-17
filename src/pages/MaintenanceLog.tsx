import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { directusApi } from '../api/directus';
import { Car, MaintenanceHistory } from '../types';
import { 
  Wrench, 
  Calendar, 
  Gauge, 
  DollarSign, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  Search,
  ArrowLeft,
  Plus,
  Car as CarIcon
} from 'lucide-react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { format } from 'date-fns';

export const MaintenanceLog: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [cars, setCars] = useState<Car[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<{ value: string, label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    mileage: '',
    cost: '',
    notes: ''
  });
  const [serviceItems, setServiceItems] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const [carsData, itemsData] = await Promise.all([
        directusApi.getCars(),
        directusApi.getMaintenanceItems()
      ]);
      setCars(carsData);
      setMaintenanceItems(
        itemsData
          .filter(item => item.status !== 'inactive')
          .map(item => ({ value: item.name, label: item.name }))
      );
    } catch (err: any) {
      if (err.response?.status === 401) return;
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const carOptions = cars.map(car => ({
    value: car.id,
    label: `${car.car_number} (${car.vehicle_type || t('not_specified')})`,
    car: car
  }));

  const handleCarChange = (option: any) => {
    if (option) {
      setSelectedCar(option.car);
      setFormData(prev => ({
        ...prev,
        mileage: option.car.current_mileage?.toString() || ''
      }));
    } else {
      setSelectedCar(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar || serviceItems.length === 0) return;

    setSubmitting(true);
    try {
      // Check for new items and create them
      const newItems = serviceItems.filter(item => !maintenanceItems.some(mi => mi.value === item));
      if (newItems.length > 0) {
        await Promise.all(newItems.map(name => directusApi.createMaintenanceItem({ name })));
      }

      await directusApi.createMaintenanceHistory({
        car_id: selectedCar.id,
        date: formData.date,
        mileage: Number(formData.mileage),
        cost: formData.cost ? Number(formData.cost) : undefined,
        service_type: serviceItems.join(', '),
        notes: formData.notes
      });

      // Update car's current mileage if it's higher
      if (Number(formData.mileage) > (selectedCar.current_mileage || 0)) {
        await directusApi.updateItem('cars', selectedCar.id, {
          current_mileage: Number(formData.mileage)
        });
      }

      setSuccess(true);
    } catch (err) {
      console.error('Failed to save maintenance record:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setSelectedCar(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      mileage: '',
      cost: '',
      notes: ''
    });
    setServiceItems([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-3xl shadow-xl border border-emerald-100 text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">{t('success')}</h2>
          <p className="text-gray-500">{t('save_maintenance_record_success')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            onClick={resetForm}
            className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            {t('add_another')}
          </button>
          <button
            onClick={() => navigate('/maintenance/reports')}
            className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
          >
            {t('view_reports')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-8 h-8 text-primary" />
            {t('maintenance_log')}
          </h1>
          <p className="text-gray-500">{t('maintenance_log_desc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Vehicle Selection */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <label className="text-sm font-bold text-gray-700 block">
              {t('select_vehicle')}
            </label>
            <Select
              options={carOptions}
              onChange={handleCarChange}
              placeholder={t('search_placeholder')}
              isClearable
              className="react-select-container"
              classNamePrefix="react-select"
              styles={{
                control: (base) => ({
                  ...base,
                  borderRadius: '12px',
                  padding: '2px',
                  borderColor: '#e5e7eb',
                  boxShadow: 'none',
                  '&:hover': { borderColor: '#3b82f6' }
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#eff6ff' : 'white',
                  color: state.isSelected ? 'white' : '#1f2937',
                  padding: '10px 15px'
                })
              }}
            />

            {selectedCar && (
              <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <CarIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedCar.car_number}</p>
                    <p className="text-xs text-gray-500">{selectedCar.vehicle_type || t('not_specified')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="bg-white/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('current_mileage')}</p>
                    <p className="text-sm font-bold text-gray-900">{selectedCar.current_mileage?.toLocaleString() || 0} {t('km')}</p>
                  </div>
                  <div className="bg-white/50 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('status')}</p>
                    <span className={`text-xs font-bold ${selectedCar.maintenance_status === 'maintenance' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {selectedCar.maintenance_status === 'maintenance' ? t('in_maintenance') : t('ready_to_use')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Maintenance Form */}
        <div className="lg:col-span-2">
          {!selectedCar ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-400 font-medium">{t('please_select_vehicle_to_continue')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">{t('date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">{t('history_mileage')}</label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.mileage}
                      onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">{t('cost')}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">{t('history_service_type')}</label>
                <CreatableSelect
                  isMulti
                  options={maintenanceItems}
                  onChange={(newValue) => setServiceItems(newValue.map(v => v.value))}
                  placeholder={t('select_or_type_items')}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      padding: '4px',
                      borderColor: '#e5e7eb',
                      backgroundColor: '#f9fafb',
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#3b82f6' }
                    })
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">{t('history_notes')}</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    rows={3}
                    placeholder={t('history_notes_placeholder')}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || serviceItems.length === 0}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    {t('save_maintenance_record')}
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
