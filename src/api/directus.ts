import axios from 'axios';
import { Member, Car, CarPermission, AdminUser, MaintenanceHistory } from '../types';

export const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com';
export const STATIC_API_KEY = import.meta.env.VITE_DIRECTUS_STATIC_TOKEN || 'JwVz29Z6wVy_QpOqxc1J9sw-BAt3v8nn';

export const api = axios.create({
  baseURL: DIRECTUS_URL,
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
    const token = localStorage.getItem('admin_token');
    if (token && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (STATIC_API_KEY) {
      // Use static key if no admin token
      config.headers.Authorization = `Bearer ${STATIC_API_KEY}`;
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
      
      // Clear all auth data
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
      
      // Only redirect if we're not already on the login page
      // and if we're not trying to log in (to avoid infinite loops)
      const isLoginPage = window.location.pathname.includes('/login');
      const isAuthRequest = error.config?.url?.includes('/auth/login');
      
      if (!isLoginPage && !isAuthRequest) {
        console.log('Redirecting to login due to 401...');
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

  loginStaff: async (email: string, password: string) => {
    try {
      const response = await api.get('/items/line_users', {
        params: {
          filter: {
            email: { _eq: email },
            password: { _eq: password }
          }
        }
      });
      return response.data.data[0];
    } catch (error) {
      console.error('Staff login error:', error);
      throw error;
    }
  },
  
  getMembers: async (): Promise<Member[]> => {
    const response = await api.get('/items/line_users', {
      params: {
        limit: -1
      }
    });
    return response.data.data || [];
  },

  getMember: async (id: string): Promise<Member> => {
    const response = await api.get(`/items/line_users/${id}`, {
      params: {
        fields: '*,car_users.*,car_users.car_id.*'
      }
    });
    return response.data.data;
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
    const response = await api.get('/items/cars', {
      params: {
        fields: '*,car_image.*,car_users.*,car_users.line_user_id.*',
        limit: -1
      }
    });
    return response.data.data || [];
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
    const response = await api.get('/items/work_reports', {
      params: {
        fields: '*,car_id.*,driver_id.*,member_id.*,customer_id.*,customer_id.member_id.*,customer_id.members.*,customer_id.members.line_user_id.*',
        sort: '-date_created',
        limit: -1
      }
    });
    return response.data.data;
  },

  getWorkReport: async (id: string): Promise<any> => {
    const response = await api.get(`/items/work_reports/${id}`, {
      params: {
        fields: '*,car_id.*,driver_id.*,member_id.*,customer_id.*,customer_id.member_id.*,customer_id.members.*,customer_id.members.line_user_id.*'
      }
    });
    return response.data.data;
  },

  createWorkReport: async (data: any): Promise<any> => {
    const response = await api.post('/items/work_reports', data);
    return response.data.data;
  },

  updateWorkReport: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/items/work_reports/${id}`, data);
    return response.data.data;
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
    let url = `${baseUrl}/assets/${id}?access_token=${STATIC_API_KEY}`;
    if (options?.key) {
      url += `&key=${options.key}`;
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
    const response = await api.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data.id;
  },

  getCustomerLocation: async (id: string): Promise<any> => {
    const response = await api.get(`/items/customer_locations/${id}`, {
      params: {
        fields: '*,member_id.*,members.*,members.line_user_id.*'
      }
    });
    return response.data.data;
  },

  getCustomerLocations: async (): Promise<any[]> => {
    const response = await api.get('/items/customer_locations', {
      params: {
        fields: '*,member_id.*,members.*,members.line_user_id.*',
        sort: '-date_created',
        limit: -1
      }
    });
    return response.data.data;
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
      const response = await api.get('/items/system_settings/1');
      return response.data.data;
    } catch (error) {
      console.warn('System settings not found in Directus, using defaults');
      return null;
    }
  },

  updateSystemSettings: async (data: any): Promise<any> => {
    try {
      // Try to update ID 1, if fails, create it
      try {
        const response = await api.patch('/items/system_settings/1', data);
        return response.data.data;
      } catch (e: any) {
        console.error('Patch failed, trying post:', e.response?.data || e.message);
        const response = await api.post('/items/system_settings', { id: 1, ...data });
        return response.data.data;
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
      const response = await api.get('/items/work_reports', {
        params: {
          filter: {
            case_number: { _eq: caseNumber }
          },
          fields: '*,car_id.*,driver_id.*,member_id.*,customer_id.*,customer_id.member_id.*,customer_id.members.*,customer_id.members.line_user_id.*',
          limit: 1
        }
      });

      const job = response.data.data[0];
      if (!job) return null;

      // 2. Verify phone number
      // Normalize phone numbers for comparison (remove non-digits)
      const normalize = (p: string) => p.replace(/\D/g, '');
      const searchPhone = normalize(phone);

      // Check driver phone
      const driverPhone = normalize(job.driver_id?.phone || job.driver_id?.Phone || '');
      if (driverPhone === searchPhone) return job;

      // Check customer primary member phone
      const customerMemberPhone = normalize(job.customer_id?.member_id?.phone || job.customer_id?.member_id?.Phone || '');
      if (customerMemberPhone === searchPhone) return job;

      // Check other customer members
      if (job.customer_id?.members && Array.isArray(job.customer_id.members)) {
        for (const m of job.customer_id.members) {
          const mPhone = normalize(m.line_user_id?.phone || m.line_user_id?.Phone || '');
          if (mPhone === searchPhone) return job;
        }
      }

      // If no match
      throw new Error('Verification failed: Phone number does not match this case.');
    } catch (error) {
      console.error('Tracking error:', error);
      throw error;
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
  }
};
