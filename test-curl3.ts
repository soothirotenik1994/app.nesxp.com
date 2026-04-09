import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', {
      maxRedirects: 10,
      headers: {
        'User-Agent': 'curl/7.68.0',
      }
    });
    console.log('Final URL:', response.request.res.responseUrl);
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
