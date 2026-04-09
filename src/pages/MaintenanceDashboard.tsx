import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { directusApi } from '../api/directus';
import { Car as CarType, MaintenanceHistory } from '../types';
import { AlertCircle, Wrench, Calendar, Gauge, Edit2, X, Loader2, Save, Car as CarIcon, Plus, Trash2, History, TrendingUp, CheckCircle2, AlertTriangle, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import CreatableSelect from 'react-select/creatable';

export const MaintenanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [allHistory, setAllHistory] = useState<MaintenanceHistory[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<{ value: string, label: string }[]>([]);
  const [serviceItems, setServiceItems] = useState<string[]>(['']);
  const [newHistoryData, setNewHistoryData] = useState({
    date: new Date().toISOString().split('T')[0],
    mileage: '',
    cost: '',
    notes: ''
  });
  const [addingHistory, setAddingHistory] = useState(false);
  const [formData, setFormData] = useState({
    car_number: '',
    vehicle_type: '',
    description: '',
    owner_name: '',
    member_phone: '',
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
      const [carsData, historyData, itemsData] = await Promise.all([
        directusApi.getCars(),
        directusApi.getAllMaintenanceHistory(),
        directusApi.getMaintenanceItems()
      ]);
      setCars(carsData);
      setAllHistory(historyData);
      setMaintenanceItems(
        itemsData
          .filter(item => item.status !== 'inactive')
          .map(item => ({ value: item.name, label: item.name }))
      );
    } catch (err: any) {
      if (err.response?.status === 401) return;
      setError(t('failed_to_load_vehicles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const handleOpenModal = async (car: CarType) => {
    setEditingCar(car);
    const carImageId = (car.car_image && typeof car.car_image === 'object') ? (car.car_image as any).id : car.car_image;
    
    setServiceItems(['']);
    setFormData({
      car_number: car.car_number || '',
      vehicle_type: car.vehicle_type || '',
      description: car.description || '',
      owner_name: car.owner_name || '',
      member_phone: car.member_phone || '',
      car_image: carImageId || '',
      status: (car as any).status || 'active',
      maintenance_status: (car as any).maintenance_status || 'normal',
      next_maintenance_date: (car as any).next_maintenance_date ? new Date((car as any).next_maintenance_date).toISOString().split('T')[0] : '',
      next_maintenance_mileage: (car as any).next_maintenance_mileage?.toString() || '',
      current_mileage: (car as any).current_mileage?.toString() || ''
    });
    
    try {
      const history = await directusApi.getMaintenanceHistory(car.id);
      setMaintenanceHistory(history);
    } catch (err: any) {
      if (err.response?.status === 401) {
        return;
      }
      console.error('Failed to fetch maintenance history', err);
    }
    
    setIsModalOpen(true);
  };

  const handleCreateHistory = async () => {
    if (!editingCar) return;
    const validItems = serviceItems.filter(item => item.trim() !== '');
    if (validItems.length === 0) return;

    setAddingHistory(true);
    try {
      // Check for new items and create them in the database
      const newItemsToCreate = validItems.filter(item => !maintenanceItems.some(mi => mi.value === item));
      if (newItemsToCreate.length > 0) {
        await Promise.all(newItemsToCreate.map(name => directusApi.createMaintenanceItem({ name: name })));
        // Refresh items list
        const itemsData = await directusApi.getMaintenanceItems();
        setMaintenanceItems(itemsData.map(item => ({ value: item.name, label: item.name })));
      }

      const newRecord = await directusApi.createMaintenanceHistory({
        ...newHistoryData,
        service_type: validItems.join(', '),
        car_id: editingCar.id,
        mileage: Number(newHistoryData.mileage),
        cost: newHistoryData.cost ? Number(newHistoryData.cost) : undefined
      });
      setMaintenanceHistory([...maintenanceHistory, newRecord]);
      setAllHistory([newRecord, ...allHistory]);
      setNewHistoryData({
        date: new Date().toISOString().split('T')[0],
        mileage: '',
        cost: '',
        notes: ''
      });
      setServiceItems(['']);
    } catch (error: any) {
      if (error.response?.status === 401) return;
      console.error('Error creating maintenance record:', error);
    } finally {
      setAddingHistory(false);
    }
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
      if (err.response?.status === 401) return;
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
      if (err.response?.status === 401) return;
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

  const allAlerts = useMemo(() => {
    return cars.flatMap(car => checkMaintenance(car).map(alert => ({ ...alert, carNumber: car.car_number })));
  }, [cars]);

  const criticalAlerts = allAlerts.filter(a => a.color === 'text-red-500');
  const warningAlerts = allAlerts.filter(a => a.color === 'text-yellow-500');

  const stats = useMemo(() => {
    const total = cars.length;
    const inMaintenance = cars.filter(c => c.maintenance_status === 'maintenance').length;
    const ready = total - inMaintenance;

    // Calculate most frequent maintenance items
    const itemCounts: Record<string, number> = {};
    allHistory.forEach(record => {
      if (record.service_type) {
        // Split by comma if multiple items were stored
        const items = record.service_type.split(',').map(i => i.trim());
        items.forEach(item => {
          if (item) {
            itemCounts[item] = (itemCounts[item] || 0) + 1;
          }
        });
      }
    });

    const chartData = Object.entries(itemCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { total, inMaintenance, ready, chartData };
  }, [cars, allHistory]);

  const exportToExcel = () => {
    import('xlsx').then(XLSX => {
      const data = cars.map(car => ({
        [t('car_number')]: car.car_number,
        [t('vehicle_type')]: car.vehicle_type || '',
        [t('maintenance_status')]: car.maintenance_status === 'maintenance' ? t('maintenance') : t('normal'),
        [t('next_maintenance_date')]: car.next_maintenance_date ? new Date(car.next_maintenance_date).toLocaleDateString() : '',
        [t('next_maintenance_mileage')]: car.next_maintenance_mileage || '',
        [t('current_mileage')]: car.current_mileage || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Report');
      XLSX.writeFile(wb, `maintenance_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('maintenance_dashboard')}</h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/maintenance/items')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Settings className="w-4 h-4" />
            {t('manage_maintenance_types')}
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            {t('export_excel')}
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 grid grid-cols-1 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <CarIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">{t('total_vehicles')}</p>
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">{t('ready_to_use')}</p>
              <p className="text-2xl font-black text-emerald-600">{stats.ready}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <Wrench className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">{t('in_maintenance')}</p>
              <p className="text-2xl font-black text-red-600">{stats.inMaintenance}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('most_frequent_maintenance')}
            </h3>
          </div>
          <div className="h-[200px] w-full">
            {stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic">
                {t('no_data')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <h3 className="text-xl font-bold text-slate-900">{t('vehicle_inventory')}</h3>
        {allAlerts.length > 0 && (
          <div className="flex gap-4">
            {criticalAlerts.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                {criticalAlerts.length} {t('critical_alerts')}
              </div>
            )}
          </div>
        )}
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
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-slate-900">{t('edit_maintenance_info')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-8">
              <form id="maintenance-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('car_number')}</label>
                  <input type="text" value={formData.car_number} disabled className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('maintenance_status')}</label>
                  <select value={formData.maintenance_status} onChange={(e) => setFormData(prev => ({...prev, maintenance_status: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary">
                    <option value="normal">{t('normal')}</option>
                    <option value="maintenance">{t('maintenance')}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('next_maintenance_date')}</label>
                    <input type="date" value={formData.next_maintenance_date} onChange={(e) => setFormData(prev => ({...prev, next_maintenance_date: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">{t('next_maintenance_mileage')}</label>
                    <input type="number" value={formData.next_maintenance_mileage} onChange={(e) => setFormData(prev => ({...prev, next_maintenance_mileage: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('current_mileage')}</label>
                  <input type="number" value={formData.current_mileage} onChange={(e) => setFormData(prev => ({...prev, current_mileage: e.target.value}))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </form>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  {t('maintenance_history')}
                </h3>
                
                <div className="space-y-3 mb-6">
                  {maintenanceHistory.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100">
                      {t('no_maintenance_history')}
                    </div>
                  ) : (
                    maintenanceHistory.map((record) => (
                      <div key={record.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-slate-900">{record.service_type}</p>
                          <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                            {record.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-sm text-slate-600 flex items-center gap-1">
                            <Gauge className="w-3 h-3" /> {record.mileage} km
                          </p>
                          {record.cost && (
                            <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                              ฿{record.cost.toLocaleString()}
                            </p>
                          )}
                        </div>
                        {record.notes && (
                          <p className="text-sm text-slate-500 bg-white p-2 rounded-lg border border-slate-100">{record.notes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                  <h4 className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> {t('add_maintenance_record')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-blue-800">{t('date')}</label>
                      <input
                        type="date"
                        value={newHistoryData.date}
                        onChange={(e) => setNewHistoryData({ ...newHistoryData, date: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-blue-800">{t('history_mileage')}</label>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={newHistoryData.mileage}
                        onChange={(e) => setNewHistoryData({ ...newHistoryData, mileage: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-blue-800">{t('cost')}</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newHistoryData.cost}
                        onChange={(e) => setNewHistoryData({ ...newHistoryData, cost: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-blue-800">{t('history_service_type')}</label>
                    {serviceItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1">
                          <CreatableSelect
                            isClearable
                            placeholder={t('history_service_type')}
                            options={maintenanceItems}
                            value={item ? { value: item, label: item } : null}
                            onChange={(newValue: any) => {
                              const newItems = [...serviceItems];
                              newItems[index] = newValue ? newValue.value : '';
                              setServiceItems(newItems);
                            }}
                            styles={{
                              control: (base) => ({
                                ...base,
                                borderRadius: '0.5rem',
                                borderColor: '#bfdbfe',
                                fontSize: '0.875rem',
                                '&:hover': {
                                  borderColor: '#3b82f6'
                                }
                              }),
                              menu: (base) => ({
                                ...base,
                                zIndex: 9999
                              })
                            }}
                          />
                        </div>
                        {serviceItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setServiceItems(serviceItems.filter((_, i) => i !== index))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setServiceItems([...serviceItems, ''])}
                      className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> {t('add_item')}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-blue-800">{t('history_notes')}</label>
                    <input
                      type="text"
                      placeholder={t('history_notes')}
                      value={newHistoryData.notes}
                      onChange={(e) => setNewHistoryData({ ...newHistoryData, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateHistory}
                    disabled={addingHistory || serviceItems.every(i => !i.trim()) || !newHistoryData.mileage}
                    className="w-full bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm mt-2"
                  >
                    {addingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('save_maintenance_record')}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 shrink-0 flex gap-3 bg-slate-50/50">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-white transition-colors">{t('cancel')}</button>
              <button type="submit" form="maintenance-form" disabled={submitting} className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> {t('save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
