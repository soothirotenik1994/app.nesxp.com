import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, Lock, Mail, Loader2, UserCog, User, MessageCircle } from 'lucide-react';
import { directusApi, setAuthToken } from '../api/directus';
import clsx from 'clsx';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Clear old tokens to avoid interceptor issues with invalid/expired tokens
    localStorage.removeItem('admin_token');
    setAuthToken(null);

    try {
      // 1. Try Admin Login first
      try {
        console.log('Attempting admin login...');
        const data = await directusApi.login(email, password);
        localStorage.setItem('admin_token', data.access_token);
        setAuthToken(data.access_token);
        
        // Fetch user info to get role
        const user = await directusApi.getCurrentUser();
        const role = user.role?.name || 'Driver';
        const isAdmin = role.toLowerCase() === 'administrator' || role.toLowerCase() === 'admin';
        localStorage.setItem('user_role', role);
        localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
        localStorage.setItem('user_name', `${user.first_name} ${user.last_name}`);
        localStorage.setItem('user_email', user.email);
        
        navigate(isAdmin ? '/' : '/jobs/my');
        return; // Success
      } catch (adminErr: any) {
        console.log('Admin login failed or not an admin, trying staff login...');
        // If it's a real error (not just 401), we might want to know
        if (adminErr.response?.status && adminErr.response.status !== 401) {
          console.warn('Admin API error:', adminErr.response.data);
        }
      }

      // 2. Try Staff Login (Member) if admin login failed
      console.log('Attempting staff login...');
      const member = await directusApi.loginStaff(email, password);
      
      if (member) {
        console.log('Staff login successful:', member.email);
        localStorage.setItem('user_role', 'Driver');
        localStorage.setItem('user_name', `${member.first_name} ${member.last_name}`);
        localStorage.setItem('user_email', member.email);
        localStorage.setItem('member_id', member.id);
        navigate('/jobs/my');
      } else {
        console.log('No staff member found with these credentials');
        setError(t('login_error'));
      }
    } catch (err: any) {
      console.error('Login process error:', err);
      
      // Check for specific Directus errors
      const directusErrors = err.response?.data?.errors;
      if (directusErrors && directusErrors.length > 0) {
        const msg = directusErrors[0].message;
        if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
          setError('Permission Error: Please enable "Public" Read access for "line_users" in Directus Settings.');
        } else {
          setError(`${t('login_error')} (${msg})`);
        }
      } else if (err.message === 'Network Error') {
        setError('Network Error: Cannot connect to database server.');
      } else {
        setError(t('login_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl mb-4 shadow-xl shadow-slate-200 p-2 overflow-hidden">
            <img 
              src="https://img2.pic.in.th/4863801.jpg" 
              alt="NES Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('login_title')}</h1>
          <p className="text-slate-500 mt-2">{t('login_subtitle')}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="p-8">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('password')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('sign_in')
                )}
              </button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">{t('or_continue_with')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const channelId = import.meta.env.VITE_LINE_CHANNEL_ID;
                  const redirectUri = encodeURIComponent(import.meta.env.VITE_LINE_REDIRECT_URI);
                  const state = Math.random().toString(36).substring(7);
                  const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid%20email`;
                  window.location.href = url;
                }}
                className="w-full bg-[#06C755] text-white py-3 rounded-xl font-semibold hover:bg-[#05b34c] transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5 fill-white" />
                {t('login_with_line')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
