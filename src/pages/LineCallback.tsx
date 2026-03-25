import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, AlertCircle } from 'lucide-react';
import { directusApi, setAuthToken } from '../api/directus';

export const LineCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Processing LINE login...');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('LineCallback: Current URL:', window.location.href);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      console.log('LineCallback: Params:', { code: !!code, state, errorParam });

      if (errorParam) {
        console.error('LineCallback: Error from LINE:', errorParam);
        setError(`LINE Login Error: ${errorParam}`);
        return;
      }

      if (!code) {
        console.error('LineCallback: No code received');
        setError('No authorization code received');
        return;
      }

      try {
        setStatus('Exchanging code for token...');
        console.log('LineCallback: Exchanging code for token...');
        
        // Get config from backend
        const configResponse = await axios.get('/api/line/config');
        const { redirectUri } = configResponse.data;

        // Exchange code for token via our server proxy
        const tokenResponse = await axios.post('/api/auth/line/token', {
          code,
          redirect_uri: redirectUri
        });

        const { id_token, access_token } = tokenResponse.data;

        setStatus('Fetching LINE profile...');
        // Get user profile from LINE
        const profileResponse = await axios.get('https://api.line.me/v2/profile', {
          headers: { Authorization: `Bearer ${access_token}` }
        });

        const lineProfile = profileResponse.data;
        const lineUserId = lineProfile.userId;

        // If we have a picture URL from LINE, try to import it to Directus
        let directusPictureId = lineProfile.pictureUrl;
        if (lineProfile.pictureUrl) {
          try {
            setStatus('Storing profile picture...');
            directusPictureId = await directusApi.importFileFromUrl(lineProfile.pictureUrl);
          } catch (picErr) {
            console.warn('Failed to import profile picture to Directus:', picErr);
          }
        }

        setStatus('Finding member profile...');
        // Search for member in Directus by line_user_id
        const members = await directusApi.getMembers();
        let member = members.find(m => m.line_user_id === lineUserId);

        if (!member) {
          // Try to get email from id_token
          let email = '';
          try {
            if (id_token && typeof id_token === 'string') {
              // Decode JWT payload
              const base64Url = id_token.split('.')[1];
              if (base64Url) {
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                
                const payload = JSON.parse(jsonPayload);
                email = payload.email || '';
              }
            }
          } catch (e) {
            console.warn('Failed to decode id_token:', e);
          }

          // If not found by line_user_id, try by email
          if (email) {
            member = members.find(m => m.email === email);
            if (member) {
              // Link LINE account to existing member
              setStatus('Linking LINE account...');
              member = await directusApi.updateMember(member.id, {
                line_user_id: lineUserId,
                picture_url: directusPictureId,
                display_name: lineProfile.displayName
              });
            }
          }

          // If still not found, auto-register as customer
          if (!member) {
            setStatus('Registering as customer...');
            member = await directusApi.createMember({
              line_user_id: lineUserId,
              email: email,
              first_name: lineProfile.displayName,
              last_name: '(LINE)',
              role: 'customer',
              status: 'pending',
              picture_url: directusPictureId,
              display_name: lineProfile.displayName
            });
          }
        }

        // Check if member exists and has a valid role
        if (!member) {
          console.error('LineCallback: Member not found in system');
          setError('ขออภัย ไม่พบข้อมูลผู้ใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อลงทะเบียน');
          return;
        }

        // Check if member is active
        if (member.status === 'inactive') {
          console.error('LineCallback: Member account is disabled');
          setError('ขออภัย บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
          return;
        }

        if (member.status === 'pending') {
          console.error('LineCallback: Member account is pending approval');
          setError('บัญชีของคุณอยู่ระหว่างการตรวจสอบโดยแอดมิน กรุณารอสักครู่');
          return;
        }

        // Default to customer if role is missing
        if (!member.role) {
          console.log('LineCallback: Member has no role, defaulting to customer');
          member.role = 'customer';
          await directusApi.updateMember(member.id, { role: 'customer' }).catch(() => {});
        }

        // Allow all roles for now to ensure everyone can log in, 
        // as filtering is handled at the data level.
        const role = member.role.toLowerCase();
        console.log('LineCallback: Logging in with role:', role);

        // Update profile picture if it changed or was external
        if (member.picture_url !== directusPictureId) {
          await directusApi.updateMember(member.id, {
            picture_url: directusPictureId,
            display_name: lineProfile.displayName
          }).catch(() => {});
        }

        setStatus('Logging in...');
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_name', member.display_name || `${member.first_name} ${member.last_name}`);
        localStorage.setItem('user_email', member.email || '');
        localStorage.setItem('user_phone', member.phone || (member as any).Phone || '');
        localStorage.setItem('line_user_id', lineUserId);
        localStorage.setItem('member_id', member.id);
        
        // If we have a picture, save it
        if (member.picture_url) {
          localStorage.setItem('user_picture', directusApi.getFileUrl(member.picture_url));
        }

        navigate('/');
      } catch (err: any) {
        console.error('LINE Callback Error:', err);
        setError(err.response?.data?.error || err.message || 'An error occurred during LINE login');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
        {error ? (
          <>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Login Failed</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Authenticating</h2>
            <p className="text-slate-500">{status}</p>
          </>
        )}
      </div>
    </div>
  );
};
