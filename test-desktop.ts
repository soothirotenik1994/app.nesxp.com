import axios from 'axios';

async function test() {
  try {
    const response = await axios.get('https://maps.app.goo.gl/9uiMcYSaE5LSfxJt5', {
      maxRedirects: 10,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = response.data;
    const matches = html.match(/-?\d+\.\d{4,}/g);
    if (matches) {
      const unique = [...new Set(matches)];
      console.log(unique.slice(0, 20));
    }
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
