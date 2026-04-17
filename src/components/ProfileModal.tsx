import React, { useState, useEffect } from 'react';
import { directusApi } from '../api/directus';
import { Member } from '../types';
import { Loader2, User, Phone, Mail, Save, CheckCircle2, Camera, X, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineUserId: string;
  onUpdate?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, lineUserId, onUpdate }) => {
  const { t } = useTranslation();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    picture_url: '',
    password: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchMember = async () => {
      if (!lineUserId || !isOpen) return;
      setLoading(true);
      setImgError(false);
      console.log('Fetching member for lineUserId:', lineUserId);
      try {
        const isAdmin = localStorage.getItem('is_admin') === 'true';
        console.log('Is Admin:', isAdmin);
        
        if (isAdmin) {
          const user = await directusApi.getCurrentUser();
          console.log('Admin user fetched:', user);
          const adminMember: Member = {
            id: user.id,
            line_user_id: user.id,
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            phone: '', 
            display_name: `${user.first_name} ${user.last_name}`,
            picture_url: user.avatar || '',
            created_at: ''
          };
          setMember(adminMember);
          setFormData({
            first_name: adminMember.first_name,
            last_name: adminMember.last_name,
            phone: adminMember.phone,
            email: adminMember.email,
            picture_url: adminMember.picture_url || '',
            password: ''
          });
        } else {
          const members = await directusApi.getMembers();
          console.log('All members fetched:', members);
          const found = members.find(m => m.line_user_id === lineUserId || m.id === lineUserId);
          console.log('Member found:', found);
          
          if (found) {
            setMember(found);
            setFormData({
              first_name: found.first_name || '',
              last_name: found.last_name || '',
              phone: found.phone || '',
              email: found.email || '',
              picture_url: found.picture_url || '',
              password: ''
            });
          }
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          return;
        }
        console.error('Error fetching profile:', err);
        setError('Error fetching profile: ' + err);
      } finally {
        setLoading(false);
      }
    };

    fetchMember();
  }, [lineUserId, isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;

    try {
      setSubmitting(true);
      setError(null);
      const fileId = await directusApi.uploadFile(file);
      setFormData(prev => ({ ...prev, picture_url: fileId }));
      
      const isAdmin = localStorage.getItem('is_admin') === 'true';
      if (isAdmin) {
        await directusApi.updateAdmin(member.id, { avatar: fileId });
      } else {
        await directusApi.updateMember(member.id, { picture_url: fileId });
      }
      
      setMember(prev => prev ? { ...prev, picture_url: fileId } : null);
      localStorage.setItem('user_picture', directusApi.getFileUrl(fileId));
      if (onUpdate) onUpdate();
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message;
      setError(`Upload failed: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    
    setSubmitting(true);
    setSuccess(false);
    setError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      return;
    }

    try {
      const isAdmin = localStorage.getItem('is_admin') === 'true';
      const updateData: any = { ...formData };
      if (newPassword) {
        updateData.password = newPassword;
      } else {
        delete updateData.password;
      }

      if (isAdmin) {
        const adminUpdateData: any = {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email
        };
        if (newPassword) {
          adminUpdateData.password = newPassword;
        }
        await directusApi.updateAdmin(member.id, adminUpdateData);
      } else {
        await directusApi.updateMember(member.id, updateData);
      }
      
      localStorage.setItem('user_name', `${formData.first_name} ${formData.last_name}`);
      localStorage.setItem('user_email', formData.email);
      if (!isAdmin) {
        localStorage.setItem('user_phone', formData.phone);
      }
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onUpdate) onUpdate();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      const errorMsg = err.response?.data?.errors?.[0]?.message || err.message;
      setError(`Update failed: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-md relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="h-[500px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : !member ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Member Not Found</h2>
            <p className="text-slate-500 mb-6">{error || "We couldn't find your profile in our system."}</p>
            <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Close</button>
          </div>
        ) : (
          <>
            <div className="bg-primary p-8 text-center relative">
              <div className="absolute top-4 left-4">
                {success && (
                  <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-bounce">
                    <CheckCircle2 className="w-3 h-3" />
                    Saved
                  </div>
                )}
              </div>
              <div className="relative inline-block">
                {member.picture_url && !imgError ? (
                  <img 
                    src={directusApi.getFileUrl(member.picture_url)} 
                    alt={member.display_name} 
                    className="w-24 h-24 rounded-full border-4 border-white mx-auto shadow-lg object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto border-4 border-white/30 text-white text-3xl font-bold">
                    {String(member.display_name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-white transition-colors border border-slate-100">
                  <Camera className="w-4 h-4 text-primary" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={submitting}
                  />
                </label>
              </div>
              <h2 className="text-white text-xl font-bold mt-4">{member.display_name}</h2>
              <p className="text-white/70 text-sm">LINE ID: {member.line_user_id.substring(0, 10)}...</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-3 h-3 text-slate-400" />
                    {t('first_name')}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t('last_name')}
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {t('email')}
                </label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {t('phone')}
                </label>
                <input 
                  type="tel" 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">{t('change_password')}</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {t('new_password')}
                    </label>
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('leave_blank')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {t('confirm_password')}
                    </label>
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('leave_blank')}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs font-bold text-primary hover:text-blue-800 transition-colors"
                  >
                    {showPassword ? t('hide_password') : t('show_password')}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {t('save')}
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
