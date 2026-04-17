import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, Lock, Mail, Loader2, UserCog, User, MessageCircle, CheckSquare, Square, Search, Phone, Hash, MapPin, Clock, Package, CheckCircle2, Circle, AlertCircle, X, Truck, Navigation, Settings } from 'lucide-react';
import axios from 'axios';
import { directusApi, setAuthToken } from '../api/directus';
import { gpsApi } from '../api/gps';
import clsx from 'clsx';
import { VehicleMap } from '../components/VehicleMap';
import { CarStatus } from '../types';

const StatusTimeline: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const steps = [
    { key: 'pending', label: t('status_pending') },
    { key: 'accepted', label: t('status_accepted') },
    { key: 'completed', label: t('status_completed') }
  ];

  const currentIdx = steps.findIndex(s => s.key === status);
  const isCancelled = status === 'cancelled' || status === 'cancel_pending';

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 mb-6 shadow-sm">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
        {steps.map((step, idx) => {
          const isActive = idx <= currentIdx && !isCancelled;
          const isCurrent = idx === currentIdx && !isCancelled;
          
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
              <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                isActive ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-white text-slate-300 border-2 border-slate-100",
                isCurrent && "ring-4 ring-primary/10"
              )}>
                {isActive ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </div>
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-wider",
                isActive ? "text-primary" : "text-slate-400"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {status === 'cancel_pending' ? t('status_cancel_pending') : t('status_cancelled')}
        </div>
      )}
    </div>
  );
};

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'tracking'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // Tracking states
  const [caseNumber, setCaseNumber] = useState('');
  const [trackingPhone, setTrackingPhone] = useState('');
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [carStatus, setCarStatus] = useState<CarStatus | null>(null);
  const [showTrackingResult, setShowTrackingResult] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState(localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com');
  const [settingsKey, setSettingsKey] = useState(() => {
    let key = localStorage.getItem('static_api_key');
    const badTokens = [
      '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0',
      'JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn'
    ];
    if (key && badTokens.includes(key)) {
      localStorage.removeItem('static_api_key');
      key = null;
    }
    const envKey = (import.meta.env.VITE_DIRECTUS_STATIC_TOKEN || '').trim();
    return key || (badTokens.includes(envKey) ? null : envKey) || 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const isTrackingEnabled = localStorage.getItem('enable_tracking') !== 'false';
  const isLineLoginEnabled = localStorage.getItem('enable_line_login') !== 'false';
  const isGoogleLoginEnabled = localStorage.getItem('enable_google_login') === 'true';
  const googleClientId = localStorage.getItem('google_client_id') || '';

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    const savedPassword = localStorage.getItem('remembered_password');
    const savedRememberMe = localStorage.getItem('remember_me_enabled') === 'true';

    if (savedRememberMe && savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
    
    // If tracking is disabled, force mode to login
    if (!isTrackingEnabled && mode === 'tracking') {
      setMode('login');
    }
  }, [isTrackingEnabled, mode]);

  const handleSaveSettings = () => {
    localStorage.setItem('directus_url', settingsUrl);
    localStorage.setItem('static_api_key', settingsKey);
    setShowSettings(false);
    window.location.reload(); // Reload to apply new settings to axios instance
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    const recordLogin = async (userEmail: string, status: 'success' | 'failed') => {
      try {
        const ipRes = await axios.get('https://api.ipify.org?format=json').catch(() => ({ data: { ip: 'Unknown' } }));
        const ip = ipRes.data.ip;
        
        await directusApi.createLoginLog({
          user_email: userEmail,
          ip_address: ip,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          status: status
        });
      } catch (e) {
        console.error('Failed to record login log:', e);
      }
    };

    if (mode === 'login') {
      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem('remembered_email', trimmedEmail);
        localStorage.setItem('remembered_password', trimmedPassword);
        localStorage.setItem('remember_me_enabled', 'true');
      } else {
        localStorage.removeItem('remembered_email');
        localStorage.removeItem('remembered_password');
        localStorage.setItem('remember_me_enabled', 'false');
      }

      // Clear old tokens to avoid interceptor issues with invalid/expired tokens
      directusApi.logout();

      try {
        // 1. Try Admin Login first
        try {
          console.log(`Attempting admin login for: ${trimmedEmail}`);
          const data = await directusApi.login(trimmedEmail, trimmedPassword);
          console.log('Admin login response received');
          localStorage.setItem('admin_token', data.access_token);
          setAuthToken(data.access_token);
          
          // Fetch user info to get role
          const user = await directusApi.getCurrentUser();
          console.log('Admin user info fetched:', user.email);
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
          
          // Record success log
          recordLogin(user.email, 'success');
          
          navigate('/');
          return; // Success
        } catch (adminErr: any) {
          console.log('Admin login attempt failed:', adminErr.response?.status, adminErr.message);
          // If it's a real error (not just 401), we might want to know
          if (adminErr.response?.status && adminErr.response.status !== 401) {
            console.warn('Admin API error details:', adminErr.response.data);
            recordLogin(trimmedEmail, 'failed');
          }
        }

        // 2. Try Staff Login (Member) if admin login failed
        console.log(`Attempting staff login for: ${trimmedEmail}`);
        try {
          const member = await directusApi.loginStaff(trimmedEmail, trimmedPassword);
          
          if (member) {
            console.log('Staff member match found:', member.email);
            if (member.status === 'inactive') {
              console.log('Member is inactive');
              setError(t('account_disabled'));
              setLoading(false);
              return;
            }
            console.log('Staff login successful, redirecting...', member.email);
            localStorage.setItem('user_role', member.role || 'Customer');
            localStorage.setItem('user_name', `${member.first_name} ${member.last_name}`);
            localStorage.setItem('user_email', member.email || '');
            localStorage.setItem('member_id', member.id);
            if (member.picture_url) {
              localStorage.setItem('user_picture', directusApi.getFileUrl(member.picture_url));
            }
            localStorage.removeItem('admin_token'); // Ensure no admin token for staff
            localStorage.setItem('is_admin', 'false');
            
            // Record success log
            recordLogin(member.email || trimmedEmail, 'success');
            
            // Success! Navigate to home
            setTimeout(() => {
              navigate('/');
            }, 500);
          } else {
            console.log('No staff member matching credentials found in Directus');
            recordLogin(trimmedEmail, 'failed');
            setError(t('login_error'));
          }
        } catch (staffErr: any) {
          console.error('Staff login API call failed:', staffErr.response?.status, staffErr.message);
          if (staffErr.response?.data) {
            console.error('Staff error data:', JSON.stringify(staffErr.response.data));
          }
          setError(t('login_error'));
        }
      } catch (err: any) {
        console.error('Outer login catch block:', err);
        setError(t('login_error'));
      } finally {
        setLoading(false);
      }
    } else {
      // Tracking Mode
      try {
        const trimmedCase = caseNumber.trim();
        const trimmedPhone = trackingPhone.trim();
        const job = await directusApi.trackJob(trimmedCase, trimmedPhone);
        if (job) {
          setTrackingResult(job);
          // Fetch car status
          if (job.car_id?.car_number) {
            try {
              const status = await gpsApi.getCarStatus(job.car_id.car_number);
              setCarStatus(status);
            } catch (e) {
              console.error('Failed to fetch car status', e);
              setCarStatus(null);
            }
          }
          setShowTrackingResult(true);
        } else {
          setError(t('no_job_found'));
        }
      } catch (err: any) {
        console.error('Tracking error:', err);
        if (err.message?.includes('Verification failed')) {
          setError(t('verification_failed'));
        } else {
          setError(t('no_job_found'));
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const websiteName = localStorage.getItem('website_name') || 'NES Tracking';
  const websiteLogo = localStorage.getItem('website_logo') || 'https://img2.pic.in.th/4863801.jpg';
  const websiteBackground = localStorage.getItem('website_background');

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-body">
      <main className="flex-grow flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Imagery */}
        <div className="absolute inset-0 z-0">
          <img 
            alt="Background" 
            className="w-full h-full object-cover opacity-20 filter blur-[2px]" 
            src={websiteBackground || "https://lh3.googleusercontent.com/aida-public/AB6AXuBfitiLOJFUsF2pIz71BBXDqWrH6_X5Z8J0v6CNWa6SbDfISL3HlMVCz03V6j6lVYzZVglZb4IGMp2XhJio_48MQqxHvTYlFrG6pypePvAVUq1mAy_FC-E8yYbXJ9XchJ6U9B7BfZh7yy_asFkAjp5HTKvpgh89q0ONkSOymOIW_ThQx1J_K608uMmOQjRDnrtekNToixaCpImdfj3IDPn3Q9lwu6n-hPE8BNzEgimCcX77GDD-EC4F2CWoM_I5n-4hL4EmsCXbvBY"}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-surface/90 via-surface/40 to-transparent"></div>
        </div>

        {/* Login Container */}
        <div className="relative z-10 w-full max-w-[480px]">
          <div className="bg-surface-container-lowest rounded-3xl shadow-[0px_20px_60px_rgba(26,27,34,0.08)] p-8 md:p-12 border border-outline-variant/10">
            {/* Branding & Header */}
            <div className="text-center mb-10">
              <div className="inline-flex flex-col items-center justify-center mb-8">
                {websiteLogo ? (
                  <img 
                    src={websiteLogo} 
                    alt={websiteName} 
                    className="h-16 mb-2 object-contain cursor-pointer select-none" 
                    referrerPolicy="no-referrer" 
                    onDoubleClick={() => setShowSettings(true)}
                  />
                ) : (
                  <div 
                    className="inline-flex items-center justify-center cursor-pointer select-none"
                    onDoubleClick={() => setShowSettings(true)}
                  >
                    <span className="text-primary text-4xl font-headline font-extrabold tracking-tighter">NES</span>
                    <span className="text-primary-container text-4xl font-headline font-normal tracking-tighter ml-1">Logistics</span>
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">
                {mode === 'login' ? t('welcome_back_to') + " " + websiteName : t('track_your_package')}
              </h1>
              <p className="text-on-surface-variant font-label text-sm">
                {mode === 'login' ? t('login_to_manage') : t('enter_info_to_track')}
              </p>
            </div>

            {error && (
              <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium border border-error/10 mb-6 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold font-label text-on-secondary-container ml-1" htmlFor="email">
                    {t('email_or_line_id')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="email"
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('email_or_line_placeholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="block text-sm font-semibold font-label text-on-secondary-container" htmlFor="password">
                      {t('password')}
                    </label>
                    <Link className="text-xs font-bold text-primary hover:text-primary-container transition-colors" to="/forgot-password">
                      {t('forgot_password')}
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      onClick={() => setRememberMe(!rememberMe)}
                      className={clsx(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                        rememberMe ? "bg-primary border-primary" : "border-outline/30 group-hover:border-primary/50"
                      )}
                    >
                      {rememberMe && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-on-surface-variant select-none">{t('remember_me')}</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('login')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold font-label text-on-secondary-container ml-1" htmlFor="caseNumber">
                    {t('case_number')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Hash className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="caseNumber"
                      type="text"
                      required
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      placeholder="THXXXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold font-label text-on-secondary-container ml-1" htmlFor="phone">
                    {t('phone')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="phone"
                      type="tel"
                      required
                      value={trackingPhone}
                      onChange={(e) => setTrackingPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <Search className="w-5 h-5" />
                      {t('search')}
                    </>
                  )}
                </button>
              </form>
            )}

            {mode === 'login' && (isLineLoginEnabled || isGoogleLoginEnabled) && (
              <>
                <div className="relative my-10">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant/20"></div>
                  </div>
                  <div className="relative flex justify-center text-xs font-label">
                    <span className="px-4 bg-surface-container-lowest text-outline italic">
                      {t('or_login_with')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {isLineLoginEnabled && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const response = await axios.get('/api/line/config');
                          if (!response.data || typeof response.data !== 'object' || !response.data.channelId) {
                            setError('LINE Configuration Error');
                            return;
                          }
                          const { channelId, redirectUri } = response.data;
                          const state = Math.random().toString(36).substring(7);
                          const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=profile%20openid%20email`;
                          window.location.href = url;
                        } catch (err) {
                          setError('Failed to initialize LINE login.');
                        }
                      }}
                      className="flex items-center justify-center gap-3 w-full py-4 bg-[#06C755] hover:bg-[#05b14c] text-white rounded-2xl font-body font-bold transition-all active:scale-[0.98]"
                    >
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M24 10.304c0-5.354-5.383-9.713-12-9.713s-12 4.359-12 9.713c0 4.793 4.265 8.806 10.029 9.552.39.084.92.258 1.054.59.12.301.079.77.039 1.073l-.171 1.047c-.052.312-.252 1.22 1.083.666 1.335-.554 7.203-4.243 9.83-7.258 1.766-2.025 2.136-3.834 2.136-5.672z"></path>
                      </svg>
                      {t('login_with_line')}
                    </button>
                  )}

                  {isGoogleLoginEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!googleClientId) {
                          setError('Google Client ID is missing.');
                          return;
                        }
                        const redirectUri = `${window.location.origin}/google/callback`;
                        const scope = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
                        const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
                        window.location.href = url;
                      }}
                      className="flex items-center justify-center gap-3 w-full py-4 bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/20 rounded-2xl font-body font-bold transition-all active:scale-[0.98]"
                    >
                      <img 
                        alt="Google Logo" 
                        className="w-5 h-5" 
                        src="https://www.gstatic.com/marketing-cms/assets/images/66/ac/14b165e647fd85c824bfbe5d6bc5/gmail.webp=s96-fcrop64=1,00000000ffffffff-rw"
                        referrerPolicy="no-referrer"
                      />
                      {t('login_with_google')}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Footer Link */}
            <div className="mt-10 text-center space-y-4">
              <p className="text-sm font-label text-on-surface-variant">
                {t('no_account_yet')}
                <a 
                  className="text-primary font-bold hover:underline ml-1" 
                  href="https://line.me/ti/p/@nesxp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('register_here')}
                </a>
              </p>
              
              {isTrackingEnabled && (
                <button
                  onClick={() => { setMode(mode === 'login' ? 'tracking' : 'login'); setError(''); }}
                  className="text-xs font-bold text-outline hover:text-primary transition-colors"
                >
                  {mode === 'login' ? t('switch_to_tracking') : t('back_to_login')}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Shared Footer */}
      <footer className="w-full py-8 bg-white flex flex-col md:flex-row justify-between items-center px-12 border-t border-outline-variant/10">
        <div className="font-headline font-bold text-primary mb-4 md:mb-0">{websiteName}</div>
        <div className="flex flex-wrap justify-center gap-8 mb-4 md:mb-0">
          <button 
            onClick={() => { setShowTrackingModal(true); setError(''); }}
            className="font-label text-sm text-outline hover:text-primary transition-colors"
          >
            {t('tracking')}
          </button>
          <a className="font-label text-sm text-outline hover:text-primary transition-colors" href="#">{t('privacy_policy')}</a>
          <a className="font-label text-sm text-outline hover:text-primary transition-colors" href="#">{t('terms_of_use')}</a>
          <a className="font-label text-sm text-outline hover:text-primary transition-colors" href="#">{t('help')}</a>
        </div>
        <div className="font-label text-sm text-outline">© 2024 {websiteName}. {t('all_rights_reserved')}.</div>
      </footer>

      {/* API Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-800 text-white">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6" />
                <h2 className="text-xl font-bold">{t('api_settings_modal_title')}</h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">{t('directus_url')}</label>
                <input 
                  type="text"
                  value={settingsUrl}
                  onChange={(e) => setSettingsUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('directus_url_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">{t('static_api_key')}</label>
                <input 
                  type="text"
                  value={settingsKey}
                  onChange={(e) => setSettingsKey(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('static_api_key_placeholder')}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSaveSettings}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20"
                >
                  {t('save_reload')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal (Popup) */}
      {showTrackingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-primary text-on-primary">
              <div className="flex items-center gap-3">
                <Search className="w-6 h-6" />
                <h2 className="text-xl font-headline font-bold">{t('tracking')}</h2>
              </div>
              <button 
                onClick={() => setShowTrackingModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8">
              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                try {
                  const job = await directusApi.trackJob(caseNumber, trackingPhone);
                  if (job) {
                    setTrackingResult(job);
                    if (job.car_id?.car_number) {
                      try {
                        const status = await gpsApi.getCarStatus(job.car_id.car_number);
                        setCarStatus(status);
                      } catch (e) {
                        setCarStatus(null);
                      }
                    }
                    setShowTrackingModal(false);
                    setShowTrackingResult(true);
                  } else {
                    setError(t('no_job_found'));
                  }
                } catch (err: any) {
                  if (err.message?.includes('Verification failed')) {
                    setError(t('verification_failed'));
                  } else {
                    setError(t('no_job_found'));
                  }
                } finally {
                  setLoading(false);
                }
              }} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold font-label text-on-secondary-container ml-1" htmlFor="modalCaseNumber">
                    {t('case_number')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Hash className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="modalCaseNumber"
                      type="text"
                      required
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      placeholder="THXXXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold font-label text-on-secondary-container ml-1" htmlFor="modalPhone">
                    {t('phone')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="modalPhone"
                      type="tel"
                      required
                      value={trackingPhone}
                      onChange={(e) => setTrackingPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-error-container text-on-error-container p-3 rounded-xl text-xs font-medium border border-error/10 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all duration-200 mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <Search className="w-5 h-5" />
                      {t('search')}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Result Modal */}
      {showTrackingResult && trackingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-secondary text-on-secondary">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">{t('tracking_result')}</h2>
                  <p className="text-on-secondary/80 text-xs">{trackingResult.case_number}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTrackingResult(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <StatusTimeline status={trackingResult.status} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider">{t('origin')}</p>
                      <p className="text-on-surface font-semibold">{trackingResult.origin}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-tertiary-container/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-on-tertiary-container" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider">{t('destination')}</p>
                      <p className="text-on-surface font-semibold">{trackingResult.destination}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/5 flex items-center justify-center flex-shrink-0">
                      <Navigation className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider">{t('current_location')}</p>
                      <p className="text-on-surface font-semibold">{carStatus?.address || t('loading_location')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider">{t('vehicle')}</p>
                      <p className="text-on-surface font-semibold">{trackingResult.car_id?.car_number || t('no_vehicle')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/5 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider">{t('driver')}</p>
                      <p className="text-on-surface font-semibold">{trackingResult.driver_id ? `${trackingResult.driver_id.first_name} ${trackingResult.driver_id.last_name}` : t('not_assigned')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {trackingResult.delivery_photos && trackingResult.delivery_photos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('images')}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {trackingResult.delivery_photos.map((photo: any, idx: number) => (
                      <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-outline-variant/20 shadow-sm">
                        <img 
                          src={directusApi.getFileUrl(photo)} 
                          alt={`delivery-${idx}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('vehicle_location')}
                </h3>
                <div className="h-64 rounded-2xl overflow-hidden border border-outline-variant/20">
                  <VehicleMap 
                    vehicles={carStatus ? [carStatus] : []}
                    center={carStatus ? { lat: carStatus.lat, lng: carStatus.lng } : { lat: 13.7563, lng: 100.5018 }}
                    zoom={15}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
