import axios from 'axios';
import { directusApi } from '../api/directus';

export const lineService = {
  sendPushMessage: async (to: string, messages: any[]) => {
    try {
      const response = await axios.post('/api/line/send', {
        to,
        messages
      });
      return response.data;
    } catch (error: any) {
      console.error('Error in lineService.sendPushMessage:', error);
      
      const errorData = error.response?.data?.details || error.message;
      const errorString = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
      
      if (errorString && (errorString.includes("You have reached your monthly limit.") || errorString.includes("monthly limit"))) {
        const alertMessage = `LINE error: You have reached your monthly limit. Please check your LINE Official Account plan.`;
        window.dispatchEvent(new CustomEvent('system-alert', { 
          detail: { message: alertMessage, type: 'error' } 
        }));

        // Fallback: Create a system notification in Directus
        try {
          await directusApi.createItem('admin_notifications', {
            message: `LINE Notification Failed: Monthly limit reached. Message intended for ${to}: ${JSON.stringify(messages)}`,
            type: 'error',
            is_read: false,
            created_at: new Date().toISOString()
          });
          console.log('Admin notified via Directus mailbox (admin_notifications)');
        } catch (fallbackErr) {
          console.error('Failed to create fallback notification in Directus:', fallbackErr);
        }
        return false; // Return false instead of throwing
      }
      
      throw error;
    }
  },

  broadcastMessage: async (to: string[], messages: any[]) => {
    try {
      const response = await axios.post('/api/line/broadcast', {
        to,
        messages
      });
      return response.data;
    } catch (error: any) {
      console.error('Error in lineService.broadcastMessage:', error);
      
      const errorData = error.response?.data?.details || error.message;
      const errorString = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);

      if (errorString && (errorString.includes("You have reached your monthly limit.") || errorString.includes("monthly limit"))) {
        const alertMessage = `LINE error: You have reached your monthly limit. Please check your LINE Official Account plan.`;
        window.dispatchEvent(new CustomEvent('system-alert', { 
          detail: { message: alertMessage, type: 'error' } 
        }));

        // Fallback: Create a system notification in Directus
        try {
          await directusApi.createItem('admin_notifications', {
            message: `LINE Broadcast Failed: Monthly limit reached. Broadcast intended for ${to.length} recipients.`,
            type: 'error',
            is_read: false,
            created_at: new Date().toISOString()
          });
          console.log('Admin notified via Directus mailbox (admin_notifications)');
        } catch (fallbackErr) {
          console.error('Failed to create fallback notification in Directus:', fallbackErr);
        }
        return false; // Return false instead of throwing
      }
      
      throw error;
    }
  }
};
