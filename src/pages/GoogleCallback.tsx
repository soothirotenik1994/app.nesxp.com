import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { directusApi } from '../api/directus';

export const GoogleCallback: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(t('authenticating'));

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Google Login Error: ${errorParam}`);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        return;
      }

      try {
        setStatus(t('loading'));
        
        // Get config from backend
        const configResponse = await axios.get('/api/google/config');
        const { redirectUri } = configResponse.data;

        // Exchange code for token via our server proxy
        const tokenResponse = await axios.post('/api/auth/google/token', {
          code,
          redirect_uri: redirectUri
        });

        const { access_token } = tokenResponse.data;

        // Get user info from Google
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` }
        });

        const googleUser = userInfoResponse.data;
        const email = googleUser.email;
        const googleUserId = googleUser.sub;

        if (!email) {
          setError('Could not retrieve email from Google account');
          return;
        }

        // Search for member in Directus by google_user_id or email
        const members = await directusApi.getMembers();
        let member = members.find(m => m.google_user_id === googleUserId || m.email === email);

        if (!member) {
          // Auto-register as customer if not found
          setStatus(t('loading'));
          member = await directusApi.createMember({
            google_user_id: googleUserId,
            email: email,
            first_name: googleUser.given_name || googleUser.name,
            last_name: googleUser.family_name || '(Google)',
            role: 'customer',
            status: 'pending',
            display_name: googleUser.name
          });
        } else if (!member.google_user_id) {
          // Link Google account to existing member
          await directusApi.updateMember(member.id, {
            google_user_id: googleUserId
          }).catch(() => {});
        }

        if (member.status === 'inactive') {
          setError(t('account_disabled'));
          return;
        }

        if (member.status === 'pending') {
          setError(t('account_pending_msg'));
          return;
        }

        const role = (member.role || 'customer').toLowerCase();
        
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_name', member.display_name || `${member.first_name} ${member.last_name}`);
        localStorage.setItem('user_email', member.email || '');
        localStorage.setItem('member_id', member.id);
        
        if (googleUser.picture) {
          localStorage.setItem('user_picture', googleUser.picture);
        }

        navigate('/');
      } catch (err: any) {
        console.error('Google Callback Error:', err);
        setError(err.response?.data?.error || err.message || 'An error occurred during Google login');
      }
    };

    handleCallback();
  }, [searchParams, navigate, t]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
        {error ? (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{t('login_failed')}</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              {t('back_to_login')}
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">{t('authenticating')}</h2>
            <p className="text-slate-500">{status}</p>
          </>
        )}
      </div>
    </div>
  );
};
