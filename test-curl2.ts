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
      const response = await axios.get(url, {
        maxRedirects: 10,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
        }
      });
      console.log('Final URL for', url, ':', response.request.res.responseUrl);
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

test();
