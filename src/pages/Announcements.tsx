import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Bell, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  Target,
  Image as ImageIcon,
  Upload,
  Loader2
} from 'lucide-react';
import { directusApi, api } from '../api/directus';
import { format } from 'date-fns';
import { clsx } from 'clsx';

export const Announcements: React.FC = () => {
  const { t } = useTranslation();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewingItem, setViewingItem] = useState<any>(null);

  const userRole = localStorage.getItem('user_role') || 'Customer';
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_roles: [] as string[],
    status: 'published',
    image: null as string | null
  });

  const [uploading, setUploading] = useState(false);

  const availableRoles = ['Administrator', 'Admin', 'Driver', 'Customer', 'General'];

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await directusApi.getItems('announcements', {
        sort: '-date_created',
        limit: -1
      });
      
      // Filter for regular users
      if (!isAdmin) {
        const filtered = data.filter((item: any) => {
          if (item.status !== 'published') return false;
          
          let targets: string[] = [];
          if (typeof item.target_roles === 'string') {
            targets = item.target_roles.split(',').map((r: string) => r.trim());
          } else if (Array.isArray(item.target_roles)) {
            targets = item.target_roles;
          }
          
          return targets.length === 0 || targets.some(r => r.toLowerCase() === userRole.toLowerCase());
        });
        setAnnouncements(filtered);
      } else {
        setAnnouncements(data);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      // setError(t('failed_fetch_announcements'));
      // Don't set error if collection doesn't exist yet, just show empty
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await directusApi.updateItem('announcements', editingItem.id, formData);
      } else {
        await directusApi.createItem('announcements', formData);
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to save announcement:', err);
      setError(t('failed_save_announcement'));
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm(t('confirm_delete_announcement', 'คุณแน่ใจหรือไม่ว่าต้องการลบประกาศนี้?'))) return;
    try {
      await api.delete(`/items/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  const filteredAnnouncements = announcements.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      content: item.content || '',
      target_roles: Array.isArray(item.target_roles) ? item.target_roles : (item.target_roles?.split(',') || []),
      status: item.status || 'published',
      image: item.image || null
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      content: '',
      target_roles: [],
      status: 'published',
      image: null
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileId = await directusApi.uploadFile(file);
      setFormData(prev => ({ ...prev, image: fileId }));
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleRole = (role: string) => {
    setFormData(prev => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles, role]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          {t('company_announcements', 'ประกาศบริษัท')}
        </h1>

        {isAdmin && (
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            {t('create_announcement', 'สร้างประกาศ')}
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder={t('search_announcements', 'ค้นหาประกาศ...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">{t('loading')}</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">{t('no_announcements', 'ไม่พบประกาศในขณะนี้')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAnnouncements.map((item) => (
            <div 
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group flex flex-col"
            >
              {item.image && (
                <div className="aspect-video w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                  <img 
                    src={directusApi.getFileUrl(item.image)} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2 rounded-xl bg-primary/10 text-primary`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2">{item.title}</h3>
                <div className="text-slate-600 text-sm line-clamp-3 mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: item.content }} />
                
                {item.status === 'draft' && (
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">
                      {t('draft')}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(item.date_created), 'dd MMM yyyy')}
                </div>
                <button 
                  onClick={() => {
                    setViewingItem(item);
                    setIsViewModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {t('read_more', 'อ่านต่อ')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingItem ? t('edit_announcement', 'แก้ไขประกาศ') : t('create_announcement', 'สร้างประกาศ')}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_title', 'หัวข้อประกาศ')}</label>
                  <input 
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_content', 'เนื้อหา')}</label>
                  <textarea 
                    required
                    rows={6}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('announcement_image', 'รูปภาพประกอบ')}</label>
                  <div className="space-y-4">
                    {formData.image ? (
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 group">
                        <img 
                          src={directusApi.getFileUrl(formData.image)} 
                          className="w-full h-full object-cover"
                          alt="Preview"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: null }))}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-video w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 hover:border-primary/50 transition-all">
                        {uploading ? (
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-300 mb-2" />
                            <span className="text-sm font-bold text-slate-500">{t('upload_image', 'อัปโหลดรูปภาพ')}</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    {t('target_audience', 'กลุ่มเป้าหมาย')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={clsx(
                          "px-4 py-2 rounded-xl text-sm font-semibold transition-all border",
                          formData.target_roles.includes(role)
                            ? "bg-primary border-primary text-white"
                            : "bg-white border-slate-200 text-slate-500 hover:border-primary/50"
                        )}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">* {t('target_audience_hint', 'หากไม่เลือกกลุ่มใดเลย ประกาศจะแสดงให้ทุกกลุ่มเห็น')}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('status')}</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'published' })}
                      className={clsx(
                        "flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2",
                        formData.status === 'published' ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-slate-200 text-slate-400"
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t('published', 'เผยแพร่')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'draft' })}
                      className={clsx(
                        "flex-1 px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2",
                        formData.status === 'draft' ? "bg-amber-50 border-amber-500 text-amber-700" : "bg-white border-slate-200 text-slate-400"
                      )}
                    >
                      <AlertCircle className="w-4 h-4" />
                      {t('draft', 'ร่าง')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  {editingItem ? t('update') : t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && viewingItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
          <div className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 line-clamp-1">{viewingItem.title}</h2>
                  <p className="text-xs text-slate-400 font-medium">{format(new Date(viewingItem.date_created), 'PPPP')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {viewingItem.image && (
                <div className="aspect-video w-full bg-slate-100">
                  <img 
                    src={directusApi.getFileUrl(viewingItem.image)} 
                    alt={viewingItem.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="p-8">
                <div 
                  className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-lg" 
                  dangerouslySetInnerHTML={{ __html: viewingItem.content.replace(/\n/g, '<br />') }} 
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
