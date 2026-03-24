import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Member, Car, CarPermission } from '../types';
import { 
  ArrowLeft, 
  ChevronRight, 
  ChevronLeft, 
  Car as CarIcon, 
  Search,
  Loader2,
  CheckCircle2
} from 'lucide-react';

export const AssignCars: React.FC = () => {
  const { t } = useTranslation();
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  
  const [member, setMember] = useState<Member | null>(null);
  const [allCars, setAllCars] = useState<Car[]>([]);
  const [permissions, setPermissions] = useState<CarPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!memberId) return;
      
      try {
        const [memberData, carsData, permissionsData] = await Promise.all([
          directusApi.getMember(memberId),
          directusApi.getCars(),
          directusApi.getCarPermissions(memberId)
        ]);
        setMember(memberData);
        setAllCars(carsData);
        setPermissions(permissionsData);
      } catch (error: any) {
        console.error('Error fetching assignment data:', error);
        if (error.response?.status === 403) {
          alert('Permission Denied (403): You do not have access to manage car assignments.');
        } else {
          alert(t('error_loading_data') || 'Error loading data');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [memberId, navigate, t]);

  const assignedCarIds = permissions.map(p => {
    if (!p.car_id) return null;
    const id = typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
    return String(id);
  }).filter(Boolean) as string[];
  
  const availableCars = allCars.filter(car => {
    const isAssigned = assignedCarIds.includes(String(car.id));
    const carNum = (car.car_number || '').toLowerCase();
    const desc = (car.description || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return !isAssigned && (carNum.includes(search) || desc.includes(search));
  });

  const assignedCars = allCars.filter(car => assignedCarIds.includes(String(car.id)));

  const handleAddPermission = async (carId: string) => {
    if (!memberId) return;
    setProcessing(carId);
    try {
      // 1. Check if the car is already assigned to anyone else
      const car = allCars.find(c => String(c.id) === String(carId));
      if (car && car.car_users && car.car_users.length > 0) {
        // Enforce "One car, one driver" rule: 
        // Clear all existing assignments for this car before adding the new one
        await Promise.all(car.car_users.map((cu: any) => 
          directusApi.deleteCarPermission(cu.id).catch(err => {
            console.warn(`Failed to delete existing permission ${cu.id}:`, err);
          })
        ));
      }

      // 2. Add the new permission
      const newPermission = await directusApi.addCarPermission(memberId, carId);
      
      // 3. Update the car's owner_name and driver_phone to match the new driver
      if (car && member) {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.display_name || '';
        await directusApi.updateCar(carId, {
          owner_name: fullName,
          driver_phone: member.phone || ''
        });
      }

      // 4. Refresh all data to ensure UI is in sync
      const [carsData, permissionsData] = await Promise.all([
        directusApi.getCars(),
        directusApi.getCarPermissions(memberId)
      ]);
      setAllCars(carsData);
      setPermissions(permissionsData);
    } catch (error: any) {
      console.error('Error adding permission:', error);
      const errorData = error.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || error.message || t('error_adding_permission');
      alert(errorMsg);
    } finally {
      setProcessing(null);
    }
  };

  const handleRemovePermission = async (carId: string) => {
    const permission = permissions.find(p => {
      if (!p.car_id) return false;
      const id = typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
      return String(id) === String(carId);
    });
    if (!permission) return;
    
    setProcessing(carId);
    try {
      await directusApi.deleteCarPermission(permission.id);
      
      // Also clear the car's owner info if it matches this member
      const car = allCars.find(c => String(c.id) === String(carId));
      if (car && member) {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.display_name || '';
        if (car.owner_name === fullName) {
          await directusApi.updateCar(carId, {
            owner_name: '',
            driver_phone: ''
          });
        }
      }

      // Refresh data
      const [carsData, permissionsData] = await Promise.all([
        directusApi.getCars(),
        directusApi.getCarPermissions(memberId)
      ]);
      setAllCars(carsData);
      setPermissions(permissionsData);
    } catch (error: any) {
      console.error('Error removing permission:', error);
      const errorData = error.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || error.message || t('error_removing_permission');
      alert(errorMsg);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-slate-500 font-medium">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/members')}
          className="p-2 hover:bg-slate-200 rounded-xl transition-colors bg-slate-100 text-slate-600"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('assign_cars')}</h2>
          <p className="text-slate-500">
            {t('managing_permissions_for')}{' '}
            <span className="font-bold text-slate-700">
              {member?.display_name || `${member?.first_name} ${member?.last_name}`}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Member Info Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          {member?.picture_url ? (
            <img 
              src={directusApi.getFileUrl(member.picture_url)} 
              alt="" 
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
              <Search className="w-8 h-8 opacity-20" />
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-slate-900">{member?.display_name || `${member?.first_name} ${member?.last_name}`}</h3>
            <p className="text-sm text-slate-500">LINE ID: {member?.line_user_id || 'N/A'}</p>
          </div>
        </div>
        {/* Available Cars */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              {t('available_vehicles')}
              <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                {availableCars.length}
              </span>
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {availableCars.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <CarIcon className="w-12 h-12 opacity-20" />
                <p className="text-sm">{t('no_data')}</p>
              </div>
            ) : (
              availableCars.map((car) => (
                <div 
                  key={car.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-emerald-200">
                      <CarIcon className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{car.car_number}</p>
                      <p className="text-[10px] text-primary font-bold">
                        {(() => {
                          const assignedNames = car.car_users?.map((cu: any) => {
                            const user = cu.line_user_id;
                            return user?.display_name || (user?.first_name ? `${user.first_name} ${user.last_name}` : null);
                          }).filter(Boolean).join(', ');
                          return assignedNames || car.owner_name || 'N/A';
                        })()}
                      </p>
                      <p className="text-xs text-slate-500">{car.description || t('no_description')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddPermission(car.id)}
                    disabled={!!processing}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all disabled:opacity-50"
                  >
                    {processing === car.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assigned Cars */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              {t('assigned_vehicles')}
              <span className="bg-emerald-100 text-emerald-600 text-xs px-2 py-0.5 rounded-full">
                {assignedCars.length}
              </span>
            </h3>
            <p className="text-sm text-slate-500">{t('vehicles_member_can_track')}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {assignedCars.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <ShieldCheck className="w-12 h-12 opacity-20" />
                <p className="text-sm">{t('no_data')}</p>
              </div>
            ) : (
              assignedCars.map((car) => (
                <div 
                  key={car.id}
                  className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 hover:border-emerald-300 transition-all group"
                >
                  <button
                    onClick={() => handleRemovePermission(car.id)}
                    disabled={!!processing}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-50"
                  >
                    {processing === car.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ChevronLeft className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-bold text-slate-900">{car.car_number}</p>
                      <p className="text-[10px] text-primary font-bold">
                        {(() => {
                          const assignedNames = car.car_users?.map((cu: any) => {
                            const user = cu.line_user_id;
                            return user?.display_name || (user?.first_name ? `${user.first_name} ${user.last_name}` : null);
                          }).filter(Boolean).join(', ');
                          return assignedNames || car.owner_name || 'N/A';
                        })()}
                      </p>
                      <p className="text-xs text-slate-500">{car.description || t('no_description')}</p>
                    </div>
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-emerald-200">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Re-using ShieldCheck icon locally or importing it
const ShieldCheck = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
  </svg>
);
