import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { Member } from '../types';
import { Search, UserPlus, MoreVertical, ExternalLink, Mail, Phone, X, Edit2, Trash2, Loader2, Car as CarIcon, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { format } from 'date-fns';
import { clsx } from 'clsx';

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    line_user_id: '',
    password: '',
    role: 'customer' as 'driver' | 'customer'
  });
  const navigate = useNavigate();

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
          setError(detail || 'Failed to load members');
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
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone,
        line_user_id: member.line_user_id,
        password: '', // Don't show password
        role: member.role || 'customer'
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
        role: 'customer'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const payload: any = { ...formData };
      
      // If line_user_id is empty, set it to null to avoid uniqueness constraint issues with empty strings
      if (!payload.line_user_id) {
        payload.line_user_id = null;
      }

      if (editingMember && !payload.password) {
        delete payload.password;
      }

      if (editingMember) {
        await directusApi.updateMember(editingMember.id, payload);
      } else {
        await directusApi.createMember(payload);
      }
      setIsModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      console.error('Error saving member:', err);
      const errorData = err.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || err.message || 'Failed to save member';
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

  const filteredMembers = members.filter(m => {
    const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
    const email = (m.email || '').toLowerCase();
    const phone = (m.phone || '');
    const role = (m.role || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return fullName.includes(search) || email.includes(search) || phone.includes(searchTerm) || role.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('members')}</h2>
          <p className="text-slate-500">{t('manage_members')}</p>
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
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{t('showing_members', { count: filteredMembers.length })}</span>
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-50 border-b border-red-100 text-red-600 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
            <button onClick={fetchMembers} className="text-xs font-bold underline">{t('try_again')}</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">{t('name')}</th>
                <th className="px-6 py-4">{t('contact_info')}</th>
                <th className="px-6 py-4">{t('role')}</th>
                <th className="px-6 py-4">{t('assigned_vehicles')}</th>
                <th className="px-6 py-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">{t('loading')}</p>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    {t('no_data')}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.picture_url ? (
                          <img 
                            src={member.picture_url} 
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
                            <span className={clsx(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                              member.line_user_id ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {member.line_user_id ? 'LINE' : 'Admin'}
                            </span>
                            {member.car_users && member.car_users.length > 0 && (
                              <span className="bg-blue-100 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                {member.car_users.length} {t('vehicles')}
                              </span>
                            )}
                          </div>
                          {member.display_name && (member.first_name || member.last_name) && (
                            <p className="text-xs text-primary font-medium">LINE: {member.display_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
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
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        member.role === 'customer' ? "bg-emerald-100 text-emerald-700" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {t(`${member.role || 'driver'}_role`)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.role === 'customer' && (
                        <div className="flex flex-wrap gap-1.5 max-w-[250px]">
                          {(() => {
                            // Find permissions for this member
                            const memberPermissions = allPermissions.filter(p => {
                              if (!p.line_user_id) return false;
                              const id = typeof p.line_user_id === 'object' ? (p.line_user_id as any).id : p.line_user_id;
                              return String(id) === String(member.id);
                            });
                            const memberCars = allCars.filter(car => memberPermissions.some(p => {
                              if (!p.car_id) return false;
                              const id = typeof p.car_id === 'object' ? (p.car_id as any).id : p.car_id;
                              return String(id) === String(car.id);
                            }));
                            
                            if (memberCars.length > 0) {
                              return memberCars.map((car) => (
                                <span 
                                  key={car.id}
                                  className="bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded-lg text-[10px] font-bold flex flex-col gap-0.5"
                                  title={`${t('driver_name')}: ${car.owner_name || 'N/A'}`}
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
                              ));
                            }
                            
                            // Fallback to nested data if manual join fails
                            if (member.car_users && member.car_users.length > 0) {
                              return member.car_users.map((cu: any) => {
                                const car = cu.car_id;
                                return (
                                  <span 
                                    key={car?.id || Math.random()}
                                    className="bg-blue-50 text-primary border border-blue-100 px-2 py-0.5 rounded-lg text-[10px] font-bold flex flex-col gap-0.5"
                                    title={`${t('driver_name')}: ${car?.owner_name || 'N/A'}`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <CarIcon className="w-3 h-3" />
                                      {car?.car_number || cu.car_number || t('unknown_car')}
                                    </div>
                                    {car?.owner_name && (
                                      <span className="text-[8px] opacity-70 font-medium truncate max-w-[80px]">
                                        {car.owner_name}
                                      </span>
                                    )}
                                  </span>
                                );
                              });
                            }

                            return <span className="text-slate-400 text-xs italic">{t('no_data')}</span>;
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {member.role === 'customer' && (
                          <button 
                            onClick={() => navigate(`/permissions/${member.id}`)}
                            className="p-2 hover:bg-blue-50 text-primary rounded-lg transition-colors"
                            title={t('assign_cars')}
                          >
                            <ExternalLink className="w-5 h-5" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleOpenModal(member)}
                          className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                          title={t('edit')}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeleteId(member.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
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
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('role')}</label>
                <select 
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="driver">{t('driver_role')}</option>
                  <option value="customer">{t('customer_role')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('line_id')}</label>
                <input 
                  type="text" 
                  value={formData.line_user_id}
                  onChange={(e) => setFormData({...formData, line_user_id: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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
