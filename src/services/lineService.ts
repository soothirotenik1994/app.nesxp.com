import axios from 'axios';

export const lineService = {
  sendPushMessage: async (to: string, message: any) => {
    try {
      const response = await axios.post('/api/line/send', {
        to,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Error in lineService.sendPushMessage:', error);
      throw error;
    }
  }
};
