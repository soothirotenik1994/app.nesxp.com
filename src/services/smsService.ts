import axios from 'axios';

export const smsService = {
  sendSms: async (msisdn: string | string[], message: string) => {
    try {
      const response = await axios.post('/api/sms/send', {
        msisdn,
        message
      });
      return response.data;
    } catch (error) {
      console.error('Error in smsService.sendSms:', error);
      throw error;
    }
  }
};
