import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { directusApi } from '../api/directus';

export const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // The reset URL points to the ResetPassword page in our app
      const resetUrl = `${window.location.origin}/reset-password`;
      await directusApi.requestPasswordReset(email, resetUrl);
      setSuccess(true);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError(t('forgot_password_error'));
    } finally {
      setLoading(false);
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
            src={websiteBackground || "https://picsum.photos/seed/truck/1920/1080?blur=2"}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-surface/90 via-surface/40 to-transparent"></div>
        </div>

        <div className="relative z-10 w-full max-w-[480px]">
          <div className="bg-surface-container-lowest rounded-3xl shadow-[0px_20px_60px_rgba(26,27,34,0.08)] p-8 md:p-12 border border-outline-variant/10 text-center">
            {/* Branding */}
            <div className="mb-8">
              {websiteLogo ? (
                <img 
                  src={websiteLogo} 
                  alt={websiteName} 
                  className="h-16 mx-auto mb-2 object-contain select-none" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="inline-flex items-center justify-center select-none">
                  <span className="text-primary text-4xl font-headline font-extrabold tracking-tighter">NES</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-headline font-bold text-on-surface tracking-tight mb-2">
              {t('forgot_password_title')}
            </h1>
            <p className="text-on-surface-variant font-label text-sm mb-8">
              {t('forgot_password_desc')}
            </p>

            {success ? (
              <div className="space-y-6">
                <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl flex flex-col items-center gap-4 border border-emerald-100">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-sm">
                    {t('reset_link_sent')}
                  </p>
                  <p className="text-xs opacity-80 leading-relaxed">
                    {t('check_your_email')}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('back_to_login')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium border border-error/10 mb-6 flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2 text-left">
                  <label className="block text-sm font-semibold font-label text-on-secondary-container ml-1" htmlFor="email">
                    {t('email')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="w-5 h-5 text-outline" />
                    </div>
                    <input
                      className="block w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/10 focus:bg-surface-container-lowest transition-all duration-200"
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary text-on-primary font-headline font-bold text-lg rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-container active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('send_reset_link')}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-2 text-on-surface-variant font-bold text-sm hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('back_to_login')}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
