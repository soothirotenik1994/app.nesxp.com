import axios from 'axios';
import { Member, Car, CarPermission, AdminUser } from '../types';

export const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL || 'https://data.nesxp.com';
export const STATIC_API_KEY = import.meta.env.VITE_DIRECTUS_STATIC_TOKEN || '1US7kkCXks43DIJBn0XZlc0nQhAWA9x0';

export const api = axios.create({
  baseURL: DIRECTUS_URL,
});

// Set auth token if available
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    // If no admin token, use the static API key for staff access
    api.defaults.headers.common['Authorization'] = `Bearer ${STATIC_API_KEY}`;
  }
};

// Add request interceptor to ensure token is always sent
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
      // console.log('Using admin token:', token.substring(0, 5) + '...');
    } else {
      // Use static key if no admin token
      config.headers.Authorization = `Bearer ${STATIC_API_KEY}`;
      // console.log('Using static API key');
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
      localStorage.removeItem('admin_token');
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
        fields: '*,car_users.*,car_users.line_user_id.*',
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
        fields: '*,role.name'
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
        fields: '*,car_id.*,driver_id.*,customer_id.*,customer_id.member_id.*,customer_id.members.*,customer_id.members.line_user_id.*',
        sort: '-date_created'
      }
    });
    return response.data.data;
  },

  getWorkReport: async (id: string): Promise<any> => {
    const response = await api.get(`/items/work_reports/${id}`, {
      params: {
        fields: '*,car_id.*,driver_id.*,customer_id.*,customer_id.member_id.*,customer_id.members.*,customer_id.members.line_user_id.*'
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

  getFileUrl: (fileId: string, options?: { key?: string }) => {
    if (!fileId) return '';
    if (fileId.startsWith('http')) return fileId;
    const baseUrl = DIRECTUS_URL.replace(/\/$/, '');
    let url = `${baseUrl}/assets/${fileId}?access_token=${STATIC_API_KEY}`;
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

  uploadFile: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
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
        sort: '-date_created'
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

  linkCarToMember: async (carId: string, memberId: string): Promise<any> => {
    try {
      // Check if already linked
      const existing = await api.get('/items/car_users', {
        params: {
          filter: {
            car_id: { _eq: carId },
            line_user_id: { _eq: memberId }
          }
        }
      });
      
      if (existing.data.data.length === 0) {
        return await api.post('/items/car_users', {
          car_id: carId,
          line_user_id: memberId
        });
      }
      return existing.data.data[0];
    } catch (error) {
      console.error('Error linking car to member:', error);
      throw error;
    }
  },

  getRoles: async (): Promise<any[]> => {
    const response = await api.get('/roles', {
      params: {
        fields: 'id,name'
      }
    });
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
};
