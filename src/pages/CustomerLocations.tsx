import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { CustomerLocation, Member } from '../types';
import { Search, Plus, MapPin, Edit2, Trash2, X, Loader2, AlertCircle, Building2, User, Phone, Mail, FileText, Map, Users } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import Select from 'react-select';

export const CustomerLocations: React.FC = () => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [originalMembers, setOriginalMembers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    company_name: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    branch: '',
    contact_name: '',
    contact_phone: '',
    member_id: '',
    member_ids: [] as string[]
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locationsData, membersData] = await Promise.all([
        directusApi.getCustomerLocations(),
        directusApi.getMembers()
      ]);
      setLocations(locationsData);
      setMembers(membersData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      if (err.response?.status !== 401) {
        setError(err.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (location?: CustomerLocation) => {
    if (location) {
      setEditingLocation(location);
      setOriginalMembers(location.members || []);
      
      // Extract member IDs from both member_id and members array
      const memberIds: string[] = [];
      
      const primaryMemberId = typeof location.member_id === 'object' ? location.member_id?.id : location.member_id;
      if (primaryMemberId) memberIds.push(String(primaryMemberId));
      
      if (location.members && Array.isArray(location.members)) {
        location.members.forEach((m: any) => {
          const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
          if (id && !memberIds.includes(String(id))) {
            memberIds.push(String(id));
          }
        });
      }

      setFormData({
        company_name: location.company_name || '',
        tax_id: location.tax_id || '',
        phone: location.phone || '',
        email: location.email || '',
        address: location.address || '',
        branch: location.branch || '',
        contact_name: location.contact_name || '',
        contact_phone: location.contact_phone || '',
        member_id: primaryMemberId || '',
        member_ids: memberIds
      });
    } else {
      setEditingLocation(null);
      setOriginalMembers([]);
      setFormData({
        company_name: '',
        tax_id: '',
        phone: '',
        email: '',
        address: '',
        branch: '',
        contact_name: '',
        contact_phone: '',
        member_id: '',
        member_ids: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const payload: any = {
        ...formData,
        member_id: formData.member_ids[0] && formData.member_ids[0] !== '' ? formData.member_ids[0] : null, // Primary member for backward compatibility
      };

      // For Directus M2M updates, we need to handle existing relations
      // To simplify and ensure it works, we'll send the members as a list of junction objects
      // Note: In Directus, to replace the set, you might need to provide the IDs of existing junction records to delete them,
      // but if the relationship is configured to "Auto-save", sending the new list might work.
      // However, a more robust way for Directus M2M is often to handle the junction table directly or use the specific nested syntax.
      
      const validMemberIds = formData.member_ids.filter(id => id && id !== '');
      
      if (editingLocation) {
        // For Directus M2M updates, we use the nested syntax to sync the relationship
        const currentJunctions = originalMembers || [];
        
        // Identify junction records to delete
        const toDelete = currentJunctions
          .filter(j => {
            const userId = typeof j.line_user_id === 'object' ? j.line_user_id?.id : j.line_user_id;
            return userId && !validMemberIds.includes(String(userId));
          })
          .map(j => j.id)
          .filter(Boolean);
        
        // Identify new members to add
        const toCreate = validMemberIds
          .filter(userId => !currentJunctions.some(j => {
            const existingUserId = typeof j.line_user_id === 'object' ? j.line_user_id?.id : j.line_user_id;
            return existingUserId && String(existingUserId) === String(userId);
          }))
          .map(userId => ({ line_user_id: userId }));

        // Use the nested action syntax for Directus
        // Only send if there are changes to avoid potential issues with empty arrays
        if (toCreate.length > 0 || toDelete.length > 0) {
          payload.members = {
            create: toCreate,
            delete: toDelete
          };
        } else {
          delete payload.members;
        }
      } else {
        // For new records, just send the list of junction objects
        payload.members = validMemberIds.map(id => ({
          line_user_id: id
        }));
      }

      // Remove member_ids from payload as it's UI only
      delete payload.member_ids;

      if (editingLocation) {
        await directusApi.updateCustomerLocation(editingLocation.id, payload);
      } else {
        await directusApi.createCustomerLocation(payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving location:', err);
      setActionError(err.message || 'Failed to save location');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setActionError(null);
      await directusApi.deleteCustomerLocation(deleteId);
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting location:', err);
      setActionError(err.message || t('error_deleting'));
      setDeleteId(null);
    }
  };

  const filteredLocations = locations.filter(l => {
    const company = (l.company_name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return company.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('customer_locations')}</h2>
          <p className="text-slate-500">{t('manage_customer_locations')}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5" />
          {t('add_customer_location')}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder={t('search_customers')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="text-sm text-slate-500">
            {t('total_members')}: {filteredLocations.length}
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-50 border-b border-red-100 text-red-600 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
            <button onClick={fetchData} className="text-xs font-bold underline">{t('try_again')}</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500">{t('loading')}</p>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              {t('no_data')}
            </div>
          ) : (
            filteredLocations.map((loc) => (
              <div key={loc.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-blue-200 transition-colors">
                    <Building2 className="w-6 h-6 text-slate-400 group-hover:text-primary" />
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleOpenModal(loc)}
                      className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteId(loc.id)}
                      className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{loc.company_name}</h3>
                  <div className="mt-2 space-y-2">
                    {loc.tax_id && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs text-slate-500">{t('tax_id')}: {loc.tax_id}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {loc.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-xs text-slate-500">{loc.phone}</p>
                        </div>
                      )}
                      {loc.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-xs text-slate-500">{loc.email}</p>
                        </div>
                      )}
                    </div>
                    {loc.branch && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs text-slate-500">{t('branch')}: {loc.branch}</p>
                      </div>
                    )}
                    {(() => {
                      const memberIds: string[] = [];
                      const primaryId = typeof loc.member_id === 'object' ? loc.member_id?.id : loc.member_id;
                      if (primaryId) memberIds.push(String(primaryId));
                      
                      if (loc.members && Array.isArray(loc.members)) {
                        loc.members.forEach((m: any) => {
                          const id = typeof m.line_user_id === 'object' ? m.line_user_id?.id : m.line_user_id;
                          if (id && !memberIds.includes(String(id))) {
                            memberIds.push(String(id));
                          }
                        });
                      }

                      if (memberIds.length === 0) return null;

                      return (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-xs text-slate-500">
                            {t('customer_role')}: {(() => {
                              const selectedMembers = members.filter(m => memberIds.includes(m.id));
                              return selectedMembers.map(m => m.display_name || `${m.first_name} ${m.last_name}`).join(', ');
                            })()}
                          </p>
                        </div>
                      );
                    })()}
                    {(loc.contact_name || loc.contact_phone) && (
                      <div className="flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <div className="flex flex-col">
                          <p className="text-[10px] font-bold text-primary uppercase leading-none mb-1">{t('contact_person') || 'Contact Person'}</p>
                          <p className="text-xs text-slate-700 font-medium">{loc.contact_name || '-'} {loc.contact_phone ? `(${loc.contact_phone})` : ''}</p>
                        </div>
                      </div>
                    )}
                    {loc.address && (
                      <div className="flex items-start gap-2">
                        <Map className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <p className="text-xs text-slate-500 line-clamp-2">{loc.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!deleteId}
        title={t('confirm_delete')}
        message={t('confirm_delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={t('delete')}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {editingLocation ? t('edit_customer_location') : t('add_customer_location')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('company_name')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g. ABC Logistics"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('tax_id')}</label>
                  <input 
                    type="text" 
                    value={formData.tax_id}
                    onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Tax ID"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('phone')}</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Phone Number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('email')}</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Email Address"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('branch')}</label>
                  <input 
                    type="text" 
                    value={formData.branch}
                    onChange={(e) => setFormData({...formData, branch: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Office/Branch"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('contact_name')}</label>
                  <input 
                    type="text" 
                    value={formData.contact_name}
                    onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('contact_name')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">{t('contact_phone')}</label>
                  <input 
                    type="text" 
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('contact_phone')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('address')}</label>
                <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                  placeholder="Full Address"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('customer_role')}</label>
                <Select
                  isMulti
                  options={members
                    .filter(m => m.role === 'customer' || formData.member_ids.includes(m.id))
                    .map(m => ({
                      value: m.id,
                      label: `${m.display_name || `${m.first_name} ${m.last_name}`} (${m.email})`
                    }))
                  }
                  value={members
                    .filter(m => formData.member_ids.includes(m.id))
                    .map(m => ({
                      value: m.id,
                      label: `${m.display_name || `${m.first_name} ${m.last_name}`} (${m.email})`
                    }))
                  }
                  onChange={(selectedOptions) => {
                    const selectedIds = selectedOptions ? (selectedOptions as any[]).map(o => o.value) : [];
                    
                    // Update contact info from the first selected member if it was empty or if it's the first one
                    let newContactName = formData.contact_name;
                    let newContactPhone = formData.contact_phone;
                    
                    if (selectedIds.length > 0 && (!formData.contact_name || formData.member_ids.length === 0)) {
                      const firstMember = members.find(m => m.id === selectedIds[0]);
                      if (firstMember) {
                        newContactName = firstMember.display_name || `${firstMember.first_name} ${firstMember.last_name}`;
                        newContactPhone = firstMember.phone || '';
                      }
                    }

                    setFormData({
                      ...formData,
                      member_ids: selectedIds,
                      contact_name: newContactName,
                      contact_phone: newContactPhone
                    });
                  }}
                  placeholder={`-- ${t('select_role')} --`}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                      padding: '2px',
                      backgroundColor: '#f8fafc',
                      borderColor: '#e2e8f0',
                      '&:hover': {
                        borderColor: '#cbd5e1'
                      }
                    }),
                    menu: (base) => ({
                      ...base,
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      zIndex: 100
                    })
                  }}
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
