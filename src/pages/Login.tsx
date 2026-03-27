import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, Loader2, MessageCircle, ArrowRight, ShieldCheck, Languages } from 'lucide-react';
import axios from 'axios';
import { directusApi, setAuthToken } from '../api/directus';
import { motion } from 'motion/react';
import clsx from 'clsx';

export const Login: React.FC = () => {
  const { t, i18n } = useTranslation();
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
    directusApi.logout();

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
        localStorage.setItem('member_id', user.id);
        if (user.avatar) {
          localStorage.setItem('user_picture', directusApi.getFileUrl(user.avatar));
        }
        
        navigate('/');
        return; // Success
      } catch (adminErr: any) {
        console.log('Admin login failed or not an admin, trying staff login...');
        if (adminErr.response?.status && adminErr.response.status !== 401) {
          console.warn('Admin API error:', adminErr.response.data);
        }
      }

      // 2. Try Staff Login (Member) if admin login failed
      console.log('Attempting staff login...');
      const member = await directusApi.loginStaff(email, password);
      
      if (member) {
        if (member.status === 'inactive') {
          setError(t('account_disabled') || 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
          setLoading(false);
          return;
        }
        console.log('Staff login successful:', member.email);
        localStorage.setItem('user_role', member.role || 'customer');
        localStorage.setItem('user_name', `${member.first_name} ${member.last_name}`);
        localStorage.setItem('user_email', member.email);
        localStorage.setItem('member_id', member.id);
        if (member.picture_url) {
          localStorage.setItem('user_picture', directusApi.getFileUrl(member.picture_url));
        }
        localStorage.setItem('is_admin', 'false');
        navigate('/');
      } else {
        console.log('No staff member found with these credentials');
        setError(t('login_error'));
      }
    } catch (err: any) {
      console.error('Login process error:', err);
      const directusErrors = err.response?.data?.errors;
      if (directusErrors && directusErrors.length > 0) {
        const msg = directusErrors[0].message;
        if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
          setError(t('permission_error_directus'));
        } else {
          setError(`${t('login_error')} (${msg})`);
        }
      } else if (err.message === 'Network Error') {
        setError(t('network_error'));
      } else {
        setError(t('login_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const websiteName = localStorage.getItem('website_name') || 'NES Tracking';
  const websiteLogo = localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg';
  const websiteBackground = localStorage.getItem('website_background');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100
      }
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-20">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1 flex gap-1">
          <button
            onClick={() => i18n.changeLanguage('th')}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              i18n.language?.startsWith('th') 
                ? "bg-white text-slate-900 shadow-lg" 
                : "text-white hover:bg-white/10"
            )}
          >
            TH
          </button>
          <button
            onClick={() => i18n.changeLanguage('en')}
            className={clsx(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              i18n.language?.startsWith('en') 
                ? "bg-white text-slate-900 shadow-lg" 
                : "text-white hover:bg-white/10"
            )}
          >
            EN
          </button>
        </div>
      </div>

      {/* Background with Overlay */}
      <div 
        className="absolute inset-0 z-0 transition-transform duration-1000 scale-105"
        style={websiteBackground ? {
          backgroundImage: `url(${websiteBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
        }}
      />
      <div className="absolute inset-0 z-1 bg-slate-900/40 backdrop-blur-[2px]" />

      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] z-1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] z-1" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[440px]"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-6 shadow-2xl shadow-black/20 p-3 overflow-hidden border border-white/20"
          >
            <img 
              src={websiteLogo} 
              alt={websiteName} 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
            {websiteName}
          </h1>
          <p className="text-slate-200/80 mt-3 font-medium text-lg">
            {t('login_subtitle') || 'เข้าสู่ระบบเพื่อใช้งาน'}
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div 
          variants={itemVariants}
          className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 overflow-hidden"
        >
          <div className="p-8 sm:p-10">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-semibold border border-red-100 mb-8 flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <motion.div variants={itemVariants}>
                <label className="block text-sm font-bold text-slate-700 mb-2.5 ml-1">
                  {t('email')}
                </label>
                <div className="group relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="example@email.com"
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-bold text-slate-700 mb-2.5 ml-1">
                  {t('password')}
                </label>
                <div className="group relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                </div>
              </motion.div>

              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.02, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-70 shadow-lg shadow-slate-900/20"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{t('sign_in')}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>

              <motion.div variants={itemVariants} className="relative my-10">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest">
                  <span className="px-4 bg-white text-slate-400">{t('or_continue_with') || 'หรือ'}</span>
                </div>
              </motion.div>

              <motion.button
                variants={itemVariants}
                whileHover={{ scale: 1.02, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={async () => {
                  try {
                    const response = await axios.get('/api/line/config');
                    const { channelId, redirectUri } = response.data;
                    if (!channelId || !redirectUri) {
                      setError('LINE Configuration Error: LINE_CHANNEL_ID or REDIRECT_URI is missing.');
                      return;
                    }
                    const state = Math.random().toString(36).substring(7);
                    const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=profile%20openid%20email`;
                    window.location.href = url;
                  } catch (err) {
                    setError('Failed to initialize LINE login.');
                  }
                }}
                className="w-full bg-[#06C755] text-white py-4 rounded-2xl font-bold hover:bg-[#05b34c] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#06C755]/20"
              >
                <div className="bg-white rounded-full p-1">
                  <MessageCircle className="w-4 h-4 text-[#06C755] fill-[#06C755]" />
                </div>
                {t('login_with_line')}
              </motion.button>
            </form>
          </div>
          
          {/* Footer Info */}
          <div className="bg-slate-50/50 p-6 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-tighter">
              <ShieldCheck size={14} />
              <span>{t('secure_system_footer')}</span>
            </div>
          </div>
        </motion.div>

        {/* System Version/Copyright */}
        <motion.p 
          variants={itemVariants}
          className="text-center text-white/40 text-xs mt-8 font-medium"
        >
          &copy; {new Date().getFullYear()} {websiteName}. {t('all_rights_reserved')}
        </motion.p>
      </motion.div>
    </div>
  );
};

