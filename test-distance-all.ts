import axios from 'axios';

async function test() {
  const urls = [
    'https://maps.app.goo.gl/XfVvfeXu5SHrxtnf8',
    'https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5',
    'https://maps.app.goo.gl/MrpfCZpLAkK7zZ1B9',
    'https://maps.app.goo.gl/zZPRZRCfvjtjTS277',
    'https://maps.app.goo.gl/bprVGTPw1gJPkHjk6'
  ];

  for (const url of urls) {
    try {
      const response = await axios.post('http://localhost:3000/api/calculate-distance', {
        originUrl: url,
        destinationUrl: url
      });
      console.log('Result for', url, ':', response.data.originCoords);
    } catch (e: any) {
      console.error('Error for', url, ':', e.response?.data || e.message);
    }
  }
}

test();
