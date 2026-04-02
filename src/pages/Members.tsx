import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { lineService } from '../services/lineService';
import { Member } from '../types';
import { Search, UserPlus, MoreVertical, ExternalLink, Mail, Phone, X, Edit2, Trash2, Loader2, Car as CarIcon, AlertCircle, Plus, Settings2, Check, Shield, UserCheck } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { format } from 'date-fns';
import { clsx } from 'clsx';

// Memoized MemberRow component
const MemberRow = React.memo(({ 
  member, 
  visibleColumns, 
  allCars, 
  allPermissions, 
  onEdit, 
  onDelete,
  onNavigatePermissions,
  onSwitchAccount
}: { 
  member: Member, 
  visibleColumns: string[], 
  allCars: any[], 
  allPermissions: any[], 
  onEdit: (member: Member) => void, 
  onDelete: (id: string) => void,
  onNavigatePermissions: (id: string) => void,
  onSwitchAccount: (member: Member) => void
}) => {
  const { t } = useTranslation();

  const memberVehicles = useMemo(() => {
    // 1. Try manual join first
    const memberPermissions = allPermissions.filter(p => {
      const id = p.line_user_id && typeof p.line_user_id === 'object' ? (p.line_user_id as any).id : p.line_user_id;
      return String(id) === String(member.id);
    });
    
    const cars = allCars.filter(car => memberPermissions.some(p => {
      const id = p.car_id && typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
      return String(id) === String(car.id);
    }));

    if (cars.length > 0) return cars;

    // 2. Fallback to nested data
    if (member.car_users && member.car_users.length > 0) {
      return member.car_users.map((cu: any) => cu.car_id).filter(Boolean);
    }

    return [];
  }, [member.id, member.car_users, allCars, allPermissions]);

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      {visibleColumns.includes('name') && (
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            {member.picture_url ? (
              <img 
                src={directusApi.getFileUrl(member.picture_url)} 
                alt={member.display_name} 
                className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                {String(member.first_name || member.display_name || 'U').charAt(0).toUpperCase()}
                {String(member.last_name || '').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900">
                  {member.first_name || member.last_name 
                    ? `${member.first_name} ${member.last_name}`.trim()
                    : member.display_name || t('not_specified')}
                </p>
                {member.car_users && member.car_users.length > 0 && (
                  <span className="bg-blue-100 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {member.car_users.length} {t('vehicles')}
                  </span>
                )}
              </div>
              {member.display_name && (member.first_name || member.last_name) && (
                <p className="text-xs text-primary font-medium">{t('line_label')}{member.display_name}</p>
              )}
            </div>
          </div>
        </td>
      )}
      {visibleColumns.includes('contact') && (
        <td className="px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {member.email ? (
                <a href={`mailto:${member.email}`} className="hover:text-primary hover:underline transition-colors">
                  {member.email}
                </a>
              ) : (
                <span className="text-slate-400 italic text-xs">{t('not_specified')}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {member.phone ? (
                <a href={`tel:${member.phone}`} className="hover:text-primary hover:underline transition-colors">
                  {member.phone}
                </a>
              ) : (
                <span className="text-slate-400 italic text-xs">{t('not_specified')}</span>
              )}
            </div>
          </div>
        </td>
      )}
      {visibleColumns.includes('role') && (
        <td className="px-6 py-4">
          <span className={clsx(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            member.status === 'inactive' ? "bg-red-100 text-red-700" :
            member.role === 'member' || member.role === 'driver' ? "bg-blue-100 text-blue-700" :
            member.role === 'general' ? "bg-slate-100 text-slate-700" :
            "bg-emerald-100 text-emerald-700"
          )}>
            {member.status === 'inactive' ? t('disabled') : member.role === 'general' ? t('general_role') : t(`${member.role || 'customer'}_role`)}
          </span>
        </td>
      )}
      {visibleColumns.includes('line_uid') && (
        <td className="px-6 py-4">
          <p className="text-xs font-mono text-slate-500 break-all max-w-[150px]">
            {member.line_user_id || '-'}
          </p>
        </td>
      )}
      {visibleColumns.includes('vehicles') && (
        <td className="px-6 py-4">
          <div className="flex flex-wrap gap-1.5 max-w-[250px]">
            {memberVehicles.length > 0 ? (
              memberVehicles.map((car: any) => (
                <span 
                  key={car.id}
                  className="bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded-lg text-[10px] font-bold flex flex-col gap-0.5"
                  title={`${t('member_name')}: ${car.owner_name || 'N/A'}`}
                >
                  <div className="flex items-center gap-1">
                    <CarIcon className="w-3 h-3" />
                    {car.car_number}
                  </div>
                  {car.owner_name && (
                    <span className="text-[8px] opacity-70 font-medium truncate max-w-[80px]">
                      {car.owner_name}
                    </span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-slate-400 text-xs italic">{t('no_data')}</span>
            )}
          </div>
        </td>
      )}
      {visibleColumns.includes('actions') && (
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={() => onSwitchAccount(member)}
              className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
              title={t('switch_account') || 'สลับบัญชี'}
            >
              <UserCheck className="w-5 h-5" />
            </button>
            {member.role === 'customer' && (
              <button 
                onClick={() => onNavigatePermissions(member.id)}
                className="p-2 hover:bg-blue-50 text-primary rounded-lg transition-colors"
                title={t('assign_cars')}
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => onEdit(member)}
              className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
              title={t('edit')}
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onDelete(member.id)}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
              title={t('delete')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
});

export const Members: React.FC = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [allCars, setAllCars] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [switchAccountMember, setSwitchAccountMember] = useState<Member | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('members_columns');
    return saved ? JSON.parse(saved) : ['name', 'contact', 'role', 'status', 'source', 'line_uid', 'vehicles', 'actions'];
  });

  useEffect(() => {
    localStorage.setItem('members_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (id: string) => {
    setVisibleColumns(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id) 
        : [...prev, id]
    );
  };

  const columns = [
    { id: 'name', label: t('name') },
    { id: 'contact', label: t('contact_info') },
    { id: 'role', label: t('role') },
    { id: 'line_uid', label: t('line_uid') },
    { id: 'vehicles', label: t('assigned_vehicles') },
    { id: 'actions', label: t('actions') },
  ];
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    line_user_id: '',
    password: '',
    role: 'general' as 'member' | 'customer' | 'general' | 'driver' | 'inactive',
    status: 'active' as 'active' | 'inactive' | 'pending',
    picture_url: ''
  });
  const navigate = useNavigate();

  const handleSwitchAccountClick = useCallback((member: Member) => {
    setSwitchAccountMember(member);
  }, []);

  const confirmSwitchAccount = useCallback(() => {
    if (switchAccountMember) {
      localStorage.setItem('user_role', switchAccountMember.role || 'customer');
      localStorage.setItem('is_admin', 'false');
      localStorage.setItem('is_switched_account', 'true');
      localStorage.setItem('user_name', `${switchAccountMember.first_name || ''} ${switchAccountMember.last_name || ''}`.trim() || switchAccountMember.display_name || '');
      localStorage.setItem('user_email', switchAccountMember.email || '');
      localStorage.setItem('member_id', switchAccountMember.id);
      if (switchAccountMember.picture_url) {
        localStorage.setItem('user_picture', directusApi.getFileUrl(switchAccountMember.picture_url));
      } else {
        localStorage.removeItem('user_picture');
      }
      window.location.href = '/';
    }
  }, [switchAccountMember]);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersData, carsData, permissionsData] = await Promise.all([
        directusApi.getMembers(),
        directusApi.getCars(),
        directusApi.getCarPermissions()
      ]);
      setMembers(membersData);
      setAllCars(carsData);
      setAllPermissions(permissionsData);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      // Only set error if it's not a 401 (which is handled by the interceptor)
      if (err.response?.status !== 401 && err.message?.indexOf('401') === -1) {
        const detail = err.response?.data?.errors?.[0]?.message || err.message;
        if (detail.toLowerCase().includes('permission') || detail.toLowerCase().includes('forbidden')) {
          setError(`${t('permission_error')}: ${t('check_directus_permissions', { collection: 'line_users' })}`);
        } else {
          setError(detail || t('failed_load_members'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleOpenModal = (member?: Member) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        line_user_id: member.line_user_id || '',
        password: '', // Don't show password
        role: member.role || 'customer',
        status: member.status || 'active',
        picture_url: member.picture_url || ''
      });
    } else {
      setEditingMember(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        line_user_id: '',
        password: '',
        role: 'general',
        status: 'active',
        picture_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSubmitting(true);
      const fileId = await directusApi.uploadFile(file);
      setFormData(prev => ({ ...prev, picture_url: fileId }));
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setActionError(t('failed_upload_photo'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    const payload: any = { ...formData };
      
      // If line_user_id is empty, set it to null to avoid uniqueness constraint issues with empty strings
      if (!payload.line_user_id) {
        payload.line_user_id = null;
      }

      if (editingMember && !payload.password) {
        delete payload.password;
      }

    try {
      if (editingMember) {
        // If status is set to 'inactive', set status to 'inactive', otherwise 'active'
        if (payload.status === 'inactive') {
          payload.status = 'inactive';
        } else {
          payload.status = 'active';
        }

        if (editingMember.status === 'pending' && payload.status === 'active' && editingMember.line_user_id) {
          try {
            await lineService.sendPushMessage(editingMember.line_user_id, [{
              type: 'text',
              text: t('account_approved_msg')
            }]);
          } catch (e) {
            console.error('Failed to send approval notification:', e);
          }
        }

        // If changing from member to another role, clear member assignments
        if (editingMember.role === 'member' && payload.role !== 'member') {
          const memberName = `${editingMember.first_name} ${editingMember.last_name}`.trim();
          const carsToUpdate = allCars.filter(c => c.owner_name === memberName);
          for (const car of carsToUpdate) {
            await directusApi.updateCar(car.id, { owner_name: '', member_phone: '' });
          }
        }

        await directusApi.updateMember(editingMember.id, payload);
      } else {
        payload.status = 'pending';
        payload.role = 'general';
        await directusApi.createMember(payload);
      }
      setIsModalOpen(false);
      fetchMembers();
    } catch (err) {
      console.error('Error saving member:', err);
      const errorData = (err as any).response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || (err as any).message || t('failed_save_member');
      setActionError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setActionError(null);
      await directusApi.deleteMember(deleteId);
      setDeleteId(null);
      fetchMembers();
    } catch (err: any) {
      console.error('Error deleting member:', err);
      setActionError(err.message || t('error_deleting'));
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (member: Member) => {
    try {
      // If pending or inactive, make it active. If active, make it inactive.
      const newStatus = (member.status === 'inactive' || member.status === 'pending') ? 'active' : 'inactive';
      await directusApi.updateMember(member.id, { status: newStatus });
      
      // If approving a pending member, send notification
      if (member.status === 'pending' && newStatus === 'active' && member.line_user_id) {
        try {
          await lineService.sendPushMessage(member.line_user_id, [{
            type: 'text',
            text: t('account_approved_msg')
          }]);
        } catch (e) {
          console.error('Failed to send approval notification:', e);
        }
      }
      
      fetchMembers();
    } catch (err: any) {
      console.error('Error toggling member status:', err);
      setActionError(t('failed_update_status'));
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
      const email = (m.email || '').toLowerCase();
      const phone = (m.phone || '');
      const role = (m.role || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      
      return fullName.includes(search) || email.includes(search) || phone.includes(searchTerm) || role.includes(search);
    });
  }, [members, searchTerm]);

  const handleEdit = useCallback((member: Member) => handleOpenModal(member), []);
  const handleDeleteClick = useCallback((id: string) => setDeleteId(id), []);
  const handleNavigatePermissions = useCallback((id: string) => navigate(`/permissions/${id}`), [navigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('members')}</h2>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <UserPlus className="w-5 h-5" />
          {t('add_member')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">{t('total_members')}</p>
          <p className="text-3xl font-bold text-primary mt-1">{members.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">{t('assigned_vehicles')}</p>
          <p className="text-3xl font-bold text-secondary mt-1">
            {allPermissions.length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search_members')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{t('showing_members', { count: filteredMembers.length })}</span>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className={clsx(
                  "p-2 rounded-xl border transition-all flex items-center gap-2",
                  showColumnSettings 
                    ? "bg-primary text-white border-primary shadow-lg shadow-blue-100" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
                title={t('display_settings')}
              >
                <Settings2 className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-semibold">{t('display_settings')}</span>
              </button>

              {showColumnSettings && (
                <>
                  <div 
                    className="fixed inset-0 z-[60]" 
                    onClick={() => setShowColumnSettings(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[61] animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('show_hide_columns')}</p>
                    </div>
                    {columns.map(col => (
                      <button
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                      >
                        <span className={clsx(
                          "text-sm font-medium transition-colors",
                          visibleColumns.includes(col.id) ? "text-slate-900" : "text-slate-400"
                        )}>
                          {col.label}
                        </span>
                        {visibleColumns.includes(col.id) && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                    <div className="px-2 pt-2 mt-1 border-t border-slate-50">
                      <button 
                        onClick={() => setVisibleColumns(columns.map(c => c.id))}
                        className="w-full px-3 py-2 text-xs font-bold text-primary hover:bg-blue-50 rounded-lg transition-colors text-left"
                      >
                        {t('reset_columns_btn')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-50 border-b border-red-100 text-red-600 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
            <button onClick={fetchMembers} className="text-xs font-bold underline">{t('try_again')}</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                {visibleColumns.includes('name') && <th className="px-6 py-4">{t('name')}</th>}
                {visibleColumns.includes('contact') && <th className="px-6 py-4">{t('contact_info')}</th>}
                {visibleColumns.includes('role') && <th className="px-6 py-4">{t('role')}</th>}
                {visibleColumns.includes('line_uid') && <th className="px-6 py-4">{t('line_uid')}</th>}
                {visibleColumns.includes('vehicles') && <th className="px-6 py-4">{t('assigned_vehicles')}</th>}
                {visibleColumns.includes('actions') && <th className="px-6 py-4 text-right">{t('actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-12 text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">{t('loading')}</p>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-400">
                    {t('no_data')}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <MemberRow 
                    key={member.id}
                    member={member}
                    visibleColumns={visibleColumns}
                    allCars={allCars}
                    allPermissions={allPermissions}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onNavigatePermissions={handleNavigatePermissions}
                    onSwitchAccount={handleSwitchAccountClick}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Modal */}
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
        message={t('delete_confirm')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={t('delete')}
      />

      <ConfirmModal 
        isOpen={!!switchAccountMember}
        title={t('switch_account') || 'สลับบัญชี'}
        message={t('confirm_switch_account', { name: switchAccountMember?.first_name || switchAccountMember?.display_name || '' }) || `คุณต้องการสลับบัญชีไปเป็น ${switchAccountMember?.first_name || switchAccountMember?.display_name} ใช่หรือไม่?`}
        onConfirm={confirmSwitchAccount}
        onCancel={() => setSwitchAccountMember(null)}
        confirmText={t('confirm') || 'ยืนยัน'}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingMember ? t('edit_member') : t('add_member')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('profile_picture')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                    {formData.picture_url ? (
                      <img 
                        src={directusApi.getFileUrl(formData.picture_url)} 
                        alt="" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserPlus className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <label className="flex-1 flex items-center justify-center px-4 py-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-medium">{formData.picture_url ? t('change_photo') : t('upload_photo')}</span>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('first_name')}</label>
                    <input 
                    type="text" 
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('last_name')}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('email')}</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('phone')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('password')}</label>
                <input 
                  type="password" 
                  required={!editingMember}
                  placeholder={editingMember ? t('leave_blank') : ""}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('registration_source')}</label>
                  <div className={clsx(
                    "px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider inline-block",
                    formData.line_user_id ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {formData.line_user_id ? 'LINE' : t('admin_user')}
                  </div>
                </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400" />
                    {t('role')}
                  </label>
                  <select 
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none"
                  >
                    <option value="driver">{t('driver_role')}</option>
                    <option value="customer">{t('customer_role')}</option>
                    <option value="general">{t('general_role')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-slate-400" />
                    {t('status')}
                  </label>
                  <select 
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none"
                  >
                    <option value="active">{t('active')}</option>
                    <option value="inactive">{t('disabled')}</option>
                    <option value="pending">{t('pending')}</option>
                  </select>
                </div>
              </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('line_id')}</label>
                <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-mono break-all">
                  {formData.line_user_id || t('not_linked')}
                </div>
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
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-colors shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
