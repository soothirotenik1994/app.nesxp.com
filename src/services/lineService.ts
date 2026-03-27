import axios from 'axios';

export const lineService = {
  sendPushMessage: async (to: string, messages: any[]) => {
    try {
      const response = await axios.post('/api/line/send', {
        to,
        messages
      });
      return response.data;
    } catch (error: any) {
      // If it's a 429 (Too Many Requests) or the limit is reached, don't log as error and don't throw
      if (error.response?.status === 429 || error.response?.data?.limitReached) {
        console.warn('LINE monthly limit reached, notification skipped.');
        
        // Dispatch custom event to notify UI
        window.dispatchEvent(new CustomEvent('line-limit-reached', { 
          detail: { message: error.response?.data?.error || 'LINE monthly limit reached' } 
        }));
        
        // Also store in localStorage to persist across page reloads
        localStorage.setItem('line_limit_reached', 'true');
        
        return { success: false, error: 'limit_reached', message: error.response?.data?.error };
      }
      
      console.error('Error in lineService.sendPushMessage:', error);
      throw error;
    }
  }
};
