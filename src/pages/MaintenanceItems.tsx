import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2, Save, X, Wrench, Edit2, Check, Search, Info, Calendar, Gauge, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { directusApi } from '../api/directus';
import { cn } from '../lib/utils';

export const MaintenanceItems: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    default_mileage_interval: '',
    default_month_interval: '',
    status: 'active'
  });
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await directusApi.getMaintenanceItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch maintenance items:', err);
      setError(t('failed_to_load_data'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    setIsAdding(true);
    try {
      await directusApi.createMaintenanceItem({
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        default_mileage_interval: newItem.default_mileage_interval ? Number(newItem.default_mileage_interval) : undefined,
        default_month_interval: newItem.default_month_interval ? Number(newItem.default_month_interval) : undefined,
        status: newItem.status
      });
      setNewItem({
        name: '',
        description: '',
        default_mileage_interval: '',
        default_month_interval: '',
        status: 'active'
      });
      setShowAddForm(false);
      await fetchItems();
    } catch (err) {
      console.error('Failed to add maintenance item:', err);
      setError(t('failed_to_save'));
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateItem = async (id: string | number) => {
    if (!editingData.name.trim()) return;

    setIsUpdating(true);
    try {
      await directusApi.updateMaintenanceItem(id, {
        name: editingData.name.trim(),
        description: editingData.description.trim(),
        default_mileage_interval: editingData.default_mileage_interval ? Number(editingData.default_mileage_interval) : null,
        default_month_interval: editingData.default_month_interval ? Number(editingData.default_month_interval) : null,
        status: editingData.status
      });
      setEditingId(null);
      setEditingData(null);
      await fetchItems();
    } catch (err) {
      console.error('Failed to update maintenance item:', err);
      setError(t('failed_to_save'));
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleStatus = async (item: any) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await directusApi.updateMaintenanceItem(item.id, { status: newStatus });
      await fetchItems();
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError(t('failed_to_save'));
    }
  };

  const handleDeleteItem = async (id: string | number) => {
    setIsDeleting(true);
    try {
      await directusApi.deleteMaintenanceItem(id);
      setDeletingId(null);
      await fetchItems();
    } catch (err) {
      console.error('Failed to delete maintenance item:', err);
      setError(t('failed_to_delete'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-8 h-8 text-primary" />
            {t('manage_maintenance_types')}
          </h1>
          <p className="text-gray-500">{t('manage_maintenance_types_desc')}</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-sm"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? t('cancel') : t('add_item')}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {showAddForm && (
        <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">{t('history_service_type')}</label>
                <input
                  type="text"
                  placeholder={t('enter_maintenance_type_name')}
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">{t('maintenance_description')}</label>
                <input
                  type="text"
                  placeholder={t('maintenance_description_placeholder')}
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">{t('default_mileage_interval')}</label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    placeholder="10000"
                    value={newItem.default_mileage_interval}
                    onChange={(e) => setNewItem({ ...newItem, default_mileage_interval: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">{t('default_month_interval')}</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    placeholder="6"
                    value={newItem.default_month_interval}
                    onChange={(e) => setNewItem({ ...newItem, default_month_interval: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAdding || !newItem.name.trim()}
                className="px-8 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('add')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('search_maintenance_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>{t('loading')}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Wrench className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{t('no_items_found')}</p>
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <div key={item.id} className={cn(
                "p-4 hover:bg-gray-50 transition-colors group",
                item.status === 'inactive' && "bg-gray-50/50"
              )}>
                {editingId === item.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={editingData.name}
                        onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                        className="px-3 py-2 bg-white border border-primary rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editingData.description}
                        onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        placeholder={t('maintenance_description')}
                      />
                      <input
                        type="number"
                        value={editingData.default_mileage_interval}
                        onChange={(e) => setEditingData({ ...editingData, default_mileage_interval: e.target.value })}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        placeholder={t('default_mileage_interval')}
                      />
                      <input
                        type="number"
                        value={editingData.default_month_interval}
                        onChange={(e) => setEditingData({ ...editingData, default_month_interval: e.target.value })}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        placeholder={t('default_month_interval')}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleUpdateItem(item.id)}
                        disabled={isUpdating || !editingData.name.trim()}
                        className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingData(null);
                        }}
                        className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-all"
                      >
                        <X className="w-4 h-4" />
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-gray-400 font-mono text-sm mt-1">{index + 1}.</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-gray-900",
                            item.status === 'inactive' && "text-gray-400 line-through"
                          )}>
                            {item.name}
                          </span>
                          {item.status === 'inactive' && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-md uppercase">
                              {t('status_inactive')}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            {item.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2">
                          {item.default_mileage_interval && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                              <Gauge className="w-3 h-3" />
                              {item.default_mileage_interval.toLocaleString()} {t('km')}
                            </div>
                          )}
                          {item.default_month_interval && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                              <Calendar className="w-3 h-3" />
                              {item.default_month_interval} {t('month')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleStatus(item)}
                        title={item.status === 'active' ? t('status_inactive') : t('status_active')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          item.status === 'active' ? "text-emerald-500 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-100"
                        )}
                      >
                        {item.status === 'active' ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingData({
                            name: item.name,
                            description: item.description || '',
                            default_mileage_interval: item.default_mileage_interval || '',
                            default_month_interval: item.default_month_interval || '',
                            status: item.status
                          });
                        }}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title={t('edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(item.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {deletingId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('confirm_delete')}</h3>
              <p className="text-gray-500 mb-6">
                {t('confirm_delete_message')}
                <br />
                <span className="font-bold text-gray-700">
                  "{items.find(i => i.id === deletingId)?.name}"
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleDeleteItem(deletingId)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-200"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
