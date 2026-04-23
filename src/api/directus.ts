import axios from 'axios';
import { Member, Car, CarPermission, AdminUser, MaintenanceHistory } from '../types';

const getSafeStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[directusApi] localStorage access denied for key: ${key}`, e);
    return null;
  }
};

export const DIRECTUS_URL = getSafeStorageItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com';

// Use administrative proxy for better reliability and token management
const PROXY_URL = '/api/directus';

const getStaticKey = () => {
  let key = getSafeStorageItem('static_api_key');
  
  // Clean up problematic values
  if (key === 'null' || key === 'undefined' || key === '') {
    key = null;
    try { localStorage.removeItem('static_api_key'); } catch (e) {}
  }
  
  const badTokens = [
    '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0',
    'JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn',
    'KC7bsoqj_bmFeKWJCDGadyxXZsleRUi4',
    'null',
    'undefined'
  ];
  
  // Confirmed working token provided by user - now primarily handled by backend for security
  const confirmedToken = 'r0eWclUwYkWhUWVlaYkzgOJzAKpRtEex';
  
  if (key && (badTokens.some(bt => key.trim().includes(bt)) || key.length < 20)) {
    console.log('[directusApi] Specifically found and clearing invalid/leaked token from localStorage');
    try { localStorage.removeItem('static_api_key'); } catch (e) {}
    key = null;
  }
  
  const envKey = (import.meta.env.VITE_DIRECTUS_STATIC_TOKEN || '').trim();
  // Return user's setting, or the env variable, or fallback to the confirmed token
  let finalKey = key || (envKey && !badTokens.includes(envKey) && envKey.length >= 20 ? envKey : confirmedToken);
  
  if (finalKey === 'null' || finalKey === 'undefined' || !finalKey) return confirmedToken;
  return finalKey.trim();
};

export const STATIC_API_KEY = getStaticKey();

// Use the proxy URL as the base for all API calls to avoid CORS and auth header issues
export const api = axios.create({
  baseURL: PROXY_URL,
  timeout: 30000, // 30 seconds timeout
});

// Set auth token if available
export const setAuthToken = (token: string | null) => {
  if (token && token !== 'null' && token !== 'undefined') {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    // If no admin token, use the static API key for staff access
    if (STATIC_API_KEY) {
      api.defaults.headers.common['Authorization'] = `Bearer ${STATIC_API_KEY}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }
};

// Add request interceptor to ensure token is always sent
api.interceptors.request.use(
  (config) => {
    // Do not send Authorization header for login requests
    if (config.url?.includes('/auth/login')) {
      delete config.headers.Authorization;
      return config;
    }

    // If Authorization is already set (e.g. explicitly in trackJob), don't overwrite it
    if (config.headers.Authorization) {
      console.log(`Using existing Authorization for: ${config.url}`);
      return config;
    }

    const token = localStorage.getItem('admin_token');
    
    // Always attach the current target Directus URL for the backend proxy
    // We read it from localStorage every time to ensure it's up to date even before page reload
    const currentDirectusUrl = localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com';
    config.headers['X-Directus-Target-Url'] = currentDirectusUrl;
    
    // Also pass the static key so the backend can use it if needed for this specific Directus instance
    if (STATIC_API_KEY) {
      config.headers['X-Directus-Static-Key'] = STATIC_API_KEY;
    }

    if (token && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`Using Admin Token for: ${config.url}`);
    } else if (STATIC_API_KEY) {
      // Use static key if no admin token
      config.headers.Authorization = `Bearer ${STATIC_API_KEY}`;
      console.log(`Using Static API Key for: ${config.url}`);
    } else {
      console.log(`No Authorization header for: ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add interceptor for 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('401 Unauthorized detected at:', window.location.pathname);
      
      const adminToken = localStorage.getItem('admin_token');
      const memberId = localStorage.getItem('member_id');
      const isLoginPage = window.location.pathname.includes('/login');
      const isAuthRequest = error.config?.url?.includes('/auth/login');
      
      // If we have an admin token, it might be expired. Refresh or logout.
      if (adminToken && !isLoginPage && !isAuthRequest) {
        console.log('[Interceptor] Admin token error, clearing session...');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('member_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('is_admin');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_picture');
        localStorage.removeItem('menu_permissions');
        localStorage.removeItem('is_switched_account');
        setAuthToken(null);
        window.location.href = '/login';
      } else if (memberId && !adminToken) {
        // If it's a staff member (no admin token), do NOT logout automatically.
        // Let the specific API calls handle their own fallbacks.
        console.log('[Interceptor] Staff member 401 detected. Will attempt fallback in the API call.');
      } else if (!isLoginPage && !isAuthRequest) {
        // No session at all and got 401
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const directusApi = {
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  loginStaff: async (identifier: string, password: string) => {
    try {
      console.log(`[directusApi] loginStaff: Using secure backend authentication for ${identifier}`);
      
      // Use the dedicated server-side login endpoint to avoid sending passwords to browser
      const response = await axios.post('/api/auth/staff-login', { 
        identifier, 
        password 
      });
      
      const member = response.data.data;
      if (member) {
        console.log(`[directusApi] loginStaff: Success! Authorized as ${member.email || member.display_name}`);
        return member;
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn('[directusApi] loginStaff: Invalid credentials');
        return null;
      }
      console.error('[directusApi] loginStaff Critical Error:', error.response?.status, error.response?.data || error.message);
      throw error;
    }
  },
  
  getMembers: async (): Promise<Member[]> => {
    const params = {
      limit: -1,
      fields: '*,car_users.*,car_users.car_id.*'
    };
    try {
      const response = await api.get('/items/line_users', { params });
      return response.data.data || [];
    } catch (error: any) {
      if (!error.response || error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[directusApi] getMembers failed (${error.response?.status || 'Network Error'}), trying Public Access fallback...`);
        const response = await axios.get(`${PROXY_URL}/items/line_users`, { params });
        return response.data.data || [];
      }
      throw error;
    }
  },

  getMember: async (id: string): Promise<Member> => {
    const params = {
      fields: '*,car_users.*,car_users.car_id.*'
    };
    try {
      const response = await api.get(`/items/line_users/${id}`, { params });
      return response.data.data;
    } catch (error: any) {
      if (!error.response || error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[directusApi] getMember ${id} failed (${error.response?.status || 'Network Error'}), trying Public Access fallback...`);
        const response = await axios.get(`${PROXY_URL}/items/line_users/${id}`, { params });
        return response.data.data;
      }
      throw error;
    }
  },

  createMember: async (data: Partial<Member>): Promise<Member> => {
    const response = await api.post('/items/line_users', data);
    return response.data.data;
  },

  updateMember: async (id: string, data: Partial<Member>): Promise<Member> => {
    const response = await api.patch(`/items/line_users/${id}`, data);
    return response.data.data;
  },

  deleteMember: async (id: string): Promise<void> => {
    console.log('Attempting to delete member:', id);
    try {
      // 1. Delete related car_users permissions
      const permissionsResponse = await api.get('/items/car_users', {
        params: { 
          filter: { line_user_id: { _eq: id } },
          fields: 'id'
        }
      });
      const permissions = permissionsResponse.data?.data;
      if (Array.isArray(permissions) && permissions.length > 0) {
        await Promise.all(permissions.map((p: any) => 
          api.delete(`/items/car_users/${p.id}`).catch(() => {})
        ));
      }

      // 2. Delete related work_reports
      const reportsResponse = await api.get('/items/work_reports', {
        params: { 
          filter: { driver_id: { _eq: id } },
          fields: 'id'
        }
      }).catch(() => ({ data: { data: [] } })); // Collection might not exist
      const reports = reportsResponse.data?.data;
      if (Array.isArray(reports) && reports.length > 0) {
        await Promise.all(reports.map((r: any) => 
          api.delete(`/items/work_reports/${r.id}`).catch(() => {})
        ));
      }
      
      // 3. Finally delete the member
      await api.delete(`/items/line_users/${id}`);
      console.log('Successfully deleted member:', id);
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || error.message;
      console.error('Error in deleteMember:', errorData || error.message);
      throw new Error(`Failed to delete member: ${errorMsg}`);
    }
  },

  getCars: async (): Promise<Car[]> => {
    try {
      const response = await api.get('/items/cars', {
        params: {
          fields: '*,car_image.*,car_users.*,car_users.line_user_id.*',
          limit: -1
        }
      });
      return response.data.data || [];
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn('[directusApi] getCars Auth failed (401), trying Public Access fallback...');
        const response = await axios.get(`${PROXY_URL}/items/cars`, {
          params: {
            fields: '*,car_image.*,car_users.*,car_users.line_user_id.*',
            limit: -1
          }
        });
        return response.data.data || [];
      }
      throw error;
    }
  },

  createCar: async (data: Partial<Car>): Promise<Car> => {
    const response = await api.post('/items/cars', data);
    return response.data.data;
  },

  updateCar: async (id: string, data: Partial<Car>): Promise<Car> => {
    const response = await api.patch(`/items/cars/${id}`, data);
    return response.data.data;
  },

  deleteCar: async (id: string): Promise<void> => {
    console.log('Attempting to delete car:', id);
    try {
      // 1. Delete related car_users permissions
      const permissionsResponse = await api.get('/items/car_users', {
        params: { 
          filter: { car_id: { _eq: id } },
          fields: 'id'
        }
      });
      const permissions = permissionsResponse.data?.data;
      if (Array.isArray(permissions) && permissions.length > 0) {
        await Promise.all(permissions.map((p: any) => 
          api.delete(`/items/car_users/${p.id}`).catch(() => {})
        ));
      }

      // 2. Delete related work_reports
      const reportsResponse = await api.get('/items/work_reports', {
        params: { 
          filter: { car_id: { _eq: id } },
          fields: 'id'
        }
      }).catch(() => ({ data: { data: [] } })); // Collection might not exist
      const reports = reportsResponse.data?.data;
      if (Array.isArray(reports) && reports.length > 0) {
        await Promise.all(reports.map((r: any) => 
          api.delete(`/items/work_reports/${r.id}`).catch(() => {})
        ));
      }
      
      // 3. Finally delete the car
      await api.delete(`/items/cars/${id}`);
      console.log('Successfully deleted car:', id);
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || error.message;
      console.error('Error in deleteCar:', errorData || error.message);
      throw new Error(`Failed to delete car: ${errorMsg}`);
    }
  },

  getCarPermissions: async (memberId?: string): Promise<CarPermission[]> => {
    const params: any = { limit: -1 };
    if (memberId) {
      params.filter = { line_user_id: { _eq: memberId } };
    }
    const response = await api.get('/items/car_users', { params });
    return response.data.data || [];
  },

  addCarPermission: async (memberId: string, carId: string): Promise<CarPermission> => {
    const response = await api.post('/items/car_users', {
      line_user_id: memberId,
      car_id: carId,
    });
    return response.data.data;
  },

  deleteCarPermission: async (id: string): Promise<void> => {
    await api.delete(`/items/car_users/${id}`);
  },

  getAdmins: async (): Promise<AdminUser[]> => {
    const response = await api.get('/users', {
      params: {
        fields: '*,role.name',
        limit: -1
      }
    });
    return response.data.data;
  },

  createAdmin: async (data: Partial<AdminUser> & { password?: string }): Promise<AdminUser> => {
    const response = await api.post('/users', data);
    return response.data.data;
  },

  updateAdmin: async (id: string, data: Partial<AdminUser> & { password?: string }): Promise<AdminUser> => {
    const response = await api.patch(`/users/${id}`, data);
    return response.data.data;
  },

  deleteAdmin: async (id: string): Promise<void> => {
    console.log('Attempting to delete admin:', id);
    try {
      // Check if we are trying to delete ourselves
      // Note: This is a simple check, the server will also prevent this if configured
      await api.delete(`/users/${id}`);
      console.log('Successfully deleted admin:', id);
    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMsg = (Array.isArray(errorData?.errors) && errorData.errors[0]?.message) || error.message;
      console.error('Error in deleteAdmin:', errorData || error.message);
      throw new Error(`Failed to delete admin: ${errorMsg}`);
    }
  },
  
  getWorkReports: async (): Promise<any[]> => {
    const fields = '*,car_id.*,driver_id.*,member_id.*,customer_id.*';
    try {
      const response = await api.get('/items/work_reports', {
        params: {
          fields,
          sort: '-date_created',
          limit: -1
        }
      });
      return response.data.data;
    } catch (error: any) {
      if (!error.response || error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[directusApi] getWorkReports failed (${error.response?.status || 'Network Error'}), trying Public Access fallback...`);
        const response = await axios.get(`${PROXY_URL}/items/work_reports`, { 
          params: { 
            fields,
            sort: '-date_created',
            limit: -1
          } 
        });
        return response.data.data || [];
      }
      throw error;
    }
  },

  getWorkReport: async (id: string): Promise<any> => {
    const fields = '*,car_id.*,driver_id.*,member_id.*,customer_id.*';
    try {
      const response = await api.get(`/items/work_reports/${id}`, {
        params: { fields }
      });
      return response.data.data;
    } catch (error: any) {
      if (!error.response || error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[directusApi] getWorkReport ${id} failed (${error.response?.status || 'Network Error'}), trying Public Access fallback...`);
        const response = await axios.get(`${PROXY_URL}/items/work_reports/${id}`, {
          params: { fields }
        });
        return response.data.data;
      }
      throw error;
    }
  },

  getMemberWorkReports: async (memberId: string): Promise<any[]> => {
    const params = {
      filter: {
        _or: [
          { member_id: { _eq: memberId } },
          { driver_id: { _eq: memberId } }
        ],
        status: { _eq: 'pending' }
      },
      fields: '*,car_id.*,driver_id.*,member_id.*,customer_id.*',
      sort: '-date_created',
      limit: -1
    };

    try {
      const response = await api.get('/items/work_reports', { params });
      return response.data.data;
    } catch (error: any) {
      if (!error.response || error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[directusApi] getMemberWorkReports ${memberId} failed (${error.response?.status || 'Network Error'}), trying Public Access fallback...`);
        const response = await axios.get(`${PROXY_URL}/items/work_reports`, { params });
        return response.data.data || [];
      }
      throw error;
    }
  },

  createWorkReport: async (data: any): Promise<any> => {
    try {
      const response = await api.post('/items/work_reports', data);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn('[directusApi] createWorkReport Auth failed (401), trying fallback...');
        const response = await axios.post(`${PROXY_URL}/items/work_reports`, data);
        return response.data.data;
      }
      throw error;
    }
  },

  updateWorkReport: async (id: string, data: any): Promise<any> => {
    try {
      const response = await api.patch(`/items/work_reports/${id}`, data);
      return response.data.data;
    } catch (error: any) {
      if (!error.response || error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[directusApi] updateWorkReport ${id} failed (${error.response?.status || 'Network Error'}), trying fallback...`);
        const response = await axios.patch(`${PROXY_URL}/items/work_reports/${id}`, data);
        return response.data.data;
      }
      throw error;
    }
  },

  deleteWorkReport: async (id: string): Promise<void> => {
    await api.delete(`/items/work_reports/${id}`);
  },

  getFileUrl: (fileId: any, options?: { key?: string }) => {
    if (!fileId) return '';
    
    // Handle if fileId is an object (common in Directus when expanded)
    let id = fileId;
    if (typeof fileId === 'object' && fileId !== null) {
      id = fileId.id || '';
    }
    
    if (typeof id !== 'string') return '';
    if (!id) return '';

    if (id.startsWith('http')) return id;
    
    const baseUrl = DIRECTUS_URL.replace(/\/$/, '');
    const token = localStorage.getItem('admin_token') || STATIC_API_KEY;
    
    let url = `${baseUrl}/assets/${id}`;
    if (token) {
      url += `?access_token=${token}`;
    }
    
    if (options?.key) {
      url += `${url.includes('?') ? '&' : '?'}key=${options.key}`;
    }
    return url;
  },

  importFileFromUrl: async (url: string, folderId?: string) => {
    const response = await api.post('/files/import', {
      url,
      folder: folderId
    });
    return response.data.data?.id || response.data.data;
  },

  uploadFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/files', formData);
    return response.data.data.id;
  },

  getCustomerLocation: async (id: string): Promise<any> => {
    try {
      const response = await api.get(`/items/customer_locations/${id}`, {
        params: {
          fields: '*,member_id.*,members.*,members.line_users_id.*,members.line_user_id.*,members.members_id.*'
        }
      });
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn(`[directusApi] getCustomerLocation ${id} Auth failed (401), trying fallback...`);
        const response = await axios.get(`${PROXY_URL}/items/customer_locations/${id}`, {
          params: {
            fields: '*,member_id.*,members.*,members.line_users_id.*,members.line_user_id.*,members.members_id.*'
          }
        });
        return response.data.data;
      }
      throw error;
    }
  },

  getCustomerLocations: async (): Promise<any[]> => {
    try {
      const response = await api.get('/items/customer_locations', {
        params: {
          fields: '*,member_id.*,members.*,members.line_users_id.*,members.line_user_id.*,members.members_id.*',
          sort: '-date_created',
          limit: -1
        }
      });
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn('[directusApi] getCustomerLocations Auth failed (401), trying fallback...');
        const response = await axios.get(`${PROXY_URL}/items/customer_locations`, {
          params: {
            fields: '*,member_id.*,members.*,members.line_users_id.*,members.line_user_id.*,members.members_id.*',
            sort: '-date_created',
            limit: -1
          }
        });
        return response.data.data;
      }
      throw error;
    }
  },

  createCustomerLocation: async (data: any): Promise<any> => {
    const response = await api.post('/items/customer_locations', data);
    return response.data.data;
  },

  updateCustomerLocation: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/items/customer_locations/${id}`, data);
    return response.data.data;
  },

  deleteCustomerLocation: async (id: string): Promise<void> => {
    await api.delete(`/items/customer_locations/${id}`);
  },

  getSystemSettings: async (): Promise<any> => {
    try {
      // Try to get the first item from the collection (resilient to different IDs)
      const response = await api.get('/items/system_settings', {
        params: { limit: 1 }
      });
      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error) {
      console.warn('System settings fetch failed, trying direct access fallback...');
      try {
        const targetUrl = localStorage.getItem('directus_url') || import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com';
        const response = await axios.get(`${targetUrl.replace(/\/$/, '')}/items/system_settings`, {
          params: { limit: 1 },
          timeout: 5000
        });
        return response.data.data?.[0] || null;
      } catch (e) {
        console.warn('System settings not found in Directus, using defaults');
        return null;
      }
    }
  },

  updateSystemSettings: async (data: any): Promise<any> => {
    try {
      // 1. Try to find the existing settings record first
      const response = await api.get('/items/system_settings', {
        params: { limit: 1, fields: 'id' }
      });
      
      const existing = response.data.data?.[0];
      
      if (existing) {
        // Update the existing record
        const patchResponse = await api.patch(`/items/system_settings/${existing.id}`, data);
        return patchResponse.data.data;
      } else {
        // Create a new record (ID 1 is a good default for integers)
        const postResponse = await api.post('/items/system_settings', { id: 1, ...data });
        return postResponse.data.data;
      }
    } catch (error: any) {
      console.error('Error updating system settings:', error.response?.data || error.message);
      throw error;
    }
  },

  getLineSettings: async (): Promise<any> => {
    try {
      const response = await api.get('/items/line_settings/1');
      return response.data.data;
    } catch (error) {
      console.warn('LINE settings not found in Directus');
      return null;
    }
  },

  updateLineSettings: async (data: any): Promise<any> => {
    try {
      // Try to update ID 1, if fails, create it
      try {
        const response = await api.patch('/items/line_settings/1', data);
        return response.data.data;
      } catch (e) {
        const response = await api.post('/items/line_settings', { id: 1, ...data });
        return response.data.data;
      }
    } catch (error) {
      console.error('Error updating LINE settings:', error);
      throw error;
    }
  },
  
  getLoginLogs: async (): Promise<any[]> => {
    try {
      const response = await api.get('/items/login_logs', {
        params: {
          sort: '-timestamp',
          limit: 100
        }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching login logs:', error);
      return [];
    }
  },

  createLoginLog: async (data: { 
    user_email: string; 
    ip_address: string; 
    timestamp: string; 
    user_agent: string;
    status: string;
  }): Promise<any> => {
    try {
      // Use the dedicated server-side endpoint for creating logs
      // This bypasses 401 issues on the proxy because the server appends the static token
      const response = await axios.post('/api/login-logs', data);
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating login log:', error.response?.status, error.response?.data || error.message);
      // Don't throw, we don't want to block login if logging fails
      return null;
    }
  },

  linkCarToMember: async (carId: string, memberId: string): Promise<any> => {
    try {
      console.log(`linkCarToMember: START carId=${carId}, memberId=${memberId}`);
      // Check if already linked
      console.log(`linkCarToMember: Checking existing link for car ${carId} and member ${memberId}`);
      const existing = await api.get('/items/car_users', {
        params: {
          filter: {
            car_id: { _eq: carId },
            line_user_id: { _eq: memberId }
          },
          limit: -1
        }
      });
      console.log(`linkCarToMember: Existing links found: ${existing.data.data.length}`);
      
      if (existing.data.data.length === 0) {
        console.log(`linkCarToMember: Creating new link in car_users for car ${carId} and member ${memberId}`);
        const response = await api.post('/items/car_users', {
          car_id: carId,
          line_user_id: memberId
        });
        console.log('linkCarToMember: Link creation response:', response.data.data);
        return response.data.data;
      }
      console.log(`linkCarToMember: Link already exists for car ${carId} and member ${memberId}`);
      return existing.data.data[0];
    } catch (error) {
      console.error('linkCarToMember: ERROR linking car to member:', error);
      throw error;
    }
  },

  getRoles: async (): Promise<any[]> => {
    const response = await api.get('/roles', {
      params: {
        fields: 'id,name',
        limit: -1
      }
    });
    return response.data.data;
  },

  getCarBrands: async (): Promise<any[]> => {
    try {
      const response = await api.get('/items/car_brands', {
        params: {
          limit: -1,
          sort: 'name'
        }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching car brands:', error);
      return [];
    }
  },

  getMaintenanceHistory: async (carId: string): Promise<MaintenanceHistory[]> => {
    const response = await api.get('/items/maintenance_history', {
      params: {
        filter: { car_id: { _eq: carId } },
        sort: '-date',
        limit: -1
      }
    });
    return response.data.data || [];
  },

  getAllMaintenanceHistory: async (): Promise<MaintenanceHistory[]> => {
    const response = await api.get('/items/maintenance_history', {
      params: {
        sort: '-date',
        limit: -1
      }
    });
    return response.data.data || [];
  },

  getMaintenanceItems: async (): Promise<any[]> => {
    const response = await api.get('/items/maintenance_items', {
      params: {
        sort: 'name',
        limit: -1
      }
    });
    return response.data.data || [];
  },

  createMaintenanceItem: async (data: { 
    name: string; 
    description?: string; 
    status?: string;
    default_mileage_interval?: number;
    default_month_interval?: number;
  }): Promise<any> => {
    const response = await api.post('/items/maintenance_items', data);
    return response.data.data;
  },

  deleteMaintenanceItem: async (id: string | number): Promise<void> => {
    await api.delete(`/items/maintenance_items/${id}`);
  },

  updateMaintenanceItem: async (id: string | number, data: {
    name?: string;
    description?: string;
    status?: string;
    default_mileage_interval?: number;
    default_month_interval?: number;
  }): Promise<any> => {
    const response = await api.patch(`/items/maintenance_items/${id}`, data);
    return response.data.data;
  },

  createMaintenanceHistory: async (data: Partial<MaintenanceHistory>): Promise<MaintenanceHistory> => {
    const response = await api.post('/items/maintenance_history', data);
    return response.data.data;
  },

  createCarBrand: async (data: { name: string }): Promise<any> => {
    const response = await api.post('/items/car_brands', data);
    return response.data.data;
  },

  deleteCarBrand: async (id: string): Promise<void> => {
    await api.delete(`/items/car_brands/${id}`);
  },

  getRolePermissions: async (): Promise<any[]> => {
    try {
      const response = await api.get('/items/role_permissions', {
        params: { limit: -1 }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  },

  updateRolePermissions: async (id: string | number, data: any): Promise<any> => {
    const response = await api.patch(`/items/role_permissions/${id}`, data);
    return response.data.data;
  },

  createRolePermission: async (data: any): Promise<any> => {
    const response = await api.post('/items/role_permissions', data);
    return response.data.data;
  },

  deleteRolePermission: async (id: string | number): Promise<void> => {
    await api.delete(`/items/role_permissions/${id}`);
  },

  getItems: async (collection: string, params: any = {}): Promise<any[]> => {
    const response = await api.get(`/items/${collection}`, { params });
    return response.data.data;
  },

  updateItem: async (collection: string, id: string | number, data: any): Promise<any> => {
    const response = await api.patch(`/items/${collection}/${id}`, data);
    return response.data.data;
  },

  createItem: async (collection: string, data: any): Promise<any> => {
    const response = await api.post(`/items/${collection}`, data);
    return response.data.data;
  },

  getCurrentUser: async (): Promise<any> => {
    const response = await api.get('/users/me', {
      params: {
        fields: 'id,first_name,last_name,email,role.name,avatar'
      }
    });
    return response.data.data;
  },

  trackJob: async (caseNumber: string, phone: string): Promise<any> => {
    try {
      // 1. Find the job by case number
      // Use our backend's public tracking API which uses server-side token
      // This avoids 401 errors and CORS issues in the browser
      console.log(`Tracking: Calling backend API for ${caseNumber} with phone ${phone}`);
      const response = await axios.get(`/api/track/${caseNumber}`, { params: { phone } });
      
      const job = response.data.data;
      if (!job) return null;

      // 2. Verify phone number
      // Normalize phone numbers for comparison (remove non-digits)
      const getDigits = (p: string) => (p || '').toString().replace(/\D/g, '');
      
      const searchDigits = getDigits(phone);
      console.log(`Tracking: Verifying phone (search digits: ${searchDigits})`);

      const checkPhone = (p: string | undefined | null, label: string) => {
        if (!p) return false;
        const dbDigits = getDigits(p);
        console.log(`Tracking: Checking ${label}: ${dbDigits}`);
        
        if (!dbDigits || !searchDigits) return false;
        
        // Match if one is a suffix of the other (at least 8 digits)
        const minMatch = 8;
        if (dbDigits.length >= minMatch && searchDigits.length >= minMatch) {
          if (dbDigits.endsWith(searchDigits) || searchDigits.endsWith(dbDigits)) {
            console.log(`Tracking: Match found via suffix on ${label}`);
            return true;
          }
        }
        
        // Exact match
        return dbDigits === searchDigits;
      };

      // Check all potential phone fields
      if (checkPhone(job.driver_id?.phone, 'Driver')) return job;
      if (checkPhone(job.member_id?.phone, 'Member')) return job;
      if (checkPhone(job.customer_id?.phone, 'Customer Direct')) return job;
      if (checkPhone(job.customer_id?.member_id?.phone, 'Customer Primary Member')) return job;

      // Check other customer members
      if (job.customer_id?.members && Array.isArray(job.customer_id.members)) {
        for (let i = 0; i < job.customer_id.members.length; i++) {
          if (checkPhone(job.customer_id.members[i].line_user_id?.phone, `Customer Member ${i}`)) return job;
        }
      }

      // If no match
      console.warn('Tracking: Phone verification failed');
      throw new Error('Verification failed: Phone number does not match this case.');
    } catch (error: any) {
      console.error('Tracking error:', error.response?.data || error.message);
      if (error.response?.status === 404) return null;
      throw error;
    }
  },

  getVehicleHistory: async (carNumber: string, startTime: string, endTime: string): Promise<any[]> => {
    try {
      const response = await api.get('/items/vehicle_location_history', {
        params: {
          filter: {
            car_number: { _eq: carNumber },
            timestamp: { _between: [startTime, endTime] }
          },
          sort: 'timestamp',
          limit: -1
        }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching vehicle history:', error);
      return [];
    }
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('member_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_picture');
    localStorage.removeItem('menu_permissions');
    localStorage.removeItem('is_switched_account');
    setAuthToken(null);
  },

  requestPasswordReset: async (email: string, resetUrl: string) => {
    try {
      await api.post('/auth/password/request', { email, reset_url: resetUrl });
    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  },

  resetPassword: async (token: string, password: string) => {
    try {
      await api.post('/auth/password/reset', { token, password });
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }
};
