import axios from 'axios';
import { CarStatus } from '../types';

// Mocking the GPS API since it's an external SOAP/Servlet API that might have CORS issues in browser
// In a real app, this might need a proxy or specific CORS headers
export const gpsApi = {
  getCarStatus: async (carNumber: string): Promise<CarStatus> => {
    try {
      // Call our backend proxy to avoid CORS
      const response = await axios.get(`/api/proxy/gps/${carNumber}`);
      let data = response.data;

      // Handle array response
      if (Array.isArray(data)) {
        data = data[0];
      }

      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        throw new Error(`No data returned for vehicle ${carNumber}`);
      }

      // Map the response to our CarStatus type
      // We handle various common field names in case the API returns different ones
      const rawStatus = (data.status || data.Status || data.STATUS || '').toString().toLowerCase();
      const speed = parseFloat(data.speed || data.Speed || data.SPEED || 0);
      
      let normalizedStatus: 'online' | 'offline' = 'offline';
      if (rawStatus === 'online' || rawStatus === 'moving' || rawStatus === 'running' || rawStatus === '1' || rawStatus === 'active') {
        normalizedStatus = 'online';
      } else if (rawStatus === 'offline' || rawStatus === 'stopped' || rawStatus === '0' || rawStatus === 'inactive') {
        normalizedStatus = 'offline';
      } else {
        // Fallback to speed if status is unknown or missing
        normalizedStatus = speed > 0 ? 'online' : 'offline';
      }

      return {
        carNumber: data.carNumber || data.car_number || data.CarNumber || carNumber,
        lat: parseFloat(data.lat || data.latitude || data.Lat || data.LATITUDE || 0),
        lng: parseFloat(data.lng || data.longitude || data.Lng || data.LONGITUDE || 0),
        speed: speed,
        address: data.address || data.Address || data.ADDRESS || "Location data available",
        lastUpdate: data.lastUpdate || data.last_update || data.Time || data.TIME || data.LAST_UPDATE || new Date().toISOString(),
        status: normalizedStatus
      };
    } catch (error: any) {
      console.error(`Error fetching status for ${carNumber}:`, error.message);
      throw error;
    }
  }
};
