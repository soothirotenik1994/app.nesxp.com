import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Car as CarType } from '../types';
import { Search, Plus, Car as CarIcon, MoreVertical, Edit2, Trash2, X, Loader2, AlertCircle, Save } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const Cars: React.FC = () => {
  const { t } = useTranslation();
  const [cars, setCars] = useState<CarType[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    car_number: '',
    vehicle_type: '',
    description: '',
    owner_name: '',
    driver_phone: '',
    car_image: ''
  });

  const fetchCars = async () => {
    setLoading(true);
    setError(null);
    try {
      const carsDataResult = await directusApi.getCars();
      console.log('Fetched cars:', carsDataResult);
      setCars(carsDataResult);
      
      const [membersDataResult, permissionsDataResult] = await Promise.all([
        directusApi.getMembers(),
        directusApi.getCarPermissions()
      ]);
      setAllMembers(membersDataResult);
      setAllPermissions(permissionsDataResult);
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
        driver_phone: car.driver_phone || '',
        car_image: carImageId || ''
      });
    } else {
      setEditingCar(null);
      setFormData({
        car_number: '',
        vehicle_type: '',
        description: '',
        owner_name: '',
        driver_phone: '',
        car_image: ''
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
        car_image: formData.car_image || null
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

  const filteredCars = cars.filter(c => {
    const carNum = String(c.car_number || '').toLowerCase();
    const desc = String(c.description || '').toLowerCase();
    const owner = String(c.owner_name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return carNum.includes(search) || desc.includes(search) || owner.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('vehicle_inventory')}</h2>
          <p className="text-slate-500">{t('manage_vehicles')}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          {t('add_vehicle')}
        </button>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
              <div key={car.id} className="bg-white rounded-2xl border border-slate-200 hover:border-primary/30 transition-all group overflow-hidden flex flex-col shadow-sm hover:shadow-md">
                {/* Car Image Display */}
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  {(() => {
                    const imageId = typeof car.car_image === 'object' ? (car.car_image as any)?.id : car.car_image;
                    if (imageId) {
                      return (
                        <img 
                          src={directusApi.getFileUrl(car.car_image)} 
                          alt={car.car_number} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      );
                    }
                    return (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <CarIcon className="w-16 h-16 text-slate-200" />
                      </div>
                    );
                  })()}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(car)}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-primary transition-colors shadow-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteId(car.id)}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-red-500 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('driver_name')}</p>
                      <p className="text-sm text-slate-700 font-bold truncate">{car.owner_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('phone')}</p>
                      {car.driver_phone ? (
                        <a href={`tel:${car.driver_phone}`} className="text-sm text-primary font-bold hover:underline">
                          {car.driver_phone}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-300 italic">{t('no_data')}</p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('members')}</p>
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        // Find permissions for this car
                        const carPermissions = allPermissions.filter(p => {
                          if (!p.car_id) return false;
                          const id = typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
                          return String(id) === String(car.id);
                        });
                        const carMembers = allMembers.filter(member => carPermissions.some(p => {
                          if (!p.line_user_id) return false;
                          const id = typeof p.line_user_id === 'object' ? (p.line_user_id as any).id : p.line_user_id;
                          return String(id) === String(member.id);
                        }));
                        
                        if (carMembers.length > 0) {
                          return carMembers.map((member) => {
                            const name = member.display_name || `${member.first_name} ${member.last_name}`;
                            return (
                              <span 
                                key={member.id}
                                className="bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold"
                              >
                                {name}
                              </span>
                            );
                          });
                        }

                        // Fallback to nested data
                        if (car.car_users && car.car_users.length > 0) {
                          return car.car_users.map((cu) => {
                            const member = cu.line_user_id;
                            const name = member?.display_name || (member?.first_name ? `${member.first_name} ${member.last_name}` : t('unknown_car'));
                            return (
                              <span 
                                key={(cu as any).id || Math.random()}
                                className="bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded text-[10px] font-bold"
                              >
                                {name}
                              </span>
                            );
                          });
                        }

                        return <span className="text-slate-400 text-[10px] italic">{t('no_data')}</span>;
                      })()}
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 line-clamp-2 italic mb-4">
                    {car.description || t('no_description')}
                  </p>
                </div>
              </div>
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
                {editingCar ? t('edit_vehicle') || 'แก้ไขรถ' : t('add_vehicle') || 'เพิ่มรถ'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('car_image') || 'รูปภาพรถ'}</label>
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
                          <span className="text-xs font-bold text-slate-400">กำลังอัพโหลด...</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                            <Plus className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                          </div>
                          <span className="text-sm font-bold text-slate-500">{t('upload_photo') || 'อัพโหลดรูปภาพ'}</span>
                          <span className="text-[10px] text-slate-400 mt-1">PNG, JPG สูงสุด 10MB</span>
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
                <label className="text-sm font-semibold text-slate-700">{t('car_number')}</label>
                  <input 
                  type="text" 
                  required
                  value={formData.car_number}
                  onChange={(e) => setFormData(prev => ({...prev, car_number: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="3ฒธ2714"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('vehicle_type') || 'ประเภทรถ'}</label>
                <input 
                  type="text" 
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData(prev => ({...prev, vehicle_type: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="4 ล้อตู้ทึบ"
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
                        driver_phone: selectedMember.phone || ''
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev, 
                        owner_name: '',
                        driver_phone: ''
                      }));
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="">{t('select_driver')}</option>
                  {allMembers
                    .filter(m => (m.role || 'driver') === 'driver')
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
                  value={formData.driver_phone}
                  onChange={(e) => setFormData(prev => ({...prev, driver_phone: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="081-234-5678"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('description')}</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Toyota Hilux White..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  {t('cancel') || 'ยกเลิก'}
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
                      {t('save') || 'บันทึก'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
