import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';
import { CustomerLocation } from '../types';
import { Search, Plus, MapPin, Edit2, Trash2, X, Loader2, AlertCircle, Building2, User, Phone, Mail, FileText, Map } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const CustomerLocations: React.FC = () => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CustomerLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    tax_id: '',
    phone: '',
    email: '',
    address: '',
    branch: ''
  });

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await directusApi.getCustomerLocations();
      setLocations(data);
    } catch (err: any) {
      console.error('Error fetching locations:', err);
      if (err.response?.status !== 401) {
        setError(err.message || 'Failed to load customer locations');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleOpenModal = (location?: CustomerLocation) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        company_name: location.company_name || '',
        tax_id: location.tax_id || '',
        phone: location.phone || '',
        email: location.email || '',
        address: location.address || '',
        branch: location.branch || ''
      });
    } else {
      setEditingLocation(null);
      setFormData({
        company_name: '',
        tax_id: '',
        phone: '',
        email: '',
        address: '',
        branch: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      if (editingLocation) {
        await directusApi.updateCustomerLocation(editingLocation.id, formData);
      } else {
        await directusApi.createCustomerLocation(formData);
      }
      setIsModalOpen(false);
      fetchLocations();
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
      fetchLocations();
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
            <button onClick={fetchLocations} className="text-xs font-bold underline">{t('try_again')}</button>
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

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('address')}</label>
                <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                  placeholder="Full Address"
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
