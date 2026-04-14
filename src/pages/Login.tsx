import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    { key: 'arrived', label: t('status_arrived') },
    { key: 'completed', label: t('status_completed') }
  ];

  const currentIdx = steps.findIndex(s => s.key === status);
  const isCancelled = status === 'cancelled' || status === 'cancel_pending';

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
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
                isActive ? "text-emerald-600" : "text-slate-400"
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
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl, setSettingsUrl] = useState(localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com');
  const [settingsKey, setSettingsKey] = useState(localStorage.getItem('static_api_key') || import.meta.env.VITE_DIRECTUS_STATIC_TOKEN || '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const isTrackingEnabled = localStorage.getItem('enable_tracking') !== 'false';

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

    if (mode === 'login') {
      // Handle Remember Me
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
        localStorage.setItem('remembered_password', password);
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
          // If it's a real error (not just 401), we might want to know
          if (adminErr.response?.status && adminErr.response.status !== 401) {
            console.warn('Admin API error:', adminErr.response.data);
          }
        }

        // 2. Try Staff Login (Member) if admin login failed
        console.log('Attempting staff login...');
        const member = await directusApi.loginStaff(email, password);
        
        if (member) {
          if (member.status === 'inactive') {
            setError(t('account_disabled'));
            setLoading(false);
            return;
          }
          console.log('Staff login successful:', member.email);
          localStorage.setItem('user_role', member.role || 'Customer');
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
        
        // Check for specific Directus errors
        const directusErrors = err.response?.data?.errors;
        if (directusErrors && directusErrors.length > 0) {
          const msg = directusErrors[0].message;
          if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
            setError(t('permission_error_msg'));
          } else {
            setError(`${t('login_error')} (${msg})`);
          }
        } else if (err.message === 'Network Error') {
          setError(t('network_error_msg'));
        } else {
          setError(t('login_error'));
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Tracking Mode
      try {
        const job = await directusApi.trackJob(caseNumber, trackingPhone);
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
          setError(t('error_fetching_data'));
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
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={websiteBackground ? {
        backgroundImage: `url(${websiteBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {}}
    >
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 p-3 bg-white/80 backdrop-blur shadow-sm rounded-full text-slate-500 hover:text-slate-900 transition-colors"
        title="Server Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Server Settings
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Directus URL
                </label>
                <input
                  type="text"
                  value={settingsUrl}
                  onChange={(e) => setSettingsUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="https://data.nesxp.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Static API Key
                </label>
                <input
                  type="text"
                  value={settingsKey}
                  onChange={(e) => setSettingsKey(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="Enter API Key"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                >
                  Save & Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={clsx("max-w-md w-full", !websiteBackground && "bg-slate-50")}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl mb-4 shadow-xl shadow-slate-200 p-2 overflow-hidden">
            <img 
              src={websiteLogo} 
              alt={websiteName} 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{websiteName}</h1>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden text-slate-900">
          {/* Tab Switcher */}
          {isTrackingEnabled && (
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={clsx(
                  "flex-1 py-4 text-sm font-bold transition-all",
                  mode === 'login' ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t('sign_in')}
              </button>
              <button
                onClick={() => { setMode('tracking'); setError(''); }}
                className={clsx(
                  "flex-1 py-4 text-sm font-bold transition-all",
                  mode === 'tracking' ? "text-primary border-b-2 border-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t('tracking')}
              </button>
            </div>
          )}

          <div className="p-8">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 mb-6">
                {error}
              </div>
            )}

            {mode === 'login' ? (
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
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900"
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
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {rememberMe ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                    {t('remember_me')}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
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
                  onClick={async () => {
                    try {
                      const response = await axios.get('/api/line/config');
                      
                      // Check if the response is HTML (meaning the backend is not running and we got the SPA fallback)
                      if (typeof response.data === 'string' && response.data.includes('<html')) {
                        setError('Backend Server Error: The Node.js backend is not running. Please ensure you have deployed the backend server.');
                        return;
                      }

                      const { channelId, redirectUri } = response.data;
                      
                      console.log('Starting LINE Login with:', { channelId, redirectUri });
                      
                      if (!channelId || !redirectUri) {
                        setError('LINE Configuration Error: LINE_CHANNEL_ID or REDIRECT_URI is missing in Directus settings.');
                        console.error('LINE Config missing:', { channelId, redirectUri });
                        return;
                      }

                      const state = Math.random().toString(36).substring(7);
                      const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=profile%20openid%20email`;
                      window.location.href = url;
                    } catch (err) {
                      console.error('Failed to fetch LINE config:', err);
                      setError('Failed to initialize LINE login. Please try again.');
                    }
                  }}
                  className="w-full bg-[#06C755] text-white py-3 rounded-xl font-semibold hover:bg-[#05b34c] transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5 fill-white" />
                  {t('login_with_line')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('case_number')}
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900"
                      placeholder="THXXXXXXXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {t('phone')}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={trackingPhone}
                      onChange={(e) => setTrackingPhone(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900"
                      placeholder="08X-XXX-XXXX"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-secondary text-white py-3 rounded-xl font-semibold hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      {t('search')}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Tracking Result Modal */}
      {showTrackingResult && trackingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-secondary text-white">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6" />
                <div>
                  <h2 className="text-xl font-bold">{t('tracking_result')}</h2>
                  <p className="text-white/80 text-xs">{trackingResult.case_number}</p>
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
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('origin')}</p>
                      <p className="text-slate-900 font-semibold">{trackingResult.origin}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('destination')}</p>
                      <p className="text-slate-900 font-semibold">{trackingResult.destination}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Navigation className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('current_location')}</p>
                      <p className="text-slate-900 font-semibold">{carStatus?.address || t('loading_location')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('vehicle')}</p>
                      <p className="text-slate-900 font-semibold">{trackingResult.car_id?.car_number || t('no_vehicle')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('driver')}</p>
                      <p className="text-slate-900 font-semibold">{trackingResult.driver_id ? `${trackingResult.driver_id.first_name} ${trackingResult.driver_id.last_name}` : t('not_assigned')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {trackingResult.delivery_photos && trackingResult.delivery_photos.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('images')}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {trackingResult.delivery_photos.map((photo: any, idx: number) => (
                      <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
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
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('vehicle_location')}
                </h3>
                <div className="h-64 rounded-2xl overflow-hidden border border-slate-200">
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
