import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Car as CarType, Member } from '../types';
import { Search, Plus, Car as CarIcon, Edit2, Trash2, X, Loader2, AlertCircle, Save, Phone, MapPin, Clock } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

// Memoized CarCard component to prevent unnecessary re-renders
const CarCard = React.memo(({ 
  car, 
  isAdmin, 
  carBrands, 
  allMembers, 
  allPermissions,
  onEdit, 
  onDelete 
}: { 
  car: CarType, 
  isAdmin: boolean, 
  carBrands: any[], 
  allMembers: Member[], 
  allPermissions: any[],
  onEdit: (car: CarType) => void, 
  onDelete: (id: string) => void 
}) => {
  const { t } = useTranslation();
  
  const imageId = typeof car.car_image === 'object' ? (car.car_image as any)?.id : car.car_image;
  const brandName = useMemo(() => {
    if (typeof car.brand_id === 'object' && car.brand_id) return (car.brand_id as any)?.name;
    return carBrands.find(b => b.id === car.brand_id)?.name || 'N/A';
  }, [car.brand_id, carBrands]);

  const carMembers = useMemo(() => {
    // 1. Try to use expanded data first (most efficient)
    let membersList: string[] = [];
    if (car.car_users && car.car_users.length > 0) {
      membersList = car.car_users.map(cu => {
        const member = cu.line_user_id;
        if (!member) return null;
        return member.display_name || (member.first_name ? `${member.first_name} ${member.last_name}` : null);
      }).filter(Boolean) as string[];
    } else {
      // 2. Fallback to manual join if needed
      const carPermissions = allPermissions.filter(p => {
        const id = typeof p.car_id === 'object' ? (p.car_id as any)?.id : p.car_id;
        return String(id) === String(car.id);
      });
      
      membersList = allMembers
        .filter(member => carPermissions.some(p => {
          const id = typeof p.line_user_id === 'object' ? (p.line_user_id as any)?.id : p.line_user_id;
          return String(id) === String(member.id);
        }))
        .map(m => m.display_name || `${m.first_name} ${m.last_name}`);
    }

    // Filter out the driver from the members list
    return membersList.filter(name => name !== car.owner_name);
  }, [car.car_users, car.id, allPermissions, allMembers, car.owner_name]);

  const isAssigned = !!car.owner_name;

  return (
    <div className={clsx(
      "bg-white rounded-2xl border transition-all group overflow-hidden flex flex-col shadow-sm hover:shadow-md",
      isAssigned ? "border-slate-200" : "border-slate-200 hover:border-primary/30"
    )}>
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        {imageId ? (
          <img 
            src={directusApi.getFileUrl(car.car_image)} 
            alt={car.car_number} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50">
            <CarIcon className="w-16 h-16 text-slate-200" />
          </div>
        )}
        {isAdmin && (
          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onEdit(car)}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-primary transition-colors shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(car.id)}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-red-500 transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {car.vehicle_type && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-primary/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
              {car.vehicle_type}
            </span>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">{car.car_number}</h3>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            {t('online')}
          </div>
        </div>
        
        <div className="mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('brand')}</p>
          <p className="text-sm text-slate-700 font-bold">{brandName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('driver_name')}</p>
            <p className="text-sm text-slate-700 font-bold truncate">{car.owner_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('phone')}</p>
            {car.member_phone ? (
              <a href={`tel:${car.member_phone}`} className="text-sm text-primary font-bold hover:underline">
                {car.member_phone}
              </a>
            ) : (
              <p className="text-sm text-slate-300 italic">{t('no_data')}</p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('members')}</p>
          <div className="flex flex-wrap gap-1">
            {carMembers.length > 0 ? (
              carMembers.map((name, idx) => (
                <span 
                  key={idx}
                  className="bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="text-slate-400 text-[10px] italic">{t('no_data')}</span>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-500 line-clamp-2 italic mb-4">
          {car.description || t('no_description')}
        </p>
      </div>
    </div>
  );
});

export const Cars: React.FC = () => {
  const { t } = useTranslation();
  const [cars, setCars] = useState<CarType[]>([]);
  const [carBrands, setCarBrands] = useState<any[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    car_number: '',
    vehicle_type: '',
    description: '',
    owner_name: '',
    member_phone: '',
    car_image: '',
    status: 'active',
    brand_id: '',
    current_mileage: '' as string | number,
    next_maintenance_date: '',
    next_maintenance_mileage: '' as string | number
  });

  const userRole = localStorage.getItem('user_role');
  const memberId = localStorage.getItem('member_id');
  const isAdmin = userRole === 'Administrator' || userRole === 'Admin';

  const fetchCars = async () => {
    setLoading(true);
    setError(null);
    try {
      const carsDataResult = await directusApi.getCars();
      console.log('Fetched cars:', carsDataResult);
      setCars(carsDataResult);
      
      const [membersDataResult, permissionsDataResult, brandsDataResult] = await Promise.all([
        directusApi.getMembers(),
        directusApi.getCarPermissions(),
        directusApi.getCarBrands().catch(err => {
          console.error('Error fetching car brands:', err);
          return [];
        })
      ]);
      setAllMembers(membersDataResult);
      setAllPermissions(permissionsDataResult);
      setCarBrands(brandsDataResult);
    } catch (err: any) {
      console.error('Error fetching cars:', err);
      // Only set error if it's not a 401 (which is handled by the interceptor)
      if (err.response?.status !== 401 && err.message?.indexOf('401') === -1) {
        const detail = err.response?.data?.errors?.[0]?.message || err.message;
        if (detail.toLowerCase().includes('permission') || detail.toLowerCase().includes('forbidden')) {
          setError(`${t('permission_error')}: ${t('check_directus_permissions', { collection: 'cars' })}`);
        } else {
          setError(detail || 'Failed to load vehicles');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const handleOpenModal = (car?: CarType) => {
    if (car) {
      setEditingCar(car);
      // Ensure car_image is just the ID string if it's an object, handle null safely
      const carImageId = (car.car_image && typeof car.car_image === 'object') 
        ? (car.car_image as any).id 
        : car.car_image;
      
      console.log('Opening modal for car:', car.id, 'Image ID:', carImageId);
      
      setFormData({
        car_number: car.car_number || '',
        vehicle_type: car.vehicle_type || '',
        description: car.description || '',
        owner_name: car.owner_name || '',
        member_phone: car.member_phone || '',
        car_image: carImageId || '',
        status: (car as any).status || 'active',
        brand_id: (car.brand_id && typeof car.brand_id === 'object' ? (car.brand_id as any).id : car.brand_id) || '',
        current_mileage: car.current_mileage || '',
        next_maintenance_date: car.next_maintenance_date || '',
        next_maintenance_mileage: car.next_maintenance_mileage || ''
      });
    } else {
      setEditingCar(null);
      setFormData({
        car_number: '',
        vehicle_type: '',
        description: '',
        owner_name: '',
        member_phone: '',
        car_image: '',
        status: 'active',
        brand_id: '',
        current_mileage: '',
        next_maintenance_date: '',
        next_maintenance_mileage: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setActionError(null);
      console.log('Uploading file:', file.name);
      const fileId = await directusApi.uploadFile(file);
      console.log('File uploaded successfully, ID:', fileId);
      setFormData(prev => ({ ...prev, car_image: fileId }));
    } catch (err: any) {
      console.error('Error uploading car image:', err);
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message || 'Failed to upload car image';
      setActionError(`Upload Error: ${errorMsg}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, car_image: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    
    console.log('Submitting car data:', formData);
    
    try {
      let carId = editingCar?.id;
      // Prepare data for submission, ensuring empty strings are null for file fields if needed
      const submissionData = {
        ...formData,
        car_image: formData.car_image || null,
        status: formData.status as 'active' | 'inactive',
        brand_id: formData.brand_id || null,
        next_maintenance_date: formData.next_maintenance_date ? new Date(formData.next_maintenance_date).toISOString() : null,
        next_maintenance_mileage: formData.next_maintenance_mileage ? parseInt(String(formData.next_maintenance_mileage)) : undefined,
        current_mileage: formData.current_mileage ? parseInt(String(formData.current_mileage)) : undefined
      };
      
      console.log('Submission data (processed):', submissionData);

      if (editingCar) {
        console.log('Updating car:', editingCar.id);
        const updatedCar = await directusApi.updateCar(editingCar.id, submissionData);
        console.log('Update response:', updatedCar);
      } else {
        console.log('Creating new car');
        const newCar = await directusApi.createCar(submissionData);
        carId = newCar.id;
        console.log('New car created, response:', newCar);
      }

      // Sync car_users with owner_name to enforce "One car, one driver"
      const selectedMember = allMembers.find(m => (m.first_name + ' ' + m.last_name).trim() === formData.owner_name);
      if (carId) {
        // 1. Clear existing assignments for this car to enforce the rule
        const car = cars.find(c => String(c.id) === String(carId));
        if (car && car.car_users && car.car_users.length > 0) {
          await Promise.all(car.car_users.map((cu: any) => 
            directusApi.deleteCarPermission(cu.id).catch(() => {})
          ));
        }

        // 2. Add the new driver assignment if one was selected
        if (selectedMember) {
          await directusApi.addCarPermission(selectedMember.id, carId);
        }
      }

      setIsModalOpen(false);
      fetchCars();
    } catch (err: any) {
      console.error('Error saving car:', err);
      const errorData = err.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || err.message || 'Failed to save vehicle';
      setActionError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setActionError(null);
      await directusApi.deleteCar(deleteId);
      setDeleteId(null);
      fetchCars();
    } catch (err: any) {
      console.error('Error deleting car:', err);
      setActionError(err.message || t('error_deleting'));
      setDeleteId(null);
    }
  };

  const filteredCars = useMemo(() => {
    return cars.filter(c => {
      // If not admin, only show cars that this driver has permission for
      if (!isAdmin && memberId) {
        const hasPermission = allPermissions.some(p => {
          const pCarId = (p.car_id && typeof p.car_id === 'object') ? (p.car_id as any).id : p.car_id;
          const pMemberId = (p.line_user_id && typeof p.line_user_id === 'object') ? (p.line_user_id as any).id : p.line_user_id;
          return String(pCarId) === String(c.id) && String(pMemberId) === String(memberId);
        });
        if (!hasPermission) return false;
      }

      const carNum = String(c.car_number || '').toLowerCase();
      const desc = String(c.description || '').toLowerCase();
      const owner = String(c.owner_name || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      
      return carNum.includes(search) || desc.includes(search) || owner.includes(search);
    });
  }, [cars, searchTerm, isAdmin, memberId, allPermissions]);

  const handleEdit = useCallback((car: CarType) => handleOpenModal(car), []);
  const handleDeleteClick = useCallback((id: string) => setDeleteId(id), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('vehicle_inventory')}</h2>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button 
              onClick={() => handleOpenModal()}
              className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
            >
              <Plus className="w-5 h-5" />
              {t('add_vehicle')}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="text-sm text-slate-500">
            {t('vehicles')}: {filteredCars.length}
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-50 border-b border-red-100 text-red-600 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
            <button onClick={fetchCars} className="text-xs font-bold underline">{t('try_again')}</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500">{t('loading')}</p>
            </div>
          ) : filteredCars.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              {t('no_data')}
            </div>
          ) : (
            filteredCars.map((car) => (
              <CarCard 
                key={car.id} 
                car={car} 
                isAdmin={isAdmin} 
                carBrands={carBrands}
                allMembers={allMembers}
                allPermissions={allPermissions}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            ))
          )}
        </div>
      </div>

      {/* Vehicle Modal */}
      {actionError && (
        <div className="fixed bottom-6 right-6 z-[70] animate-in slide-in-from-right-full duration-300">
          <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="font-bold text-sm">{actionError}</p>
            <button onClick={() => setActionError(null)} className="ml-2 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteId}
        title={t('confirm_delete')}
        message={t('delete_confirm_vehicle')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={t('delete')}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingCar ? t('edit_vehicle') : t('add_vehicle')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('car_image')}</label>
                <div className="space-y-3">
                  {formData.car_image ? (
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group">
                      <img 
                        src={directusApi.getFileUrl(formData.car_image)} 
                        alt="" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="p-2 bg-white rounded-full text-slate-600 hover:text-primary cursor-pointer transition-colors">
                          <Plus className="w-5 h-5" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </label>
                        <button 
                          type="button"
                          onClick={handleRemoveImage}
                          className="p-2 bg-white rounded-full text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="w-full aspect-video flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 hover:border-primary/30 transition-all group">
                      {uploadingImage ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-xs font-bold text-slate-400">{t('uploading')}</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                            <Plus className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                          </div>
                          <span className="text-sm font-bold text-slate-500">{t('upload_photo')}</span>
                          <span className="text-[10px] text-slate-400 mt-1">{t('max_file_size')}</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700">{t('vehicle_brand')}</label>
                  <button 
                    type="button"
                    onClick={() => setIsBrandModalOpen(true)}
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {t('manage_brands')}
                  </button>
                </div>
                <select 
                  value={formData.brand_id}
                  onChange={(e) => setFormData(prev => ({...prev, brand_id: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">{t('select_brand')}</option>
                  {carBrands.map(brand => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('status')}</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('car_number')}</label>
                  <input 
                  type="text" 
                  required
                  value={formData.car_number}
                  onChange={(e) => setFormData(prev => ({...prev, car_number: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('car_number')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('vehicle_type')}</label>
                <input 
                  type="text" 
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData(prev => ({...prev, vehicle_type: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('vehicle_type')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('driver_name')}</label>
                <select 
                  value={allMembers.find(m => (m.first_name + ' ' + m.last_name).trim() === formData.owner_name)?.id || ''}
                  onChange={(e) => {
                    const selectedMember = allMembers.find(m => String(m.id) === e.target.value);
                    if (selectedMember) {
                      setFormData(prev => ({
                        ...prev, 
                        owner_name: `${selectedMember.first_name} ${selectedMember.last_name}`.trim(),
                        member_phone: selectedMember.phone || ''
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev, 
                        owner_name: '',
                        member_phone: ''
                      }));
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="">{t('select_driver')}</option>
                  {allMembers
                    .filter(m => m.role === 'member' || m.role === 'driver')
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('phone')}</label>
                <input 
                  type="tel" 
                  value={formData.member_phone}
                  onChange={(e) => setFormData(prev => ({...prev, member_phone: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('phone')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('current_mileage')}</label>
                <input 
                  type="number" 
                  value={formData.current_mileage}
                  onChange={(e) => setFormData(prev => ({...prev, current_mileage: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('current_mileage')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('next_maintenance_date')}</label>
                  <input 
                    type="date" 
                    value={formData.next_maintenance_date}
                    onChange={(e) => setFormData(prev => ({...prev, next_maintenance_date: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('next_maintenance_mileage')}</label>
                  <input 
                    type="number" 
                    value={formData.next_maintenance_mileage}
                    onChange={(e) => setFormData(prev => ({...prev, next_maintenance_mileage: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('next_maintenance_mileage')}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('description')}</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder={t('description')}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {(submitting || uploadingImage) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {editingCar ? t('save_changes') : t('add_vehicle')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBrandModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{t('vehicle_brand')}</h3>
              <button onClick={() => setIsBrandModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Add Brand Form */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = (e.target as any).brandName.value;
                if (!name) return;
                try {
                  setSubmitting(true);
                  await directusApi.createCarBrand({ name });
                  (e.target as any).reset();
                  fetchCars(); // Refresh brands
                } catch (err) {
                  console.error('Error creating brand:', err);
                } finally {
                  setSubmitting(false);
                }
              }} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('add_new_brand')}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      name="brandName"
                      required
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Toyota"
                    />
                    <button 
                      type="submit"
                      disabled={submitting}
                      className="bg-primary text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-70"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </form>

              {/* Brands List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('brand_list')}</h4>
                <div className="space-y-2">
                  {carBrands.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">{t('no_data')}</p>
                  ) : (
                    carBrands.map(brand => (
                      <div key={brand.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                        <span className="font-semibold text-slate-700">{brand.name}</span>
                        <button 
                          type="button"
                          onClick={() => setDeleteBrandId(brand.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!deleteBrandId}
        title={t('confirm_delete_brand')}
        message={t('confirm_delete_brand_msg')}
        onConfirm={async () => {
          if (!deleteBrandId) return;
          try {
            await directusApi.deleteCarBrand(deleteBrandId);
            setDeleteBrandId(null);
            fetchCars();
          } catch (err: any) {
            console.error('Error deleting brand:', err);
            setActionError(t('delete_brand_error'));
            setDeleteBrandId(null);
          }
        }}
        onCancel={() => setDeleteBrandId(null)}
        confirmText={t('delete')}
      />
    </div>
  );
};
