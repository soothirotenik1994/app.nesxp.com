import axios from 'axios';

async function test() {
  try {
    let url = 'https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5';
    for (let i = 0; i < 5; i++) {
      const response = await axios.get(url, {
        maxRedirects: 0,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      console.log(`Step ${i}:`, response.status, response.headers.location || 'No location');
      if (response.headers.location) {
        url = response.headers.location;
      } else {
        break;
      }
    }
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
