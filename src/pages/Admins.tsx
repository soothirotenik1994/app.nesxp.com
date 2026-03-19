import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  UserPlus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Shield,
  AlertCircle,
  X,
  Check,
  Settings2
} from 'lucide-react';
import { directusApi } from '../api/directus';
import { AdminUser, Member } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { clsx } from 'clsx';

export const Admins: React.FC = () => {
  const { t } = useTranslation();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('admins_columns');
    return saved ? JSON.parse(saved) : ['name', 'email', 'role', 'status', 'line_uid'];
  });

  const columns = [
    { id: 'name', label: t('name') },
    { id: 'email', label: t('email') },
    { id: 'role', label: t('role') },
    { id: 'status', label: t('status') },
    { id: 'line_uid', label: t('line_uid') },
  ];

  const toggleColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    
    // Don't allow hiding all columns
    if (newVisibleColumns.length === 0) return;
    
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('admins_columns', JSON.stringify(newVisibleColumns));
  };

  const resetColumns = () => {
    const defaultColumns = ['name', 'email', 'role', 'status', 'line_uid'];
    setVisibleColumns(defaultColumns);
    localStorage.setItem('admins_columns', JSON.stringify(defaultColumns));
  };
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    line_user_id: '',
    password: '',
    status: 'active',
    role: ''
  });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const [adminsData, rolesData, membersData] = await Promise.all([
        directusApi.getAdmins(),
        directusApi.getRoles(),
        directusApi.getMembers()
      ]);
      setAdmins(adminsData);
      setRoles(rolesData);
      setMembers(membersData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
      // Only set error if it's not a 401 (which is handled by the interceptor)
      if (err.response?.status !== 401 && err.message?.indexOf('401') === -1) {
        setError(t('error_fetching_data'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleOpenModal = (admin?: AdminUser) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({
        first_name: admin.first_name || '',
        last_name: admin.last_name || '',
        email: admin.email || '',
        phone: admin.phone || '',
        line_user_id: admin.line_user_id || '',
        password: '', // Don't show password
        status: admin.status || 'active',
        role: typeof admin.role === 'object' ? admin.role?.id : admin.role || ''
      });
    } else {
      setEditingAdmin(null);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        line_user_id: '',
        password: '',
        status: 'active',
        role: roles.find(r => r.name === 'Administrator')?.id || ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      if (editingAdmin) {
        // Update
        const updateData: any = { ...formData };
        if (!updateData.password) delete updateData.password;
        
        // Fix uniqueness error: only send email if it changed
        if (updateData.email === editingAdmin.email) {
          delete updateData.email;
        }
        
        await directusApi.updateAdmin(editingAdmin.id, updateData);
      } else {
        // Create
        await directusApi.createAdmin(formData);
      }
      setIsModalOpen(false);
      fetchAdmins();
    } catch (err: any) {
      console.error(err);
      const errorData = err.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || err.message || t('error_saving');
      setActionError(errorMsg);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setActionError(null);
      await directusApi.deleteAdmin(deleteId);
      setDeleteId(null);
      fetchAdmins();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || t('error_deleting'));
      setDeleteId(null);
    }
  };

  const filteredAdmins = admins.filter(admin => {
    const firstName = (admin.first_name || '').toLowerCase();
    const lastName = (admin.last_name || '').toLowerCase();
    const email = (admin.email || '').toLowerCase();
    const search = searchQuery.toLowerCase();
    
    return firstName.includes(search) || lastName.includes(search) || email.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admins')}</h1>
          <p className="text-slate-500 text-sm">{t('manage_admins')}</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-200"
        >
          <UserPlus className="w-5 h-5" />
          {t('add_admin')}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('search_placeholder')}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className={clsx(
                "p-2 rounded-lg border transition-all flex items-center gap-2 text-sm font-medium",
                showColumnSettings 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
              title={t('display_settings') || 'แสดงผล'}
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('display_settings') || 'แสดงผล'}</span>
            </button>

            {showColumnSettings && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowColumnSettings(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-in fade-in zoom-in duration-100 origin-top-right">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('display_columns') || 'เลือกข้อมูลที่ต้องการแสดง'}</span>
                    <button 
                      onClick={resetColumns}
                      className="text-[10px] font-bold text-emerald-600 hover:underline"
                    >
                      {t('reset_columns') || 'รีเซ็ต'}
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto py-1">
                    {columns.map(col => (
                      <button
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                      >
                        <span className={clsx(
                          "text-sm transition-colors",
                          visibleColumns.includes(col.id) ? "text-slate-900 font-medium" : "text-slate-400"
                        )}>
                          {col.label}
                        </span>
                        {visibleColumns.includes(col.id) && (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                {visibleColumns.includes('name') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('name')}</th>}
                {visibleColumns.includes('email') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('email')}</th>}
                {visibleColumns.includes('role') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('role')}</th>}
                {visibleColumns.includes('status') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>}
                {visibleColumns.includes('line_uid') && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('line_uid')}</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                      <p className="text-slate-500 text-sm font-medium">{t('loading')}</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                      <p className="text-slate-900 font-bold">{error}</p>
                      <button 
                        onClick={fetchAdmins}
                        className="text-emerald-600 font-bold text-sm hover:underline"
                      >
                        {t('try_again')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-6 py-12 text-center">
                    <p className="text-slate-500 font-medium">{t('no_data')}</p>
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors group">
                    {visibleColumns.includes('name') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                            {String(admin.first_name || '').charAt(0).toUpperCase()}
                            {String(admin.last_name || '').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{admin.first_name} {admin.last_name}</p>
                            <p className="text-xs text-slate-500">ID: {admin.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('email') && (
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{admin.email}</p>
                      </td>
                    )}
                    {visibleColumns.includes('role') && (
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          {typeof admin.role === 'object' ? admin.role?.name : t('not_specified')}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize",
                          admin.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}>
                          <div className={clsx(
                            "w-1.5 h-1.5 rounded-full",
                            admin.status === 'active' ? "bg-emerald-500" : "bg-slate-400"
                          )} />
                          {admin.status === 'active' ? t('active') : t('inactive')}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('line_uid') && (
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono text-slate-500 break-all max-w-[150px]">
                          {admin.line_user_id || '-'}
                        </p>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(admin)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteId(admin.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal */}
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
        message={t('confirm_delete_message') || t('confirm_delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={t('delete')}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingAdmin ? t('edit_admin') : t('add_admin')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingAdmin && (
                <div className="space-y-1.5 pb-2 border-b border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('select_from_members')}</label>
                  <select 
                    className="w-full bg-emerald-50 border-emerald-100 text-emerald-900 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      
                      const member = members.find(m => String(m.id) === String(selectedId));
                      if (member) {
                        const memberRole = member.role || '';
                        const matchingRole = roles.find(r => 
                          r.name.toLowerCase() === memberRole.toLowerCase() ||
                          r.name.toLowerCase().includes(memberRole.toLowerCase())
                        );

                        setFormData(prev => {
                          const newData = {
                            ...prev,
                            first_name: member.first_name || '',
                            last_name: member.last_name || '',
                            email: member.email || '',
                            phone: member.phone || '',
                            line_user_id: member.line_user_id || '',
                            password: member.password || '',
                            role: matchingRole ? matchingRole.id : prev.role,
                          };
                          console.log('Updating form data with member:', member.first_name, member.last_name);
                          return newData;
                        });
                      }
                    }}
                    value=""
                  >
                    <option value="">{t('select_member')}</option>
                    {members.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('first_name')}</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('last_name')}</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('email')}</label>
                <input 
                  type="email" 
                  required
                  className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('phone')}</label>
                <input 
                  type="tel" 
                  className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('password')}</label>
                <input 
                  type="password" 
                  required={!editingAdmin}
                  placeholder={editingAdmin ? t('leave_blank') : ""}
                  className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('role')}</label>
                <select 
                  className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="" disabled>{t('select_role')}</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</label>
                <select 
                  className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('line_uid')}</label>
                <div className="w-full bg-slate-100 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 font-mono break-all">
                  {formData.line_user_id || t('not_linked')}
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-200"
                >
                  {editingAdmin ? t('save') : t('add_admin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
