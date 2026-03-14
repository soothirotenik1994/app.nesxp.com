import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { directusApi } from '../api/directus';
import { Member } from '../types';
import { Loader2, User, Phone, Mail, Save, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { lineUserId } = useParams<{ lineUserId: string }>();
  const { t } = useTranslation();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    const fetchMember = async () => {
      if (!lineUserId) return;
      try {
        // In a real LIFF app, we would search by line_user_id
        // For this demo, we'll assume the ID passed is the Directus ID or we fetch all and filter
        const members = await directusApi.getMembers();
        const found = members.find(m => m.line_user_id === lineUserId || m.id === lineUserId);
        
        if (found) {
          setMember(found);
          setFormData({
            first_name: found.first_name || '',
            last_name: found.last_name || '',
            phone: found.phone || '',
            email: found.email || ''
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMember();
  }, [lineUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    
    setSubmitting(true);
    setSuccess(false);
    try {
      await directusApi.updateMember(member.id, formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Member Not Found</h2>
          <p className="text-slate-500">We couldn't find your profile in our system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-primary p-8 text-center relative">
            <div className="absolute top-4 right-4">
              {success && (
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-bounce">
                  <CheckCircle2 className="w-3 h-3" />
                  Saved
                </div>
              )}
            </div>
            {member.picture_url ? (
              <img 
                src={member.picture_url} 
                alt={member.display_name} 
                className="w-24 h-24 rounded-full border-4 border-white mx-auto shadow-lg object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto border-4 border-white/30 text-white text-3xl font-bold">
                {String(member.display_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="text-white text-xl font-bold mt-4">{member.display_name}</h2>
            <p className="text-white/70 text-sm">LINE ID: {member.line_user_id.substring(0, 10)}...</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  {t('first_name')}
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="John"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  {t('last_name')}
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                {t('email')}
              </label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                {t('phone')}
              </label>
              <input 
                type="tel" 
                required
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="081-234-5678"
              />
            </div>

            <button 
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
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
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-8">
          Nationwide Express Service Tracking System
        </p>
      </div>
    </div>
  );
};

export default Profile;
