import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5?_imcp=1', {
      maxRedirects: 10,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    });
    console.log('Final URL:', response.request.res.responseUrl);
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
